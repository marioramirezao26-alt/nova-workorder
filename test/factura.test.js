// Factura electrónica DIAN con Factus de cotizaciones aprobadas: cada empresa conecta su cuenta (credenciales cifradas) y
// su rango; la cotización se factura a consumidor final o a nombre del cliente, con los precios SIN IVA y la tarifa de
// cada renglón. Factus es falso: un servidor local en FACTUS_API_URL que guarda lo que recibe y, como el de verdad,
// devuelve la factura ya hecha si se repite la referencia (por cuenta: el client_id hace de ambiente).
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const http = require('http');
const mongoose = require('mongoose');
const { start, stop, reset, call, company, login } = require('./helpers');
const factus = require('../src/services/factus');
const { seal } = require('../src/utils/secretBox');

let fake;
let bills = [];
let made = {};             // las facturas que ya tiene Factus, por cuenta y referencia
let valid = new Map();     // token → client_id
let issued = 0;            // tokens entregados
let reject = false;
let pending = false;       // 409: una factura con esa referencia quedó pendiente de envío a la DIAN
let lose = false;          // Factus crea la factura pero la respuesta no llega
let unauthorized = false;  // Factus rechaza cualquier token
const CREDS = { env: 'pruebas', clientId: 'cliente-123', clientSecret: 'secreto-xyz', username: 'duena@empresa.co', password: 'Clave-Factus-1', numberingRangeId: 8 };
const PROD = { ...CREDS, env: 'produccion', clientId: 'cliente-prod' };

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
        issued += 1;
        valid.set(`tok-${issued}`, form.get('client_id'));
        return send(200, { token_type: 'Bearer', expires_in: 600, access_token: `tok-${issued}`, refresh_token: 'r' });
      }
      if (req.url === '/v2/bills/validate') {
        const account = valid.get(String(req.headers.authorization || '').replace('Bearer ', ''));
        if (!account || unauthorized) return send(401, { message: 'Unauthenticated.' });
        if (reject) return send(422, { message: 'Regla FAK24: el NIT no es válido' });
        if (pending) return send(409, { message: 'Se encontró una factura pendiente por enviar a la DIAN' });
        const bill = JSON.parse(raw);
        const key = `${account}|${bill.reference_code}`;
        if (!made[key]) {
          bills.push(bill);
          const c = bill.customer;
          made[key] = { number: `SETP99000${bills.length}`, cufe: `cufe-${bills.length}`, is_validated: true,
            links: { qr: 'https://qr', public_url: `https://factus.test/f/${bills.length}` },
            customer: { identification: c.identification, names: c.names || c.company } };
          if (lose) return send(503, {});
        }
        return send(201, { status: 'Created', data: made[key] });
      }
      return send(404, {});
    });
  }).listen(0);
  process.env.FACTUS_API_URL = `http://127.0.0.1:${fake.address().port}`;
});
after(async () => { fake.close(); delete process.env.FACTUS_API_URL; await stop(); });
beforeEach(async () => {
  await reset();
  bills = []; made = {}; valid = new Map(); issued = 0;
  reject = false; pending = false; lose = false; unauthorized = false;
  factus._reset();
});

const ITEMS = [
  { description: 'Mantenimiento preventivo', qty: 4, unitPrice: 120000, taxRate: 19 },
  { description: 'Gas refrigerante (libra)', qty: 2.5, unitPrice: 35000, taxRate: 19 },
  { description: 'Visita técnica', qty: 1, unitPrice: 50000, taxRate: 0 },
];

const approve = (token) => call('POST', `/cotizaciones/${token}/aprobar`, { body: { name: 'Carlos Pérez', accept: true } });
// Otra cotización del mismo cliente, enviada (y aprobada si se pide).
const quoteFor = async (a, client, { items = ITEMS, approved = false } = {}) => {
  const q = (await call('POST', '/quotes', { as: a.token, body: { client: client._id, title: 'Mantenimiento piso 3', items } })).data;
  const token = (await call('POST', `/quotes/${q._id}/send`, { as: a.token })).data.path.split('/').pop();
  if (approved) await approve(token);
  return { q, token };
};
// Una empresa con Factus y una cotización enviada al cliente.
const setup = async (name = 'Frío Ruta', { connect = true, items = ITEMS } = {}) => {
  const a = await company(name);
  if (connect) assert.equal((await call('PUT', '/company/factus', { as: a.token, body: CREDS })).status, 200);
  const slug = name.toLowerCase().replace(/\W+/g, '');
  const client = (await call('POST', '/clients', { as: a.token, body: { name: 'Hotel Norte', company: 'Hoteles del Norte SAS', email: `h@${slug}.com` } })).data;
  return { a, client, ...(await quoteFor(a, client, { items })) };
};
const invoice = (a, q, body = {}) => call('POST', `/quotes/${q._id}/invoice`, { as: a.token, body });

