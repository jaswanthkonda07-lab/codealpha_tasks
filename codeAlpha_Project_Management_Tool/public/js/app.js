import { deriveKey, encryptText, decryptText, encryptBytes, decryptBytes } from './crypto.js';
import { Whiteboard } from './whiteboard.js';

const $ = (s) => document.querySelector(s);
const state = {
  token: localStorage.getItem('ms_token'), user: JSON.parse(localStorage.getItem('ms_user') || 'null'),
  socket: null, key: null, roomId: null, joined: false,
  local: null, camTrack: null, micTrack: null, screenTrack: null,
  peers: new Map(), tiles: new Map(), ice: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }, board: null
};

/* ---------- helpers ---------- */
function el(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null) e.append(kid instanceof Node ? kid : String(kid));
  return e;
}
function toast(msg, type = '') {
  const t = el('div', { class: 'toast ' + type }, msg);
  $('#toasts').append(t);
  setTimeout(() => t.remove(), 4000);
}
const show = (id) => document.querySelectorAll('.view').forEach((v) => { v.hidden = v.id !== id; });
const cleanRoom = (s) => (s || '').trim().replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 40);
const randomRoom = () => { const a = new Uint8Array(5); crypto.getRandomValues(a); return [...a].map((b) => b.toString(36).padStart(2, '0')).join('').slice(0, 8); };
const fmtSize = (n) => (n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
async function api(method, url, body) {
  const res = await fetch('/api' + url, {
    method, headers: { 'Content-Type': 'application/json', ...(state.token ? { Authorization: 'Bearer ' + state.token } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

/* ---------- auth ---------- */
let mode = 'login';
document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => {
  mode = t.dataset.mode;
  document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === t));
  $('#aName').hidden = mode === 'login';
  $('#aSubmit').textContent = mode === 'login' ? 'Sign in' : 'Create account';
  $('#aErr').textContent = '';
}));
$('#authForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#aSubmit').disabled = true;
  $('#aErr').textContent = '';
  try {
    const d = await api('POST', '/auth/' + mode, { name: $('#aName').value, email: $('#aEmail').value, password: $('#aPass').value });
    state.token = d.token; state.user = d.user;
    localStorage.setItem('ms_token', d.token);
    localStorage.setItem('ms_user', JSON.stringify(d.user));
    enterLobby();
  } catch (err) { $('#aErr').textContent = err.message; }
  $('#aSubmit').disabled = false;
});
function logout() {
  leaveRoom(false);
  stopLocal();
  state.token = null; state.user = null;
  localStorage.removeItem('ms_token'); localStorage.removeItem('ms_user');
  show('authView');
}
$('#logoutBtn').addEventListener('click', logout);

/* ---------- lobby / local media ---------- */
async function getLocalMedia() {
  const tries = [{ video: { width: 1280, height: 720 }, audio: true }, { video: false, audio: true }, { video: true, audio: false }];
  for (const c of tries) {
    try { return await navigator.mediaDevices.getUserMedia(c); } catch { /* try next */ }
  }
  return null;
}
async function enterLobby() {
  show('lobbyView');
  $('#lUser').textContent = state.user.name;
  const hash = location.hash.match(/room=([\w-]+)/);
  if (hash) $('#roomId').value = hash[1];
  if (!state.local) {
    state.local = await getLocalMedia();
    if (!state.local) $('#previewMsg').textContent = 'No camera or microphone available. You can still join and watch.';
  }
  if (state.local) {
    state.camTrack = state.local.getVideoTracks()[0] || null;
    state.micTrack = state.local.getAudioTracks()[0] || null;
    $('#preview').srcObject = state.local;
    startMeter(state.local);
    if (!state.camTrack) $('#previewMsg').textContent = 'Camera unavailable, joining with audio only.';
  }
}
function stopLocal() {
  if (state.local) state.local.getTracks().forEach((t) => t.stop());
  stopMeter();
  state.local = null; state.camTrack = null; state.micTrack = null;
  $('#preview').srcObject = null;
}
$('#newRoom').addEventListener('click', () => { $('#roomId').value = randomRoom(); });

