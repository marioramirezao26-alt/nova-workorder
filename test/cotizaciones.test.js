// Cotizaciones (Mejora 3): borrador → enviada → aprobada (crea la orden) o rechazada, con el enlace público del cliente.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { start, stop, reset, call, company, login, origin } = require('./helpers');
const { totals } = require('../src/utils/money');

before(start);
after(stop);
beforeEach(reset);

const DAY = 86400000;
const day = (offset) => new Date(Date.now() - 5 * 3600000 + offset * DAY).toISOString().slice(0, 10);   // fecha en Colombia

const setup = async (name = 'Frío Ruta') => {
  const a = await company(name);
  const slug = name.toLowerCase().replace(/\W+/g, '');
  const made = await call('POST', '/users', { as: a.token, body: { name: 'Ana Técnica', email: `ana@${slug}.com`, role: 'tecnico' } });
  const tech = await login(`ana@${slug}.com`, made.data.temporaryPassword);
  const other = await call('POST', '/users', { as: a.token, body: { name: 'Beto Técnico', email: `beto@${slug}.com`, role: 'tecnico' } });
  const beto = await login(`beto@${slug}.com`, other.data.temporaryPassword);
  const client = (await call('POST', '/clients', { as: a.token, body: { name: 'Hotel Norte', email: `hotel@${slug}.com`, phone: '3001234567' } })).data;
  return { a, tech, beto, client };
};

const ITEMS = [
  { description: 'Mantenimiento preventivo de aire acondicionado', qty: 4, unitPrice: 120000, taxRate: 19 },
  { description: 'Gas refrigerante R410 (libra)', qty: 2.5, unitPrice: 35000 },
  { description: 'Visita técnica', qty: 1, unitPrice: 50000, taxRate: 0 },
];

test('crear: el servidor calcula los totales, numera por empresa y pone la validez por defecto', async () => {
  const { a, tech, client } = await setup();
  const r = await call('POST', '/quotes', { as: tech, body: { client: client._id, title: 'Mantenimiento piso 3', items: ITEMS, subtotal: 1, total: 1 } });
  assert.equal(r.status, 201);
  assert.equal(r.data.number, 1);
  assert.equal(r.data.currency, 'COP');
  assert.equal(r.data.status, 'borrador');
  // 480.000 + 87.500 + 50.000 = 617.500; IVA 19 % de 480.000 = 91.200 y de 87.500 (19 % por defecto) = 16.625
  assert.equal(r.data.subtotal, 617500);
  assert.equal(r.data.tax, 107825);
  assert.equal(r.data.total, 725325);
  assert.equal(r.data.items[1].taxRate, 19);
  const days = (new Date(r.data.validUntil) - Date.now()) / DAY;
  assert.ok(days > 14 && days < 16.1, `validez de ~15 días, dio ${days}`);
  const second = await call('POST', '/quotes', { as: a.token, body: { client: client._id, title: 'Otra', items: [ITEMS[2]] } });
  assert.equal(second.data.number, 2);
  // otra empresa empieza en 1 y no ve las de esta
  const b = await setup('Otra Empresa');
  assert.equal((await call('POST', '/quotes', { as: b.a.token, body: { client: b.client._id, title: 'X', items: [ITEMS[2]] } })).data.number, 1);
  assert.equal((await call('GET', '/quotes', { as: b.a.token })).data.items.length, 1);
  assert.equal((await call('GET', `/quotes/${r.data._id}`, { as: b.a.token })).status, 404);
  assert.equal((await call('POST', '/quotes', { as: b.a.token, body: { client: client._id, title: 'X', items: [ITEMS[2]] } })).status, 400);   // cliente ajeno
});

