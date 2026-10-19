// Mapa en vivo: mientras una orden está en proceso, el celular del técnico manda dónde va (con la empresa de acuerdo y
// su autorización). El administrador ve en el mapa a cada técnico, su cliente, el recorrido y si se alejó del cliente.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, reset, call, company, login } = require('./helpers');

before(start);
after(stop);
beforeEach(reset);

const CLIENTE = { lat: 4.6533, lng: -74.0836 };
const CERCA = { lat: 4.6536, lng: -74.0838, accuracy: 12 };
const LEJOS = { lat: 4.7110, lng: -74.0721, accuracy: 20 };

const setup = async ({ on = true, consent = true } = {}) => {
  const a = await company('Frío Ruta');
  const made = await call('POST', '/users', { as: a.token, body: { name: 'Ana Técnica', email: 'ana@frioruta.com', role: 'tecnico' } });
  const tech = await login('ana@frioruta.com', made.data.temporaryPassword);
  const client = (await call('POST', '/clients', { as: a.token, body: { name: 'Hotel Norte', email: 'hotel@norte.com', address: 'Cra 15 # 93' } })).data;
  if (on) {
    await call('PUT', '/company/location-tracking', { as: a.token, body: { enabled: true } });
    const live = await call('PUT', '/company/live-tracking', { as: a.token, body: { enabled: true } });
    assert.equal(live.data.company.liveTracking, true);
  }
  await call('PUT', '/auth/location-consent', { as: tech, body: { accept: true } });
  if (consent) {
    const ok = await call('PUT', '/auth/live-consent', { as: tech, body: { accept: true } });
    assert.ok(ok.data.liveConsentAt);
  }
  const order = (await call('POST', '/workorders', { as: a.token,
    body: { title: 'Mantenimiento', description: 'Mantenimiento del aire acondicionado', client: client._id, assignedTo: made.data.user._id } })).data;
  return { a, tech, client, order };
};

test('solo se comparte la ubicación de una orden propia en proceso', async () => {
  process.env.PING_EVERY_SECONDS = '0';
  const { a, tech, order } = await setup();
  const before = await call('POST', `/workorders/${order._id}/ping`, { as: tech, body: { location: CERCA } });
  assert.equal(before.status, 409);                                   // todavía pendiente: no se guarda nada
  await call('PATCH', `/workorders/${order._id}/status`, { as: tech, body: { status: 'en_proceso', location: CERCA } });
  const ok = await call('POST', `/workorders/${order._id}/ping`, { as: tech, body: { location: CERCA } });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.stored, true);
  const bad = await call('POST', `/workorders/${order._id}/ping`, { as: tech, body: { location: { lat: 200, lng: 0 } } });
  assert.equal(bad.status, 400);
  // otro técnico de la misma empresa no puede mandar puntos de una orden que no es suya
  const other = await call('POST', '/users', { as: a.token, body: { name: 'Beto', email: 'beto@frioruta.com', role: 'tecnico' } });
  const beto = await login('beto@frioruta.com', other.data.temporaryPassword);
  await call('PUT', '/auth/live-consent', { as: beto, body: { accept: true } });
  assert.equal((await call('POST', `/workorders/${order._id}/ping`, { as: beto, body: { location: CERCA } })).status, 409);
  // al completar, deja de verse en el mapa y ya no acepta puntos
  await call('PATCH', `/workorders/${order._id}/status`, { as: tech, body: { status: 'completada', location: CLIENTE } });
  assert.equal((await call('POST', `/workorders/${order._id}/ping`, { as: tech, body: { location: CERCA } })).status, 409);
  const live = await call('GET', '/workorders/live', { as: a.token });
  assert.equal(live.data.items.length, 0);
  // otra empresa no ve nada
  const b = await company('Otra Empresa');
  assert.equal((await call('GET', '/workorders/live', { as: b.token })).data.items.length, 0);
});

