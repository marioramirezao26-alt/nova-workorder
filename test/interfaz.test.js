const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

// Con frontend/dist presente, el backend sirve la interfaz y deja /api para la API (un solo origen en producción).
const dist = path.join(__dirname, '..', 'frontend', 'dist');
const created = !fs.existsSync(path.join(dist, 'index.html'));
if (created) {
  fs.mkdirSync(path.join(dist, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(dist, 'index.html'), '<!doctype html><title>NOVA</title><div id="root"></div>');
  fs.writeFileSync(path.join(dist, 'assets', 'app.js'), 'console.log(1)');
}
const { start, stop, call, origin } = require('./helpers');

before(start);
after(async () => {
  await stop();
  if (created) fs.rmSync(dist, { recursive: true, force: true });
});

test('sirve la interfaz y sus rutas, sin tapar la API', async () => {
  assert.equal((await call('GET', '/health')).status, 200);
  const root = await fetch(`${origin()}/`);
  assert.equal(root.status, 200);
  assert.match(await root.text(), /NOVA|root/);
  assert.equal((await fetch(`${origin()}/ordenes/123`)).status, 200);      // rutas del frontend → index.html
  const asset = await fetch(`${origin()}/assets/${created ? 'app.js' : fs.readdirSync(path.join(dist, 'assets'))[0]}`);
  assert.equal(asset.status, 200);
  assert.equal((await call('GET', '/no-existe')).status, 404);                  // /api desconocida sigue en JSON 404
  assert.equal(root.headers.get('x-frame-options'), 'DENY');
});
