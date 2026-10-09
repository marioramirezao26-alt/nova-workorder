const mongoose = require('mongoose');

// Una empresa que pidió una demo desde la página de ventas (novaworkorder.com). GABY las lee por la API de plataforma,
// las convierte en prospectos de NOVA · Ventas y las marca como recibidas.
const demoRequestSchema = new mongoose.Schema(
  {
    company: { type: String, required: true, trim: true, maxlength: 150 },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 200 },
    phone: { type: String, trim: true, maxlength: 40, default: '' },
    technicians: { type: Number, min: 1, max: 10000, default: null },
    message: { type: String, trim: true, maxlength: 1000, default: '' },
    source: { type: String, trim: true, maxlength: 60, default: 'web' },
    // nueva: aún no la lee GABY · recibida: ya es un prospecto en NOVA · Ventas
    status: { type: String, enum: ['nueva', 'recibida'], default: 'nueva', index: true },
    receivedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('DemoRequest', demoRequestSchema);
