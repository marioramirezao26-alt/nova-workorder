// Límite del formulario público «Pide tu demo»: 5 solicitudes por IP cada hora (contador compartido en la base).
const { limiter } = require('../utils/rateStore');

const demoLimiter = limiter({
  name: 'demo',
  windowMs: 60 * 60 * 1000,
  max: 5,
  onLimit: (req, res) => res.status(429).json({ message: req.body && req.body.lang === 'en'
    ? 'We already got several requests from here. Email us at contacto@novaworkorder.com.'
    : 'Ya recibimos varias solicitudes desde aquí. Escríbenos a contacto@novaworkorder.com.' }),
});

module.exports = { demoLimiter };
