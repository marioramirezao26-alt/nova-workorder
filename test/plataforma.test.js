const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, reset, call, company, login, KEY } = require('./helpers');
const mongoose = require('mongoose');
const Company = require('../src/models/Company');
const WorkOrder = require('../src/models/WorkOrder');
const Quote = require('../src/models/Quote');

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const HOUR = 60 * 60 * 1000;
const ago = (ms) => new Date(Date.now() - ms);
// Cambia fechas directo en la base (sin Mongoose ni `timestamps`) para simular el paso del tiempo.
const backdate = (Model, _id, fields) => Model.collection.updateOne({ _id: new mongoose.Types.ObjectId(String(_id)) }, { $set: fields });

before(start);
after(stop);
beforeEach(reset);

test('la API de plataforma exige la llave', async () => {
  assert.equal((await call('GET', '/platform/companies')).status, 401);
  assert.equal((await call('GET', '/platform/companies', { platformKey: 'otra-llave' })).status, 401);
  assert.equal((await call('GET', '/platform/companies', { platformKey: KEY })).status, 200);
});

test('GABY entrega el producto: crea la empresa y su administrador, que cambia la contraseña al entrar', async () => {
  const made = await call('POST', '/platform/companies', { platformKey: KEY, body: {
    name: 'Mantenimientos Andinos S.A.S.', adminName: 'Laura Gómez', adminEmail: 'Laura@Andinos.co', maxTechnicians: 5 } });
  assert.equal(made.status, 201);
  assert.equal(made.data.company.slug, 'mantenimientos-andinos-s-a-s');
  // recién creada, nadie ha entrado ni hay actividad: fechas en null y conteos en 0
  assert.deepEqual(made.data.company.usage, { technicians: 0, users: 1, workOrders: 0, adminEntered: false, completedOrders: 0, reportsShared: 0, quotesSent: 0,
    lastLoginAt: null, lastActivityAt: null, ordersLast24h: 0, activeTechnicians7d: 0 });
  assert.equal(made.data.admin.email, 'laura@andinos.co');
  const first = await call('POST', '/auth/login', { body: { email: 'laura@andinos.co', password: made.data.admin.temporaryPassword } });
  assert.equal(first.status, 200);
  assert.equal(first.data.mustChangePassword, true);
  assert.equal(first.data.company.name, 'Mantenimientos Andinos S.A.S.');
  assert.equal((await call('PUT', '/auth/password', { as: first.data.token, body: { currentPassword: 'mala', newPassword: 'Nueva-clave-99' } })).status, 400);
  assert.equal((await call('PUT', '/auth/password', { as: first.data.token, body: { currentPassword: made.data.admin.temporaryPassword, newPassword: 'Nueva-clave-99' } })).status, 200);
  const again = await call('POST', '/auth/login', { body: { email: 'laura@andinos.co', password: 'Nueva-clave-99' } });
  assert.equal(again.data.mustChangePassword, false);
  // GABY ve que el administrador ya entró (cambió la contraseña temporal)
  assert.equal((await call('GET', `/platform/companies/${made.data.company._id}`, { platformKey: KEY })).data.usage.adminEntered, true);
  // el mismo email no se puede vender dos veces
  assert.equal((await call('POST', '/platform/companies', { platformKey: KEY, body: { name: 'Otra', adminName: 'X', adminEmail: 'laura@andinos.co' } })).status, 409);
  // nombre repetido: slug distinto
  const twin = await call('POST', '/platform/companies', { platformKey: KEY, body: { name: 'Mantenimientos Andinos S.A.S.', adminName: 'Y', adminEmail: 'y@andinos2.co' } });
  assert.notEqual(twin.data.company.slug, made.data.company.slug);
});

