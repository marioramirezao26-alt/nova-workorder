const mongoose = require('mongoose');

// La recomendación que el administrador de una empresa deja desde la app («Recomiéndanos»). Mario la aprueba o la
// rechaza desde GABY (API de plataforma) y solo las aprobadas salen en novaworkorder.com. Una sola viva por empresa:
// si la vuelve a mandar, la de antes se reemplaza y vuelve a «pendiente».
// Solo se guarda lo que la persona escribió en el formulario y el nombre de su empresa: nada de correo ni teléfono.
const STATUSES = ['pendiente', 'aprobada', 'rechazada', 'retirada'];

// El texto exacto de la autorización que aceptó (queda guardado con la fecha, como constancia).
const CONSENT_TEXT = 'Autorizo a NOVA Desarrollos a publicar esta opinión con mi nombre, cargo y empresa en '
  + 'novaworkorder.com. Puedo retirarla cuando quiera.';

const LIMITS = { textMin: 20, textMax: 400, nameMin: 2, nameMax: 80, roleMax: 80, cityMax: 60 };

const reviewSchema = new mongoose.Schema(
  {
    // La empresa (multiempresa): una reseña por empresa.
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, unique: true },
    // El nombre de la empresa al momento de enviarla (se toma de la cuenta, no lo escribe la persona).
    companyName: { type: String, required: true, trim: true, maxlength: 150 },
    name: { type: String, required: true, trim: true, minlength: LIMITS.nameMin, maxlength: LIMITS.nameMax },
    role: { type: String, trim: true, maxlength: LIMITS.roleMax, default: '' },          // cargo, opcional
    city: { type: String, trim: true, maxlength: LIMITS.cityMax, default: '' },          // opcional
    rating: { type: Number, required: true, min: 1, max: 5, validate: Number.isInteger },
    text: { type: String, required: true, trim: true, minlength: LIMITS.textMin, maxlength: LIMITS.textMax },
    // pendiente: espera a Mario · aprobada: se publica · rechazada: no se publica · retirada: la quitó la empresa
    status: { type: String, enum: STATUSES, default: 'pendiente', index: true },
    consentText: { type: String, required: true },
    consentAt: { type: Date, required: true },
    submittedAt: { type: Date, required: true },
    // Quién la envió (para la bitácora de la empresa); nunca sale en la página.
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    decidedAt: { type: Date, default: null },                 // cuándo Mario la aprobó o la rechazó
    reason: { type: String, trim: true, maxlength: 300, default: '' },   // motivo del rechazo (solo para la empresa)
    withdrawnAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// La página pública lee las aprobadas, las más recientes primero.
reviewSchema.index({ status: 1, decidedAt: -1 });

module.exports = mongoose.model('Review', reviewSchema);
module.exports.STATUSES = STATUSES;
module.exports.CONSENT_TEXT = CONSENT_TEXT;
module.exports.LIMITS = LIMITS;
