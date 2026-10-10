// Límite del chat de la página de ventas, en memoria: 30 mensajes por IP cada hora (la IP no se guarda en la base).
const WINDOW_MS = 60 * 60 * 1000;
const MAX = 30;
const hits = new Map();

const chatLimiter = (req, res, next) => {
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
  if (entry.count >= MAX) {
    return res.status(429).json({ message: 'Hablamos mucho por hoy 😊. Para seguir, déjanos tus datos en «Empieza gratis» o escríbenos a contacto@novaworkorder.com.' });
  }
  entry.count += 1;
  return next();
};

module.exports = { chatLimiter, _chatHits: hits };
