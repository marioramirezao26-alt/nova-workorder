// Defensa en profundidad del aislamiento multiempresa.
//
// Hoy cada consulta filtra por empresa a mano (companyScope / orderFilter). Si una función nueva olvida ese filtro,
// devolvería o cambiaría datos de OTRA empresa sin avisar. Este plugin convierte ese olvido en un error ruidoso: en los
// modelos de datos de negocio (WorkOrder, Client), toda consulta de lectura/escritura DEBE acotar por `tenant` (o traer
// un `_id`, como en un findById o al poblar por referencia). Si no, lanza TenantScopeError en vez de tocar la base.
//
// Flujos globales legítimos (migraciones, mantenimiento) se eximen de forma EXPLÍCITA:
//   Modelo.updateMany(filtro, cambio, { allowCrossTenant: true })
//   Modelo.find(filtro).setOptions({ allowCrossTenant: true })
//   Modelo.aggregate(pipeline).option({ allowCrossTenant: true })

class TenantScopeError extends Error {
  constructor(modelName, op) {
    super(`Consulta sin filtro de empresa en ${modelName}.${op}: toda consulta debe acotar por "tenant" `
      + '(o traer "_id"). Si de verdad es entre empresas, usa { allowCrossTenant: true }.');
    this.name = 'TenantScopeError';
  }
}

// ¿El filtro acota a una empresa? Acepta `tenant` o `_id` al tope, o dentro de un `$and` (no dentro de `$or`, que
// mezclaría empresas). No recorre más profundo a propósito: queremos exigir el acote donde de verdad protege.
function scoped(filter) {
  if (!filter || typeof filter !== 'object') return false;
  if (Object.prototype.hasOwnProperty.call(filter, 'tenant')) return true;
  if (Object.prototype.hasOwnProperty.call(filter, '_id')) return true;
  if (Array.isArray(filter.$and)) return filter.$and.some(scoped);
  return false;
}

// Consultas de Mongoose que llevan filtro y pueden tocar varias empresas si se olvida el acote.
const QUERY_OPS = [
  'count', 'countDocuments', 'distinct', 'find', 'findOne',
  'findOneAndUpdate', 'findOneAndDelete', 'findOneAndReplace', 'replaceOne',
  'updateMany', 'deleteMany',
];
// Estas también existen como middleware de documento; aquí solo nos interesa la variante de consulta (Modelo.updateOne…).
const QUERY_ONLY_OPS = ['updateOne', 'deleteOne'];

module.exports = function tenantGuard(schema) {
  function guardFilter() {
    if (this.getOptions && this.getOptions().allowCrossTenant) return;
    if (!scoped(this.getFilter())) {
      throw new TenantScopeError(this.model && this.model.modelName, this.op || 'query');
    }
  }

  QUERY_OPS.forEach((op) => schema.pre(op, guardFilter));
  QUERY_ONLY_OPS.forEach((op) => schema.pre(op, { query: true, document: false }, guardFilter));

  // Una agregación tiene que empezar por `$match` con `tenant`, si no cuenta/lee de todas las empresas.
  schema.pre('aggregate', function guardAggregate() {
    if (this.options && this.options.allowCrossTenant) return;
    const first = this.pipeline()[0];
    const match = first && first.$match;
    if (!match || !Object.prototype.hasOwnProperty.call(match, 'tenant')) {
      throw new TenantScopeError(this._model && this._model.modelName, 'aggregate');
    }
  });

  // Contar toda la colección ignora el filtro: nunca debe correr sin permiso explícito entre empresas.
  schema.pre('estimatedDocumentCount', function guardEstimate() {
    if (this.getOptions && this.getOptions().allowCrossTenant) return;
    throw new TenantScopeError(this.model && this.model.modelName, 'estimatedDocumentCount');
  });
};

module.exports.TenantScopeError = TenantScopeError;
