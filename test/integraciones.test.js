// Integraciones: llaves de API por empresa (/api/v1) y webhooks firmados con cola de reintentos.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const crypto = require('crypto');
const { start, stop, reset, call, company } = require('./helpers');
const webhooks = require('../src/utils/webhooks');
const WebhookDelivery = require('../src/models/WebhookDelivery');
const Webhook = require('../src/models/Webhook');

// Un sistema externo de mentiras que recibe los webhooks; `reply` decide qué responde.
let receiver;
let hookUrl;
let received = [];
let reply = 200;

before(async () => {
  await start();
  receiver = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      received.push({ headers: req.headers, raw, body: JSON.parse(raw) });
      res.writeHead(reply).end();
    });
  }).listen(0);
  hookUrl = `http://127.0.0.1:${receiver.address().port}/avisos`;
});
after(async () => { receiver.close(); await stop(); });
beforeEach(async () => {
  await reset();
  received = [];
  reply = 200;
  process.env.WEBHOOK_ALLOW_PRIVATE = '1';
});

const v1 = (method, path, key, body) => call(method, `/v1${path}`, { as: key, body });
const order = { title: 'Revisar aire', description: 'El aire de la oficina no enfría bien' };

test('una llave de lectura ve solo su empresa y no puede escribir', async () => {
  const a = await company('Llaves Uno');
  const b = await company('Llaves Dos');
  await call('POST', '/workorders', { as: a.token, body: order });
  await call('POST', '/workorders', { as: b.token, body: { ...order, title: 'Otra empresa' } });

  const made = await call('POST', '/integrations/keys', { as: a.token, body: { name: 'ERP' } });
  assert.equal(made.status, 201);
  assert.match(made.data.key, /^nwo_/);
  const list = await call('GET', '/integrations/keys', { as: a.token });
  assert.equal(list.data.items.length, 1);
  assert.equal(list.data.items[0].key, undefined);              // la llave completa no se vuelve a mostrar

  const seen = await v1('GET', '/workorders', made.data.key);
  assert.equal(seen.status, 200);
  assert.deepEqual(seen.data.items.map((o) => o.title), ['Revisar aire']);
  assert.equal((await v1('POST', '/workorders', made.data.key, order)).status, 403);
  assert.equal((await v1('GET', '/workorders', 'nwo_inventada')).status, 401);
  assert.equal((await v1('GET', '/workorders', a.token)).status, 401);   // el token del panel no sirve en la API
});

test('una llave de escritura crea órdenes y la bitácora dice que fue la API', async () => {
  const a = await company('Llaves Tres');
  const { key } = (await call('POST', '/integrations/keys', { as: a.token, body: { name: 'Zapier', scope: 'escritura' } })).data;
  const made = await v1('POST', '/workorders', key, order);
  assert.equal(made.status, 201);
  assert.equal((await v1('POST', '/workorders', key, { title: 'x' })).status, 400);   // misma validación del panel
  const moved = await v1('PATCH', `/workorders/${made.data._id}/status`, key, { status: 'en_proceso', location: { lat: 4.6, lng: -74 } });
  assert.equal(moved.status, 200);
  assert.equal(moved.data.startLocation, null);                    // por la API nunca entra una ubicación
  assert.equal((await v1('DELETE', `/workorders/${made.data._id}`, key)).status, 404);   // la API no borra

  const log = (await call('GET', '/audit', { as: a.token })).data.items;
  assert.ok(log.some((e) => e.summary.includes('Creó la orden') && e.user.startsWith('API «Zapier»')));
});

test('una llave revocada o de un administrador desactivado deja de servir', async () => {
  const a = await company('Llaves Cuatro');
  const made = (await call('POST', '/integrations/keys', { as: a.token, body: { name: 'ERP' } })).data;
  assert.equal((await v1('GET', '/clients', made.key)).status, 200);
  assert.equal((await call('DELETE', `/integrations/keys/${made._id}`, { as: a.token })).status, 200);
  assert.equal((await v1('GET', '/clients', made.key)).status, 401);

  // Un segundo administrador crea una llave y luego lo desactivan.
  const other = await call('POST', '/users', { as: a.token, body: { name: 'Otro Admin', email: 'otro@llavescuatro.com', role: 'admin' } });
  const { login } = require('./helpers');
  const token = await login('otro@llavescuatro.com', other.data.temporaryPassword);
  const key2 = (await call('POST', '/integrations/keys', { as: token, body: { name: 'Suya' } })).data.key;
  assert.equal((await v1('GET', '/workorders', key2)).status, 200);
  const id = other.data.user?._id || other.data._id;
  assert.equal((await call('PUT', `/users/${id}`, { as: a.token, body: { active: false } })).status, 200);
  assert.equal((await v1('GET', '/workorders', key2)).status, 401);
});

