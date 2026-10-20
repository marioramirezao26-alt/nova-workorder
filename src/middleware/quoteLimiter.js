// Respuestas a cotizaciones desde el enlace público: 20 por IP cada hora (contador compartido en la base).
const { limiter } = require('../utils/rateStore');

const quoteLimiter = limiter({
  name: 'cotizacion',
  windowMs: 60 * 60 * 1000,
  max: 20,
  onLimit: (req, res) => res.status(429).json({ message: 'Demasiados intentos. Espera un rato y vuelve a intentarlo.' }),
});

module.exports = { quoteLimiter };
