// Bitácora de auditoría: las acciones sensibles del panel (órdenes, clientes, usuarios) quedan registradas con quién y
// cuándo. Solo el administrador puede leerla; cada empresa ve solo la suya.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, reset, call, company, login } = require('./helpers');

before(start);
after(stop);
beforeEach(reset);

test('las acciones sensibles quedan en la bitácora, con quién y qué', async () => {
  const a = await company('Frío Austral');
  const client = (await call('POST', '/clients', { as: a.token, body: { name: 'Hotel Sol', email: 'sol@hotel.com' } })).data;
  const order = (await call('POST', '/workorders', { as: a.token, body: { title: 'Mantenimiento', description: 'Aire central', client: client._id } })).data;
  await call('PATCH', `/workorders/${order._id}/status`, { as: a.token, body: { status: 'en_proceso' } });
  await call('POST', '/users', { as: a.token, body: { name: 'Tecnia', email: 'tec@frio.com', role: 'tecnico' } });

  const log = await call('GET', '/audit', { as: a.token });
  assert.equal(log.status, 200);
  const actions = log.data.items.map((e) => e.action);
  assert.ok(actions.includes('cliente.crear'));
  assert.ok(actions.includes('orden.crear'));
  assert.ok(actions.includes('orden.estado'));
  assert.ok(actions.includes('usuario.crear'));
  assert.equal(log.data.items[0].action, 'usuario.crear');          // lo más nuevo primero
  assert.ok(log.data.items[0].user && log.data.items[0].summary);
  assert.ok(log.data.pagination.total >= 4);
});

test('solo el administrador lee la bitácora, y cada empresa ve solo la suya', async () => {
  const a = await company('Clima Uno');
  const b = await company('Clima Dos');
  await call('POST', '/clients', { as: a.token, body: { name: 'Clínica A', email: 'a@clinica.com' } });

  // El técnico no puede leer la bitácora.
  const made = await call('POST', '/users', { as: a.token, body: { name: 'Tec', email: 'tec@uno.com', role: 'tecnico' } });
  const tec = await login('tec@uno.com', made.data.temporaryPassword);
  assert.equal((await call('GET', '/audit', { as: tec })).status, 403);

  // La otra empresa no ve la actividad de la primera.
  const logB = await call('GET', '/audit', { as: b.token });
  assert.equal(logB.status, 200);
  assert.ok(!logB.data.items.some((e) => e.summary.includes('Clínica A')));
});
