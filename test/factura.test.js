// Factura electrónica DIAN con Factus de cotizaciones aprobadas: cada empresa conecta su cuenta (credenciales cifradas) y
// su rango; la cotización se factura a consumidor final o a nombre del cliente, con los precios SIN IVA y la tarifa de
// cada renglón. Factus es falso: un servidor local en FACTUS_API_URL que guarda lo que recibe.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const mongoose = require('mongoose');
const { start, stop, reset, call, company, login } = require('./helpers');
const factus = require('../src/services/factus');

let fake;
let bills = [];
let reject = false;
const CREDS = { env: 'pruebas', clientId: 'cliente-123', clientSecret: 'secreto-xyz', username: 'duena@empresa.co', password: 'Clave-Factus-1', numberingRangeId: 8 };

before(async () => {
  await start();
  fake = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      const send = (code, body) => { res.writeHead(code, { 'Content-Type': 'application/json', Connection: 'close' }); res.end(JSON.stringify(body)); };
      if (req.url === '/oauth/token') {
        const form = new URLSearchParams(raw);
        if (form.get('password') !== CREDS.password || form.get('client_secret') !== CREDS.clientSecret) return send(401, { message: 'invalid' });
        return send(200, { token_type: 'Bearer', expires_in: 600, access_token: 'tok-1', refresh_token: 'r' });
      }
      if (req.url === '/v2/bills/validate') {
        if (req.headers.authorization !== 'Bearer tok-1') return send(401, {});
        if (reject) return send(422, { message: 'Regla FAK24: el NIT no es válido' });
        bills.push(JSON.parse(raw));
        return send(201, { status: 'Created', data: { number: `SETP99000${bills.length}`, cufe: `cufe-${bills.length}`, links: { qr: 'https://qr', public_url: `https://factus.test/f/${bills.length}` } } });
      }
      return send(404, {});
    });
  }).listen(0);
  process.env.FACTUS_API_URL = `http://127.0.0.1:${fake.address().port}`;
});
after(async () => { fake.close(); delete process.env.FACTUS_API_URL; await stop(); });
beforeEach(async () => { await reset(); bills = []; reject = false; factus._reset(); });

const ITEMS = [
  { description: 'Mantenimiento preventivo', qty: 4, unitPrice: 120000, taxRate: 19 },
  { description: 'Gas refrigerante (libra)', qty: 2.5, unitPrice: 35000, taxRate: 19 },
  { description: 'Visita técnica', qty: 1, unitPrice: 50000, taxRate: 0 },
];

// Una empresa con Factus y una cotización aprobada por el cliente.
const setup = async (name = 'Frío Ruta', { connect = true, items = ITEMS } = {}) => {
  const a = await company(name);
  if (connect) assert.equal((await call('PUT', '/company/factus', { as: a.token, body: CREDS })).status, 200);
  const slug = name.toLowerCase().replace(/\W+/g, '');
  const client = (await call('POST', '/clients', { as: a.token, body: { name: 'Hotel Norte', company: 'Hoteles del Norte SAS', email: `h@${slug}.com` } })).data;
  const q = (await call('POST', '/quotes', { as: a.token, body: { client: client._id, title: 'Mantenimiento piso 3', items } })).data;
  const token = (await call('POST', `/quotes/${q._id}/send`, { as: a.token })).data.path.split('/').pop();
  return { a, q, token, client };
};
const approve = (token) => call('POST', `/cotizaciones/${token}/aprobar`, { body: { name: 'Carlos Pérez', accept: true } });

test('conectar: las credenciales se prueban con Factus, quedan cifradas y solo el administrador las maneja', async () => {
  const a = await company('Factura Uno');
  assert.equal((await call('PUT', '/company/factus', { as: a.token, body: { ...CREDS, password: 'otra' } })).status, 400);
  assert.equal((await call('PUT', '/company/factus', { as: a.token, body: { ...CREDS, username: 'no-es-correo' } })).status, 400);
  const ok = await call('PUT', '/company/factus', { as: a.token, body: CREDS });
  assert.equal(ok.status, 200, JSON.stringify(ok.data));
  assert.equal(ok.data.connected, true);
  assert.equal(ok.data.numberingRangeId, 8);
  assert.ok(!JSON.stringify(ok.data).includes('secreto-xyz') && !JSON.stringify(ok.data).includes('Clave-Factus'));
  const raw = await mongoose.connection.collection('companies').findOne({ _id: new mongoose.Types.ObjectId(a.id) });
  assert.ok(raw.factus.passwordSealed.startsWith('v1.') && !raw.factus.passwordSealed.includes('Clave-Factus'));
  const made = await call('POST', '/users', { as: a.token, body: { name: 'Ana', email: 'ana@facturauno.com', role: 'tecnico' } });
  const tech = await login('ana@facturauno.com', made.data.temporaryPassword);
  assert.equal((await call('GET', '/company/factus', { as: tech })).status, 403);
  assert.equal((await call('DELETE', '/company/factus', { as: a.token })).data.connected, false);
});

