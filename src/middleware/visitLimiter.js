// Límite de los contadores de la página de ventas, en memoria: 60 eventos por IP cada hora (la IP no se guarda).
const WINDOW_MS = 60 * 60 * 1000;
const MAX = 60;
const hits = new Map();

const visitLimiter = (req, res, next) => {
  const now = Date.now();
  if (hits.size > 5000) {
    for (const [ip, entry] of hits) {
      if (now - entry.first > WINDOW_MS) hits.delete(ip);
    }
  }
  const entry = hits.get(req.ip);
  if (!entry || now - entry.first > WINDOW_MS) {
    hits.set(req.ip, { count: 1, first: now });
    return next();
  }
  if (entry.count >= MAX) return res.status(204).end();          // se ignora en silencio: la página no se entera
  entry.count += 1;
  return next();
};

module.exports = { visitLimiter, _visitHits: hits };
