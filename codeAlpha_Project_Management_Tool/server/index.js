require('dotenv').config();
require('express-async-errors');
const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'dev-only-secret-change-me';
  console.warn('[warn] JWT_SECRET not set, using an insecure development default.');
}
const auth = require('./middleware');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true }, maxHttpBufferSize: 1e6 });
app.set('trust proxy', 1);

// Camera/mic/screen-capture are explicitly allowed for our own origin; everything else locked down.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      'connect-src': ["'self'", 'ws:', 'wss:'],
      'media-src': ["'self'", 'blob:'],
      'img-src': ["'self'", 'data:', 'blob:']
    }
  }
}));
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), display-capture=(self)');
  next();
});
app.use(cors());
app.use(express.json({ limit: '50kb' }));

// ---- REST: auth, ICE config, encrypted file relay ----
app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false }), require('./routes/auth'));

app.get('/api/config', (req, res) => {
  const iceServers = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];
  if (process.env.TURN_URL) iceServers.push({ urls: process.env.TURN_URL, username: process.env.TURN_USER, credential: process.env.TURN_PASS });
  res.json({ iceServers });
});

// Files arrive already encrypted in the browser (AES-256-GCM); the server only ever stores ciphertext.
const UPLOAD_DIR = path.join(__dirname, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const MAX_FILE = 25 * 1024 * 1024;
app.post('/api/files', auth, rateLimit({ windowMs: 60 * 1000, max: 20 }),
  express.raw({ type: 'application/octet-stream', limit: MAX_FILE + 64 }),
  async (req, res) => {
    if (!Buffer.isBuffer(req.body) || req.body.length < 29) return res.status(400).json({ error: 'Invalid upload' });
    const id = crypto.randomBytes(16).toString('hex');
    await fs.promises.writeFile(path.join(UPLOAD_DIR, id), req.body);
    res.status(201).json({ id });
  });
app.get('/api/files/:id', auth, (req, res) => {
  if (!/^[a-f0-9]{32}$/.test(req.params.id)) return res.status(400).json({ error: 'Bad id' });
  const file = path.join(UPLOAD_DIR, req.params.id);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'File expired or not found' });
  res.type('application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
// Auto-delete shared files after 2 hours.
setInterval(() => {
  fs.readdir(UPLOAD_DIR, (err, files) => {
    if (err) return;
    for (const f of files) {
      const p = path.join(UPLOAD_DIR, f);
      fs.stat(p, (e, s) => { if (!e && Date.now() - s.mtimeMs > 2 * 3600 * 1000) fs.unlink(p, () => {}); });
    }
  });
}, 10 * 60 * 1000).unref();

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'File too large (max 25 MB)' });
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

// ---- Signaling server (Socket.io). Media flows peer-to-peer; chat/files are E2E-encrypted ciphertext. ----
const rooms = new Map();   // roomId -> Map(socketId -> {name})
const boards = new Map();  // roomId -> whiteboard segments (for late joiners)
const MAX_PEERS = 8;       // full-mesh WebRTC scales to roughly 6-8 participants
const ROOM = /^[a-zA-Z0-9_-]{3,40}$/;
const isStr = (v, n) => typeof v === 'string' && v.length <= n;

io.use((socket, next) => {
  try {
    const u = jwt.verify(socket.handshake.auth.token, process.env.JWT_SECRET);
    socket.userId = u.id; socket.userName = u.name;
    next();
  } catch { next(new Error('unauthorized')); }
});

io.on('connection', (socket) => {
  const leave = () => {
    const id = socket.roomId;
    if (!id) return;
    const room = rooms.get(id);
    if (room) {
      room.delete(socket.id);
      socket.to(id).emit('peer-left', { id: socket.id });
      if (!room.size) { rooms.delete(id); boards.delete(id); }
    }
    socket.leave(id);
    socket.roomId = null;
  };

  socket.on('join', ({ roomId } = {}) => {
    if (!ROOM.test(roomId || '')) return;
    leave();
    const room = rooms.get(roomId) || new Map();
    if (room.size >= MAX_PEERS) return socket.emit('room-full');
    const peers = [...room].map(([id, p]) => ({ id, name: p.name }));
    room.set(socket.id, { name: socket.userName });
    rooms.set(roomId, room);
    socket.join(roomId);
    socket.roomId = roomId;
    socket.emit('joined', { peers, history: boards.get(roomId) || [] });
    socket.to(roomId).emit('peer-joined', { id: socket.id, name: socket.userName });
  });

  // WebRTC offer/answer/ICE relay (only between peers in the same room)
  socket.on('signal', ({ to, data } = {}) => {
    const room = rooms.get(socket.roomId);
    if (room && room.has(to) && data) io.to(to).emit('signal', { from: socket.id, data });
  });

  // Encrypted chat: {iv, ct} are base64 ciphertext; the server cannot read them.
  socket.on('chat', (m = {}) => {
    if (!socket.roomId || !isStr(m.iv, 64) || !isStr(m.ct, 12000)) return;
    socket.to(socket.roomId).emit('chat', { from: socket.userName, iv: m.iv, ct: m.ct, ts: Date.now() });
  });
  socket.on('file', (m = {}) => {
    if (!socket.roomId || !/^[a-f0-9]{32}$/.test(m.id || '') || !m.meta || !isStr(m.meta.iv, 64) || !isStr(m.meta.ct, 4000)) return;
    socket.to(socket.roomId).emit('file', { from: socket.userName, id: m.id, meta: m.meta });
  });

  // Whiteboard
  socket.on('draw', (s = {}) => {
    const id = socket.roomId;
    const nums = ['x0', 'y0', 'x1', 'y1', 'size'];
    if (!id || !nums.every((k) => Number.isFinite(s[k])) || !/^#[0-9a-f]{6}$/i.test(s.color || '')) return;
    const seg = { x0: s.x0, y0: s.y0, x1: s.x1, y1: s.y1, size: Math.min(Math.max(s.size, 1), 40), color: s.color, erase: !!s.erase };
    const h = boards.get(id) || [];
    if (h.length < 20000) h.push(seg);
    boards.set(id, h);
    socket.to(id).emit('draw', seg);
  });
  socket.on('board-clear', () => {
    if (!socket.roomId) return;
    boards.set(socket.roomId, []);
    socket.to(socket.roomId).emit('board-clear');
  });

  // Camera/mic state so peers can show an avatar instead of a black frame
  socket.on('media-state', (m = {}) => {
    if (socket.roomId) socket.to(socket.roomId).emit('media-state', { id: socket.id, cam: !!m.cam, mic: !!m.mic });
  });

  // Reactions and raised hands (allow-listed so clients can't inject arbitrary content)
  const EMOJI = ['👍', '👏', '❤️', '😂', '🎉', '😮'];
  socket.on('reaction', (e) => {
    if (socket.roomId && EMOJI.includes(e)) socket.to(socket.roomId).emit('reaction', { id: socket.id, emoji: e });
  });
  socket.on('hand', (up) => {
    if (socket.roomId) socket.to(socket.roomId).emit('hand', { id: socket.id, up: !!up });
  });

  socket.on('leave-room', leave);
  socket.on('disconnect', leave);
});

const PORT = process.env.PORT || 5000;
mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/meetsphere')
  .then(() => server.listen(PORT, () => console.log(`MeetSphere running on http://localhost:${PORT}`)))
  .catch((e) => { console.error('MongoDB connection failed:', e.message); process.exit(1); });