/* ---------- joining a room ---------- */
$('#joinBtn').addEventListener('click', async () => {
  if (!window.isSecureContext) return toast('Camera, screen share and encryption need HTTPS (or localhost).', 'error');
  const roomId = cleanRoom($('#roomId').value) || randomRoom();
  if (roomId.length < 3) return toast('Room code must be at least 3 characters.', 'error');
  $('#joinBtn').disabled = true;
  try {
    state.roomId = roomId;
    state.key = await deriveKey($('#passcode').value || roomId, roomId);
    try { const cfg = await api('GET', '/config'); if (cfg.iceServers) state.ice = cfg; } catch { /* use default STUN */ }
    location.hash = 'room=' + roomId;
    $('#roomLabel').textContent = 'Room: ' + roomId;
    $('#grid').replaceChildren(); $('#msgs').replaceChildren(); $('#fileList').replaceChildren();
    state.tiles.clear();
    stopMeter();
    show('roomView');
    startTimer();
    addTile('local', state.user.name + ' (You)', state.local, true);
    if (!state.board) state.board = new Whiteboard($('#wb'), (s) => state.socket && state.socket.emit('draw', s));
    connectSocket();
    $('#handBtn').classList.remove('on');
    syncButtons();
  } catch (e) { toast(e.message, 'error'); }
  $('#joinBtn').disabled = false;
});

function connectSocket() {
  const s = io({ auth: { token: state.token } });
  state.socket = s;
  s.on('connect', () => {
    if (state.joined) { closeAllPeers(); }
    s.emit('join', { roomId: state.roomId });
    state.joined = true;
  });
  s.on('connect_error', (e) => { if (e.message === 'unauthorized') { toast('Session expired, please sign in again.', 'error'); logout(); } });
  s.on('disconnect', () => toast('Connection lost, reconnecting…', 'error'));
  s.on('room-full', () => { toast('This room is full (max 8 participants).', 'error'); leaveRoom(true); });
  s.on('joined', ({ peers, history }) => {
    peers.forEach((p) => createPeer(p.id, p.name, true));
    state.board.clear();
    history.forEach((seg) => state.board.draw(seg));
    updateCount();
    sendMediaState();
  });
  s.on('peer-joined', ({ id, name }) => { createPeer(id, name, false); sysMsg(name + ' joined'); sendMediaState(); });
  s.on('peer-left', ({ id }) => { const p = state.peers.get(id); if (p) sysMsg(p.name + ' left'); closePeer(id); });
  s.on('signal', onSignal);
  s.on('media-state', ({ id, cam, mic }) => {
    const t = state.tiles.get(id);
    if (!t) return;
    t.el.classList.toggle('novideo', !cam);
    t.mic.hidden = mic;
    t.cam = cam; t.micOn = mic;
    renderPeople();
  });
  s.on('chat', async (m) => {
    let text;
    try { text = await decryptText(state.key, m); } catch { text = '🔒 Could not decrypt (different passcode?)'; }
    addMsg(m.from, text, false, text.startsWith('🔒 Could'));
    bumpUnread();
  });
  s.on('file', async (m) => {
    try { addFile(m.id, JSON.parse(await decryptText(state.key, m.meta)), m.from); }
    catch { sysMsg('A file was shared but could not be decrypted (passcode mismatch).'); }
  });
  s.on('draw', (seg) => state.board.draw(seg));
  s.on('board-clear', () => state.board.clear());
  s.on('reaction', ({ emoji }) => floatEmoji(emoji));
  s.on('hand', ({ id, up }) => {
    const t = state.tiles.get(id);
    if (!t) return;
    t.handUp = up; t.hand.hidden = !up; renderPeople();
    if (up) toast(t.name + ' raised a hand ✋');
  });
}
function sendMediaState() {
  if (!state.socket) return;
  state.socket.emit('media-state', { cam: !!state.camTrack && state.camTrack.enabled, mic: !!state.micTrack && state.micTrack.enabled });
  const lt = state.tiles.get('local');
  if (lt && lt.handUp) state.socket.emit('hand', true);
}

