const mongoose = require('mongoose');

// Fotos de la visita (antes / después) y la firma del cliente. Van aparte de la orden para que listar órdenes no cargue
// imágenes; la orden guarda solo la lista (`attachments`) y la firma (`signature`).
const KINDS = ['antes', 'despues', 'firma'];

const workOrderFileSchema = new mongoose.Schema(
  {
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    workOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkOrder', required: true },
    kind: { type: String, enum: KINDS, required: true },
    type: { type: String, enum: ['image/jpeg', 'image/png', 'image/webp'], required: true },
    data: { type: Buffer, required: true },
    size: { type: Number, required: true },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

workOrderFileSchema.index({ tenant: 1, workOrder: 1 });
workOrderFileSchema.plugin(require('./tenantGuard'));

module.exports = mongoose.model('WorkOrderFile', workOrderFileSchema);
module.exports.KINDS = KINDS;
