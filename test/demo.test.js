const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, reset, call, KEY } = require('./helpers');
const { resetLimits } = require('../src/utils/rateStore');

before(start);
after(stop);
beforeEach(async () => { await reset(); await resetLimits(); });

const demo = { company: 'Frío Total SAS', name: 'Laura Gómez', email: 'Laura@FrioTotal.com', phone: '3109998877', technicians: '4',
  message: 'Tenemos 4 técnicos en Bogotá' };

test('la página de ventas registra la demo y GABY la lee y la confirma', async () => {
  assert.equal((await call('POST', '/public/demo', { body: { ...demo, email: 'no-es-email' } })).status, 400);
  assert.equal((await call('POST', '/public/demo', { body: demo })).status, 201);
  assert.equal((await call('POST', '/public/demo', { body: { ...demo, website: 'http://spam' } })).status, 201);   // bot: no se guarda
  assert.equal((await call('GET', '/platform/demo-requests')).status, 401);                                     // solo con la llave
  const list = await call('GET', '/platform/demo-requests', { platformKey: KEY });
  assert.equal(list.data.items.length, 1);
  const [d] = list.data.items;
  assert.equal(d.email, 'laura@friototal.com');
  assert.equal(d.technicians, 4);
  assert.equal(d.product, 'servicios');                                                          // sin elegir: Servicios
  assert.equal(d.status, 'nueva');
  const ack = await call('POST', `/platform/demo-requests/${d._id}/ack`, { platformKey: KEY });
  assert.equal(ack.data.status, 'recibida');
  assert.equal((await call('GET', '/platform/demo-requests', { platformKey: KEY })).data.items.length, 0);
  assert.equal((await call('GET', '/platform/demo-requests?status=recibida', { platformKey: KEY })).data.items.length, 1);
});

test('la demo dice qué app le interesa; en Pedidos no cuentan técnicos', async () => {
  assert.equal((await call('POST', '/public/demo', { body: { ...demo, product: 'otra' } })).status, 400);
  assert.equal((await call('POST', '/public/demo', { body: { ...demo, product: 'pedidos', company: 'Café Luna' } })).status, 201);
  const [d] = (await call('GET', '/platform/demo-requests', { platformKey: KEY })).data.items;
  assert.equal(d.product, 'pedidos');
  assert.equal(d.technicians, null);
});

test('el formulario tiene límite por IP', async () => {
  for (let i = 0; i < 5; i += 1) assert.equal((await call('POST', '/public/demo', { body: demo })).status, 201);
  assert.equal((await call('POST', '/public/demo', { body: demo })).status, 429);
});

test('«Empieza gratis»: una prueba exige aceptar términos y privacidad; GABY la ve como prueba', async () => {
  assert.equal((await call('POST', '/public/demo', { body: { ...demo, kind: 'otra' } })).status, 400);
  const sin = await call('POST', '/public/demo', { body: { ...demo, kind: 'prueba' } });
  assert.equal(sin.status, 400);
  assert.match(sin.data.message, /términos/);
  assert.equal((await call('POST', '/public/demo', { body: { ...demo, kind: 'prueba', consent: 'true' } })).status, 400);  // solo true de verdad
  assert.equal((await call('POST', '/public/demo', { body: { ...demo, kind: 'prueba', consent: true } })).status, 201);
  assert.equal((await call('POST', '/public/demo', { body: demo })).status, 201);
  const items = (await call('GET', '/platform/demo-requests', { platformKey: KEY })).data.items;
  assert.deepEqual(items.map((d) => d.kind), ['prueba', 'demo']);
  assert.ok(items[0].consentAt && !items[1].consentAt);
});

test('la página de Estados Unidos marca la solicitud en inglés y responde errores en inglés', async () => {
  const en = { ...demo, lang: 'en', company: 'Cool Air LLC', email: 'joe@coolair.com' };
  assert.equal((await call('POST', '/public/demo', { body: { ...en, lang: 'fr' } })).status, 400);
  const bad = await call('POST', '/public/demo', { body: { ...en, email: 'nope' } });
  assert.equal(bad.status, 400);
  assert.equal(bad.data.errors[0].message, 'Please enter a valid email');
  const noConsent = await call('POST', '/public/demo', { body: { ...en, kind: 'prueba' } });
  assert.match(noConsent.data.message, /accept the terms/);
  assert.equal((await call('POST', '/public/demo', { body: { ...en, kind: 'prueba', consent: true } })).status, 201);
  assert.equal((await call('POST', '/public/demo', { body: demo })).status, 201);
  const items = (await call('GET', '/platform/demo-requests', { platformKey: KEY })).data.items;
  assert.deepEqual(items.map((d) => [d.company, d.lang]), [['Cool Air LLC', 'en'], ['Frío Total SAS', 'es']]);
});

