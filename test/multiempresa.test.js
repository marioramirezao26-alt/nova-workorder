const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, reset, call, company, login, KEY } = require('./helpers');

before(start);
after(stop);
beforeEach(reset);

test('el registro público está cerrado', async () => {
  const r = await call('POST', '/auth/register', { body: { name: 'X', email: 'x@x.com', password: '12345678' } });
  assert.equal(r.status, 410);
});

test('cada empresa ve solo sus clientes, órdenes y tablero', async () => {
  const a = await company('Frío Total');
  const b = await company('Redes del Norte');
  const ca = await call('POST', '/clients', { as: a.token, body: { name: 'Hotel Sol', email: 'compras@hotelsol.com', company: 'Hoteles Sol S.A.' } });
  assert.equal(ca.status, 201);
  assert.equal(ca.data.company, 'Hoteles Sol S.A.');                         // la razón social del cliente no se pisa con la empresa dueña
  assert.equal(ca.data.tenant, a.id);
  // el mismo email de cliente puede existir en otra empresa
  assert.equal((await call('POST', '/clients', { as: b.token, body: { name: 'Hotel Sol B', email: 'compras@hotelsol.com' } })).status, 201);
  const oa = await call('POST', '/workorders', { as: a.token, body: { title: 'Mantenimiento', description: 'Revisión del aire central', client: ca.data._id } });
  assert.equal(oa.status, 201);
  assert.equal(oa.data.customerName, 'Hotel Sol');

  assert.equal((await call('GET', '/workorders', { as: b.token })).data.items.length, 0);
  assert.equal((await call('GET', `/workorders/${oa.data._id}`, { as: b.token })).status, 404);
  assert.equal((await call('PUT', `/workorders/${oa.data._id}`, { as: b.token, body: { title: 'Hackeo', description: 'no debería poder' } })).status, 404);
  assert.equal((await call('DELETE', `/workorders/${oa.data._id}`, { as: b.token })).status, 404);
  assert.equal((await call('GET', `/clients/${ca.data._id}`, { as: b.token })).status, 404);
  assert.equal((await call('GET', '/clients', { as: b.token })).data.items.length, 1);
  assert.equal((await call('GET', '/dashboard/summary', { as: b.token })).data.total, 0);
  assert.equal((await call('GET', '/dashboard/summary', { as: a.token })).data.total, 1);
  // una orden no puede apuntar al cliente de otra empresa
  const bClient = (await call('GET', '/clients', { as: b.token })).data.items[0]._id;
  const cross = await call('POST', '/workorders', { as: a.token, body: { title: 'Cruce', description: 'cliente de otra empresa', client: bClient } });
  assert.equal(cross.status, 400);
});

test('un usuario cliente solo ve sus propias órdenes (antes veía todas)', async () => {
  const a = await company('Clima Pro');
  const c1 = (await call('POST', '/clients', { as: a.token, body: { name: 'Clínica Uno', email: 'uno@clinica.com' } })).data;
  const c2 = (await call('POST', '/clients', { as: a.token, body: { name: 'Colegio Dos', email: 'dos@colegio.com' } })).data;
  await call('POST', '/workorders', { as: a.token, body: { title: 'Orden uno', description: 'Para la clínica uno', client: c1._id } });
  await call('POST', '/workorders', { as: a.token, body: { title: 'Orden dos', description: 'Para el colegio dos', client: c2._id } });
  const made = await call('POST', '/users', { as: a.token, body: { name: 'Dra. Uno', email: 'dra@clinica.com', role: 'cliente', client: c1._id } });
  assert.equal(made.status, 201);
  const token = await login('dra@clinica.com', made.data.temporaryPassword);
  const orders = await call('GET', '/workorders', { as: token });
  assert.deepEqual(orders.data.items.map((o) => o.title), ['Orden uno']);
  assert.equal((await call('GET', '/clients', { as: token })).data.items.length, 1);
  assert.equal((await call('GET', `/clients/${c2._id}`, { as: token })).status, 404);
  assert.equal((await call('GET', '/dashboard/summary', { as: token })).data.total, 1);
  assert.equal((await call('POST', '/workorders', { as: token, body: { title: 'Intento', description: 'cliente creando orden' } })).status, 403);
  assert.equal((await call('GET', '/users', { as: token })).status, 403);
});

