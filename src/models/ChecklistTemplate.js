const mongoose = require('mongoose');

// Plantilla de checklist de una empresa («Mantenimiento de aire», «Instalación de cámara»…). Al usarla en una orden se
// copia (la orden guarda los puntos de ese momento): si luego cambia la plantilla, la orden sigue diciendo lo que se revisó.
const checklistTemplateSchema = new mongoose.Schema(
  {
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    name: { type: String, required: [true, 'El nombre es obligatorio'], trim: true, maxlength: 80 },
    items: {
      type: [{
        _id: false,
        label: { type: String, required: true, trim: true, maxlength: 160 },
        required: { type: Boolean, default: false },       // sin marcarlo no se puede completar la orden
      }],
      validate: [(v) => v.length >= 1 && v.length <= 40, 'La plantilla lleva entre 1 y 40 puntos'],
    },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

checklistTemplateSchema.index({ tenant: 1, name: 1 });
checklistTemplateSchema.plugin(require('./tenantGuard'));

module.exports = mongoose.model('ChecklistTemplate', checklistTemplateSchema);
