const mongoose = require('mongoose');

// Cotización de una empresa a su cliente. Se arma en borrador, se envía con un enlace (/cotizacion/<llave>) y el
// cliente la aprueba o la rechaza sin cuenta. Al aprobarse se crea la orden de trabajo.
// borrador → enviada → aprobada | rechazada. «Vencida» no se guarda: es una enviada cuya fecha de validez pasó.
const STATUSES = ['borrador', 'enviada', 'aprobada', 'rechazada'];

const itemSchema = new mongoose.Schema(
  {
    description: { type: String, required: true, trim: true, maxlength: 200 },
    qty: { type: Number, required: true, min: 0.01, max: 100000 },
    unitPrice: { type: Number, required: true, min: 0, max: 10000000000 },
    taxRate: { type: Number, default: 0, min: 0, max: 30 },          // IVA (19 %, 5 %…) o impuesto sobre la venta, en %
    amount: { type: Number, required: true },                          // cantidad × precio, redondeado
    tax: { type: Number, required: true },
  },
  { _id: false }
);

const quoteSchema = new mongoose.Schema(
  {
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    number: { type: Number, required: true },
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: [true, 'Elige el cliente'] },
    title: { type: String, required: [true, 'El título es obligatorio'], trim: true, maxlength: 150 },
    notes: { type: String, default: '', trim: true, maxlength: 2000 },     // condiciones, garantía, forma de pago…
    items: { type: [itemSchema], validate: [(v) => v.length >= 1 && v.length <= 50, 'La cotización lleva entre 1 y 50 renglones'] },
    currency: { type: String, enum: ['COP', 'USD'], required: true },
    subtotal: { type: Number, required: true },
    tax: { type: Number, required: true },
    total: { type: Number, required: true },
    validUntil: { type: Date, required: true },
    status: { type: String, enum: STATUSES, default: 'borrador' },
    // Llave del enlace público: se crea al enviarla por primera vez y luego es siempre la misma.
    publicToken: { type: String, default: undefined },
    sentAt: { type: Date, default: null },
    // La decisión: cuándo, quién (el nombre que escribió el cliente o el usuario de la oficina), por dónde y su nota.
    decidedAt: { type: Date, default: null },
    decidedBy: { type: String, default: '' },
    decidedVia: { type: String, enum: ['', 'cliente', 'oficina'], default: '' },
    decisionNote: { type: String, default: '', maxlength: 500 },
    workOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkOrder', default: null },
    // El cobro de una cotización aprobada: cuánto se cobra (todo o el anticipo, fijado al primer intento), su estado,
    // la última transacción de Wompi y cómo se pagó (wompi, o «oficina» si la empresa lo marcó a mano).
    payment: {
      due: { type: Number, default: null },
      status: { type: String, enum: ['pendiente', 'pagado'], default: 'pendiente' },
      method: { type: String, enum: ['', 'wompi', 'oficina'], default: '' },
      txId: { type: String, default: '' },
      txStatus: { type: String, default: '' },
      paidAt: { type: Date, default: null },
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

quoteSchema.index({ tenant: 1, number: 1 }, { unique: true });
quoteSchema.index({ tenant: 1, status: 1, createdAt: -1 });
quoteSchema.index({ tenant: 1, client: 1, createdAt: -1 });
quoteSchema.index({ publicToken: 1 }, { unique: true, sparse: true });
quoteSchema.plugin(require('./tenantGuard'));

module.exports = mongoose.model('Quote', quoteSchema);
module.exports.STATUSES = STATUSES;
