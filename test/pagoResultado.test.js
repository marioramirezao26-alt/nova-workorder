// Orden 65: la página /pago/resultado (a la que Mercado Pago devuelve a quien paga) y su consulta a GABY.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { start, stop, reset, call } = require('./helpers');
const { resetLimits } = require('../src/utils/rateStore');

const LLAVE = 'llave-resultado-de-prueba';
let fake;
let got;             // lo que recibió GABY
let respuesta;       // cómo responde GABY: { code, body } o 'caido'

before(async () => {
  await start();
  fake = http.createServer((req, res) => {
    got.push({ url: req.url, key: req.headers['x-mp-resultado-key'] });
    if (respuesta === 'caido') return req.socket.destroy();
    res.writeHead(respuesta.code, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(respuesta.body));
  }).listen(0);
});
after(async () => { fake.close(); await stop(); });

beforeEach(async () => {
  await reset();
  await resetLimits();
  got = [];
  respuesta = { code: 200, body: { estado: 'aprobado' } };
  process.env.GABY_MP_RESULTADO_URL = `http://127.0.0.1:${fake.address().port}/api/mercadopago/resultado`;
  process.env.GABY_MP_RESULTADO_KEY = LLAVE;
});

const consulta = (pid = '777', ref = 'NW-1-1700000000') => call('GET', `/public/pago/resultado?payment_id=${pid}&referencia=${ref}`);

test('la consulta le pregunta a GABY con la llave y devuelve solo el estado', async () => {
  for (const estado of ['aprobado', 'pendiente', 'rechazado', 'desconocido']) {
    respuesta = { code: 200, body: { estado, payer: { email: 'no@debe.pasar' } } };
    const r = await consulta();
    assert.equal(r.status, 200);
    assert.deepEqual(r.data, { estado });                                         // nada más que el estado
  }
  assert.equal(got.length, 4);
  assert.equal(got[0].key, LLAVE);
  assert.match(got[0].url, /^\/api\/mercadopago\/resultado\?payment_id=777&referencia=NW-1-1700000000$/);
});

test('sin datos válidos no consulta nada; sin la llave configurada responde 503', async () => {
  assert.equal((await consulta('abc')).status, 400);
  assert.equal((await consulta('777', 'con espacio%20aqui')).status, 400);
  assert.equal((await consulta('777', '')).status, 400);
  assert.equal((await call('GET', '/public/pago/resultado')).status, 400);
  assert.equal(got.length, 0);
  process.env.GABY_MP_RESULTADO_KEY = '';
  const r = await consulta();
  assert.equal(r.status, 503);
  assert.equal(r.data.estado, 'desconocido');
  assert.equal(got.length, 0);
});

test('si GABY no responde, rechaza la llave o dice algo raro, el estado es desconocido (nunca aprobado)', async () => {
  respuesta = 'caido';
  assert.deepEqual((await consulta()).data, { estado: 'desconocido' });
  respuesta = { code: 403, body: { detail: 'forbidden' } };
  assert.deepEqual((await consulta()).data, { estado: 'desconocido' });
  respuesta = { code: 503, body: { detail: 'apagado' } };
  assert.deepEqual((await consulta()).data, { estado: 'desconocido' });
  respuesta = { code: 200, body: { estado: 'approved' } };                       // no es uno de los nuestros
  assert.deepEqual((await consulta()).data, { estado: 'desconocido' });
  respuesta = { code: 200, body: 'texto' };
  assert.deepEqual((await consulta()).data, { estado: 'desconocido' });
});

test('la consulta tiene límite por IP', async () => {
  for (let i = 0; i < 30; i += 1) assert.equal((await consulta()).status, 200);
  const r = await consulta();
  assert.equal(r.status, 429);
  assert.equal(r.data.estado, 'desconocido');
  assert.equal(got.length, 30);
});

test('la página de retorno existe, no se indexa, consulta al servidor y nunca lee el status de la URL', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'landing', 'pago', 'resultado.html'), 'utf8');
  assert.match(html, /<meta name="robots" content="noindex" \/>/);
  assert.match(html, /fetch\('\/api\/public\/pago\/resultado\?payment_id='/);
  assert.match(html, /q\.get\('payment_id'\)/);
  assert.match(html, /q\.get\('external_reference'\)/);
  assert.doesNotMatch(html, /q\.get\('status'\)|q\.get\('collection_status'\)/);  // el estado no sale de la URL
  assert.doesNotMatch(html, /email|payer|tarjeta/i);                               // nada de quien paga
  assert.match(html, /cobros@novaworkorder\.com/);
});
