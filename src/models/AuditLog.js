const mongoose = require('mongoose');

// Bitácora de la empresa: quién hizo qué y cuándo en el panel. Rinde cuentas cuando hay varios usuarios.
// Es solo registro: no guarda contraseñas ni datos sensibles, apenas una frase legible y referencias.
const auditSchema = new mongoose.Schema(
  {
    // Empresa dueña del registro (multiempresa).
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: [true, 'La empresa es obligatoria'],
    },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },   // quién la hizo
    userName: { type: String, default: '' },
    userEmail: { type: String, default: '' },
    action: { type: String, required: true },     // clave corta: 'orden.crear', 'cliente.editar', 'usuario.crear'…
    summary: { type: String, default: '' },         // frase en español para el panel
    entityId: { type: mongoose.Schema.Types.ObjectId, default: null },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

auditSchema.index({ tenant: 1, createdAt: -1 });
// Defensa en profundidad: toda consulta de la bitácora debe acotar por empresa (igual que órdenes y clientes).
auditSchema.plugin(require('./tenantGuard'));

module.exports = mongoose.model('AuditLog', auditSchema);
