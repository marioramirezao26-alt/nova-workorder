const mongoose = require('mongoose');

// Cada aviso a un webhook queda en la base: se envía desde una cola (sobrevive a reinicios y funciona con varias
// instancias), se reintenta si falla y se borra solo a los 30 días.
const deliverySchema = new mongoose.Schema(
  {
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    webhook: { type: mongoose.Schema.Types.ObjectId, ref: 'Webhook', required: true },
    event: { type: String, required: true },
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
    status: { type: String, enum: ['pendiente', 'entregado', 'fallido'], default: 'pendiente' },
    attempts: { type: Number, default: 0 },
    nextAttemptAt: { type: Date, default: () => new Date() },
    lockedUntil: { type: Date, default: null },      // la instancia que lo está enviando lo aparta un momento
    responseStatus: { type: Number, default: null },
    lastError: { type: String, default: '' },
    deliveredAt: { type: Date, default: null },
  },
  { timestamps: true }
);

deliverySchema.index({ status: 1, nextAttemptAt: 1 });
deliverySchema.index({ tenant: 1, webhook: 1, createdAt: -1 });
deliverySchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 3600 });
deliverySchema.plugin(require('./tenantGuard'));

module.exports = mongoose.model('WebhookDelivery', deliverySchema);