test('validaciones: renglones, cantidades, precios e impuestos', async () => {
  const { a, client } = await setup();
  const bad = async (items) => (await call('POST', '/quotes', { as: a.token, body: { client: client._id, title: 'X', items } })).status;
  assert.equal(await bad([]), 400);
  assert.equal(await bad([{ description: '', qty: 1, unitPrice: 1 }]), 400);
  assert.equal(await bad([{ description: 'a', qty: 0, unitPrice: 1 }]), 400);
  // 0,004 se redondea a 0: 400 con el renglón (no un 500) y no gasta un número
  const tiny = await call('POST', '/quotes', { as: a.token, body: { client: client._id, title: 'X', items: [{ description: 'a', qty: 0.004, unitPrice: 1 }] } });
  assert.equal(tiny.status, 400);
  assert.equal(tiny.data.message, 'Cantidad inválida en el renglón 1');
  assert.equal(await bad([{ description: 'a', qty: 1, unitPrice: -5 }]), 400);
  assert.equal(await bad([{ description: 'a', qty: 1, unitPrice: 'mil' }]), 400);
  assert.equal(await bad([{ description: 'a', qty: 1, unitPrice: 1, taxRate: 50 }]), 400);
  assert.equal(await bad(Array.from({ length: 51 }, () => ITEMS[2])), 400);
  assert.equal((await call('POST', '/quotes', { as: a.token, body: { client: client._id, items: ITEMS } })).status, 400);   // sin título
  assert.equal((await call('POST', '/quotes', { as: a.token, body: { client: client._id, title: 'X', items: [ITEMS[2]] } })).data.number, 1);
});

test('enviar, aprobar desde el enlace: crea la orden una sola vez y queda en la bitácora', async () => {
  const { a, tech, client } = await setup();
  const q = (await call('POST', '/quotes', { as: tech, body: { client: client._id, title: 'Mantenimiento piso 3', items: ITEMS, notes: 'Garantía de 3 meses' } })).data;
  // en borrador el enlace no existe
  const sent = await call('POST', `/quotes/${q._id}/send`, { as: tech });
  assert.equal(sent.status, 200);
  assert.match(sent.data.path, /^\/cotizacion\/[A-Za-z0-9_-]{20,40}$/);
  assert.equal(sent.data.quote.status, 'enviada');
  const token = sent.data.path.split('/').pop();
  assert.equal((await call('POST', `/quotes/${q._id}/send`, { as: tech })).data.path, sent.data.path);   // mismo enlace

  const pub = await call('GET', `/cotizaciones/${token}`);
  assert.equal(pub.status, 200);
  assert.equal(pub.data.company.name, 'Frío Ruta');
  assert.equal(pub.data.quote.total, 725325);
  assert.equal(pub.data.quote.client.name, 'Hotel Norte');
  assert.equal(pub.data.quote.client.email, undefined);       // sin datos de contacto del cliente
  assert.equal(pub.data.quote.publicToken, undefined);

  assert.equal((await call('POST', `/cotizaciones/${token}/aprobar`, { body: { name: 'Carlos Pérez' } })).status, 400);   // sin aceptar
  assert.equal((await call('POST', `/cotizaciones/${token}/aprobar`, { body: { name: 'C', accept: true } })).status, 400);
  const res = await fetch(`${origin()}/api/cotizaciones/${token}/aprobar`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (iPhone) Prueba' }, body: JSON.stringify({ name: 'Carlos Pérez', accept: true }),
  });
  const ok = { status: res.status, data: await res.json() };
  assert.equal(ok.status, 200);
  assert.equal(ok.data.quote.status, 'aprobada');
  assert.equal(ok.data.quote.decidedBy, 'Carlos Pérez');
  // dos clics: el segundo no aprueba de nuevo ni crea otra orden
  assert.equal((await call('POST', `/cotizaciones/${token}/aprobar`, { body: { name: 'Carlos Pérez', accept: true } })).status, 409);
  assert.equal((await call('POST', `/cotizaciones/${token}/rechazar`, { body: { name: 'Carlos Pérez' } })).status, 409);

  const orders = (await call('GET', '/workorders?limit=50', { as: a.token })).data.items;
  assert.equal(orders.length, 1);
  assert.match(orders[0].title, /^Cotización #1: Mantenimiento piso 3/);
  assert.equal(orders[0].client._id, client._id);
  assert.equal(orders[0].status, 'pendiente');
  assert.match(orders[0].description, /4 × Mantenimiento preventivo/);
  const detail = (await call('GET', `/quotes/${q._id}`, { as: a.token })).data;
  assert.equal(detail.workOrder._id, orders[0]._id);
  assert.equal(detail.decidedVia, 'cliente');
  const log = (await call('GET', '/audit?limit=50', { as: a.token })).data.items;
  assert.ok(log.some((e) => e.action === 'cotizacion.aprobada' && /Carlos Pérez/.test(e.summary)));
  // el nombre lo escribe cualquiera con el enlace: queda de dónde vino la respuesta
  const entry = await mongoose.connection.collection('auditlogs').findOne({ action: 'cotizacion.aprobada' });
  assert.equal(entry.meta.userAgent, 'Mozilla/5.0 (iPhone) Prueba');
  assert.match(entry.meta.ip, /127\.0\.0\.1/);
  // aprobada: no se edita, no se reabre, no se borra
  assert.equal((await call('PUT', `/quotes/${q._id}`, { as: tech, body: { title: 'Cambio' } })).status, 409);
  assert.equal((await call('POST', `/quotes/${q._id}/reopen`, { as: tech })).status, 409);
  assert.equal((await call('DELETE', `/quotes/${q._id}`, { as: a.token })).status, 409);
});

