const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, reset, call, company, origin } = require('./helpers');

before(start);
after(stop);
beforeEach(reset);

// Un PNG real de 1×1 píxel.
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

test('el administrador pone el logo y los colores de su empresa; todos los ven al entrar', async () => {
  const a = await company('Frío Total');
  const r = await call('PUT', '/company/branding', { as: a.token, body: { primary: '#E11D48', accent: '#f59e0b', logo: PNG } });
  assert.equal(r.status, 200);
  assert.equal(r.data.primary, '#e11d48');
  assert.equal(r.data.hasLogo, true);
  const me = await call('GET', '/auth/profile', { as: a.token });
  assert.deepEqual({ ...me.data.company.branding, logoVersion: 0 }, { primary: '#e11d48', accent: '#f59e0b', hasLogo: true, logoVersion: 0 });
  const logo = await fetch(`${origin()}/api/public/logo/${a.id}`);
  assert.equal(logo.status, 200);
  assert.equal(logo.headers.get('content-type'), 'image/png');
  assert.equal(Buffer.from(await logo.arrayBuffer()).length, 70);
  const off = await call('PUT', '/company/branding', { as: a.token, body: { logo: null, primary: null } });
  assert.equal(off.data.hasLogo, false);
  assert.equal(off.data.primary, null);
  assert.equal(off.data.accent, '#f59e0b');                                                      // lo que no se envía, queda
  assert.equal((await fetch(`${origin()}/api/public/logo/${a.id}`)).status, 404);
});

test('solo imágenes de verdad, livianas, y colores válidos; solo el administrador', async () => {
  const a = await company('Redes SAS');
  const bad = (body) => call('PUT', '/company/branding', { as: a.token, body });
  assert.equal((await bad({ primary: 'rojo' })).status, 400);
  assert.equal((await bad({ logo: 'data:image/svg+xml;base64,PHN2Zz48c2NyaXB0Pg==' })).status, 400);    // SVG puede llevar código
  assert.equal((await bad({ logo: `data:image/png;base64,${Buffer.from('no soy png').toString('base64')}` })).status, 400);
  const big = `data:image/png;base64,${Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(310 * 1024)]).toString('base64')}`;
  const r = await bad({ logo: big });
  assert.equal(r.status, 400);
  assert.match(r.data.message, /300 KB/);
  const tech = await call('POST', '/users', { as: a.token, body: { name: 'Téc', email: 't@redes.co', role: 'tecnico' } });
  const login = await call('POST', '/auth/login', { body: { email: 't@redes.co', password: tech.data.temporaryPassword } });
  assert.equal((await call('PUT', '/company/branding', { as: login.data.token, body: { primary: '#000000' } })).status, 403);
  assert.equal((await fetch(`${origin()}/api/public/logo/no-es-id`)).status, 400);
});
