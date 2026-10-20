// Límite de los contadores de la página de ventas: 60 eventos por IP cada hora (contador compartido en la base).
// Pasado el límite se ignora en silencio: la página no se entera.
const { limiter } = require('../utils/rateStore');

const visitLimiter = limiter({
  name: 'visit',
  windowMs: 60 * 60 * 1000,
  max: 60,
  onLimit: (req, res) => res.status(204).end(),
});

module.exports = { visitLimiter };
