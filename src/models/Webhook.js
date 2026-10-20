const mongoose = require('mongoose');

// Webhook de una empresa: cuando pasa algo con una orden, le avisamos a su sistema con un POST firmado.
// El secreto de la firma no se guarda: se deriva de `salt` y de la llave del servidor (ver src/utils/webhooks.js).
const webhookSchema = new mongoose.Schema(
  {
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: [true, 'La empresa es obligatoria'] },
    url: { type: String, required: [true, 'La dirección del webhook es obligatoria'], trim: true, maxlength: 500 },
    events: { type: [String], default: [] },
    salt: { type: String, required: true, select: false },
    active: { type: Boolean, default: true },
    failures: { type: Number, default: 0 },          // intentos fallidos seguidos; con muchos se apaga solo
    lastStatus: { type: String, default: null },     // «200», «timeout», «sin conexión»…
    lastAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

webhookSchema.index({ tenant: 1, active: 1 });
webhookSchema.plugin(require('./tenantGuard'));

module.exports = mongoose.model('Webhook', webhookSchema);