// Una cotización como la ve buildBill (lo que tenga la base), para revisar la forma y el medio de pago.
const TOTAL = 725325;
const asQuote = (payment) => ({
  _id: 'q1', number: 7, title: 'Mantenimiento', currency: 'COP', total: TOTAL, payment,
  items: ITEMS.map((i) => ({ ...i })),
});
const bill = (payment) => factus.buildBill({ factus: { numberingRangeId: 8 } }, asQuote(payment), {});

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
  // cambiar los datos (el mismo correo, otro ambiente) SIEMPRE pide un token nuevo: el guardado no prueba nada
  const bad = await call('PUT', '/company/factus', { as: a.token, body: { ...PROD, password: 'MALA', clientSecret: 'MALO' } });
  assert.equal(bad.status, 400);
  assert.equal((await call('GET', '/company/factus', { as: a.token })).data.env, 'pruebas');   // no se guardó
  const before = issued;
  assert.equal((await call('PUT', '/company/factus', { as: a.token, body: PROD })).status, 200);
  assert.equal(issued, before + 1);
  const made = await call('POST', '/users', { as: a.token, body: { name: 'Ana', email: 'ana@facturauno.com', role: 'tecnico' } });
  const tech = await login('ana@facturauno.com', made.data.temporaryPassword);
  assert.equal((await call('GET', '/company/factus', { as: tech })).status, 403);
  assert.equal((await call('DELETE', '/company/factus', { as: a.token })).data.connected, false);
});

test('el token se guarda por empresa, ambiente y usuario, y se olvida al conectar, cambiar o desconectar', async () => {
  const sealed = { clientId: 'cliente-123', clientSecretSealed: seal(CREDS.clientSecret), passwordSealed: seal(CREDS.password), username: CREDS.username };
  const empresa = { _id: 'empresa-1', factus: { ...sealed, env: 'pruebas' } };
  assert.equal(await factus.token(empresa), 'tok-1');
  assert.equal(await factus.token(empresa), 'tok-1');                        // guardado
  assert.equal(await factus.token({ ...empresa, factus: { ...sealed, env: 'produccion' } }), 'tok-2');   // otro ambiente
  assert.equal(await factus.token({ _id: 'empresa-2', factus: { ...sealed, env: 'pruebas' } }), 'tok-3'); // otra empresa
  assert.equal(await factus.token({ ...empresa, factus: { ...sealed, env: 'pruebas', username: 'otra@empresa.co' } }), 'tok-4');   // otro usuario
  factus.forget('empresa-1');
  assert.equal(await factus.token(empresa), 'tok-5');
  assert.equal(await factus.token({ _id: 'empresa-2', factus: { ...sealed, env: 'pruebas' } }), 'tok-3');
  // por la API: conectar deja guardado el token que probó las credenciales; cambiar los datos y desconectar lo olvidan
  const a = await company('Tokens SAS');
  const enPruebas = { _id: a.id, factus: { ...sealed, env: 'pruebas' } };
  assert.equal((await call('PUT', '/company/factus', { as: a.token, body: CREDS })).status, 200);       // tok-6
  assert.equal(await factus.token(enPruebas), 'tok-6');
  assert.equal((await call('PUT', '/company/factus', { as: a.token, body: PROD })).status, 200);        // tok-7
  assert.equal(await factus.token(enPruebas), 'tok-8');
  assert.equal((await call('DELETE', '/company/factus', { as: a.token })).status, 200);
  assert.equal(await factus.token({ _id: a.id, factus: { ...sealed, env: 'produccion' } }), 'tok-9');
});

