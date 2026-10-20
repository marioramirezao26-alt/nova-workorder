// Límite del chat de la página de ventas: 30 mensajes por IP cada hora (contador compartido en la base; la IP solo vive
// en la clave del contador y caduca sola).
const { limiter } = require('../utils/rateStore');

const chatLimiter = limiter({
  name: 'chat',
  windowMs: 60 * 60 * 1000,
  max: 30,
  onLimit: (req, res) => res.status(429).json({ message: req.body && req.body.lang === 'en'
    ? 'We\'ve talked a lot today 😊. To keep going, leave your details in "Start free" or email us at contacto@novaworkorder.com.'
    : 'Hablamos mucho por hoy 😊. Para seguir, déjanos tus datos en «Empieza gratis» o escríbenos a contacto@novaworkorder.com.' }),
});

module.exports = { chatLimiter };
