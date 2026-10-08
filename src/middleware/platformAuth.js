const crypto = require('crypto');

// La API de plataforma la usa GABY (el sistema que vende NOVA) para crear y administrar empresas.
// Exige la llave PLATFORM_API_KEY en el encabezado `x-platform-key`; sin llave configurada, la API está apagada.
const platformAuth = (req, res, next) => {
  const expected = process.env.PLATFORM_API_KEY || '';

  if (expected.length < 32) {
    return res.status(503).json({ message: 'La API de plataforma no está habilitada (falta PLATFORM_API_KEY de al menos 32 caracteres)' });
  }

  const given = String(req.headers['x-platform-key'] || '');
  const a = crypto.createHash('sha256').update(given).digest();
  const b = crypto.createHash('sha256').update(expected).digest();

  if (!given || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ message: 'Llave de plataforma inválida' });
  }

  return next();
};

module.exports = { platformAuth };