test('el administrador gestiona usuarios y el plan limita los técnicos', async () => {
  const a = await company('Servi Tec', { maxTechnicians: 1 });
  const t1 = await call('POST', '/users', { as: a.token, body: { name: 'Ana', email: 'ana@servitec.com', role: 'tecnico' } });
  assert.equal(t1.status, 201);
  assert.ok(t1.data.temporaryPassword.length >= 12 && t1.data.user.mustChangePassword === true);
  assert.equal(t1.data.user.password, undefined);
  const t2 = await call('POST', '/users', { as: a.token, body: { name: 'Beto', email: 'beto@servitec.com', role: 'tecnico' } });
  assert.equal(t2.status, 403);
  assert.match(t2.data.message, /1 técnico/);
  // desactivar a Ana libera el cupo y le quita el acceso al instante
  const anaToken = await login('ana@servitec.com', t1.data.temporaryPassword);
  assert.equal((await call('GET', '/workorders', { as: anaToken })).status, 200);
  assert.equal((await call('PUT', `/users/${t1.data.user._id}`, { as: a.token, body: { active: false } })).status, 200);
  assert.equal((await call('GET', '/workorders', { as: anaToken })).status, 401);
  assert.equal((await call('POST', '/users', { as: a.token, body: { name: 'Beto', email: 'beto@servitec.com', role: 'tecnico' } })).status, 201);
  // reactivar a Ana ya no cabe en el plan
  assert.equal((await call('PUT', `/users/${t1.data.user._id}`, { as: a.token, body: { active: true } })).status, 403);
  // el administrador no puede quitarse su rol
  const me = (await call('GET', '/auth/profile', { as: a.token })).data;
  assert.equal((await call('PUT', `/users/${me._id}`, { as: a.token, body: { role: 'tecnico' } })).status, 400);
  // otra empresa no toca estos usuarios
  const b = await company('Otra');
  assert.equal((await call('PUT', `/users/${t1.data.user._id}`, { as: b.token, body: { name: 'x' } })).status, 404);
  assert.equal((await call('GET', '/users', { as: b.token })).data.items.length, 1);
  // un técnico ve la lista para asignar, sin clientes
  const beto = (await call('GET', '/users', { as: a.token })).data.items.find((u) => u.email === 'beto@servitec.com');
  const reset = await call('PUT', `/users/${beto._id}`, { as: a.token, body: { resetPassword: true } });
  const betoToken = await login('beto@servitec.com', reset.data.temporaryPassword);
  const visible = (await call('GET', '/users', { as: betoToken })).data.items;
  assert.ok(visible.every((u) => u.role !== 'cliente' && u.active === undefined));
  assert.equal((await call('POST', '/users', { as: betoToken, body: { name: 'x', email: 'x@y.com', role: 'admin' } })).status, 403);
});

test('las órdenes solo se asignan a técnicos activos de la misma empresa', async () => {
  const a = await company('Uno');
  const b = await company('Dos');
  const techB = (await call('POST', '/users', { as: b.token, body: { name: 'Tec B', email: 'tec@dos.com', role: 'tecnico' } })).data.user;
  const bad = await call('POST', '/workorders', { as: a.token, body: { title: 'Orden', description: 'asignada a otra empresa', assignedTo: techB._id } });
  assert.equal(bad.status, 400);
  const techA = (await call('POST', '/users', { as: a.token, body: { name: 'Tec A', email: 'tec@uno.com', role: 'tecnico' } })).data.user;
  const ok = await call('POST', '/workorders', { as: a.token, body: { title: 'Orden', description: 'asignada a su técnico', assignedTo: techA._id, dueDate: '2026-12-01' } });
  assert.equal(ok.status, 201);
  assert.equal(ok.data.assignedTo.email, 'tec@uno.com');
  const cleared = await call('PUT', `/workorders/${ok.data._id}`, { as: a.token, body: { title: 'Orden', description: 'ya sin técnico asignado', assignedTo: '' } });
  assert.equal(cleared.status, 200);
  assert.equal(cleared.data.assignedTo, null);
});

test('el técnico ve sus órdenes y cambia el estado desde el celular', async () => {
  const a = await company('Campo');
  const c = (await call('POST', '/clients', { as: a.token, body: { name: 'Planta Norte', email: 'planta@norte.com' } })).data;
  const ana = await call('POST', '/users', { as: a.token, body: { name: 'Ana', email: 'ana@campo.com', role: 'tecnico' } });
  const beto = await call('POST', '/users', { as: a.token, body: { name: 'Beto', email: 'beto@campo.com', role: 'tecnico' } });
  const mine = (await call('POST', '/workorders', { as: a.token, body: { title: 'Revisar bomba', description: 'Bomba de agua del piso 2', client: c._id, assignedTo: ana.data.user._id } })).data;
  const other = (await call('POST', '/workorders', { as: a.token, body: { title: 'Otra orden', description: 'Asignada a otro técnico', assignedTo: beto.data.user._id } })).data;
  const anaToken = await login('ana@campo.com', ana.data.temporaryPassword);
  const list = await call('GET', '/workorders?assigned=me', { as: anaToken });
  assert.deepEqual(list.data.items.map((o) => o.title), ['Revisar bomba']);
  assert.equal(list.data.items[0].client.name, 'Planta Norte');
  const started = await call('PATCH', `/workorders/${mine._id}/status`, { as: anaToken, body: { status: 'en_proceso' } });
  assert.equal(started.status, 200);
  assert.ok(started.data.startedAt);
  const done = await call('PATCH', `/workorders/${mine._id}/status`, { as: anaToken, body: { status: 'completada', note: 'Se cambió el sello' } });
  assert.equal(done.data.status, 'completada');
  assert.ok(done.data.completedAt);
  assert.match(done.data.notes, /\[.* · Ana\] Se cambió el sello/);
  assert.equal((await call('PATCH', `/workorders/${other._id}/status`, { as: anaToken, body: { status: 'completada' } })).status, 403);
  assert.equal((await call('PATCH', `/workorders/${mine._id}/status`, { as: anaToken, body: { status: 'volando' } })).status, 400);
  assert.equal((await call('PATCH', `/workorders/${other._id}/status`, { as: a.token, body: { status: 'cancelada' } })).status, 200);
  const b = await company('Ajena');
  assert.equal((await call('PATCH', `/workorders/${mine._id}/status`, { as: b.token, body: { status: 'pendiente' } })).status, 404);
});
