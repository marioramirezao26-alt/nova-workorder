// Revisión de seguridad (octubre 2026): lo que un técnico, un usuario cliente o un token viejo ya no pueden hacer.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, reset, call, company } = require('./helpers');

before(start);
after(stop);
beforeEach(reset);

const tech = async (a, email) => {
  const made = await call('POST', '/users', { as: a.token, body: { name: email.split('@')[0], email, role: 'tecnico' } });
  const first = (await call('POST', '/auth/login', { body: { email, password: made.data.temporaryPassword } })).data;
  return { id: made.data.user._id, temp: made.data.temporaryPassword, first };
};

test('con la contraseña temporal solo se puede cambiar; al cambiarla, el token viejo deja de servir', async () => {
  const a = await company('Frío Ruta');
  const t = await tech(a, 'ana@frioruta.com');
  assert.equal(t.first.mustChangePassword, true);
  assert.equal((await call('GET', '/workorders', { as: t.first.token })).status, 403);
  assert.equal((await call('GET', '/auth/profile', { as: t.first.token })).status, 200);
  const changed = await call('PUT', '/auth/password', { as: t.first.token, body: { currentPassword: t.temp, newPassword: 'Clave-nueva-456' } });
  assert.equal(changed.status, 200);
  assert.ok(changed.data.token);
  assert.equal((await call('GET', '/workorders', { as: t.first.token })).status, 401);          // el token anterior ya no
  assert.equal((await call('GET', '/workorders', { as: changed.data.token })).status, 200);
  // una contraseña que no es texto se rechaza sin mensajes internos
  const odd = await call('POST', '/auth/login', { body: { email: 'ana@frioruta.com', password: { $gt: '' } } });
  assert.equal(odd.status, 400);
});

test('un técnico no edita órdenes ajenas ni cambia su estado o técnico por PUT', async () => {
  const a = await company('Frío Ruta');
  const t1 = await tech(a, 'ana@frioruta.com');
  const t2 = await tech(a, 'beto@frioruta.com');
  const tok1 = (await call('PUT', '/auth/password', { as: t1.first.token, body: { currentPassword: t1.temp, newPassword: 'Clave-nueva-456' } })).data.token;
  const body = { title: 'Revisión nevera', description: 'Revisión general del equipo', assignedTo: t2.id };
  const other = (await call('POST', '/workorders', { as: a.token, body })).data;
  const r = await call('PUT', `/workorders/${other._id}`, { as: tok1, body: { ...body, status: 'cancelada', assignedTo: t1.id } });
  assert.equal(r.status, 403);
  const mine = (await call('POST', '/workorders', { as: a.token, body: { ...body, assignedTo: t1.id } })).data;
  assert.equal((await call('PUT', `/workorders/${mine._id}`, { as: tok1, body: { ...body, assignedTo: t1.id, title: 'Revisión nevera grande' } })).status, 200);
  assert.equal((await call('PUT', `/workorders/${mine._id}`, { as: tok1, body: { ...body, assignedTo: t1.id, status: 'cancelada' } })).status, 403);
  assert.equal((await call('PUT', `/workorders/${mine._id}`, { as: tok1, body: { ...body, assignedTo: t2.id } })).status, 403);
  // el filtro de estado solo acepta estados conocidos
  const list = await call('GET', '/workorders?status[$ne]=x', { as: a.token });
  assert.equal(list.status, 200);
  assert.equal(list.data.items.length, 0);
});

test('un usuario cliente no ve la ubicación del técnico en el tablero', async () => {
  const a = await company('Frío Ruta');
  const client = (await call('POST', '/clients', { as: a.token, body: { name: 'Hotel Norte', email: 'hotel@norte.com', address: 'Cra 15' } })).data;
  const made = await call('POST', '/users', { as: a.token, body: { name: 'Hotel', email: 'hotel@norte.com', role: 'cliente', client: client._id } });
  const first = (await call('POST', '/auth/login', { body: { email: 'hotel@norte.com', password: made.data.temporaryPassword } })).data;
  const tok = (await call('PUT', '/auth/password', { as: first.token, body: { currentPassword: made.data.temporaryPassword, newPassword: 'Clave-nueva-456' } })).data.token;
  await call('POST', '/workorders', { as: a.token, body: { title: 'Mantenimiento', description: 'Mantenimiento del aire', client: client._id } });
  const WorkOrder = require('../src/models/WorkOrder');
  await WorkOrder.updateMany({ tenant: a.id }, { startLocation: { lat: 4.6, lng: -74, at: new Date() }, lastPoint: { lat: 4.6, lng: -74, at: new Date() } });
  const d = await call('GET', '/dashboard/summary', { as: tok });
  assert.equal(d.status, 200);
  const recent = d.data.recentOrders[0];
  assert.equal(recent.startLocation, undefined);
  assert.equal(recent.lastPoint, undefined);
});
