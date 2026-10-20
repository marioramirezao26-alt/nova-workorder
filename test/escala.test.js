// Escala: los límites viven en la base (valen con varias instancias y caducan solos), /api/health dice la verdad sobre la
// base y las órdenes tienen los índices de sus consultas reales.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { start, stop, reset, call, company } = require('./helpers');
const { RateLimit, hit, resetLimits } = require('../src/utils/rateStore');
const WorkOrder = require('../src/models/WorkOrder');

before(start);
after(stop);
beforeEach(async () => { await reset(); await resetLimits(); });

test('health responde ok solo con la base viva', async () => {
  const r = await call('GET', '/health');
  assert.equal(r.status, 200);
  assert.equal(r.data.db, 'ok');
});

test('el límite de inicio de sesión vive en la base: otra instancia lo ve igual', async () => {
  const a = await company('Escala Uno');
  for (let i = 0; i < 10; i += 1) {
    assert.equal((await call('POST', '/auth/login', { body: { email: a.email, password: 'mala-clave-123' } })).status, 401);
  }
  assert.equal((await call('POST', '/auth/login', { body: { email: a.email, password: 'mala-clave-123' } })).status, 429);
  // El contador está en la base, no en la memoria del proceso: si se borra allí, se vuelve a poder intentar.
  assert.ok(await RateLimit.countDocuments({ _id: /^login\|/ }) >= 1);
  await resetLimits();
  assert.equal((await call('POST', '/auth/login', { body: { email: a.email, password: 'mala-clave-123' } })).status, 401);
});

test('el contador es atómico y empieza de nuevo al vencer la ventana', async () => {
  const counts = await Promise.all(Array.from({ length: 20 }, () => hit('prueba|x', 60000)));
  assert.equal(Math.max(...counts), 20);                       // veinte a la vez: ninguno se perdió
  await RateLimit.updateOne({ _id: 'prueba|x' }, { $set: { resetAt: new Date(Date.now() - 1000) } });
  assert.equal(await hit('prueba|x', 60000), 1);               // ventana vencida: vuelve a 1
});

test('los contadores caducan solos y las órdenes tienen sus índices', async () => {
  const ttl = (await RateLimit.collection.indexes()).find((i) => i.key.resetAt === 1);
  assert.equal(ttl.expireAfterSeconds, 0);
  const keys = (await WorkOrder.collection.indexes()).map((i) => JSON.stringify(i.key));
  for (const k of [{ tenant: 1, status: 1, createdAt: -1 }, { tenant: 1, assignedTo: 1, status: 1 }, { tenant: 1, client: 1, createdAt: -1 }]) {
    assert.ok(keys.includes(JSON.stringify(k)), `falta el índice ${JSON.stringify(k)}`);
  }
  assert.ok(mongoose.connection.readyState === 1);
});