test('rechazar, volver a borrador, editar y reenviar; el borrador no se ve por el enlace', async () => {
  const { tech, client } = await setup();
  const q = (await call('POST', '/quotes', { as: tech, body: { client: client._id, title: 'Instalación', items: [ITEMS[0]] } })).data;
  const token = (await call('POST', `/quotes/${q._id}/send`, { as: tech })).data.path.split('/').pop();
  assert.equal((await call('PUT', `/quotes/${q._id}`, { as: tech, body: { title: 'Cambio' } })).status, 409);   // enviada: no se edita
  const no = await call('POST', `/cotizaciones/${token}/rechazar`, { body: { name: 'Carlos Pérez', note: 'Muy cara' } });
  assert.equal(no.data.quote.status, 'rechazada');
  const back = await call('POST', `/quotes/${q._id}/reopen`, { as: tech });
  assert.equal(back.data.status, 'borrador');
  assert.equal(back.data.decisionNote, '');
  assert.equal((await call('GET', `/cotizaciones/${token}`)).status, 404);
  const edited = await call('PUT', `/quotes/${q._id}`, { as: tech, body: { items: [{ ...ITEMS[0], unitPrice: 100000 }] } });
  assert.equal(edited.data.total, 476000);
  const again = (await call('POST', `/quotes/${q._id}/send`, { as: tech })).data.path.split('/').pop();
  assert.notEqual(again, token);                                                    // al reenviarla sale otra llave
  assert.equal((await call('GET', `/cotizaciones/${token}`)).status, 404);
  assert.equal((await call('GET', `/cotizaciones/${again}`)).data.quote.total, 476000);
});

test('volver a borrador cambia la llave: el enlace viejo no muestra ni aprueba lo que cambió', async () => {
  const { a, tech, client } = await setup();
  const other = (await call('POST', '/clients', { as: a.token, body: { name: 'Clínica Sur', email: 'compras@clinicasur.com', company: 'Clínica Sur SAS' } })).data;
  const q = (await call('POST', '/quotes', { as: tech, body: { client: client._id, title: 'Para el hotel', items: [ITEMS[2]] } })).data;
  const old = (await call('POST', `/quotes/${q._id}/send`, { as: tech })).data.path.split('/').pop();
  assert.equal((await call('GET', `/cotizaciones/${old}`)).data.quote.total, 50000);   // el hotel abre su enlace
  // la oficina la vuelve a borrador, la pasa a otro cliente con otro precio y la reenvía
  await call('POST', `/quotes/${q._id}/reopen`, { as: tech });
  await call('PUT', `/quotes/${q._id}`, { as: tech, body: { client: other._id, items: [{ ...ITEMS[2], unitPrice: 900000 }] } });
  const fresh = (await call('POST', `/quotes/${q._id}/send`, { as: tech })).data.path.split('/').pop();
  // la pestaña vieja del hotel: ni ve a la clínica ni aprueba los 900.000
  assert.equal((await call('GET', `/cotizaciones/${old}`)).status, 404);
  assert.equal((await call('POST', `/cotizaciones/${old}/aprobar`, { body: { name: 'Gerente Hotel', accept: true } })).status, 404);
  assert.equal((await call('POST', `/cotizaciones/${old}/rechazar`, { body: { name: 'Gerente Hotel' } })).status, 404);
  const detail = (await call('GET', `/quotes/${q._id}`, { as: tech })).data;
  assert.equal(detail.status, 'enviada');
  assert.equal(detail.workOrder, null);
  const pub = (await call('GET', `/cotizaciones/${fresh}`)).data.quote;
  assert.equal(pub.client.name, 'Clínica Sur');
  assert.equal(pub.total, 900000);
});

