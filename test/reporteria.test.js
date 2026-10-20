// Reportes de la empresa (solo admin): órdenes por día, por estado y por técnico, totales (creadas/completadas) y CSV.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, reset, call, company, login } = require('./helpers');

before(start);
after(stop);
beforeEach(reset);

test('el reporte cuenta órdenes por estado y por técnico, y totales', async () => {
  const a = await company('Frío Reporte');
  const client = (await call('POST', '/clients', { as: a.token, body: { name: 'Hotel', email: 'h@h.com' } })).data;
  const tec = (await call('POST', '/users', { as: a.token, body: { name: 'Ana', email: 'ana@frio.com', role: 'tecnico' } })).data.user;

  const o1 = (await call('POST', '/workorders', { as: a.token, body: { title: 'Uno', description: 'Descripción de la orden', client: client._id, assignedTo: tec._id } })).data;
  await call('POST', '/workorders', { as: a.token, body: { title: 'Dos', description: 'Descripción de la orden', assignedTo: tec._id } });
  await call('POST', '/workorders', { as: a.token, body: { title: 'Tres', description: 'Descripción de la orden' } });   // sin asignar
  await call('PATCH', `/workorders/${o1._id}/status`, { as: a.token, body: { status: 'completada' } });

  const r = await call('GET', '/reports', { as: a.token });
  assert.equal(r.status, 200);
  assert.equal(r.data.totals.created, 3);
  assert.equal(r.data.totals.completed, 1);
  const ana = r.data.byTechnician.find((t) => t.name === 'Ana');
  const sin = r.data.byTechnician.find((t) => t.name === 'Sin asignar');
  assert.equal(ana.count, 2);
  assert.equal(sin.count, 1);
  assert.equal(r.data.byStatus.find((s) => s.status === 'completada').count, 1);
  assert.equal(r.data.byDay.reduce((n, d) => n + d.count, 0), 3);
});

test('la exportación CSV trae las órdenes del rango, con encabezado', async () => {
  const a = await company('Clima CSV');
  await call('POST', '/workorders', { as: a.token, body: { title: 'Revisión', description: 'Descripción de la orden' } });
  const res = await call('GET', '/reports/orders.csv', { as: a.token });
  assert.equal(res.status, 200);
  const rows = String(res.data).trim().split('\r\n');
  assert.ok(rows[0].includes('Titulo') && rows[0].includes('Tecnico'));
  assert.equal(rows.length, 2);     // encabezado + 1 orden
});

test('solo el administrador ve los reportes', async () => {
  const a = await company('Clima Permiso');
  const made = await call('POST', '/users', { as: a.token, body: { name: 'Tec', email: 'tec@clima.com', role: 'tecnico' } });
  const tec = await login('tec@clima.com', made.data.temporaryPassword);
  assert.equal((await call('GET', '/reports', { as: tec })).status, 403);
  assert.equal((await call('GET', '/reports/orders.csv', { as: tec })).status, 403);
});