test('sin el interruptor o sin la autorización del mapa en vivo no se guarda ningún punto', async () => {
  process.env.PING_EVERY_SECONDS = '0';
  // autorizó iniciar y completar, pero no el mapa en vivo: es otra autorización
  const { a, tech, order } = await setup({ consent: false });
  assert.equal((await call('PUT', '/company/live-tracking', { as: tech, body: { enabled: false } })).status, 403);
  await call('PATCH', `/workorders/${order._id}/status`, { as: tech, body: { status: 'en_proceso' } });
  const r = await call('POST', `/workorders/${order._id}/ping`, { as: tech, body: { location: CERCA } });
  assert.equal(r.status, 200);
  assert.equal(r.data.stored, false);
  const live = (await call('GET', '/workorders/live', { as: a.token })).data;
  assert.equal(live.items[0].lastPoint, null);
  assert.equal(live.items[0].trail.length, 0);
});

test('el administrador ve dónde va cada técnico y si se alejó del cliente', async () => {
  process.env.PING_EVERY_SECONDS = '0';
  const { a, tech, client, order } = await setup();
  // el cliente ya tiene coordenadas (por ejemplo, de una visita anterior)
  const first = (await call('POST', '/workorders', { as: a.token, body: { title: 'Visita previa', description: 'Revisión general del equipo', client: client._id,
    assignedTo: order.assignedTo._id } })).data;
  await call('PATCH', `/workorders/${first._id}/status`, { as: tech, body: { status: 'en_proceso' } });
  await call('PATCH', `/workorders/${first._id}/status`, { as: tech, body: { status: 'completada', location: CLIENTE } });

  await call('PATCH', `/workorders/${order._id}/status`, { as: tech, body: { status: 'en_proceso', location: CERCA } });
  await call('POST', `/workorders/${order._id}/ping`, { as: tech, body: { location: CERCA } });
  const away = await call('POST', `/workorders/${order._id}/ping`, { as: tech, body: { location: LEJOS } });
  assert.equal(away.data.lastPoint.offSite, true);
  assert.ok(away.data.offSiteSince);
  const still = await call('POST', `/workorders/${order._id}/ping`, { as: tech, body: { location: LEJOS } });
  assert.equal(still.data.offSiteSince, away.data.offSiteSince);     // sigue lejos desde la misma hora

  const live = await call('GET', '/workorders/live', { as: a.token });
  assert.equal(live.status, 200);
  assert.equal(live.data.tracking, true);
  const item = live.data.items[0];
  assert.equal(item.assignedTo.name, 'Ana Técnica');
  assert.equal(item.client.location.lat, CLIENTE.lat);
  assert.equal(item.trail.length, 3);
  assert.equal(item.lastPoint.lat, LEJOS.lat);
  assert.ok(item.lastPoint.distanceM > 6000);
  assert.ok(item.offSiteSince);
  // vuelve donde el cliente: deja de estar marcado
  const back = await call('POST', `/workorders/${order._id}/ping`, { as: tech, body: { location: CERCA } });
  assert.equal(back.data.offSiteSince, null);
  // el técnico no ve el mapa; la lista de órdenes no trae el recorrido
  assert.equal((await call('GET', '/workorders/live', { as: tech })).status, 403);
  const list = (await call('GET', '/workorders?limit=10', { as: a.token })).data.items;
  assert.equal(list.find((o) => o._id === order._id).trail, undefined);
});

test('no se mandan puntos más seguido de lo configurado', async () => {
  process.env.PING_EVERY_SECONDS = '30';
  const { a, tech, order } = await setup();
  await call('PATCH', `/workorders/${order._id}/status`, { as: tech, body: { status: 'en_proceso', location: CERCA } });
  const r = await call('POST', `/workorders/${order._id}/ping`, { as: tech, body: { location: LEJOS } });
  assert.equal(r.data.stored, false);
  const live = (await call('GET', '/workorders/live', { as: a.token })).data;
  assert.equal(live.items[0].trail.length, 0);
  assert.equal(live.items[0].lastPoint.lat, CERCA.lat);               // el punto de inicio
  delete process.env.PING_EVERY_SECONDS;
});
