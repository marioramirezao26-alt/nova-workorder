const AuditLog = require('../models/AuditLog');

// Registra una acción sensible del panel en la bitácora de la empresa. Es best-effort: si el registro falla, NUNCA
// interrumpe la operación que el usuario pidió (la bitácora no debe estorbar al negocio).
const audit = async (req, action, summary, { entityId = null, meta = {} } = {}) => {
  try {
    await AuditLog.create({
      tenant: req.user.tenant,
      user: req.user._id,
      userName: req.user.name || '',
      userEmail: req.user.email || '',
      action,
      summary,
      entityId,
      meta,
    });
  } catch {
    // el registro es secundario; no propagamos el error
  }
};

module.exports = { audit };