test('suspender por falta de pago corta el acceso y reactivar lo devuelve; el plan se ajusta', async () => {
  const a = await company('Pagos Pendientes');
  assert.equal((await call('PATCH', `/platform/companies/${a.id}`, { platformKey: KEY, body: { status: 'suspendida' } })).status, 200);
  assert.equal((await call('GET', '/workorders', { as: a.token })).status, 402);
  const blocked = await call('POST', '/auth/login', { body: { email: a.email, password: 'Clave-segura-123' } });
  assert.equal(blocked.status, 402);
  assert.match(blocked.data.message, /suspendida/);
  await call('PATCH', `/platform/companies/${a.id}`, { platformKey: KEY, body: { status: 'activa', maxTechnicians: 3 } });
  assert.equal((await call('GET', '/workorders', { as: a.token })).status, 200);
  await call('POST', '/users', { as: a.token, body: { name: 'T', email: 't@pagos.com', role: 'tecnico' } });
  const info = await call('GET', `/platform/companies/${a.id}`, { platformKey: KEY });
  assert.equal(info.data.maxTechnicians, 3);
  assert.equal(info.data.usage.technicians, 1);
  assert.equal((await call('PATCH', `/platform/companies/${a.id}`, { platformKey: KEY, body: { status: 'borrada' } })).status, 400);
});

test('el uso para GABY suma órdenes completadas, informes compartidos y cotizaciones enviadas (sin quitar campos)', async () => {
  const a = await company('Uso Completo');
  const usage = async () => (await call('GET', `/platform/companies/${a.id}`, { platformKey: KEY })).data.usage;
  const client = (await call('POST', '/clients', { as: a.token, body: { name: 'Hotel Sol' } })).data;
  const order = async (title) => (await call('POST', '/workorders', { as: a.token, body: { title, description: 'Trabajo de mantenimiento', client: client._id } })).data;
  const o1 = await order('Una');
  const o2 = await order('Dos');
  await order('Tres');
  await call('PATCH', `/workorders/${o1._id}/status`, { as: a.token, body: { status: 'completada' } });
  await call('PATCH', `/workorders/${o2._id}/status`, { as: a.token, body: { status: 'completada' } });
  await call('POST', `/workorders/${o1._id}/report-link`, { as: a.token });
  await call('POST', `/workorders/${o1._id}/report-link`, { as: a.token, body: { rotate: true } });   // el mismo informe: cuenta una vez
  const quote = async (title) => (await call('POST', '/quotes', { as: a.token, body: { client: client._id, title, items: [{ description: title, qty: 1, unitPrice: 1000 }] } })).data;
  const q1 = await quote('Enviada');
  await quote('Borrador');
  await call('POST', `/quotes/${q1._id}/send`, { as: a.token });
  await call('POST', `/quotes/${q1._id}/send`, { as: a.token });                                    // reenviar no suma

  const u = await usage();
  const { lastLoginAt, lastActivityAt, ...counts } = u;
  assert.deepEqual(counts, { technicians: 0, users: 1, workOrders: 3, adminEntered: true, completedOrders: 2, reportsShared: 1, quotesSent: 1,
    ordersLast24h: 3, activeTechnicians7d: 0 });
  assert.match(lastLoginAt, ISO);
  assert.match(lastActivityAt, ISO);
  // la lista de empresas trae el mismo uso
  const listed = (await call('GET', '/platform/companies', { platformKey: KEY })).data.items.find((c) => c._id === a.id);
  assert.deepEqual(listed.usage, u);
  // otra empresa no suma aquí
  const b = await company('Otra Empresa');
  const ob = (await call('POST', '/workorders', { as: b.token, body: { title: 'Orden B', description: 'Trabajo de la otra empresa' } })).data;
  await call('PATCH', `/workorders/${ob._id}/status`, { as: b.token, body: { status: 'completada' } });
  assert.equal((await usage()).completedOrders, 2);
});