// Paso 2 (una sola ficha por persona): el enlace de prueba que GABY manda por el chat trae `l`, el código de la ficha.
test('el código de la ficha de GABY (l) se guarda validado y GABY lo lee en las solicitudes', async () => {
  const prueba = { ...demo, kind: 'prueba', consent: true, phone: '' };
  assert.equal((await call('POST', '/public/demo', { body: { ...prueba, l: 'k7Qm2xWa9pLr4tZc' } })).status, 201);
  assert.equal((await call('POST', '/public/demo', { body: { ...prueba, email: 'b@x.co', l: '<script>x</script>' } })).status, 201);
  assert.equal((await call('POST', '/public/demo', { body: { ...prueba, email: 'c@x.co', l: 'corto' } })).status, 201);
  assert.equal((await call('POST', '/public/demo', { body: { ...prueba, email: 'd@x.co', l: 'a'.repeat(33) } })).status, 201);
  await resetLimits();                                                                  // el tope es de 5 por IP
  assert.equal((await call('POST', '/public/demo', { body: { ...prueba, email: 'e@x.co', l: 'x'.repeat(65) } })).status, 400);
  assert.equal((await call('POST', '/public/demo', { body: { ...prueba, email: 'f@x.co', l: { $gt: '' } } })).status, 400);
  assert.equal((await call('POST', '/public/demo', { body: { ...prueba, email: 'g@x.co' } })).status, 201);  // sin enlace: igual
  const items = (await call('GET', '/platform/demo-requests', { platformKey: KEY })).data.items;
  assert.deepEqual(items.map((d) => [d.email, d.leadToken]),
    [['laura@friototal.com', 'k7Qm2xWa9pLr4tZc'], ['b@x.co', null], ['c@x.co', null], ['d@x.co', null], ['g@x.co', null]]);
});

test('la landing lee el enlace de GABY (?l=&app=&t=) y lo manda en el formulario', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const { leer, textoPrueba } = require('../landing/enlace.js');
  assert.deepEqual(leer('?l=k7Qm2xWa9pLr4tZc&app=servicios&t=5'), { lead: 'k7Qm2xWa9pLr4tZc', app: 'servicios', size: 5 });
  assert.deepEqual(leer('?app=Pedidos&l=k7Qm2xWa9pLr4tZc'), { lead: 'k7Qm2xWa9pLr4tZc', app: 'pedidos', size: null });
  assert.deepEqual(leer('?l=%3Cb%3E&app=otra&t=0'), { lead: '', app: '', size: null });                // nada inventado
  assert.deepEqual(leer('?t=20000&utm_source=ig'), { lead: '', app: '', size: null });
  assert.deepEqual(leer(''), { lead: '', app: '', size: null });
  assert.equal(textoPrueba('Servicios', 'k7Qm2xWa9pLr4tZc'),
    'Hola, acabo de crear mi prueba gratis de NOVAWORKORDER Servicios en la web (ref k7Qm2xWa9pLr4tZc).');
  assert.equal(textoPrueba('Pedidos', ''), 'Hola, acabo de crear mi prueba gratis de NOVAWORKORDER Pedidos en la web.');
  const html = fs.readFileSync(path.join(__dirname, '..', 'landing', 'index.html'), 'utf8');
  assert.ok(html.indexOf('<script src="/enlace.js"></script>') < html.indexOf("var form = document.getElementById('demo-form')"));
  assert.match(html, /if \(leadToken\) data\.l = leadToken;/);                                 // viaja en el POST
  assert.match(html, /if \(enlace\.app\) form\.product\.value = enlace\.app;/);                // la app ya elegida
  assert.match(html, /form\.technicians\.value = String\(enlace\.size\)/);                      // y los técnicos
});