/* ---------- tiles ---------- */
function addTile(id, name, stream, isLocal = false) {
  const video = el('video', { autoplay: true, playsinline: true });
  if (isLocal) video.muted = true;
  video.srcObject = stream || null;
  const mic = el('span', { class: 'muted-ico' }, '🔇');
  mic.hidden = true;
  const hand = el('span', { class: 'hand-ico' }, '✋');
  hand.hidden = true;
  const wrap = el('div', { class: 'tile' + (isLocal ? ' mirror' : ''), title: 'Click to pin / unpin', onclick: () => togglePin(id) },
    el('div', { class: 'avatar' }, (name || '?')[0].toUpperCase()), video, el('span', { class: 'name' }, name), mic, hand);
  $('#grid').append(wrap);
  const tile = { el: wrap, video, mic, hand, name, cam: true, micOn: true, handUp: false };
  state.tiles.set(id, tile);
  if (isLocal && stream && stream.getAudioTracks().length) watchSpeaking(stream, wrap);
  if (isLocal && !state.camTrack) wrap.classList.add('novideo');
  renderPeople();
  return tile;
}
function togglePin(id) {
  const t = state.tiles.get(id);
  if (!t) return;
  const was = t.el.classList.contains('pinned');
  state.tiles.forEach((x) => x.el.classList.remove('pinned'));
  if (!was) t.el.classList.add('pinned');
  $('#grid').classList.toggle('spot', !was);
}
function renderPeople() {
  const box = $('#peopleList');
  if (!box) return;
  box.replaceChildren(...[...state.tiles.values()].map((t) => el('div', { class: 'person' },
    el('span', { class: 'pav' }, (t.name || '?')[0].toUpperCase()), el('b', {}, t.name),
    el('span', { class: 'pst' }, (t.handUp ? '✋ ' : '') + (t.micOn ? '' : '🔇 ') + (t.cam ? '' : '🚫')))));
}
function watchSpeaking(stream, tileEl) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const an = ctx.createAnalyser();
    an.fftSize = 256;
    ctx.createMediaStreamSource(stream).connect(an);
    const buf = new Uint8Array(an.frequencyBinCount);
    const tick = () => {
      if (!tileEl.isConnected) { ctx.close(); return; }
      an.getByteFrequencyData(buf);
      tileEl.classList.toggle('speaking', buf.reduce((a, b) => a + b, 0) / buf.length > 18);
      requestAnimationFrame(tick);
    };
    tick();
  } catch { /* analyser unsupported */ }
}
function updateCount() { $('#peerCount').textContent = state.peers.size + 1 + ' in call'; }

