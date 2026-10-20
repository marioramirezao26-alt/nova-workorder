const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'El nombre del cliente es obligatorio'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'El email es obligatorio'],
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      default: '',
      trim: true,
    },
    company: {
      type: String,
      default: '',
      trim: true,
    },
    address: {
      type: String,
      default: '',
      trim: true,
    },
    active: {
      type: Boolean,
      default: true,
    },
    // Coordenadas del cliente: se aprenden de la primera orden completada con ubicación (`visita`).
    location: {
      type: { lat: Number, lng: Number, source: String, at: Date },
      default: null,
    },
    // Empresa dueña del dato (multiempresa). No confundir con `company` del cliente, que es su razón social.
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: [true, 'La empresa es obligatoria'],
    },
  },
  {
    timestamps: true,
  }
);

// El email del cliente es único dentro de cada empresa (dos empresas pueden tener el mismo cliente).
clientSchema.index({ tenant: 1, email: 1 }, { unique: true });

// Defensa en profundidad: toda consulta de clientes debe acotar por empresa (tenant) o fallar ruidosamente.
clientSchema.plugin(require('./tenantGuard'));

module.exports = mongoose.model('Client', clientSchema);