test('vencida: no se aprueba ni se envía; con la fecha corregida sí', async () => {
  const { tech, client } = await setup();
  const q = (await call('POST', '/quotes', { as: tech, body: { client: client._id, title: 'Instalación', items: [ITEMS[2]], validUntil: day(1) } })).data;
  const token = (await call('POST', `/quotes/${q._id}/send`, { as: tech })).data.path.split('/').pop();
  await mongoose.connection.collection('quotes').updateOne({ _id: new mongoose.Types.ObjectId(q._id) }, { $set: { validUntil: new Date(Date.now() - 1000) } });
  assert.equal((await call('GET', `/cotizaciones/${token}`)).data.quote.status, 'vencida');
  assert.equal((await call('GET', '/quotes?status=vencida', { as: tech })).data.items.length, 1);
  const late = await call('POST', `/cotizaciones/${token}/aprobar`, { body: { name: 'Carlos Pérez', accept: true } });
  assert.equal(late.status, 409);
  assert.match(late.data.message, /venció/);
  await call('POST', `/quotes/${q._id}/reopen`, { as: tech });
  await call('PUT', `/quotes/${q._id}`, { as: tech, body: { validUntil: day(10) } });
  const renewed = (await call('POST', `/quotes/${q._id}/send`, { as: tech })).data.path.split('/').pop();
  assert.equal((await call('POST', `/cotizaciones/${renewed}/aprobar`, { body: { name: 'Carlos Pérez', accept: true } })).status, 200);
});

test('permisos: el técnico solo cambia las suyas, el cliente ve las suyas sin borradores, la oficina puede aprobar', async () => {
  const { a, tech, beto, client } = await setup();
  const q = (await call('POST', '/quotes', { as: tech, body: { client: client._id, title: 'Instalación', items: [ITEMS[2]] } })).data;
  assert.equal((await call('PUT', `/quotes/${q._id}`, { as: beto, body: { title: 'Mía' } })).status, 403);
  assert.equal((await call('POST', `/quotes/${q._id}/send`, { as: beto })).status, 403);
  assert.equal((await call('DELETE', `/quotes/${q._id}`, { as: tech })).status, 403);
  // usuario cliente de la ficha
  const cu = await call('POST', '/users', { as: a.token, body: { name: 'Hotel', email: 'compras@hotel.com', role: 'cliente', client: client._id } });
  const cliente = await login('compras@hotel.com', cu.data.temporaryPassword);
  assert.equal((await call('GET', '/quotes', { as: cliente })).data.items.length, 0);           // borrador: no la ve
  assert.equal((await call('POST', '/quotes', { as: cliente, body: { client: client._id, title: 'X', items: [ITEMS[2]] } })).status, 403);
  const token = (await call('POST', `/quotes/${q._id}/send`, { as: tech })).data.path.split('/').pop();
  assert.equal((await call('GET', '/quotes', { as: cliente })).data.items.length, 1);
  // la llave (con ella se aprueba sin sesión) la ven quien la armó, el administrador y el cliente; otro técnico no
  const keyFor = async (as) => [(await call('GET', '/quotes', { as })).data.items[0].publicToken, (await call('GET', `/quotes/${q._id}`, { as })).data.publicToken];
  assert.deepEqual(await keyFor(tech), [token, token]);
  assert.deepEqual(await keyFor(a.token), [token, token]);
  assert.deepEqual(await keyFor(cliente), [token, token]);
  assert.deepEqual(await keyFor(beto), [undefined, undefined]);
  // aprobación de la oficina (el cliente dijo que sí por teléfono): solo el administrador
  assert.equal((await call('POST', `/quotes/${q._id}/approve`, { as: tech })).status, 403);
  const ok = await call('POST', `/quotes/${q._id}/approve`, { as: a.token, body: { note: 'Aprobó por teléfono' } });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.status, 'aprobada');
  assert.equal(ok.data.decidedVia, 'oficina');
  assert.ok(ok.data.workOrder);
  // convertir otra vez no crea otra orden
  await call('POST', `/quotes/${q._id}/convert`, { as: a.token });
  assert.equal((await call('GET', '/workorders?limit=50', { as: a.token })).data.items.length, 1);
  assert.equal((await call('GET', '/cotizaciones/llave-inventada-que-no-existe-123')).status, 404);
});