/* ---------- WebRTC (full mesh) ---------- */
function createPeer(id, name, initiator) {
  if (state.peers.has(id)) return state.peers.get(id);
  const pc = new RTCPeerConnection(state.ice);
  const remote = new MediaStream();
  const tile = addTile(id, name, remote);
  const peer = { pc, name, remote, tile };
  state.peers.set(id, peer);
  // Always create one audio + one video sender so screen share can use replaceTrack (no renegotiation).
  for (const kind of ['audio', 'video']) {
    const track = kind === 'video' ? (state.screenTrack || state.camTrack) : state.micTrack;
    if (track) pc.addTrack(track); else pc.addTransceiver(kind, { direction: 'sendrecv' });
  }
  pc.onicecandidate = (e) => { if (e.candidate) state.socket.emit('signal', { to: id, data: { candidate: e.candidate } }); };
  pc.ontrack = (e) => {
    remote.addTrack(e.track);
    if (e.track.kind === 'audio') watchSpeaking(remote, tile.el);
  };
  pc.onconnectionstatechange = () => { if (pc.connectionState === 'failed' && pc.restartIce) pc.restartIce(); };
  if (initiator) {
    (async () => {
      await pc.setLocalDescription(await pc.createOffer());
      state.socket.emit('signal', { to: id, data: { sdp: pc.localDescription } });
    })();
  }
  updateCount();
  return peer;
}
async function onSignal({ from, data }) {
  const peer = state.peers.get(from) || createPeer(from, 'Guest', false);
  const pc = peer.pc;
  try {
    if (data.sdp) {
      await pc.setRemoteDescription(data.sdp);
      if (data.sdp.type === 'offer') {
        await pc.setLocalDescription(await pc.createAnswer());
        state.socket.emit('signal', { to: from, data: { sdp: pc.localDescription } });
      }
    } else if (data.candidate) {
      await pc.addIceCandidate(data.candidate);
    }
  } catch (e) { console.warn('signal error', e); }
}
function closePeer(id) {
  const p = state.peers.get(id);
  if (p) { p.pc.close(); state.peers.delete(id); }
  const t = state.tiles.get(id);
  if (t) { t.el.remove(); state.tiles.delete(id); }
  if (!document.querySelector('.tile.pinned')) $('#grid').classList.remove('spot');
  renderPeople();
  updateCount();
}
function closeAllPeers() { [...state.peers.keys()].forEach(closePeer); }

/* ---------- controls ---------- */
function syncButtons() {
  $('#micBtn').classList.toggle('off', !state.micTrack || !state.micTrack.enabled);
  $('#camBtn').classList.toggle('off', !state.camTrack || !state.camTrack.enabled);
  $('#screenBtn').classList.toggle('on', !!state.screenTrack);
  $('#boardBtn').classList.toggle('on', !$('#boardPanel').hidden);
  const lt = state.tiles.get('local');
  if (lt) {
    lt.cam = !!state.camTrack && state.camTrack.enabled;
    lt.micOn = !!state.micTrack && state.micTrack.enabled;
    lt.el.classList.toggle('novideo', !lt.cam);
    lt.mic.hidden = lt.micOn;
    renderPeople();
  }
}
$('#micBtn').addEventListener('click', () => {
  if (!state.micTrack) return toast('No microphone available.', 'error');
  state.micTrack.enabled = !state.micTrack.enabled; syncButtons(); sendMediaState();
});
$('#camBtn').addEventListener('click', () => {
  if (!state.camTrack) return toast('No camera available.', 'error');
  state.camTrack.enabled = !state.camTrack.enabled; syncButtons(); sendMediaState();
});
function setVideoTrack(track) {
  for (const p of state.peers.values()) {
    const sender = p.pc.getTransceivers().find((t) => t.receiver.track.kind === 'video');
    if (sender) sender.sender.replaceTrack(track).catch(() => {});
  }
}
$('#screenBtn').addEventListener('click', async () => {
  if (state.screenTrack) return stopScreen();
  if (!navigator.mediaDevices.getDisplayMedia) return toast('Screen sharing is not supported on this device.', 'error');
  try {
    const s = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 15 }, audio: false });
    state.screenTrack = s.getVideoTracks()[0];
    state.screenTrack.onended = stopScreen;
    setVideoTrack(state.screenTrack);
    const lt = state.tiles.get('local');
    lt.video.srcObject = s; lt.el.classList.remove('mirror');
    sendMediaState();
    syncButtons();
  } catch { /* user cancelled */ }
});
function stopScreen() {
  if (!state.screenTrack) return;
  state.screenTrack.stop();
  state.screenTrack = null;
  setVideoTrack(state.camTrack);
  const lt = state.tiles.get('local');
  if (lt) { lt.video.srcObject = state.local; lt.el.classList.add('mirror'); }
  syncButtons();
}
function leaveRoom(toLobby = true) {
  clearInterval(state.timer);
  stopScreen();
  if (state.socket) { state.socket.emit('leave-room'); state.socket.disconnect(); state.socket = null; }
  state.joined = false;
  closeAllPeers();
  $('#boardPanel').hidden = true;
  if (toLobby && state.user) { history.replaceState(null, '', location.pathname); show('lobbyView'); if (state.local) startMeter(state.local); }
}
$('#leaveBtn').addEventListener('click', () => leaveRoom(true));
$('#copyLink').addEventListener('click', async () => {
  const link = location.origin + location.pathname + '#room=' + state.roomId;
  try { await navigator.clipboard.writeText(link); toast('Invite link copied. Share the passcode separately!'); } catch { toast(link); }
});

