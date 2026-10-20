const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware');

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const sign = (u) => jwt.sign({ id: u.id, name: u.name }, process.env.JWT_SECRET, { expiresIn: '12h' });
const pub = (u) => ({ id: u.id, name: u.name, email: u.email });

router.post('/register', async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!name || !EMAIL.test(email)) return res.status(400).json({ error: 'Enter a valid name and email' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  if (await User.findOne({ email })) return res.status(409).json({ error: 'This email is already registered' });
  const user = await User.create({ name: name.slice(0, 60), email, password: await bcrypt.hash(password, 12) });
  res.status(201).json({ token: sign(user), user: pub(user) });
});

router.post('/login', async (req, res) => {
  const user = await User.findOne({ email: String(req.body.email || '').trim().toLowerCase() });
  if (!user || !(await bcrypt.compare(String(req.body.password || ''), user.password))) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  res.json({ token: sign(user), user: pub(user) });
});

router.get('/me', auth, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(401).json({ error: 'Account not found' });
  res.json(pub(user));
});

module.exports = router;
