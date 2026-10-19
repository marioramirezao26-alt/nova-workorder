// Ubicación del técnico al iniciar y al completar una orden: solo con la empresa de acuerdo (interruptor del
// administrador) y con la autorización del técnico (Ley 1581). Se mide a cuántos metros estaba del cliente.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, reset, call, company, login } = require('./helpers');
const { distanceMeters } = require('../src/utils/geo');

before(start);
after(stop);
beforeEach(reset);

const CLIENTE = { lat: 4.6533, lng: -74.0836 };          // Bogotá
const CERCA = { lat: 4.6536, lng: -74.0838, accuracy: 12 };   // ~40 m
const LEJOS = { lat: 4.7110, lng: -74.0721, accuracy: 20 };   // ~6,5 km

const setup = async () => {
  const a = await company('Frío Ruta');
  const made = await call('POST', '/users', { as: a.token, body: { name: 'Ana Técnica', email: 'ana@frioruta.com', role: 'tecnico' } });
  const tech = await login('ana@frioruta.com', made.data.temporaryPassword);
  const client = (await call('POST', '/clients', { as: a.token, body: { name: 'Hotel Norte', email: 'hotel@norte.com', address: 'Cra 15 # 93' } })).data;
  const order = async (title) => (await call('POST', '/workorders', { as: a.token,
    body: { title, description: 'Mantenimiento del aire acondicionado', client: client._id, assignedTo: made.data.user._id } })).data;
  return { a, tech, client, order };
};

test('distancia entre dos puntos en metros', () => {
  const d = distanceMeters(CLIENTE, CERCA);
  assert.ok(d > 20 && d < 60, `esperaba ~40 m y dio ${d}`);
  assert.ok(distanceMeters(CLIENTE, LEJOS) > 6000);
});

test('sin el interruptor de la empresa o sin la autorización del técnico no se guarda ninguna ubicación', async () => {
  const { a, tech, order } = await setup();
  const o1 = await order('Orden sin interruptor');
  const r1 = await call('PATCH', `/workorders/${o1._id}/status`, { as: tech, body: { status: 'en_proceso', location: CERCA } });
  assert.equal(r1.status, 200);
  assert.equal(r1.data.startLocation, null);
  // la empresa lo activa, pero Ana todavía no lo autoriza
  const on = await call('PUT', '/company/location-tracking', { as: a.token, body: { enabled: true } });
  assert.equal(on.status, 200);
  assert.equal(on.data.company.locationTracking, true);
  assert.equal((await call('PUT', '/company/location-tracking', { as: tech, body: { enabled: false } })).status, 403);   // solo el administrador
  const r2 = await call('PATCH', `/workorders/${o1._id}/status`, { as: tech, body: { status: 'completada', location: CERCA } });
  assert.equal(r2.data.endLocation, null);
  const me = (await call('GET', '/auth/profile', { as: tech })).data;
  assert.equal(me.company.locationTracking, true);
  assert.equal(me.locationConsentAt, null);
});

test('con la empresa de acuerdo y el técnico autorizando: se guarda dónde inició y cerró y si estaba lejos del cliente', async () => {
  const { a, tech, client, order } = await setup();
  await call('PUT', '/company/location-tracking', { as: a.token, body: { enabled: true } });
  const ok = await call('PUT', '/auth/location-consent', { as: tech, body: { accept: true } });
  assert.equal(ok.status, 200);
  assert.ok(ok.data.locationConsentAt);
  // primera visita: el cliente aún no tiene coordenadas; al completar, se aprenden
  const o1 = await order('Primera visita');
  const s1 = await call('PATCH', `/workorders/${o1._id}/status`, { as: tech, body: { status: 'en_proceso', location: CERCA } });
  assert.equal(s1.data.startLocation.lat, CERCA.lat);
  assert.equal(s1.data.startLocation.accuracy, 12);
  assert.equal(s1.data.startLocation.distanceM, null);
  const e1 = await call('PATCH', `/workorders/${o1._id}/status`, { as: tech, body: { status: 'completada', location: CLIENTE } });
  assert.ok(e1.data.endLocation.at);
  const learned = (await call('GET', `/clients/${client._id}`, { as: a.token })).data;
  assert.equal(learned.location.source, 'visita');
  assert.equal(learned.location.lat, CLIENTE.lat);
  // segunda visita: inicia cerca (bien) y cierra lejos (se marca)
  const o2 = await order('Segunda visita');
  const s2 = await call('PATCH', `/workorders/${o2._id}/status`, { as: tech, body: { status: 'en_proceso', location: CERCA } });
  assert.ok(s2.data.startLocation.distanceM < 100 && s2.data.startLocation.offSite === false);
  const e2 = await call('PATCH', `/workorders/${o2._id}/status`, { as: tech, body: { status: 'completada', location: LEJOS } });
  assert.ok(e2.data.endLocation.distanceM > 6000 && e2.data.endLocation.offSite === true);
  // el administrador lo ve en la orden
  const seen = (await call('GET', `/workorders/${o2._id}`, { as: a.token })).data;
  assert.equal(seen.endLocation.offSite, true);
  assert.equal(seen.client.location.lat, CLIENTE.lat);
  // coordenadas inválidas se rechazan; si el técnico retira la autorización, deja de guardarse
  const bad = await call('PATCH', `/workorders/${o2._id}/status`, { as: tech, body: { status: 'en_proceso', location: { lat: 200, lng: 0 } } });
  assert.equal(bad.status, 400);
  await call('PUT', '/auth/location-consent', { as: tech, body: { accept: false } });
  const o3 = await order('Sin autorización');
  const s3 = await call('PATCH', `/workorders/${o3._id}/status`, { as: tech, body: { status: 'en_proceso', location: CERCA } });
  assert.equal(s3.data.startLocation, null);
});
