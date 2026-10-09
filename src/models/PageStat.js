const mongoose = require('mongoose');

// Analítica de la página de ventas, sin cookies y sin datos personales: solo contadores por día (hora de Colombia),
// página, canal y tipo de equipo. No se guarda la IP, el navegador ni ningún identificador del visitante.
const pageStatSchema = new mongoose.Schema(
  {
    day: { type: String, required: true },                        // YYYY-MM-DD en Colombia (UTC-5)
    path: { type: String, required: true, maxlength: 60 },
    channel: { type: String, required: true, maxlength: 20 },
    device: { type: String, enum: ['movil', 'pc'], required: true },
    // visita: abrió la página · clic: tocó «Empieza gratis» o «Pide tu demo» (una vez por visita)
    event: { type: String, enum: ['visita', 'clic'], required: true },
    count: { type: Number, default: 0 },
  },
  { timestamps: false, versionKey: false }
);

pageStatSchema.index({ day: 1, path: 1, channel: 1, device: 1, event: 1 }, { unique: true });

module.exports = mongoose.model('PageStat', pageStatSchema);
