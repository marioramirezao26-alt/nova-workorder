// Cobro con Wompi de cotizaciones aprobadas: cada empresa conecta SU cuenta (los secretos van cifrados y nunca salen);
// la cotización queda pagada solo con el evento firmado de Wompi o consultando la transacción, si la referencia, el
// valor y la moneda cuadran. Wompi es falso: un servidor local en WOMPI_API_URL.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { start, stop, reset, call, company } = require('./helpers');

const KEYS = {
  publicKey: 'pub_test_AbCdEf123456',
  integritySecret: 'test_integrity_Integ123456',
  eventsSecret: 'test_events_Event123456',
};
let fake;
const txs = {};

before(async () => {
  await start();
  fake = http.createServer((req, res) => {
    const send = (code, body) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
    if (req.url === `/merchants/${KEYS.publicKey}`) return send(200, { data: { name: 'Frío Ruta SAS' } });
    if (req.url.startsWith('/merchants/')) return send(404, { error: 'not found' });
    const m = /^\/transactions\/(.+)$/.exec(req.url);
    if (m && txs[m[1]]) return send(200, { data: txs[m[1]] });
    return send(404, {});
  }).listen(0);
  process.env.WOMPI_API_URL = `http://127.0.0.1:${fake.address().port}`;
});
after(async () => { fake.close(); delete process.env.WOMPI_API_URL; await stop(); });
beforeEach(reset);

const sign = (data, timestamp, secret = KEYS.eventsSecret) => {
  const properties = ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'];
  const vals = properties.map((p) => p.split('.').reduce((o, k) => o[k], data)).join('');
  return { properties, checksum: crypto.createHash('sha256').update(`${vals}${timestamp}${secret}`).digest('hex') };
};
const event = (tx, secret) => {
  const data = { transaction: tx };
  const timestamp = 1760000000;
  return { event: 'transaction.updated', data, timestamp, signature: sign(data, timestamp, secret) };
};

// Una empresa con Wompi y una cotización de 725.325 aprobada por el cliente desde el enlace.
const setup = async (name = 'Frío Ruta', { deposit } = {}) => {
  const a = await company(name);
  const slug = (await mongoose.connection.collection('companies').findOne({ _id: new mongoose.Types.ObjectId(a.id) })).slug;
  const conn = await call('PUT', '/company/wompi', { as: a.token, body: { ...KEYS, ...(deposit ? { depositPercent: deposit } : {}) } });
  assert.equal(conn.status, 200, JSON.stringify(conn.data));
  const client = (await call('POST', '/clients', { as: a.token, body: { name: 'Hotel Norte', email: `h@${slug}.com` } })).data;
  const q = (await call('POST', '/quotes', { as: a.token, body: { client: client._id, title: 'Mantenimiento', items: [
    { description: 'Mantenimiento', qty: 4, unitPrice: 120000, taxRate: 19 }, { description: 'Gas', qty: 2.5, unitPrice: 35000 }, { description: 'Visita', qty: 1, unitPrice: 50000, taxRate: 0 },
  ] } })).data;
  const token = (await call('POST', `/quotes/${q._id}/send`, { as: a.token })).data.path.split('/').pop();
  return { a, slug, q, token, conn: conn.data };
};
const approve = (token) => call('POST', `/cotizaciones/${token}/aprobar`, { body: { name: 'Carlos Pérez', accept: true } });
const checkout = async (token) => {
  const r = await call('GET', `/cotizaciones/${token}/pago`);
  const url = r.data && r.data.checkoutUrl ? new URL(r.data.checkoutUrl) : null;
  return { ...r, params: url ? Object.fromEntries(url.searchParams) : null };
};

