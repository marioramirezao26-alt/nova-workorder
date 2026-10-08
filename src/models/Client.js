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

module.exports = mongoose.model('Client', clientSchema);