test('un 401 al facturar olvida el token y reintenta una vez; si sigue, no se le culpa a la DIAN', async () => {
  const { a, client, q, token } = await setup();
  await approve(token);
  valid.clear();                                         // Factus revocó la sesión
  const r = await invoice(a, q);
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(issued, 2);                               // el de conectar y uno nuevo
  const other = await quoteFor(a, client, { approved: true });
  unauthorized = true;
  const no = await invoice(a, other.q);
  assert.equal(no.status, 502);
  assert.match(no.data.message, /no aceptó la sesión/);
  assert.doesNotMatch(no.data.message, /DIAN/);
  assert.equal(issued, 3);                               // un solo reintento
});

test('factura a consumidor final: precios sin IVA, tarifa por renglón, a crédito si no está pagada y sin duplicar', async () => {
  const { a, q, token } = await setup();
  assert.equal((await invoice(a, q)).status, 409);       // sin aprobar
  await approve(token);
  const r = await invoice(a, q);
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.invoice.number, 'SETP990001');
  assert.equal(r.data.invoice.cufe, 'cufe-1');
  const sent = bills[0];
  assert.equal(sent.reference_code, `NWO-COT-${q._id}`);
  assert.equal(sent.numbering_range_id, 8);
  assert.equal(sent.customer.identification, '222222222222');
  const [m, g, v] = sent.items;
  assert.deepEqual([m.price, m.quantity, m.taxes[0].rate], ['120000.00', '4.00', '19.00']);
  assert.deepEqual([g.price, g.quantity], ['35000.00', '2.50']);
  assert.deepEqual([v.price, v.taxes[0].rate, v.taxes[0].is_excluded], ['50000.00', '0.00', undefined]);   // 0 % sin marca: exento
  assert.equal(sent.payment_details.length, 1);
  const [pay] = sent.payment_details;
  assert.deepEqual([pay.payment_form, pay.payment_method_code, pay.amount], ['2', 'ZZZ', '725325.00']);   // sin pagar: a crédito
  assert.match(pay.due_date, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(pay.payment_due_date, undefined);
  assert.equal(sent.prepayment_details, undefined);
  assert.equal(sent.cash_rounding_amount, '0.00');
  // otra vez: no se factura de nuevo
  assert.equal((await invoice(a, q)).status, 200);
  assert.equal(bills.length, 1);
  const log = (await call('GET', '/audit?limit=50', { as: a.token })).data.items;
  assert.ok(log.some((e) => e.action === 'cotizacion.factura'));
});

test('una factura de pruebas se marca como tal, no la ve el cliente y no impide facturar en producción', async () => {
  const { a, client, q, token } = await setup();
  await approve(token);
  const test1 = (await invoice(a, q)).data.invoice;
  assert.deepEqual([test1.env, test1.validated], ['pruebas', true]);
  assert.equal((await call('GET', `/cotizaciones/${token}`)).data.quote.invoice, null);
  const cu = await call('POST', '/users', { as: a.token, body: { name: 'Hotel', email: 'compras@hotel.com', role: 'cliente', client: client._id } });
  const portal = await login('compras@hotel.com', cu.data.temporaryPassword);
  assert.equal((await call('GET', `/quotes/${q._id}`, { as: portal })).data.invoice, undefined);
  // mientras siga en pruebas no se repite; al pasar a producción sí se factura, y esa es la definitiva
  assert.equal((await invoice(a, q)).status, 200);
  assert.equal(bills.length, 1);
  assert.equal((await call('PUT', '/company/factus', { as: a.token, body: PROD })).status, 200);
  const real = (await invoice(a, q)).data.invoice;
  assert.equal(bills.length, 2);
  assert.deepEqual([real.env, real.cufe], ['produccion', 'cufe-2']);
  assert.equal((await call('GET', `/cotizaciones/${token}`)).data.quote.invoice.publicUrl, 'https://factus.test/f/2');
  assert.equal((await call('GET', `/quotes/${q._id}`, { as: portal })).data.invoice.cufe, 'cufe-2');
  assert.equal((await invoice(a, q)).status, 200);
  assert.equal(bills.length, 2);
  // aunque la empresa vuelva a pruebas, la de producción sigue siendo la factura
  assert.equal((await call('PUT', '/company/factus', { as: a.token, body: CREDS })).status, 200);
  assert.equal((await invoice(a, q)).data.invoice.cufe, 'cufe-2');
  assert.equal(bills.length, 2);
});

