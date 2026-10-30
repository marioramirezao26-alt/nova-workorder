// Cuenta de demostración para grabar videos (P-014): el script crea los datos, se puede repetir, --reiniciar los deja
// limpios y la cuenta no aparece para GABY (o sale marcada). Ningún dato trae el 310 ni el número real de NOVA.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { start, stop, reset, call, company, KEY, mongoUri } = require('./helpers');
const Company = require('../src/models/Company');
const Client = require('../src/models/Client');
const User = require('../src/models/User');
const WorkOrder = require('../src/models/WorkOrder');
const demo = require('../src/scripts/crearDemoServicios');

before(start);
after(stop);
beforeEach(reset);

const CLAVE = 'Clave-de-demo-para-pruebas-1';
const SCRIPT = path.join(__dirname, '..', 'src', 'scripts', 'crearDemoServicios.js');
const run = (args = [], env = { DEMO_PASSWORD: CLAVE }) => promisify(execFile)(process.execPath, [SCRIPT, ...args], {
  env: { ...process.env, DEMO_PASSWORD: '', ...env, MONGODB_URI: mongoUri() },
});
const entrar = async (password = CLAVE, email = 'admin@frio-ejemplo.example') => {
  const r = await call('POST', '/auth/login', { body: { email, password } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.mustChangePassword, false);
  return r.data;
};
const conteo = async (token) => {
  const orders = (await call('GET', '/workorders?limit=100', { as: token })).data.items;
  const quotes = (await call('GET', '/quotes', { as: token })).data.items;
  const clients = (await call('GET', '/clients?limit=100', { as: token })).data.items;
  const users = (await call('GET', '/users', { as: token })).data;
  return { orders, quotes, clients, users: Array.isArray(users) ? users : users.items };
};

test('el script crea la cuenta demo con marca, usuarios, clientes, órdenes, cotizaciones y reportes', async () => {
  const out = await run();
  assert.match(out.stdout, /Listo: Frío Ejemplo SAS \(demostración\)/);
  assert.match(out.stdout, /Clave: la de DEMO_PASSWORD/);
  assert.doesNotMatch(out.stdout, new RegExp(CLAVE));                 // la clave nunca sale impresa

  const session = await entrar();
  assert.equal(session.company.name, 'Frío Ejemplo SAS (demostración)');
  assert.equal(session.company.branding.hasLogo, true);
  assert.equal(session.company.branding.primary, '#0e7490');
  const { orders, quotes, clients, users } = await conteo(session.token);

  assert.equal(clients.length, 8);
  assert.equal(users.filter((u) => u.role === 'admin').length, 1);
  assert.equal(users.filter((u) => u.role === 'tecnico').length, 3);
  assert.equal(orders.length, demo.ORDERS.length);
  assert.deepEqual([...new Set(orders.map((o) => o.status))].sort(), ['cancelada', 'completada', 'en_proceso', 'pendiente']);
  assert.ok(orders.some((o) => o.checklist.length && o.checklist.every((i) => i.done)));
  assert.ok(orders.some((o) => o.attachments.length === 2 && o.signature && o.signature.file));
  assert.deepEqual(quotes.map((q) => q.status).sort(), ['aprobada', 'enviada', 'rechazada']);
  const aprobada = quotes.find((q) => q.status === 'aprobada');
  assert.equal(aprobada.workOrder.title, 'Instalación de termostato digital');
  assert.equal(aprobada.total, 511700);                              // 430.000 + IVA del 19 %

  // Las fotos y la firma son imágenes PNG de verdad (generadas, sin personas)
  const conFotos = orders.find((o) => o.attachments.length === 2);
  const foto = await WorkOrder.findOne({ tenant: session.company._id, _id: conFotos._id }).populate('attachments.file');
  assert.equal(foto.attachments[0].file.data.slice(1, 4).toString('ascii'), 'PNG');

  // Reportes de los últimos 30 días: órdenes creadas, completadas y por técnico
  const report = (await call('GET', '/reports', { as: session.token })).data;
  assert.equal(report.totals.created, demo.ORDERS.length);
  assert.equal(report.totals.completed, demo.ORDERS.filter((o) => o.status === 'completada').length);
  assert.ok(report.byDay.length >= 8);
  assert.ok(report.byTechnician.some((t) => t.name === 'Andrés Ejemplo'));

  // Un técnico también entra con la clave de la demo
  await entrar(CLAVE, 'camila@frio-ejemplo.example');
});

test('es idempotente: repetirlo no duplica nada', async () => {
  await run();
  await run();
  const { orders, quotes, clients, users } = await conteo((await entrar()).token);
  assert.equal(orders.length, demo.ORDERS.length);
  assert.equal(quotes.length, 3);
  assert.equal(clients.length, 8);
  assert.equal(users.length, 4);
  assert.equal(await Company.countDocuments({ slug: demo.SLUG }), 1);
  assert.deepEqual(quotes.map((q) => q.number).sort(), [1, 2, 3]);
});

test('sin DEMO_PASSWORD genera la clave y la imprime una sola vez', async () => {
  const first = await run([], {});
  const clave = /Clave de los 4 usuarios \(se muestra UNA sola vez; guárdala\): (\S+)/.exec(first.stdout)[1];
  await entrar(clave);
  const second = await run([], {});
  assert.match(second.stdout, /Clave: no cambió/);
  assert.doesNotMatch(second.stdout, new RegExp(clave));
  await entrar(clave);                                               // la misma de antes
  const third = await run(['--nueva-clave'], {});
  const nueva = /guárdala\): (\S+)/.exec(third.stdout)[1];
  assert.notEqual(nueva, clave);
  await entrar(nueva);
  // DEMO_PASSWORD corta no sirve
  await assert.rejects(run([], { DEMO_PASSWORD: 'corta' }), (err) => /al menos 8 caracteres/.test(err.stderr));
});