test('el inicio de sesión se bloquea tras 10 intentos fallidos', async () => {
  const a = await company('Fuerza Bruta');
  for (let i = 0; i < 10; i += 1) {
    assert.equal((await call('POST', '/auth/login', { body: { email: a.email, password: `mal-${i}` } })).status, 401);
  }
  assert.equal((await call('POST', '/auth/login', { body: { email: a.email, password: 'Clave-segura-123' } })).status, 429);
  assert.equal(await login('otro@correo.com', 'x'), undefined);
});

test('una empresa de Estados Unidos arranca la app en inglés; el idioma se puede cambiar', async () => {
  const made = await call('POST', '/platform/companies', { platformKey: KEY, body: {
    name: 'Cool Air LLC', adminName: 'Joe Miller', adminEmail: 'joe@coolair.com', maxTechnicians: 5, lang: 'en' } });
  assert.equal(made.status, 201);
  assert.equal(made.data.company.lang, 'en');
  const first = await call('POST', '/auth/login', { body: { email: 'joe@coolair.com', password: made.data.admin.temporaryPassword } });
  assert.equal(first.data.company.lang, 'en');
  assert.equal((await call('GET', '/auth/profile', { as: first.data.token })).data.company.lang, 'en');
  assert.equal((await call('POST', '/platform/companies', { platformKey: KEY, body: { name: 'X', adminName: 'X', adminEmail: 'x@x.co', lang: 'fr' } })).status, 400);
  const back = await call('PATCH', `/platform/companies/${made.data.company._id}`, { platformKey: KEY, body: { lang: 'es' } });
  assert.equal(back.data.lang, 'es');
  const co = await call('POST', '/platform/companies', { platformKey: KEY, body: { name: 'Frío', adminName: 'L', adminEmail: 'l@frio.co' } });
  assert.equal(co.data.company.lang, 'es');                                                     // sin decir nada: español
});

test('un ingreso actualiza lastLoginAt de la empresa, como mucho una vez por minuto', async () => {
  const made = await call('POST', '/platform/companies', { platformKey: KEY, body: { name: 'Ingresos', adminName: 'Ana', adminEmail: 'ana@ingresos.co' } });
  const id = made.data.company._id;
  const usage = async () => (await call('GET', `/platform/companies/${id}`, { platformKey: KEY })).data.usage;
  assert.equal((await usage()).lastLoginAt, null);
  // una clave mala no es un ingreso
  assert.equal((await call('POST', '/auth/login', { body: { email: 'ana@ingresos.co', password: 'mala' } })).status, 401);
  assert.equal((await usage()).lastLoginAt, null);

  const before = Date.now();
  const token = await login('ana@ingresos.co', made.data.admin.temporaryPassword);
  const first = (await usage()).lastLoginAt;
  assert.match(first, ISO);
  assert.ok(new Date(first).getTime() >= before - 1000 && new Date(first).getTime() <= Date.now());

  // otro ingreso dentro del mismo minuto no vuelve a escribir
  await backdate(Company, id, { lastLoginAt: ago(30 * 1000) });
  const recent = (await usage()).lastLoginAt;
  await call('POST', '/auth/login', { body: { email: 'ana@ingresos.co', password: 'Clave-nueva-456' } });
  assert.equal((await usage()).lastLoginAt, recent);

  // pasado el minuto, cualquier usuario de la empresa (aquí un técnico) lo mueve; `updatedAt` de la empresa no cambia
  await backdate(Company, id, { lastLoginAt: ago(2 * 60 * 1000) });
  const updatedAt = (await Company.findById(id).lean()).updatedAt.getTime();
  const tech = await call('POST', '/users', { as: token, body: { name: 'Tec', email: 'tec@ingresos.co', role: 'tecnico' } });
  await login('tec@ingresos.co', tech.data.temporaryPassword);
  const moved = (await usage()).lastLoginAt;
  assert.ok(new Date(moved).getTime() > Date.now() - 10 * 1000);
  assert.equal((await Company.findById(id).lean()).updatedAt.getTime(), updatedAt);

  // el ingreso de otra empresa no cuenta aquí
  await backdate(Company, id, { lastLoginAt: ago(HOUR) });
  const quiet = (await usage()).lastLoginAt;
  await company('Otra Que Entra');
  assert.equal((await usage()).lastLoginAt, quiet);
});

