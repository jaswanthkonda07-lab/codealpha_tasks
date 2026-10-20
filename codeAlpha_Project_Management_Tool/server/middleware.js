const jwt = require('jsonwebtoken');
// Stateless JWT check: token carries {id, name}.
module.exports = (req, res, next) => {
  const h = req.headers.authorization || '';
  try {
    req.user = jwt.verify(h.startsWith('Bearer ') ? h.slice(7) : '', process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Authentication required' });
  }
};