test('un webhook recibe el aviso firmado de la orden, sin la ubicación del técnico', async () => {
  const a = await company('Hooks Uno');
  const hook = await call('POST', '/integrations/webhooks', { as: a.token, body: { url: hookUrl, events: ['orden.creada', 'orden.estado'] } });
  assert.equal(hook.status, 201);
  assert.match(hook.data.secret, /^whsec_/);
  assert.equal((await call('GET', '/integrations/webhooks', { as: a.token })).data.items[0].secret, undefined);

  const made = await call('POST', '/workorders', { as: a.token, body: order });
  await call('PUT', `/workorders/${made.data._id}`, { as: a.token, body: { ...order, title: 'Revisar aire (editada)' } });   // no suscrito
  await webhooks.processDue();
  assert.equal(received.length, 1);
  const got = received[0];
  assert.equal(got.headers['x-nova-event'], 'orden.creada');
  assert.equal(got.body.data.title, 'Revisar aire');
  assert.equal(got.body.data.startLocation, undefined);
  const expected = crypto.createHmac('sha256', hook.data.secret).update(`${got.headers['x-nova-timestamp']}.${got.raw}`).digest('hex');
  assert.equal(got.headers['x-nova-signature'], `sha256=${expected}`);

  // Otra empresa no ve ni toca este webhook.
  const b = await company('Hooks Dos');
  assert.equal((await call('GET', '/integrations/webhooks', { as: b.token })).data.items.length, 0);
  assert.equal((await call('DELETE', `/integrations/webhooks/${hook.data._id}`, { as: b.token })).status, 404);
});

test('si el otro sistema falla se reintenta, y con el secreto rotado la firma vieja no sirve', async () => {
  const a = await company('Hooks Tres');
  const hook = (await call('POST', '/integrations/webhooks', { as: a.token, body: { url: hookUrl, events: ['orden.creada'] } })).data;
  reply = 500;
  await call('POST', '/workorders', { as: a.token, body: order });
  await webhooks.processDue();
  let d = await WebhookDelivery.findOne({ tenant: a.id }).lean();
  assert.equal(d.status, 'pendiente');
  assert.equal(d.attempts, 1);
  assert.ok(d.nextAttemptAt > new Date());                        // espera antes de reintentar
  await webhooks.processDue();
  assert.equal(received.length, 1);                               // todavía no le toca

  reply = 200;
  await WebhookDelivery.updateOne({ _id: d._id }, { nextAttemptAt: new Date() });
  await webhooks.processDue();
  d = await WebhookDelivery.findOne({ tenant: a.id }).lean();
  assert.equal(d.status, 'entregado');
  assert.equal(d.attempts, 2);

  const rotated = (await call('POST', `/integrations/webhooks/${hook._id}/secret`, { as: a.token })).data.secret;
  assert.notEqual(rotated, hook.secret);
  const test1 = await call('POST', `/integrations/webhooks/${hook._id}/test`, { as: a.token });
  assert.equal(test1.data.ok, true);
  const last = received.at(-1);
  const sig = (s) => `sha256=${crypto.createHmac('sha256', s).update(`${last.headers['x-nova-timestamp']}.${last.raw}`).digest('hex')}`;
  assert.equal(last.headers['x-nova-signature'], sig(rotated));
  assert.notEqual(last.headers['x-nova-signature'], sig(hook.secret));

  const log = (await call('GET', `/integrations/webhooks/${hook._id}/deliveries`, { as: a.token })).data.items;
  assert.ok(log.length >= 2);
});

test('un webhook no puede apuntar a la red interna ni usar http', async () => {
  delete process.env.WEBHOOK_ALLOW_PRIVATE;
  const a = await company('Hooks Cuatro');
  for (const url of ['http://ejemplo.com/x', 'https://127.0.0.1/x', 'https://10.0.0.5/x', 'https://[::1]/x', 'https://169.254.169.254/latest', 'nada']) {
    const r = await call('POST', '/integrations/webhooks', { as: a.token, body: { url, events: ['orden.creada'] } });
    assert.equal(r.status, 400, url);
  }
  assert.equal((await call('POST', '/integrations/webhooks', { as: a.token, body: { url: 'https://ejemplo.com/x', events: ['otro'] } })).status, 400);
  assert.equal(await Webhook.countDocuments({ tenant: a.id }), 0);
});

test('solo el administrador entra a integraciones', async () => {
  const a = await company('Hooks Cinco');
  const tech = await call('POST', '/users', { as: a.token, body: { name: 'Téc', email: 'tec@hookscinco.com', role: 'tecnico' } });
  const { login } = require('./helpers');
  const token = await login('tec@hookscinco.com', tech.data.temporaryPassword);
  assert.equal((await call('GET', '/integrations/keys', { as: token })).status, 403);
  assert.equal((await call('POST', '/integrations/webhooks', { as: token, body: { url: hookUrl, events: ['orden.creada'] } })).status, 403);
});
