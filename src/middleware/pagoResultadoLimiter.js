// Orden 65: límite de la consulta del resultado de un pago (/api/public/pago/resultado): 30 por IP cada 10 minutos.
// Cada consulta le pide a GABY que le pregunte a Mercado Pago, así que no puede ser gratis para quien la repita.
const { limiter } = require('../utils/rateStore');

const pagoResultadoLimiter = limiter({
  name: 'pago-resultado',
  windowMs: 10 * 60 * 1000,
  max: 30,
  onLimit: (req, res) => res.status(429).json({ estado: 'desconocido', message: 'Demasiadas consultas. Espera un momento.' }),
});

module.exports = { pagoResultadoLimiter };