/* ---------- chat ---------- */
document.querySelectorAll('.stab').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('.stab').forEach((x) => x.classList.toggle('active', x === b));
  $('#chatPane').hidden = b.dataset.tab !== 'chat';
  $('#filesPane').hidden = b.dataset.tab !== 'files';
  $('#peoplePane').hidden = b.dataset.tab !== 'people';
  if (b.dataset.tab === 'chat') { unread = 0; $('#unread').hidden = true; }
}));
function addMsg(from, text, mine, bad = false) {
  const box = $('#msgs');
  box.append(el('div', { class: 'msg' + (mine ? ' me' : '') + (bad ? ' bad' : '') }, el('small', {}, mine ? 'You' : from), el('p', {}, text)));
  box.scrollTop = box.scrollHeight;
}
function sysMsg(text) {
  const box = $('#msgs');
  box.append(el('div', { class: 'msg sys' }, text));
  box.scrollTop = box.scrollHeight;
}
$('#chatForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = $('#chatInput').value.trim();
  if (!text) return;
  $('#chatInput').value = '';
  state.socket.emit('chat', await encryptText(state.key, text));
  addMsg('You', text, true);
});

/* ---------- encrypted file sharing ---------- */
async function sendFile(file) {
  if (file.size > 25 * 1024 * 1024) return toast('Max file size is 25 MB.', 'error');
  try {
    toast('Encrypting and uploading…');
    const { iv, ct } = await encryptBytes(state.key, new Uint8Array(await file.arrayBuffer()));
    const body = new Uint8Array(iv.length + ct.length);
    body.set(iv); body.set(ct, iv.length);
    const res = await fetch('/api/files', { method: 'POST', headers: { Authorization: 'Bearer ' + state.token, 'Content-Type': 'application/octet-stream' }, body });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Upload failed');
    const { id } = await res.json();
    const meta = { name: file.name, size: file.size, type: file.type };
    state.socket.emit('file', { id, meta: await encryptText(state.key, JSON.stringify(meta)) });
    addFile(id, meta, 'You');
  } catch (e) { toast(e.message, 'error'); }
}
function addFile(id, meta, from) {
  const name = String(meta.name || 'file').slice(0, 120);
  const btn = el('button', { class: 'btn sm primary' }, 'Download');
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    try {
      const res = await fetch('/api/files/' + id, { headers: { Authorization: 'Bearer ' + state.token } });
      if (!res.ok) throw new Error('File expired or unavailable');
      const buf = new Uint8Array(await res.arrayBuffer());
      const plain = await decryptBytes(state.key, buf.slice(0, 12), buf.slice(12));
      const url = URL.createObjectURL(new Blob([plain], { type: 'application/octet-stream' }));
      const a = el('a', { href: url, download: name });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (e) { toast(e.message === 'File expired or unavailable' ? e.message : 'Decryption failed (wrong passcode?)', 'error'); }
    btn.disabled = false;
  });
  $('#fileList').prepend(el('div', { class: 'file' }, el('div', {}, el('b', {}, name), el('small', {}, `${fmtSize(Number(meta.size) || 0)} · from ${from}`)), btn));
}
$('#fileInput').addEventListener('change', (e) => { [...e.target.files].forEach(sendFile); e.target.value = ''; });
const drop = $('#drop');
['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', (e) => [...e.dataTransfer.files].forEach(sendFile));