test('--reiniciar deja los datos limpios: borra lo creado en la grabación y vuelve a los de ejemplo', async () => {
  await run();
  const { token } = await entrar();
  const { orders } = await conteo(token);
  const extra = (await call('POST', '/clients', { as: token, body: { name: 'Cliente creado grabando' } })).data;
  await call('POST', '/workorders', { as: token, body: { title: 'Orden creada grabando', description: 'Prueba en vivo', client: extra._id } });
  await call('POST', '/users', { as: token, body: { name: 'Técnico grabando', email: 'nuevo@frio-ejemplo.example', role: 'tecnico' } });
  const pendiente = orders.find((o) => o.status === 'pendiente');
  await call('PATCH', `/workorders/${pendiente._id}/status`, { as: token, body: { status: 'completada' } });

  // sin --reiniciar no borra lo de la grabación (solo agrega lo que falte)
  await run();
  assert.equal((await conteo((await entrar()).token)).orders.length, demo.ORDERS.length + 1);

  const out = await run(['--reiniciar']);
  assert.match(out.stdout, /Datos anteriores borrados/);
  const after = await conteo((await entrar()).token);
  assert.equal(after.orders.length, demo.ORDERS.length);
  assert.equal(after.clients.length, 8);
  assert.equal(after.users.length, 4);
  assert.ok(!after.orders.some((o) => o.title === 'Orden creada grabando'));
  assert.equal(after.orders.find((o) => o.title === pendiente.title).status, 'pendiente');
  assert.deepEqual(after.quotes.map((q) => q.number).sort(), [1, 2, 3]);
});

test('GABY no ve la cuenta demo en la lista (uso y cobros); por su id sale marcada y no se puede suspender', async () => {
  const real = await company('Cliente De Verdad');
  await run();
  const demoCompany = await Company.findOne({ slug: demo.SLUG });
  assert.equal(demoCompany.demo, true);

  const list = (await call('GET', '/platform/companies', { platformKey: KEY })).data.items;
  assert.deepEqual(list.map((c) => c.name), ['Cliente De Verdad']);
  assert.equal(list[0].demo, false);
  const todas = (await call('GET', '/platform/companies?demo=incluir', { platformKey: KEY })).data.items;
  assert.equal(todas.find((c) => c.slug === demo.SLUG).demo, true);

  const one = await call('GET', `/platform/companies/${demoCompany._id}`, { platformKey: KEY });
  assert.equal(one.status, 200);
  assert.equal(one.data.demo, true);
  assert.equal((await call('PATCH', `/platform/companies/${demoCompany._id}`, { platformKey: KEY, body: { status: 'suspendida' } })).status, 409);
  assert.equal((await Company.findById(demoCompany._id)).status, 'activa');
  assert.equal((await call('PATCH', `/platform/companies/${real.id}`, { platformKey: KEY, body: { status: 'suspendida' } })).status, 200);

  // y no puede mandar una «recomendación» (sería un testimonio inventado en la página)
  const { token } = await entrar();
  const review = await call('PUT', '/company/review', { as: token, body: { rating: 5, text: 'Texto de ejemplo de una recomendación', name: 'Valeria', consent: true } });
  assert.equal(review.status, 403);
});

test('ningún dato del script trae el 310 ni el número real de NOVA', async () => {
  await run();
  const tenant = (await Company.findOne({ slug: demo.SLUG }))._id;
  const phones = [
    ...(await Client.find({ tenant })).map((c) => c.phone),
    ...(await User.find({ tenant })).map((u) => u.phone),
  ];
  assert.equal(phones.length, 12);
  for (const phone of phones) {
    const digits = phone.replace(/\D/g, '');
    assert.match(digits, /^3000000\d{3}$/, phone);                  // todos de ejemplo: 300 000 0…
    assert.doesNotMatch(digits, /^(57)?310/);
    assert.doesNotMatch(digits, /3213927697/);
  }
  // Ni en los datos del script (nombres, direcciones, notas, correos)
  const all = JSON.stringify([demo.USERS, demo.CLIENTS, demo.ORDERS, demo.QUOTES, demo.TEMPLATES, demo.NAME]);
  assert.doesNotMatch(all.replace(/\D/g, ''), /3213927697/);
  assert.doesNotMatch(all, /(^|\D)310(\D|$)|\b310\s?\d/);
  assert.doesNotMatch(all, /321\s?392\s?7697/);
});