test('factura a consumidor final: precios sin IVA, tarifa por renglón, a crédito si no está pagada y sin duplicar', async () => {
  const { a, q, token } = await setup();
  assert.equal((await call('POST', `/quotes/${q._id}/invoice`, { as: a.token, body: {} })).status, 409);   // sin aprobar
  await approve(token);
  const r = await call('POST', `/quotes/${q._id}/invoice`, { as: a.token, body: {} });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.invoice.number, 'SETP990001');
  assert.equal(r.data.invoice.cufe, 'cufe-1');
  const bill = bills[0];
  assert.equal(bill.reference_code, `NWO-COT-${q._id}`);
  assert.equal(bill.numbering_range_id, 8);
  assert.equal(bill.customer.identification, '222222222222');
  const [m, g, v] = bill.items;
  assert.deepEqual([m.price, m.quantity, m.taxes[0].rate], ['120000.00', '4.00', '19.00']);
  assert.deepEqual([g.price, g.quantity], ['35000.00', '2.50']);
  assert.deepEqual([v.price, v.taxes[0].rate], ['50000.00', '0.00']);
  assert.equal(bill.payment_details[0].amount, '725325.00');
  assert.equal(bill.payment_details[0].payment_form, '2');                 // sin pagar: a crédito
  assert.match(bill.payment_details[0].payment_due_date, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(bill.cash_rounding_amount, '0.00');
  // otra vez: no se factura de nuevo
  assert.equal((await call('POST', `/quotes/${q._id}/invoice`, { as: a.token, body: {} })).status, 200);
  assert.equal(bills.length, 1);
  // el cliente ve el enlace en su página
  assert.equal((await call('GET', `/cotizaciones/${token}`)).data.quote.invoice.publicUrl, 'https://factus.test/f/1');
  const log = (await call('GET', '/audit?limit=50', { as: a.token })).data.items;
  assert.ok(log.some((e) => e.action === 'cotizacion.factura'));
});

test('a nombre del cliente con NIT, pagada (de contado) y validaciones del comprador', async () => {
  const { a, q, token } = await setup();
  await approve(token);
  await call('POST', `/quotes/${q._id}/payment`, { as: a.token, body: { status: 'pagado' } });
  assert.equal((await call('POST', `/quotes/${q._id}/invoice`, { as: a.token, body: { buyer: { docType: 'NIT', identification: '900.123.456' } } })).status, 400);
  assert.equal((await call('POST', `/quotes/${q._id}/invoice`, { as: a.token, body: { buyer: { docType: 'XX', identification: '900123456', name: 'X' } } })).status, 400);
  const r = await call('POST', `/quotes/${q._id}/invoice`, { as: a.token, body: { buyer: {
    docType: 'NIT', identification: '900123456', dv: '7', name: 'Hoteles del Norte SAS', email: 'compras@hotel.co',
  } } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const c = bills[0].customer;
  assert.deepEqual([c.identification_document_code, c.identification, c.dv, c.company, c.legal_organization_code], ['31', '900123456', '7', 'Hoteles del Norte SAS', '1']);
  assert.equal(bills[0].payment_details[0].payment_form, '1');            // pagada: de contado
  assert.equal(r.data.invoice.buyerName, 'Hoteles del Norte SAS');
});

test('si Factus rechaza queda el error para reintentar; un IVA que la DIAN no acepta no se envía', async () => {
  const { a, q, token } = await setup();
  await approve(token);
  reject = true;
  const r = await call('POST', `/quotes/${q._id}/invoice`, { as: a.token, body: {} });
  assert.equal(r.status, 502);
  assert.match(r.data.message, /FAK24/);
  assert.match((await call('GET', `/quotes/${q._id}`, { as: a.token })).data.invoice.error, /FAK24/);
  reject = false;
  assert.equal((await call('POST', `/quotes/${q._id}/invoice`, { as: a.token, body: {} })).status, 200);

  const other = await setup('Otra Empresa', { items: [{ description: 'Servicio', qty: 1, unitPrice: 100000, taxRate: 8 }] });
  await approve(other.token);
  const bad = await call('POST', `/quotes/${other.q._id}/invoice`, { as: other.a.token, body: {} });
  assert.equal(bad.status, 502);
  assert.match(bad.data.message, /0 %, 5 % o 19 %/);
});

test('sin Factus conectado no se factura; el técnico tampoco puede facturar', async () => {
  const { a, q, token } = await setup('Sin Factus', { connect: false });
  await approve(token);
  assert.equal((await call('POST', `/quotes/${q._id}/invoice`, { as: a.token, body: {} })).status, 409);
  const made = await call('POST', '/users', { as: a.token, body: { name: 'Ana', email: 'ana@sinfactus.com', role: 'tecnico' } });
  const tech = await login('ana@sinfactus.com', made.data.temporaryPassword);
  assert.equal((await call('POST', `/quotes/${q._id}/invoice`, { as: tech, body: {} })).status, 403);
});
