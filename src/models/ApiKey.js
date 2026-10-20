const mongoose = require('mongoose');

// Llave de API de una empresa: sus sistemas (ERP, facturación, Zapier…) leen y crean órdenes sin un usuario humano.
// De la llave solo se guarda su huella (SHA-256): se muestra completa una sola vez, al crearla.
const apiKeySchema = new mongoose.Schema(
  {
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: [true, 'La empresa es obligatoria'] },
    name: { type: String, required: [true, 'El nombre de la llave es obligatorio'], trim: true, maxlength: 60 },
    prefix: { type: String, required: true },            // el comienzo de la llave, para reconocerla en el panel
    hash: { type: String, required: true, unique: true, select: false },
    // lectura: consultar órdenes y clientes · escritura: además crear órdenes y cambiarles el estado
    scope: { type: String, enum: ['lectura', 'escritura'], default: 'lectura' },
    // La llave actúa en nombre del administrador que la creó: si deja de ser administrador activo, la llave deja de servir.
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    lastUsedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

apiKeySchema.index({ tenant: 1, createdAt: -1 });
apiKeySchema.plugin(require('./tenantGuard'));

module.exports = mongoose.model('ApiKey', apiKeySchema);
