// «Vencida», «hoy» y los reportes por día van por el día de Colombia (America/Bogota), no por el de UTC del servidor ni
// por la zona del celular. Se fija el reloj a las 23:30 de Colombia (04:30 UTC del día siguiente: el caso que fallaba,
// desde las 7 p. m. una orden con fecha límite de hoy salía «Vencida») y a las 00:30 de Colombia.
const { test, before, after, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');
const { start, stop, reset, call, company } = require('./helpers');
const { colombiaDay, addDays, startOfDay, endOfDay } = require('../src/utils/colombia');

const NOCHE = '2026-10-29T04:30:00.000Z';        // miércoles 28 de octubre, 11:30 p. m. en Colombia
const MADRUGADA = '2026-10-29T05:30:00.000Z';    // jueves 29 de octubre, 12:30 a. m. en Colombia

// Solo se finge la fecha (Date); los temporizadores siguen reales para que Mongo y fetch funcionen.
const clock = (iso) => {
  mock.timers.reset();
  mock.timers.enable({ apis: ['Date'], now: new Date(iso) });
};

let dates;                                        // frontend/src/dates.js (ESM, sin JSX), lo mismo que usa la interfaz
before(async () => {
  await start();
  dates = await import(pathToFileURL(path.join(__dirname, '..', 'frontend', 'src', 'dates.js')).href);
});
after(stop);
beforeEach(reset);
afterEach(() => mock.timers.reset());

test('«hoy en Colombia»: igual en el servidor y en la interfaz, sin importar la zona del equipo', () => {
  for (const [instant, day] of [[NOCHE, '2026-10-28'], [MADRUGADA, '2026-10-29'], ['2026-01-01T04:59:59.999Z', '2025-12-31'], ['2026-01-01T05:00:00.000Z', '2026-01-01']]) {
    assert.equal(colombiaDay(new Date(instant)), day, instant);
    assert.equal(dates.colombiaDay(new Date(instant)), day, instant);
  }
  clock(NOCHE);
  assert.equal(colombiaDay(), '2026-10-28');
  assert.equal(dates.colombiaDay(), '2026-10-28');
  // un celular en otra zona (Tokio, UTC+9, ya en el 29) no cambia el día de Colombia
  const tz = process.env.TZ;
  try {
    process.env.TZ = 'Asia/Tokyo';
    assert.equal(new Date().getDate(), 29);
    assert.equal(colombiaDay(), '2026-10-28');
    assert.equal(dates.colombiaDay(), '2026-10-28');
  } finally {
    if (tz === undefined) delete process.env.TZ; else process.env.TZ = tz;
  }
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(dates.addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(startOfDay('2026-10-28').toISOString(), '2026-10-28T05:00:00.000Z');
  assert.equal(endOfDay('2026-10-28').toISOString(), '2026-10-29T04:59:59.999Z');
});

// Las órdenes se crean por la API como lo hace el formulario («AAAA-MM-DD») y la interfaz decide con lo que le llega.
const ordersWithDue = async (token, days) => {
  for (const [title, dueDate] of Object.entries(days)) {
    const r = await call('POST', '/workorders', { as: token, body: { title, description: 'Descripción de la orden', dueDate } });
    assert.equal(r.status, 201, JSON.stringify(r.data));
  }
  const { data } = await call('GET', '/workorders?limit=100', { as: token });
  return Object.fromEntries(data.items.map((o) => [o.title, o]));
};

test('a las 23:30 de Colombia, la orden de hoy no está vencida; la de ayer sí', async () => {
  clock(NOCHE);
  const a = await company('Frío Noche');
  const o = await ordersWithDue(a.token, { ayer: '2026-10-27', hoy: '2026-10-28', manana: '2026-10-29' });

  // la fecha límite se guarda a la medianoche UTC del día elegido y se lee como ese mismo día (no se corre)
  assert.equal(o.hoy.dueDate, '2026-10-28T00:00:00.000Z');
  assert.equal(dates.calendarDay(o.hoy.dueDate), '2026-10-28');

  assert.equal(dates.isOverdue(o.ayer), true);
  assert.equal(dates.isOverdue(o.hoy), false);
  assert.equal(dates.isOverdue(o.manana), false);
  // con el día en UTC (lo de antes) la de hoy salía «Vencida»
  assert.ok(new Date(o.hoy.dueDate).toISOString().slice(0, 10) < new Date().toISOString().slice(0, 10));

  // cerrada no está vencida, aunque su fecha ya pasó; sin fecha límite, tampoco
  await call('PATCH', `/workorders/${o.ayer._id}/status`, { as: a.token, body: { status: 'completada' } });
  const done = (await call('GET', `/workorders/${o.ayer._id}`, { as: a.token })).data;
  assert.equal(dates.isOverdue(done), false);
  assert.equal(dates.isOverdue({ status: 'pendiente', dueDate: null }), false);
});

test('a las 00:30 de Colombia, la de ayer (que a las 23:30 era «hoy») ya está vencida; la de hoy y mañana no', async () => {
  clock(MADRUGADA);
  const a = await company('Frío Madrugada');
  const o = await ordersWithDue(a.token, { anteayer: '2026-10-27', ayer: '2026-10-28', hoy: '2026-10-29', manana: '2026-10-30' });
  assert.equal(dates.isOverdue(o.anteayer), true);
  assert.equal(dates.isOverdue(o.ayer), true);
  assert.equal(dates.isOverdue(o.hoy), false);
  assert.equal(dates.isOverdue(o.manana), false);
  // la misma orden, con el reloj de cada momento
  assert.equal(dates.isOverdue(o.ayer, new Date(NOCHE)), false);
  assert.equal(dates.isOverdue(o.ayer, new Date(MADRUGADA)), true);
});

test('cotizaciones: «vencida» desde que termina en Colombia el día de «válida hasta», no antes', async () => {
  clock('2026-10-27T15:00:00.000Z');              // 27 de octubre, 10 a. m. en Colombia: se arman y se envían
  const a = await company('Clima Validez');
  const client = (await call('POST', '/clients', { as: a.token, body: { name: 'Hotel', email: 'h@clima.com' } })).data;
  const ids = {};
  for (const [title, validUntil] of Object.entries({ ayer: '2026-10-27', hoy: '2026-10-28', manana: '2026-10-29' })) {
    const q = await call('POST', '/quotes', { as: a.token, body: { client: client._id, title, validUntil, items: [{ description: 'Visita técnica', qty: 1, unitPrice: 50000 }] } });
    assert.equal(q.status, 201, JSON.stringify(q.data));
    assert.equal((await call('POST', `/quotes/${q.data._id}/send`, { as: a.token })).status, 200);
    ids[title] = q.data._id;
  }
  const expired = async () => (await call('GET', '/quotes?status=vencida', { as: a.token })).data.items.map((q) => q.title).sort();
  const shown = async (title) => (await call('GET', `/quotes/${ids[title]}`, { as: a.token })).data.status;

  clock(NOCHE);
  assert.deepEqual(await expired(), ['ayer']);
  assert.equal(await shown('hoy'), 'enviada');
  // la validez por defecto (15 días) cuenta desde hoy en Colombia, no desde mañana en UTC
  const def = await call('POST', '/quotes', { as: a.token, body: { client: client._id, title: 'Por defecto', items: [{ description: 'Visita técnica', qty: 1, unitPrice: 50000 }] } });
  assert.equal(def.data.validUntil, '2026-11-13T04:59:59.999Z');   // fin del 12 de noviembre en Colombia

  clock(MADRUGADA);
  assert.deepEqual(await expired(), ['ayer', 'hoy']);
  assert.equal(await shown('hoy'), 'vencida');
  assert.equal(await shown('manana'), 'enviada');
});

test('reportes: sin fechas, el rango termina hoy en Colombia y cada orden cuenta en su día de Colombia', async () => {
  clock(NOCHE);
  const a = await company('Frío Reporte Noche');
  await call('POST', '/workorders', { as: a.token, body: { title: 'Tarde', description: 'Descripción de la orden' } });
  let r = await call('GET', '/reports', { as: a.token });
  assert.equal(r.status, 200);
  assert.equal(r.data.to, '2026-10-28');
  assert.equal(r.data.from, '2026-09-29');
  assert.deepEqual(r.data.byDay, [{ day: '2026-10-28', count: 1 }]);

  clock(MADRUGADA);
  await call('POST', '/workorders', { as: a.token, body: { title: 'Madrugada', description: 'Descripción de la orden' } });
  r = await call('GET', '/reports', { as: a.token });
  assert.equal(r.data.to, '2026-10-29');
  assert.deepEqual(r.data.byDay, [{ day: '2026-10-28', count: 1 }, { day: '2026-10-29', count: 1 }]);
});

test('inicio: la orden creada el 31 por la noche en Colombia cuenta en ese mes, no en el siguiente', async () => {
  clock('2026-11-01T01:00:00.000Z');              // 31 de octubre, 8 p. m. en Colombia
  const a = await company('Frío Mes');
  await call('POST', '/workorders', { as: a.token, body: { title: 'Fin de mes', description: 'Descripción de la orden' } });
  const d = await call('GET', '/dashboard/summary', { as: a.token });
  assert.equal(d.status, 200);
  assert.deepEqual(d.data.monthlyTrend, [{ _id: '2026-10', count: 1 }]);
});
