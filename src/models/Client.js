const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'El nombre del cliente es obligatorio'],
      trim: true,
    },
    // Opcional: muchos clientes de un técnico (hogares, negocios pequeños) no dan correo. Sin correo el campo no se
    // guarda (ni siquiera vacío), para que el índice único de abajo no choque entre clientes sin correo.
    email: {
      type: String,
      lowercase: true,
      trim: true,
      set: (value) => (String(value ?? '').trim() ? value : undefined),
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
    // Hacia afuera (app, API v1) un cliente sin correo sale con `email: ''`, como antes salían los demás campos vacíos.
    toJSON: { transform: (doc, ret) => ({ ...ret, email: ret.email || '' }) },
  }
);

// El email del cliente es único dentro de cada empresa (dos empresas pueden tener el mismo cliente), solo entre los
// clientes que lo tienen. Lleva otro nombre que el índice viejo (único para todos): `syncClientIndexes` cambia uno por otro.
const EMAIL_INDEX = 'tenant_1_email_1_con_correo';
clientSchema.index({ tenant: 1, email: 1 }, { unique: true, name: EMAIL_INDEX, partialFilterExpression: { email: { $type: 'string' } } });

// Defensa en profundidad: toda consulta de clientes debe acotar por empresa (tenant) o fallar ruidosamente.
clientSchema.plugin(require('./tenantGuard'));

const Client = mongoose.model('Client', clientSchema);

// Al arrancar: quita el índice viejo `tenant_1_email_1` (el correo era obligatorio y único para todos; con él, dos
// clientes sin correo chocarían) y crea el nuevo. Es idempotente y no toca los datos.
Client.syncEmailIndex = async () => {
  const indexes = await Client.collection.indexes().catch(() => []);
  if (indexes.some((i) => i.name === 'tenant_1_email_1')) {
    await Client.collection.dropIndex('tenant_1_email_1');
    console.log('Clientes: índice de correo cambiado (el correo ahora es opcional)');
  }
  await Client.createIndexes();
};

module.exports = Client;