test('una factura de antes de guardar el ambiente se reconoce por su número: SETP es de pruebas; otro prefijo, definitiva', async () => {
  const { a, client, q, token } = await setup();
  await approve(token);
  const quotes = mongoose.connection.collection('quotes');
  await quotes.updateOne({ _id: new mongoose.Types.ObjectId(q._id) }, { $set: { invoice: { number: 'FE-REAL-1', cufe: 'cufe-real', publicUrl: 'https://factus.test/real' } } });
  assert.equal((await call('GET', `/cotizaciones/${token}`)).data.quote.invoice.number, 'FE-REAL-1');   // el cliente la ve
  assert.equal((await call('GET', `/quotes/${q._id}`, { as: a.token })).data.invoice.env, 'produccion');
  assert.equal((await invoice(a, q)).status, 200);
  assert.equal(bills.length, 0);                                           // no se vuelve a facturar
  const other = await quoteFor(a, client, { approved: true });
  await quotes.updateOne({ _id: new mongoose.Types.ObjectId(other.q._id) }, { $set: { invoice: { number: 'SETP990000001', cufe: 'cufe-prueba' } } });
  assert.equal((await call('GET', `/cotizaciones/${other.token}`)).data.quote.invoice, null);
  assert.equal((await call('GET', `/quotes/${other.q._id}`, { as: a.token })).data.invoice.env, 'pruebas');
});

test('a nombre del cliente con NIT, pagada (de contado) y validaciones del comprador', async () => {
  const { a, client, q, token } = await setup();
  await approve(token);
  await call('POST', `/quotes/${q._id}/payment`, { as: a.token, body: { status: 'pagado' } });
  const nit = (buyer) => invoice(a, q, { buyer: { docType: 'NIT', name: 'Hoteles del Norte SAS', ...buyer } });
  assert.equal((await nit({ identification: '900.123.456' })).status, 400);
  assert.equal((await nit({ identification: '900123456-8' })).status, 400);        // el DV va aparte
  const short = await nit({ identification: '1234' });
  assert.equal(short.status, 400);
  assert.match(short.data.errors[0].message, /de 5 a 15 dígitos/);
  const wrong = await nit({ identification: '900123456', dv: '7' });                // el DV de 900123456 es 8
  assert.equal(wrong.status, 400);
  assert.match(wrong.data.errors[0].message, /no corresponde a ese NIT/);
  assert.equal((await invoice(a, q, { buyer: { docType: 'XX', identification: '900123456', name: 'X' } })).status, 400);
  assert.equal(bills.length, 0);
  const r = await nit({ identification: '900123456', dv: '8', email: 'compras@hotel.co' });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const c = bills[0].customer;
  assert.deepEqual([c.identification_document_code, c.identification, c.dv, c.company, c.legal_organization_code, c.country_code], ['31', '900123456', '8', 'Hoteles del Norte SAS', '1', 'CO']);
  assert.deepEqual(bills[0].payment_details, [{ payment_form: '1', payment_method_code: '10', reference_code: `cotizacion-${q.number}`, amount: '725325.00' }]);   // pagada en la oficina: de contado, efectivo
  assert.equal(r.data.invoice.buyerName, 'Hoteles del Norte SAS');
  // sin DV también se factura: Factus lo calcula
  const other = await quoteFor(a, client, { approved: true });
  assert.equal((await invoice(a, other.q, { buyer: { docType: 'NIT', identification: '800197268', name: 'DIAN' } })).status, 200);
  assert.equal('dv' in bills[1].customer, false);
});

test('pasaporte y cédula de extranjería con letras y país; el DV solo va con NIT', async () => {
  const { a, q, token } = await setup();
  await approve(token);
  assert.equal((await invoice(a, q, { buyer: { docType: 'PP', identification: 'AB-123456', name: 'John Smith' } })).status, 400);
  assert.equal((await invoice(a, q, { buyer: { docType: 'PP', identification: 'AB123456', name: 'John Smith', country: 'XYZ' } })).status, 400);
  const r = await invoice(a, q, { buyer: { docType: 'PP', identification: 'ab123456', name: 'John Smith', country: 've' } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const c = bills[0].customer;
  assert.deepEqual([c.identification_document_code, c.identification, c.names, c.country_code], ['41', 'AB123456', 'John Smith', 'VE']);
  const cc = factus.buyerFrom({ docType: 'CC', identification: '1020304050', dv: '7', name: 'Ana Ruiz' });
  assert.deepEqual([cc.identification_document_code, cc.identification, 'dv' in cc, cc.country_code], ['13', '1020304050', false, 'CO']);
});

test('el formulario calcula el mismo DV que el servidor (algoritmo de la DIAN)', () => {
  // Se toma tal cual de frontend/src/ui.jsx: la función no depende de nada más del archivo.
  const source = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'src', 'ui.jsx'), 'utf8');
  const nitDv = new Function(`return ${/export const nitDv = ([\s\S]*?\n};)/.exec(source)[1]}`)();
  assert.equal(factus.nitDv('800197268'), '4');          // el NIT de la DIAN
  assert.equal(factus.nitDv('900123456'), '8');
  for (const n of ['800197268', '900123456', '860034313', '890903938', '1020304050', '901234567', '12345', '830000000']) {
    assert.equal(nitDv(n), factus.nitDv(n), n);
  }
});