test('lastActivityAt es lo más reciente entre órdenes (con su informe) y cotizaciones', async () => {
  const a = await company('Actividad');
  const usage = async () => (await call('GET', `/platform/companies/${a.id}`, { platformKey: KEY })).data.usage;
  assert.equal((await usage()).lastActivityAt, null);                                   // entró, pero no ha hecho nada

  const order = (await call('POST', '/workorders', { as: a.token, body: { title: 'Orden', description: 'Trabajo de mantenimiento' } })).data;
  assert.equal((await usage()).lastActivityAt, new Date(order.updatedAt).toISOString());

  // una orden vieja: compartir su informe cuenta como actividad
  await backdate(WorkOrder, order._id, { createdAt: ago(5 * 24 * HOUR), updatedAt: ago(5 * 24 * HOUR) });
  const stored = async () => (await WorkOrder.findOne({ tenant: a.id, _id: order._id }).lean()).updatedAt.toISOString();
  assert.equal((await usage()).lastActivityAt, await stored());
  await call('POST', `/workorders/${order._id}/report-link`, { as: a.token });
  assert.ok(new Date((await usage()).lastActivityAt).getTime() > Date.now() - 10 * 1000);

  // una cotización más nueva que la orden manda
  await backdate(WorkOrder, order._id, { updatedAt: ago(3 * HOUR) });
  const client = (await call('POST', '/clients', { as: a.token, body: { name: 'Hotel Luna' } })).data;
  const quote = (await call('POST', '/quotes', { as: a.token, body: { client: client._id, title: 'Cot', items: [{ description: 'X', qty: 1, unitPrice: 1000 }] } })).data;
  assert.equal((await usage()).lastActivityAt, new Date(quote.updatedAt).toISOString());
  // y si la orden es la más reciente, manda la orden
  await backdate(Quote, quote._id, { updatedAt: ago(2 * HOUR) });
  await backdate(WorkOrder, order._id, { updatedAt: ago(HOUR) });
  assert.equal((await usage()).lastActivityAt, await stored());
});

test('ordersLast24h cuenta solo las órdenes creadas en las últimas 24 horas de esa empresa', async () => {
  const a = await company('Ultimo Dia');
  const usage = async () => (await call('GET', `/platform/companies/${a.id}`, { platformKey: KEY })).data.usage;
  const order = async (title) => (await call('POST', '/workorders', { as: a.token, body: { title, description: 'Trabajo de mantenimiento' } })).data;
  const o1 = await order('Vieja');
  await order('Nueva');
  assert.equal((await usage()).ordersLast24h, 2);
  await backdate(WorkOrder, o1._id, { createdAt: ago(25 * HOUR) });
  const u = await usage();
  assert.equal(u.ordersLast24h, 1);
  assert.equal(u.workOrders, 2);                                                        // el total no cambia
  const b = await company('Otra Del Dia');
  await call('POST', '/workorders', { as: b.token, body: { title: 'De B', description: 'Trabajo de la otra empresa' } });
  assert.equal((await usage()).ordersLast24h, 1);
});

