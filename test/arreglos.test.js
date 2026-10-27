// Arreglos rápidos de la revisión de producto (27-oct-2026): correo del cliente opcional, celular del técnico para
// avisarle por WhatsApp y el aviso de Inicio de cotizaciones aprobadas sin técnico (con su filtro en «Órdenes»).
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { start, stop, reset, call, company, login } = require('./helpers');
const Client = require('../src/models/Client');

before(start);
after(stop);
beforeEach(reset);

test('el correo del cliente es opcional: varios clientes sin correo, pero un correo repetido sigue sin poderse', async () => {
  const a = await company('Frío Andino');
  const sin = await call('POST', '/clients', { as: a.token, body: { name: 'Panadería La Espiga', phone: '3001234567' } });
  assert.equal(sin.status, 201);
  assert.equal(sin.data.email, '');                                   // sale vacío, como los demás campos sin dato
  const raw = await mongoose.connection.collection('clients').findOne({ _id: new mongoose.Types.ObjectId(sin.data._id) });
  assert.equal('email' in raw, false);                               // no se guarda: el índice único no choca
  assert.equal((await call('POST', '/clients', { as: a.token, body: { name: 'Casa de doña Rosa', email: '' } })).status, 201);
  assert.equal((await call('POST', '/clients', { as: a.token, body: { name: 'Tienda Don Pepe', email: '   ' } })).status, 201);
  assert.equal((await call('GET', '/clients', { as: a.token })).data.items.length, 3);

  // con correo: tiene que ser válido y no repetirse en la empresa
  assert.equal((await call('POST', '/clients', { as: a.token, body: { name: 'Malo', email: 'no-es-correo' } })).status, 400);
  const con = await call('POST', '/clients', { as: a.token, body: { name: 'Hotel Sol', email: 'Compras@HotelSol.com' } });
  assert.equal(con.data.email, 'compras@hotelsol.com');
  const dup = await call('POST', '/clients', { as: a.token, body: { name: 'Hotel Sol 2', email: 'compras@hotelsol.com' } });
  assert.equal(dup.status, 400);
  assert.match(dup.data.message, /Ya existe un cliente con ese email/);
  assert.equal((await call('POST', '/clients', { as: a.token, body: { email: 'x@y.com' } })).status, 400);   // el nombre sí es obligatorio

  // editar: quitarle el correo a uno y ponérselo a otro (sin chocar con los que no tienen)
  const quitado = await call('PUT', `/clients/${con.data._id}`, { as: a.token, body: { name: 'Hotel Sol', email: '' } });
  assert.equal(quitado.status, 200);
  assert.equal(quitado.data.email, '');
  const puesto = await call('PUT', `/clients/${sin.data._id}`, { as: a.token, body: { name: 'Panadería La Espiga', email: 'espiga@correo.co' } });
  assert.equal(puesto.data.email, 'espiga@correo.co');
  assert.equal((await call('PUT', `/clients/${con.data._id}`, { as: a.token, body: { name: 'Hotel Sol', email: 'espiga@correo.co' } })).status, 400);
  // un cambio que no toca el correo lo conserva
  assert.equal((await call('PUT', `/clients/${sin.data._id}`, { as: a.token, body: { name: 'La Espiga' } })).data.email, 'espiga@correo.co');
});

test('un cliente sin correo sirve para órdenes, cotizaciones (enviar y aprobar) y su informe público', async () => {
  const a = await company('Frío Andino');
  const client = (await call('POST', '/clients', { as: a.token, body: { name: 'Casa de doña Rosa', phone: '3001234567' } })).data;
  const order = (await call('POST', '/workorders', { as: a.token, body: { title: 'Nevera', description: 'No enfría desde el lunes', client: client._id } })).data;
  assert.equal(order.client.email, '');
  assert.equal((await call('PATCH', `/workorders/${order._id}/status`, { as: a.token, body: { status: 'completada' } })).status, 200);
  const link = await call('POST', `/workorders/${order._id}/report-link`, { as: a.token });
  assert.equal((await call('GET', `/informes/${link.data.token}`)).status, 200);

  const q = (await call('POST', '/quotes', { as: a.token, body: { client: client._id, title: 'Compresor', items: [{ description: 'Compresor', qty: 1, unitPrice: 850000 }] } })).data;
  assert.ok(!q.client.email);
  const sent = await call('POST', `/quotes/${q._id}/send`, { as: a.token });
  assert.equal(sent.status, 200);
  const token = sent.data.path.split('/').pop();
  assert.equal((await call('POST', `/cotizaciones/${token}/aprobar`, { body: { name: 'Rosa Gómez', accept: true } })).status, 200);
});