test('un renglón excluido de IVA va marcado is_excluded y al 0 %; al 0 % sin marca es exento', async () => {
  const { a, q, token } = await setup('Excluidos SAS', { items: [
    { description: 'Servicio excluido', qty: 1, unitPrice: 100000, taxRate: 0, excluded: true },
    { description: 'Servicio exento', qty: 1, unitPrice: 50000, taxRate: 0 },
    { description: 'Marcado excluido con IVA', qty: 1, unitPrice: 10000, taxRate: 19, excluded: true },
  ] });
  assert.deepEqual(q.items.map((i) => [i.excluded, i.taxRate]), [[true, 0], [false, 0], [true, 0]]);
  assert.equal(q.tax, 0);
  await approve(token);
  assert.equal((await invoice(a, q)).status, 200);
  assert.deepEqual(bills[0].items.map((i) => i.taxes[0]), [
    { code: '01', rate: '0.00', is_excluded: true }, { code: '01', rate: '0.00' }, { code: '01', rate: '0.00', is_excluded: true },
  ]);
});

test('forma y medio de pago: de contado solo pagada del todo; el anticipo va en prepayment_details', () => {
  // anticipo de Wompi: a crédito por el saldo y el anticipo con su fecha en Colombia (el servidor corre en UTC)
  const dep = bill({ status: 'anticipo', amountPaid: 362663, balance: 362662, method: 'wompi', methodType: 'CARD', txId: 'tx-1', paidAt: new Date('2026-03-01T03:00:00Z') });
  assert.equal(dep.payment_details.length, 1);
  assert.deepEqual([dep.payment_details[0].payment_form, dep.payment_details[0].payment_method_code, dep.payment_details[0].amount], ['2', 'ZZZ', '362662.00']);
  assert.match(dep.payment_details[0].due_date, /^\d{4}-\d{2}-\d{2}$/);
  assert.deepEqual(dep.prepayment_details, [{ reference_code: 'wompi-tx-1', received_date: '2026-02-28', amount: '362663.00', note: 'Anticipo de la cotización #7 pagado con Wompi' }]);
  // un anticipo de prueba no es plata real: a crédito por todo, sin anticipo
  const fake = bill({ status: 'anticipo', amountPaid: 362663, method: 'wompi', methodType: 'CARD', test: true });
  assert.deepEqual([fake.payment_details[0].payment_form, fake.payment_details[0].amount, fake.prepayment_details], ['2', '725325.00', undefined]);
  // pagada: un renglón por medio (Wompi con su medio y el saldo que registró la oficina, en efectivo)
  const codes = (payment) => bill(payment).payment_details.map((p) => [p.payment_form, p.payment_method_code, p.amount]);
  assert.deepEqual(codes({ status: 'pagado', amountPaid: TOTAL, officeAmount: 362662, method: 'wompi', methodType: 'NEQUI' }), [['1', '47', '362663.00'], ['1', '10', '362662.00']]);
  assert.deepEqual(codes({ status: 'pagado', amountPaid: TOTAL, method: 'wompi', methodType: 'CARD' }), [['1', '48', '725325.00']]);
  assert.deepEqual(codes({ status: 'pagado', amountPaid: TOTAL, method: 'wompi', methodType: 'BANCOLOMBIA_TRANSFER' }), [['1', '47', '725325.00']]);
  assert.deepEqual(codes({ status: 'pagado', amountPaid: TOTAL, method: 'wompi', methodType: 'BANCOLOMBIA_COLLECT' }), [['1', 'ZZZ', '725325.00']]);
  assert.deepEqual(codes({ status: 'pagado', amountPaid: TOTAL, officeAmount: TOTAL, method: 'oficina' }), [['1', '10', '725325.00']]);
  // una diferencia de redondeo de más de $ 500 no se envía
  const off = { ...asQuote({ status: 'pendiente' }), total: TOTAL + 501 };
  assert.throws(() => factus.buildBill({ factus: { numberingRangeId: 8 } }, off, {}), (e) => e instanceof factus.FactusError && /500/.test(e.message));
});

