const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, reset, call, KEY } = require('./helpers');
const { _hits } = require('../src/middleware/demoLimiter');

before(start);
after(stop);
beforeEach(async () => { await reset(); _hits.clear(); });

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
  assert.equal(d.status, 'nueva');
  const ack = await call('POST', `/platform/demo-requests/${d._id}/ack`, { platformKey: KEY });
  assert.equal(ack.data.status, 'recibida');
  assert.equal((await call('GET', '/platform/demo-requests', { platformKey: KEY })).data.items.length, 0);
  assert.equal((await call('GET', '/platform/demo-requests?status=recibida', { platformKey: KEY })).data.items.length, 1);
});

test('el formulario tiene límite por IP', async () => {
  for (let i = 0; i < 5; i += 1) assert.equal((await call('POST', '/public/demo', { body: demo })).status, 201);
  assert.equal((await call('POST', '/public/demo', { body: demo })).status, 429);
});