test('al arrancar se cambia el índice viejo de correo (único para todos) por el nuevo, sin tocar los datos', async () => {
  const a = await company('Índice Viejo');
  await call('POST', '/clients', { as: a.token, body: { name: 'Con correo', email: 'uno@viejo.com' } });
  const clients = mongoose.connection.collection('clients');
  await clients.dropIndex('tenant_1_email_1_con_correo');
  await clients.createIndex({ tenant: 1, email: 1 }, { unique: true, name: 'tenant_1_email_1' });   // como en producción

  await Client.syncEmailIndex();
  await Client.syncEmailIndex();                                      // idempotente
  const names = (await clients.indexes()).map((i) => i.name);
  assert.ok(!names.includes('tenant_1_email_1'));
  assert.ok(names.includes('tenant_1_email_1_con_correo'));
  assert.equal((await call('POST', '/clients', { as: a.token, body: { name: 'Sin correo 1' } })).status, 201);
  assert.equal((await call('POST', '/clients', { as: a.token, body: { name: 'Sin correo 2' } })).status, 201);
  assert.equal((await call('POST', '/clients', { as: a.token, body: { name: 'Repetido', email: 'uno@viejo.com' } })).status, 400);
});

test('el celular del técnico: lo pone el administrador y lo ve quien asigna órdenes', async () => {
  const a = await company('Frío Andino');
  const made = await call('POST', '/users', { as: a.token, body: { name: 'Juan Gómez', email: 'juan@frio.com', role: 'tecnico', phone: '300 123 4567' } });
  assert.equal(made.status, 201);
  assert.equal(made.data.user.phone, '300 123 4567');
  const sin = await call('POST', '/users', { as: a.token, body: { name: 'Pedro Ruiz', email: 'pedro@frio.com', role: 'tecnico' } });
  assert.equal(sin.data.user.phone, '');
  assert.equal((await call('POST', '/users', { as: a.token, body: { name: 'X', email: 'x@frio.com', role: 'tecnico', phone: '1'.repeat(31) } })).status, 400);
  const edited = await call('PUT', `/users/${sin.data.user._id}`, { as: a.token, body: { phone: '3109876543' } });
  assert.equal(edited.status, 200);
  assert.equal(edited.data.user.phone, '3109876543');
  // el técnico también crea y asigna órdenes: ve el celular de sus compañeros
  const juan = await login('juan@frio.com', made.data.temporaryPassword);
  const seen = (await call('GET', '/users', { as: juan })).data.items;
  assert.equal(seen.find((u) => u.name === 'Pedro Ruiz').phone, '3109876543');
  // y no puede cambiarlo
  assert.equal((await call('PUT', `/users/${sin.data.user._id}`, { as: juan, body: { phone: '1' } })).status, 403);
});

test('Inicio avisa las cotizaciones aprobadas sin técnico y «Órdenes» las filtra', async () => {
  const a = await company('Frío Andino');
  const made = await call('POST', '/users', { as: a.token, body: { name: 'Juan Gómez', email: 'juan@frio.com', role: 'tecnico' } });
  const tech = await login('juan@frio.com', made.data.temporaryPassword);
  const client = (await call('POST', '/clients', { as: a.token, body: { name: 'Hotel Sol' } })).data;
  const approve = async (title) => {
    const q = (await call('POST', '/quotes', { as: a.token, body: { client: client._id, title, items: [{ description: title, qty: 1, unitPrice: 100000 }] } })).data;
    const token = (await call('POST', `/quotes/${q._id}/send`, { as: a.token })).data.path.split('/').pop();
    await call('POST', `/cotizaciones/${token}/aprobar`, { body: { name: 'Marta Ruiz', accept: true } });
  };
  assert.equal((await call('GET', '/dashboard/summary', { as: a.token })).data.approvedQuotesUnassigned, 0);
  await approve('Compresor');
  await approve('Ventilador');
  await call('POST', '/workorders', { as: a.token, body: { title: 'Orden suelta', description: 'Sin cotización detrás' } });   // no cuenta

  assert.equal((await call('GET', '/dashboard/summary', { as: a.token })).data.approvedQuotesUnassigned, 2);
  const list = async () => (await call('GET', '/workorders?origin=quote&assigned=none&status=open', { as: a.token })).data.items;
  assert.deepEqual((await list()).map((o) => o.title).sort(), ['Cotización #1: Compresor', 'Cotización #2: Ventilador']);

  // asignar una y cancelar la otra: el aviso se va
  const [first, second] = await list();
  const edit = (o, changes) => call('PUT', `/workorders/${o._id}`, { as: a.token, body: { title: o.title, description: o.description, ...changes } });
  const juan = (await call('GET', '/users', { as: a.token })).data.items.find((u) => u.role === 'tecnico');
  assert.equal((await edit(first, { assignedTo: juan._id })).status, 200);
  assert.equal((await call('GET', '/dashboard/summary', { as: a.token })).data.approvedQuotesUnassigned, 1);
  assert.equal((await edit(second, { status: 'cancelada' })).status, 200);
  assert.equal((await call('GET', '/dashboard/summary', { as: a.token })).data.approvedQuotesUnassigned, 0);
  assert.equal((await list()).length, 0);
  // el aviso es del administrador; el técnico no lo recibe
  assert.equal((await call('GET', '/dashboard/summary', { as: tech })).data.approvedQuotesUnassigned, 0);
  // los filtros de siempre siguen iguales
  assert.equal((await call('GET', '/workorders?status=pendiente', { as: a.token })).data.items.length, 2);
  assert.equal((await call('GET', '/workorders?status=inventado', { as: a.token })).data.items.length, 0);
});
