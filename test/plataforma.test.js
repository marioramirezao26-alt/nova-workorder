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
  assert.deepEqual(made.data.company.usage, { technicians: 0, users: 1, workOrders: 0, adminEntered: false });
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

test('el inicio de sesión se bloquea tras 10 intentos fallidos', async () => {
  const a = await company('Fuerza Bruta');
  for (let i = 0; i < 10; i += 1) {
    assert.equal((await call('POST', '/auth/login', { body: { email: a.email, password: `mal-${i}` } })).status, 401);
  }
  assert.equal((await call('POST', '/auth/login', { body: { email: a.email, password: 'Clave-segura-123' } })).status, 429);
  assert.equal(await login('otro@correo.com', 'x'), undefined);
});