test('conectar: la llave se comprueba con Wompi, los secretos no salen y el técnico no lo maneja', async () => {
  const a = await company('Wompi Uno');
  assert.equal((await call('PUT', '/company/wompi', { as: a.token, body: { ...KEYS, publicKey: 'pub_test_Desconocida99' } })).status, 400);
  assert.equal((await call('PUT', '/company/wompi', { as: a.token, body: { ...KEYS, integritySecret: 'prod_integrity_Mezclado123' } })).status, 400);
  assert.equal((await call('PUT', '/company/wompi', { as: a.token, body: { ...KEYS, depositPercent: 5 } })).status, 400);
  const ok = await call('PUT', '/company/wompi', { as: a.token, body: KEYS });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.connected, true);
  assert.equal(ok.data.test, true);
  assert.equal(ok.data.merchantName, 'Frío Ruta SAS');
  assert.match(ok.data.eventsPath, /^\/api\/wompi\/[a-z0-9-]+\/eventos$/);
  const text = JSON.stringify(ok.data) + JSON.stringify((await call('GET', '/company/wompi', { as: a.token })).data);
  assert.ok(!text.includes('Integ123456') && !text.includes('Event123456'));
  const raw = await mongoose.connection.collection('companies').findOne({ _id: new mongoose.Types.ObjectId(a.id) });
  assert.ok(raw.wompi.integritySealed.startsWith('v1.') && !raw.wompi.integritySealed.includes('Integ123456'));
  const made = await call('POST', '/users', { as: a.token, body: { name: 'Ana', email: 'ana@wompiuno.com', role: 'tecnico' } });
  const { login } = require('./helpers');
  const tech = await login('ana@wompiuno.com', made.data.temporaryPassword);
  assert.equal((await call('GET', '/company/wompi', { as: tech })).status, 403);
  assert.equal((await call('PUT', '/company/wompi', { as: tech, body: KEYS })).status, 403);
  const off = await call('DELETE', '/company/wompi', { as: a.token });
  assert.equal(off.data.connected, false);
});

test('pagar: solo una cotización aprobada; el enlace va firmado por el valor exacto y la referencia cambia en cada intento', async () => {
  const { token } = await setup();
  assert.equal((await checkout(token)).status, 409);                       // enviada, sin aprobar
  const pub = (await approve(token)).data;
  assert.equal(pub.quote.payment.online, true);
  assert.equal(pub.quote.payment.due, 725325);
  const c1 = await checkout(token);
  assert.equal(c1.status, 200);
  assert.equal(c1.params['amount-in-cents'], '72532500');
  assert.equal(c1.params.currency, 'COP');
  assert.equal(c1.params['public-key'], KEYS.publicKey);
  const expected = crypto.createHash('sha256').update(`${c1.params.reference}72532500COP${KEYS.integritySecret}`).digest('hex');
  assert.equal(c1.params['signature:integrity'], expected);
  assert.match(c1.params['redirect-url'], new RegExp(`/cotizacion/${token}$`));
  const c2 = await checkout(token);
  assert.notEqual(c2.params.reference, c1.params.reference);
});

test('el evento firmado de Wompi marca la cotización pagada; firma falsa, otro valor u otra empresa no', async () => {
  const { a, slug, q, token } = await setup();
  await approve(token);
  const { params } = await checkout(token);
  const tx = { id: '1234-1700000000-11111', reference: params.reference, amount_in_cents: 72532500, currency: 'COP', status: 'APPROVED' };
  assert.equal((await call('POST', `/wompi/${slug}/eventos`, { body: event(tx, 'test_events_Otro999999') })).status, 401);
  assert.equal((await call('POST', `/wompi/${slug}/eventos`, { body: event({ ...tx, amount_in_cents: 100 }) })).status, 200);
  assert.equal((await call('GET', `/quotes/${q._id}`, { as: a.token })).data.payment.status, 'pendiente');   // valor distinto: no se toca
  // otra empresa con Wompi no puede usar una referencia de esta
  const b = await setup('Otra Empresa');
  assert.equal((await call('POST', `/wompi/${b.slug}/eventos`, { body: event(tx) })).status, 200);
  assert.equal((await call('GET', `/quotes/${q._id}`, { as: a.token })).data.payment.status, 'pendiente');
  // el bueno
  assert.equal((await call('POST', `/wompi/${slug}/eventos`, { body: event(tx) })).status, 200);
  const paid = (await call('GET', `/quotes/${q._id}`, { as: a.token })).data;
  assert.equal(paid.payment.status, 'pagado');
  assert.equal(paid.payment.method, 'wompi');
  assert.equal(paid.payment.txId, tx.id);
  // un intento rechazado posterior no la devuelve a pendiente
  await call('POST', `/wompi/${slug}/eventos`, { body: event({ ...tx, id: '1234-1700000000-22222', status: 'DECLINED' }) });
  assert.equal((await call('GET', `/quotes/${q._id}`, { as: a.token })).data.payment.status, 'pagado');
  assert.equal((await checkout(token)).status, 409);                      // ya pagada
  const log = (await call('GET', '/audit?limit=50', { as: a.token })).data.items;
  assert.ok(log.some((e) => e.action === 'cotizacion.pagada'));
  assert.equal((await call('POST', `/wompi/no-existe/eventos`, { body: event(tx) })).status, 404);
});

