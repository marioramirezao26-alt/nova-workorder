// Límite del formulario público «Pide tu demo», en memoria: 5 solicitudes por IP cada hora.
const WINDOW_MS = 60 * 60 * 1000;
const MAX = 5;
const hits = new Map();

const demoLimiter = (req, res, next) => {
  const now = Date.now();
  for (const [ip, entry] of hits) {
    if (now - entry.first > WINDOW_MS) hits.delete(ip);
  }
  const entry = hits.get(req.ip) || { count: 0, first: now };
  if (entry.count >= MAX) {
    return res.status(429).json({ message: 'Ya recibimos varias solicitudes desde aquí. Escríbenos a contacto@novaworkorder.com.' });
  }
  entry.count += 1;
  hits.set(req.ip, entry);
  return next();
};

module.exports = { demoLimiter, _hits: hits };
