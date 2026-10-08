const mongoose = require('mongoose');

// Cada empresa que compra NOVA WORKORDER es una "empresa": sus usuarios, clientes y órdenes viven aislados del resto.
const companySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'El nombre de la empresa es obligatorio'],
      trim: true,
      maxlength: 150,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    // prueba: periodo de prueba · activa: al día · suspendida: sin acceso (por ejemplo, pago vencido)
    status: {
      type: String,
      enum: ['prueba', 'activa', 'suspendida'],
      default: 'activa',
    },
    // Técnicos activos que permite el plan; null = sin límite.
    maxTechnicians: {
      type: Number,
      default: null,
      min: 0,
    },
    contactEmail: {
      type: String,
      default: '',
      lowercase: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Company', companySchema);