test('al volver del checkout se consulta la transacción en Wompi; un rechazo deja pagar de nuevo', async () => {
  const { a, q, token } = await setup();
  await approve(token);
  const first = (await checkout(token)).params;
  txs['tx-rechazada-1'] = { id: 'tx-rechazada-1', reference: first.reference, amount_in_cents: 72532500, currency: 'COP', status: 'DECLINED' };
  const back = await call('GET', `/cotizaciones/${token}/pago/estado?id=tx-rechazada-1`);
  assert.equal(back.data.quote.payment.status, 'pendiente');
  assert.equal(back.data.quote.payment.txStatus, 'DECLINED');
  assert.equal(back.data.quote.payment.online, true);
  const second = (await checkout(token)).params;
  txs['tx-aprobada-2'] = { id: 'tx-aprobada-2', reference: second.reference, amount_in_cents: 72532500, currency: 'COP', status: 'APPROVED' };
  const ok = await call('GET', `/cotizaciones/${token}/pago/estado?id=tx-aprobada-2`);
  assert.equal(ok.data.quote.payment.status, 'pagado');
  assert.equal(ok.data.quote.payment.online, false);
  // una transacción de otra cotización no se aplica a esta
  const other = await call('POST', '/quotes', { as: a.token, body: { client: q.client._id, title: 'Otra', items: [{ description: 'x', qty: 1, unitPrice: 1000 }] } });
  assert.equal(other.status, 201);
});

test('anticipo: con 50 % se cobra la mitad, fijada al primer intento aunque el porcentaje cambie después', async () => {
  const { a, token } = await setup('Anticipo SAS', { deposit: 50 });
  await approve(token);
  const c = await checkout(token);
  assert.equal(c.data.due, 362663);                                       // 725.325 / 2 redondeado
  assert.equal(c.params['amount-in-cents'], '36266300');
  await call('PUT', '/company/wompi/deposit', { as: a.token, body: { depositPercent: 100 } });
  assert.equal((await checkout(token)).data.due, 362663);
});

test('la oficina marca el pago a mano (efectivo, transferencia) y lo puede devolver a pendiente', async () => {
  const { a, q, token } = await setup();
  assert.equal((await call('POST', `/quotes/${q._id}/payment`, { as: a.token, body: { status: 'pagado' } })).status, 409);   // sin aprobar
  await approve(token);
  const paid = await call('POST', `/quotes/${q._id}/payment`, { as: a.token, body: { status: 'pagado' } });
  assert.equal(paid.data.payment.status, 'pagado');
  assert.equal(paid.data.payment.method, 'oficina');
  assert.equal((await checkout(token)).status, 409);
  const back = await call('POST', `/quotes/${q._id}/payment`, { as: a.token, body: { status: 'pendiente' } });
  assert.equal(back.data.payment.status, 'pendiente');
  assert.equal((await checkout(token)).status, 200);
});

test('sin Wompi conectado la cotización aprobada no ofrece pago en línea', async () => {
  const a = await company('Sin Wompi');
  const client = (await call('POST', '/clients', { as: a.token, body: { name: 'C', email: 'c@sinwompi.com' } })).data;
  const q = (await call('POST', '/quotes', { as: a.token, body: { client: client._id, title: 'X', items: [{ description: 'x', qty: 1, unitPrice: 1000 }] } })).data;
  const token = (await call('POST', `/quotes/${q._id}/send`, { as: a.token })).data.path.split('/').pop();
  const pub = (await approve(token)).data;
  assert.equal(pub.quote.payment.online, false);
  assert.equal((await checkout(token)).status, 409);
});
