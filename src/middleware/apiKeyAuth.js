const crypto = require('crypto');
const ApiKey = require('../models/ApiKey');
const User = require('../models/User');
const Company = require('../models/Company');
const { hit } = require('../utils/rateStore');

// API pública (/api/v1) con llave de empresa: `Authorization: Bearer nwo_…` o `X-Api-Key: nwo_…`.
// La llave actúa como el administrador que la creó, dentro de su empresa; las reglas son las mismas del panel.
const PER_MINUTE = () => Number(process.env.API_KEY_PER_MINUTE) || 120;
const hashKey = (raw) => crypto.createHash('sha256').update(raw).digest('hex');
const newKey = () => `nwo_${crypto.randomBytes(24).toString('base64url')}`;

const readKey = (req) => {
  const auth = String(req.headers.authorization || '');
  if (auth.startsWith('Bearer nwo_')) return auth.slice(7).trim();
  return String(req.headers['x-api-key'] || '').trim();
};

const apiKeyAuth = async (req, res, next) => {
  try {
    const raw = readKey(req);
    if (!raw.startsWith('nwo_')) return res.status(401).json({ message: 'Falta la llave de API' });
    const key = await ApiKey.findOne({ hash: hashKey(raw), revokedAt: null }).setOptions({ allowCrossTenant: true });
    if (!key) return res.status(401).json({ message: 'Llave de API inválida o revocada' });

    const user = await User.findOne({ _id: key.createdBy, tenant: key.tenant }).select('-password');
    if (!user || !user.active || user.role !== 'admin') {
      return res.status(401).json({ message: 'La llave dejó de servir: quien la creó ya no es administrador activo' });
    }
    const company = await Company.findById(key.tenant);
    if (!company) return res.status(401).json({ message: 'La empresa de esta llave no existe' });
    if (company.status === 'suspendida') return res.status(402).json({ message: 'La cuenta de la empresa está suspendida' });

    try {
      if (await hit(`api|${key._id}`, 60000) > PER_MINUTE()) {
        return res.status(429).json({ message: `Demasiadas peticiones: máximo ${PER_MINUTE()} por minuto por llave` });
      }
    } catch (error) {
      console.error(`Límite de API sin base: ${error.message}`);
    }

    if (!key.lastUsedAt || Date.now() - key.lastUsedAt.getTime() > 60000) {
      ApiKey.updateOne({ _id: key._id, tenant: key.tenant }, { lastUsedAt: new Date() }).catch(() => {});
    }
    req.user = user;
    req.company = company;
    req.apiKey = key;
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Llave de API inválida' });
  }
};

// Solo con llave de escritura.
const requireWrite = (req, res, next) => (req.apiKey && req.apiKey.scope === 'escritura'
  ? next()
  : res.status(403).json({ message: 'Esta llave es de solo lectura' }));

module.exports = { apiKeyAuth, requireWrite, hashKey, newKey };