test('una empresa en Estados Unidos cotiza en dólares con centavos y sin impuesto por defecto', async () => {
  const b = await company('Cool Air LLC');
  await mongoose.connection.collection('companies').updateOne({ _id: new mongoose.Types.ObjectId(b.id) }, { $set: { lang: 'en' } });
  const client = (await call('POST', '/clients', { as: b.token, body: { name: 'Hotel Miami', email: 'h@miami.com' } })).data;
  const q = await call('POST', '/quotes', { as: b.token, body: { client: client._id, title: 'AC tune-up', items: [{ description: 'Tune-up', qty: 3, unitPrice: 89.99 }] } });
  assert.equal(q.data.currency, 'USD');
  assert.equal(q.data.subtotal, 269.97);
  assert.equal(q.data.tax, 0);
  assert.equal(q.data.total, 269.97);
  // la orden que sale de la cotización va en el idioma de la empresa
  await call('POST', `/quotes/${q.data._id}/send`, { as: b.token });
  await call('POST', `/quotes/${q.data._id}/approve`, { as: b.token });
  const [order] = (await call('GET', '/workorders?limit=50', { as: b.token })).data.items;
  assert.equal(order.title, 'Quote #1: AC tune-up');
  assert.match(order.description, /^Work approved in quote #1\.\n- 3 × Tune-up/);
});

test('borrar la orden de una cotización la desliga: «Crear la orden» la vuelve a crear y queda en la bitácora', async () => {
  const { a, tech, client } = await setup();
  const q = (await call('POST', '/quotes', { as: tech, body: { client: client._id, title: 'Instalación', items: [ITEMS[2]] } })).data;
  await call('POST', `/quotes/${q._id}/send`, { as: tech });
  const first = (await call('POST', `/quotes/${q._id}/approve`, { as: a.token })).data.workOrder._id;
  assert.equal((await call('DELETE', `/workorders/${first}`, { as: a.token })).status, 200);
  const raw = await mongoose.connection.collection('quotes').findOne({ _id: new mongoose.Types.ObjectId(q._id) });
  assert.equal(raw.workOrder, null);
  const made = await call('POST', `/quotes/${q._id}/convert`, { as: a.token });
  assert.equal(made.status, 200);
  assert.ok(made.data.workOrder && made.data.workOrder._id !== first);
  assert.equal((await call('GET', '/workorders?limit=50', { as: a.token })).data.items.length, 1);
  assert.equal(await mongoose.connection.collection('auditlogs').countDocuments({ action: 'cotizacion.convertir' }), 1);
  // una cotización que ya quedó apuntando a una orden borrada (antes de este arreglo) también se recupera
  await mongoose.connection.collection('workorders').deleteMany({});
  const again = await call('POST', `/quotes/${q._id}/convert`, { as: a.token });
  assert.ok(again.data.workOrder && again.data.workOrder._id !== made.data.workOrder._id);
  assert.equal((await call('GET', '/workorders?limit=50', { as: a.token })).data.items.length, 1);
  // con la orden viva, convertir no crea otra ni anota nada
  await call('POST', `/quotes/${q._id}/convert`, { as: a.token });
  assert.equal((await call('GET', '/workorders?limit=50', { as: a.token })).data.items.length, 1);
  assert.equal(await mongoose.connection.collection('auditlogs').countDocuments({ action: 'cotizacion.convertir' }), 2);
});

test('«Crear la orden» varias veces a la vez deja una sola orden y una sola entrada en la bitácora', async () => {
  const { a, tech, client } = await setup();
  const q = (await call('POST', '/quotes', { as: tech, body: { client: client._id, title: 'Instalación', items: [ITEMS[2]] } })).data;
  await call('POST', `/quotes/${q._id}/send`, { as: tech });
  const first = (await call('POST', `/quotes/${q._id}/approve`, { as: a.token })).data.workOrder._id;
  await call('DELETE', `/workorders/${first}`, { as: a.token });
  const made = await Promise.all([1, 2, 3].map(() => call('POST', `/quotes/${q._id}/convert`, { as: a.token })));
  assert.ok(made.every((r) => r.status === 200));
  const orders = (await call('GET', '/workorders?limit=50', { as: a.token })).data.items;
  assert.equal(orders.length, 1);
  assert.ok(made.every((r) => r.data.workOrder._id === orders[0]._id));
  assert.equal(await mongoose.connection.collection('auditlogs').countDocuments({ action: 'cotizacion.convertir' }), 1);
});

// La vista previa del formulario (frontend/src/ui.jsx) repite el cálculo del servidor; se prueba tal cual, sin compilar
// el JSX que la rodea, igual que el enlace de WhatsApp en informe.test.js.
const quoteTotals = (() => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'src', 'ui.jsx'), 'utf8');
  const [, round, fn] = /(const round = [\s\S]*?;)\nexport const quoteTotals = ([\s\S]*?\n};)/.exec(source);
  return new Function(`${round}\nreturn ${fn}`)();
})();

