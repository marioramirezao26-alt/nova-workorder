const AuditLog = require('../models/AuditLog');

// Registra una acción sensible del panel en la bitácora de la empresa. Es best-effort: si el registro falla, NUNCA
// interrumpe la operación que el usuario pidió (la bitácora no debe estorbar al negocio).
const audit = async (req, action, summary, { entityId = null, meta = {} } = {}) => {
  try {
    await AuditLog.create({
      tenant: req.user.tenant,
      user: req.user._id,
      // Con llave de API queda claro que fue un sistema, no la persona (aunque actúe en su nombre).
      userName: req.apiKey ? `API «${req.apiKey.name}» (de ${req.user.name || req.user.email})` : (req.user.name || ''),
      userEmail: req.user.email || '',
      action,
      summary,
      entityId,
      meta: req.apiKey ? { ...meta, via: 'api', apiKey: String(req.apiKey._id) } : meta,
    });
  } catch {
    // el registro es secundario; no propagamos el error
  }
};

module.exports = { audit };