test('activeTechnicians7d cuenta técnicos distintos con órdenes iniciadas o completadas en 7 días', async () => {
  const a = await company('Tecnicos Activos');
  const usage = async () => (await call('GET', `/platform/companies/${a.id}`, { platformKey: KEY })).data.usage;
  const tech = async (name) => {
    const made = await call('POST', '/users', { as: a.token, body: { name, email: `${name.toLowerCase()}@activos.co`, role: 'tecnico' } });
    return { id: made.data.user._id, token: await login(`${name.toLowerCase()}@activos.co`, made.data.temporaryPassword) };
  };
  const ana = await tech('Ana');
  const beto = await tech('Beto');
  await tech('Caro');                                                                    // técnica sin órdenes
  const order = async (assignedTo) => (await call('POST', '/workorders', { as: a.token,
    body: { title: 'Orden', description: 'Trabajo de mantenimiento', assignedTo } })).data;
  const o1 = await order(ana.id);
  const o2 = await order(ana.id);
  const o3 = await order(beto.id);
  await order(beto.id);                                                                  // asignada pero sin empezar
  assert.equal((await usage()).activeTechnicians7d, 0);

  assert.equal((await call('PATCH', `/workorders/${o1._id}/status`, { as: ana.token, body: { status: 'en_proceso' } })).status, 200);
  await call('PATCH', `/workorders/${o2._id}/status`, { as: ana.token, body: { status: 'en_proceso' } });
  assert.equal((await usage()).activeTechnicians7d, 1);                                  // la misma técnica cuenta una vez
  await call('PATCH', `/workorders/${o3._id}/status`, { as: a.token, body: { status: 'completada' } });
  assert.equal((await usage()).activeTechnicians7d, 2);                                  // completada (sin iniciar) también

  // lo de hace más de 7 días ya no cuenta
  await backdate(WorkOrder, o3._id, { completedAt: ago(8 * 24 * HOUR) });
  assert.equal((await usage()).activeTechnicians7d, 1);
  await backdate(WorkOrder, o1._id, { startedAt: ago(8 * 24 * HOUR) });
  assert.equal((await usage()).activeTechnicians7d, 1);                                  // Ana sigue por la otra orden
  await backdate(WorkOrder, o2._id, { startedAt: ago(8 * 24 * HOUR) });
  assert.equal((await usage()).activeTechnicians7d, 0);

  // una orden completada sin técnico (la cierra el administrador) no suma técnicos
  const loose = await order(undefined);
  await call('PATCH', `/workorders/${loose._id}/status`, { as: a.token, body: { status: 'completada' } });
  assert.equal((await usage()).activeTechnicians7d, 0);
});

test('el uso no lleva datos de personas: solo fechas y conteos', async () => {
  const a = await company('Sin Datos Personales');
  const u = (await call('GET', `/platform/companies/${a.id}`, { platformKey: KEY })).data.usage;
  for (const [k, v] of Object.entries(u)) {
    assert.ok(typeof v === 'number' || typeof v === 'boolean' || v === null || ISO.test(v), `${k} no es fecha ni conteo: ${v}`);
  }
  assert.ok(!JSON.stringify(u).includes(a.email));
});

test('las consultas nuevas del uso van por índice de la empresa (sin recorrer toda la colección)', async () => {
  const a = await company('Indices Uso');
  await call('POST', '/workorders', { as: a.token, body: { title: 'Orden', description: 'Trabajo de mantenimiento' } });
  const tenant = new mongoose.Types.ObjectId(a.id);
  const stages = (plan) => JSON.stringify(plan.queryPlanner.winningPlan);
  const since = ago(7 * 24 * HOUR);
  const plans = [
    await WorkOrder.collection.find({ tenant }).sort({ updatedAt: -1 }).limit(1).explain(),
    await Quote.collection.find({ tenant }).sort({ updatedAt: -1 }).limit(1).explain(),
    await WorkOrder.collection.find({ tenant, createdAt: { $gte: ago(24 * HOUR) } }).explain(),
    await WorkOrder.collection.find({ tenant, assignedTo: { $ne: null },
      $or: [{ tenant, startedAt: { $gte: since } }, { tenant, completedAt: { $gte: since } }] }).explain(),
  ];
  for (const plan of plans) {
    assert.ok(stages(plan).includes('IXSCAN'), `sin índice: ${stages(plan)}`);
    assert.ok(!stages(plan).includes('COLLSCAN'), `recorre la colección: ${stages(plan)}`);
  }
});