test('dólares: el medio centavo sube (sin errores de punto flotante), igual en el servidor y en la vista previa', async () => {
  const b = await company('Cool Air LLC');
  await mongoose.connection.collection('companies').updateOne({ _id: new mongoose.Types.ObjectId(b.id) }, { $set: { lang: 'en' } });
  const client = (await call('POST', '/clients', { as: b.token, body: { name: 'Hotel Miami', email: 'h@miami.com' } })).data;
  // 85 × 9,5 % = 8,075 (Los Ángeles); 34,25 × 6 % = 2,055; 60 × 8,875 % = 5,325 (Nueva York); 1,1 × 17,15 = 18,865; 0,5 × 4,27 = 2,135
  const items = [
    { description: 'Tune-up', qty: 1, unitPrice: 85, taxRate: 9.5 },
    { description: 'Filter', qty: 1, unitPrice: 34.25, taxRate: 6 },
    { description: 'Coil cleaning', qty: 1, unitPrice: 60, taxRate: 8.875 },
    { description: 'Labor (h)', qty: 1.1, unitPrice: 17.15, taxRate: 0 },
    { description: 'Tape', qty: 0.5, unitPrice: 4.27, taxRate: 0 },
  ];
  const q = (await call('POST', '/quotes', { as: b.token, body: { client: client._id, title: 'AC service', items } })).data;
  assert.deepEqual(q.items.map((i) => [i.amount, i.tax]), [[85, 8.08], [34.25, 2.06], [60, 5.33], [18.87, 0], [2.14, 0]]);
  assert.equal(q.subtotal, 200.26);
  assert.equal(q.tax, 15.47);
  assert.equal(q.total, 215.73);
  assert.deepEqual(quoteTotals(items, 'USD'), { subtotal: 200.26, tax: 15.47, total: 215.73 });
  // en pesos, igual: 1,15 × 50 = 57,5 → 58
  assert.equal(totals([{ qty: 1.15, unitPrice: 50, taxRate: 0 }], 'COP').total, 58);
  assert.equal(quoteTotals([{ qty: 1.15, unitPrice: 50, taxRate: 0 }], 'COP').total, 58);
});