test('si Factus rechaza queda el error para reintentar; un IVA que la DIAN no acepta no se envía', async () => {
  const { a, q, token } = await setup();
  await approve(token);
  reject = true;
  const r = await invoice(a, q);
  assert.equal(r.status, 502);
  assert.match(r.data.message, /FAK24/);
  assert.match((await call('GET', `/quotes/${q._id}`, { as: a.token })).data.invoice.error, /FAK24/);
  reject = false;
  pending = true;                                        // 409: pendiente de envío a la DIAN con esa referencia
  const p = await invoice(a, q);
  assert.equal(p.status, 502);
  assert.match(p.data.message, new RegExp(`pendiente de envío a la DIAN con la referencia NWO-COT-${q._id}`));
  pending = false;
  assert.equal((await invoice(a, q)).status, 200);

  const other = await setup('Otra Empresa', { items: [{ description: 'Servicio', qty: 1, unitPrice: 100000, taxRate: 8 }] });
  await approve(other.token);
  const bad = await invoice(other.a, other.q);
  assert.equal(bad.status, 502);
  assert.match(bad.data.message, /0 %, 5 % o 19 %/);
});

test('si Factus ya tenía la factura (la respuesta se perdió), se guarda su comprador y se avisa', async () => {
  const { a, q, token } = await setup();
  await approve(token);
  lose = true;                                           // la factura sale a consumidor final pero la respuesta no llega
  assert.equal((await invoice(a, q)).status, 502);
  lose = false;
  const r = await invoice(a, q, { buyer: { docType: 'NIT', identification: '900123456', name: 'Hoteles del Norte SAS' } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(bills.length, 1);
  assert.deepEqual([r.data.invoice.buyerName, r.data.invoice.buyerId], ['Consumidor Final', '222222222222']);
  assert.match(r.data.notice, /a nombre de Consumidor Final \(222222222222\).*nota crédito/);
});

test('sin Factus conectado no se factura; tampoco una cotización en dólares; el técnico no puede facturar', async () => {
  const { a, client, q, token } = await setup('Sin Factus', { connect: false });
  await approve(token);
  assert.equal((await invoice(a, q)).status, 409);
  const made = await call('POST', '/users', { as: a.token, body: { name: 'Ana', email: 'ana@sinfactus.com', role: 'tecnico' } });
  const tech = await login('ana@sinfactus.com', made.data.temporaryPassword);
  assert.equal((await call('POST', `/quotes/${q._id}/invoice`, { as: tech, body: {} })).status, 403);
  // una cotización hecha en dólares (la empresa estuvo en inglés) no va a la DIAN como si fueran pesos
  const companies = mongoose.connection.collection('companies');
  const id = new mongoose.Types.ObjectId(a.id);
  assert.equal((await call('PUT', '/company/factus', { as: a.token, body: CREDS })).status, 200);
  await companies.updateOne({ _id: id }, { $set: { lang: 'en' } });
  const usd = await quoteFor(a, client, { items: [{ description: 'Service', qty: 1, unitPrice: 1200, taxRate: 0 }] });
  await companies.updateOne({ _id: id }, { $set: { lang: 'es' } });
  await approve(usd.token);
  assert.equal(usd.q.currency, 'USD');
  const r = await invoice(a, usd.q);
  assert.equal(r.status, 409);
  assert.match(r.data.message, /en pesos/);
  assert.equal(bills.length, 0);
});

test('conectar Factus tiene su propio cupo de intentos: no gasta el de Wompi', async () => {
  const a = await company('Cupos SAS');
  for (let n = 0; n < 10; n += 1) await call('PUT', '/company/wompi', { as: a.token, body: { publicKey: 'mala' } });
  assert.equal((await call('PUT', '/company/wompi', { as: a.token, body: { publicKey: 'mala' } })).status, 429);
  assert.equal((await call('PUT', '/company/factus', { as: a.token, body: CREDS })).status, 200);
});
