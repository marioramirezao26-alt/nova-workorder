// Defensa en profundidad del aislamiento multiempresa: el guard de datos (tenantGuard) obliga a acotar por empresa en
// TODA consulta de WorkOrder y Client, aunque un controlador futuro olvide el filtro. Prueba el guard directamente
// contra Mongoose, no por la API.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { start, stop, reset } = require('./helpers');
const WorkOrder = require('../src/models/WorkOrder');
const Client = require('../src/models/Client');

before(start);
after(stop);
beforeEach(reset);

const oid = () => new mongoose.Types.ObjectId();
const isGuard = { name: 'TenantScopeError' };

// Una orden de una empresa, para tener algo que (no) deba filtrarse.
const seedOrder = async (tenant = oid()) => {
  const order = await WorkOrder.create({ title: 'Orden', description: 'Prueba', tenant, createdBy: oid() });
  return { tenant, order };
};

test('listar sin filtro de empresa es un error, con tenant funciona', async () => {
  const { tenant } = await seedOrder();
  await assert.rejects(WorkOrder.find({}).exec(), isGuard);
  await assert.rejects(WorkOrder.find({ status: 'pendiente' }).exec(), isGuard);
  assert.equal((await WorkOrder.find({ tenant })).length, 1);
});

test('contar y agregar exigen el acote por empresa', async () => {
  const { tenant } = await seedOrder();
  await assert.rejects(WorkOrder.countDocuments({}).exec(), isGuard);
  assert.equal(await WorkOrder.countDocuments({ tenant }), 1);
  await assert.rejects(WorkOrder.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]), isGuard);
  const byStatus = await WorkOrder.aggregate([{ $match: { tenant } }, { $group: { _id: '$status', n: { $sum: 1 } } }]);
  assert.equal(byStatus[0].n, 1);
});

test('cambiar o borrar en masa sin empresa es un error', async () => {
  const { tenant } = await seedOrder();
  await assert.rejects(WorkOrder.updateMany({}, { $set: { status: 'cancelada' } }).exec(), isGuard);
  await assert.rejects(WorkOrder.deleteMany({}).exec(), isGuard);
  // y para el relleno histórico legítimo, el escape explícito sí deja:
  const r = await WorkOrder.updateMany({}, { $set: { priority: 'alta' } }, { allowCrossTenant: true });
  assert.equal(r.matchedCount, 1);
  assert.equal((await WorkOrder.find({ tenant }))[0].priority, 'alta');
});

test('traer por _id y poblar referencias sigue funcionando (findById, populate)', async () => {
  const tenant = oid();
  const client = await Client.create({ name: 'Hotel', email: 'h@h.com', tenant });
  const order = await WorkOrder.create({ title: 'O', description: 'D', tenant, createdBy: oid(), client: client._id });
  assert.ok(await WorkOrder.findById(order._id));                      // _id acota aunque no venga tenant
  const withClient = await WorkOrder.find({ tenant }).populate('client');
  assert.equal(withClient[0].client.name, 'Hotel');                    // populate (find por _id) no rompe el guard
});

test('buscar clientes por email sin empresa (la fuga clásica) es un error', async () => {
  const tenant = oid();
  await Client.create({ name: 'Uno', email: 'repetido@correo.com', tenant });
  await assert.rejects(Client.find({ email: 'repetido@correo.com' }).exec(), isGuard);
  assert.equal((await Client.find({ tenant, email: 'repetido@correo.com' })).length, 1);
});