/* ---------- whiteboard controls ---------- */
$('#boardBtn').addEventListener('click', () => { $('#boardPanel').hidden = !$('#boardPanel').hidden; syncButtons(); });
$('#wbClose').addEventListener('click', () => { $('#boardPanel').hidden = true; syncButtons(); });
$('#wbColor').addEventListener('input', (e) => { state.board.color = e.target.value; state.board.erase = false; setTool(false); });
$('#wbSize').addEventListener('input', (e) => { state.board.size = Number(e.target.value); });
const setTool = (erase) => { state.board.erase = erase; $('#wbPen').classList.toggle('on', !erase); $('#wbErase').classList.toggle('on', erase); };
$('#wbPen').addEventListener('click', () => setTool(false));
$('#wbErase').addEventListener('click', () => setTool(true));
$('#wbClear').addEventListener('click', () => { state.board.clear(); state.socket.emit('board-clear'); });
$('#wbSave').addEventListener('click', () => {
  const a = el('a', { href: state.board.png(), download: `whiteboard-${state.roomId}.png` });
  document.body.append(a); a.click(); a.remove();
});

/* ---------- v1.1: reactions, hand raise, timer, mic meter, unread badge ---------- */
let unread = 0;
function bumpUnread() {
  if (!$('#chatPane').hidden) return;
  unread += 1;
  const u = $('#unread');
  u.textContent = String(unread);
  u.hidden = false;
}
function startTimer() {
  clearInterval(state.timer);
  state.startedAt = Date.now();
  $('#timer').textContent = '00:00';
  state.timer = setInterval(() => {
    const s = Math.floor((Date.now() - state.startedAt) / 1000);
    $('#timer').textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  }, 1000);
}
function floatEmoji(emoji) {
  const f = el('span', { class: 'float-emoji', style: `left:${10 + Math.random() * 80}%` }, emoji);
  $('#floaters').append(f);
  setTimeout(() => f.remove(), 2700);
}
$('#handBtn').addEventListener('click', () => {
  const t = state.tiles.get('local');
  if (!t || !state.socket) return;
  t.handUp = !t.handUp;
  t.hand.hidden = !t.handUp;
  $('#handBtn').classList.toggle('on', t.handUp);
  state.socket.emit('hand', t.handUp);
  renderPeople();
});
$('#reactBtn').addEventListener('click', (e) => { e.stopPropagation(); $('#reactMenu').hidden = !$('#reactMenu').hidden; });
document.addEventListener('click', () => { $('#reactMenu').hidden = true; });
$('#reactMenu').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b || !state.socket) return;
  floatEmoji(b.dataset.e);
  state.socket.emit('reaction', b.dataset.e);
});
let meterRaf = 0, meterCtx = null;
function startMeter(stream) {
  stopMeter();
  if (!stream || !stream.getAudioTracks().length) return;
  try {
    meterCtx = new (window.AudioContext || window.webkitAudioContext)();
    const an = meterCtx.createAnalyser();
    an.fftSize = 256;
    meterCtx.createMediaStreamSource(stream).connect(an);
    const buf = new Uint8Array(an.frequencyBinCount);
    const fill = $('#meterFill');
    const tick = () => {
      an.getByteFrequencyData(buf);
      fill.style.width = Math.min(100, (buf.reduce((a, b) => a + b, 0) / buf.length) * 3) + '%';
      meterRaf = requestAnimationFrame(tick);
    };
    tick();
  } catch { /* unsupported */ }
}
function stopMeter() {
  cancelAnimationFrame(meterRaf);
  if (meterCtx) { meterCtx.close(); meterCtx = null; }
}
$('#lobbyView').addEventListener('click', () => { if (meterCtx && meterCtx.state === 'suspended') meterCtx.resume(); });

/* ---------- boot ---------- */
(async () => {
  if (state.token) {
    try { state.user = await api('GET', '/auth/me'); localStorage.setItem('ms_user', JSON.stringify(state.user)); enterLobby(); return; }
    catch { state.token = null; localStorage.removeItem('ms_token'); }
  }
  show('authView');
})();
window.addEventListener('beforeunload', () => { if (state.socket) state.socket.emit('leave-room'); });
