const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, reset, call, company, login, KEY } = require('./helpers');

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
  assert.deepEqual(made.data.company.usage, { technicians: 0, users: 1, workOrders: 0, adminEntered: false, completedOrders: 0, reportsShared: 0, quotesSent: 0 });
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
  assert.deepEqual(u, { technicians: 0, users: 1, workOrders: 3, adminEntered: true, completedOrders: 2, reportsShared: 1, quotesSent: 1 });
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
