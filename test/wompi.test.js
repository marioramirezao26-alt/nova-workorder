// Cobro con Wompi de cotizaciones aprobadas: cada empresa conecta SU cuenta (los secretos van cifrados y nunca salen);
// el pago cambia solo con el evento firmado de Wompi, si la referencia, el valor y la moneda cuadran (la consulta al
// volver del checkout solo muestra cómo va). Wompi es falso: un servidor local en WOMPI_API_URL.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { start, stop, reset, call, company } = require('./helpers');
const factus = require('../src/services/factus');

const KEYS = {
  publicKey: 'pub_test_AbCdEf123456',
  integritySecret: 'test_integrity_Integ123456',
  eventsSecret: 'test_events_Event123456',
};
const PROD = { publicKey: 'pub_prod_AbCdEf123456', integritySecret: 'prod_integrity_Integ123456', eventsSecret: 'prod_events_Event123456' };
let fake;
const txs = {};

before(async () => {
  await start();
  fake = http.createServer((req, res) => {
    const send = (code, body) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
    if ([KEYS.publicKey, PROD.publicKey].some((k) => req.url === `/merchants/${k}`)) return send(200, { data: { name: 'Frío Ruta SAS' } });
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

// Una empresa con Wompi (llaves de pruebas, o de producción con `keys: PROD`) y una cotización de 725.325 enviada.
const setup = async (name = 'Frío Ruta', { deposit, keys = KEYS } = {}) => {
  const a = await company(name);
  const slug = (await mongoose.connection.collection('companies').findOne({ _id: new mongoose.Types.ObjectId(a.id) })).slug;
  const conn = await call('PUT', '/company/wompi', { as: a.token, body: { ...keys, ...(deposit ? { depositPercent: deposit } : {}) } });
  assert.equal(conn.status, 200, JSON.stringify(conn.data));
  const client = (await call('POST', '/clients', { as: a.token, body: { name: 'Hotel Norte', email: `h@${slug}.com` } })).data;
  const q = (await call('POST', '/quotes', { as: a.token, body: { client: client._id, title: 'Mantenimiento', items: [
    { description: 'Mantenimiento', qty: 4, unitPrice: 120000, taxRate: 19 }, { description: 'Gas', qty: 2.5, unitPrice: 35000 }, { description: 'Visita', qty: 1, unitPrice: 50000, taxRate: 0 },
  ] } })).data;
  const token = (await call('POST', `/quotes/${q._id}/send`, { as: a.token })).data.path.split('/').pop();
  return { a, slug, q, token, conn: conn.data };
};
const approve = (token) => call('POST', `/cotizaciones/${token}/aprobar`, { body: { name: 'Carlos Pérez', accept: true } });
const send = (slug, tx, secret) => call('POST', `/wompi/${slug}/eventos`, { body: event(tx, secret) });
const txFor = (params, id, status, more = {}) => ({ id, reference: params.reference, amount_in_cents: Number(params['amount-in-cents']), currency: 'COP', status, ...more });
const quoteOf = async (a, q) => (await call('GET', `/quotes/${q._id}`, { as: a.token })).data;
const actions = async (a) => (await call('GET', '/audit?limit=50', { as: a.token })).data.items.map((e) => e.action);
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
  const { a, q, token } = await setup();
  assert.equal((await checkout(token)).status, 409);                       // enviada, sin aprobar
  const pub = (await approve(token)).data;
  assert.equal(pub.quote.payment.online, true);
  assert.equal(pub.quote.payment.due, 725325);
  assert.equal((await call('GET', `/quotes/${q._id}`, { as: a.token })).data.payment.online, true);   // el portal del cliente ofrece pagar
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
  assert.deepEqual([paid.payment.amountPaid, paid.payment.balance], [725325, 0]);
  // un intento rechazado posterior no la devuelve a pendiente
  await call('POST', `/wompi/${slug}/eventos`, { body: event({ ...tx, id: '1234-1700000000-22222', status: 'DECLINED' }) });
  assert.equal((await call('GET', `/quotes/${q._id}`, { as: a.token })).data.payment.status, 'pagado');
  assert.equal((await checkout(token)).status, 409);                      // ya pagada
  const log = (await call('GET', '/audit?limit=50', { as: a.token })).data.items;
  assert.ok(log.some((e) => e.action === 'cotizacion.pagada'));
  assert.equal((await call('POST', `/wompi/no-existe/eventos`, { body: event(tx) })).status, 404);
});

test('al volver del checkout solo se muestra lo que dice Wompi: el pago lo marca el evento firmado', async () => {
  const { a, slug, q, token } = await setup();
  await approve(token);
  const first = (await checkout(token)).params;
  txs['tx-rechazada-1'] = txFor(first, 'tx-rechazada-1', 'DECLINED');
  const back = (await call('GET', `/cotizaciones/${token}/pago/estado?id=tx-rechazada-1`)).data;
  assert.equal(back.tx.status, 'DECLINED');
  assert.equal(back.quote.payment.status, 'pendiente');
  assert.equal(back.quote.payment.online, true);
  // una transacción aprobada que trae el navegador (Wompi la consulta sin llave: puede ser de otro comercio) no la paga
  const second = (await checkout(token)).params;
  txs['tx-ajena-2'] = txFor(second, 'tx-ajena-2', 'APPROVED', { merchant: { public_key: 'pub_test_ATACANTE000' } });
  const fake = (await call('GET', `/cotizaciones/${token}/pago/estado?id=tx-ajena-2`)).data;
  assert.equal(fake.tx.status, 'APPROVED');                               // la página dice «confirmando tu pago…»
  assert.equal(fake.quote.payment.status, 'pendiente');
  assert.equal((await quoteOf(a, q)).payment.status, 'pendiente');
  // la paga el evento firmado; la página, al volver a consultar, ya la ve pagada
  const third = (await checkout(token)).params;
  txs['tx-buena-3'] = txFor(third, 'tx-buena-3', 'APPROVED', { payment_method_type: 'PSE' });
  assert.equal((await send(slug, txs['tx-buena-3'])).status, 200);
  const ok = (await call('GET', `/cotizaciones/${token}/pago/estado?id=tx-buena-3`)).data;
  assert.equal(ok.quote.payment.status, 'pagado');
  assert.equal(ok.quote.payment.online, false);
  assert.equal((await quoteOf(a, q)).payment.methodType, 'PSE');
});

test('una cotización de antes de Wompi (sin el campo payment en la base) también queda pagada', async () => {
  const { a, slug, q, token } = await setup();
  await approve(token);
  await mongoose.connection.collection('quotes').updateOne({ _id: new mongoose.Types.ObjectId(q._id) }, { $unset: { payment: 1 } });
  const { params } = await checkout(token);
  assert.equal((await send(slug, txFor(params, 'tx-vieja-1', 'APPROVED'))).status, 200);
  const paid = await quoteOf(a, q);
  assert.equal(paid.payment.status, 'pagado');
  assert.equal(paid.payment.amountPaid, 725325);
  assert.ok((await actions(a)).includes('cotizacion.pagada'));
});

test('con un intento PENDING (PSE, Nequi) no se ofrece pagar otra vez durante 30 minutos', async () => {
  const { a, slug, q, token } = await setup();
  await approve(token);
  const first = (await checkout(token)).params;
  txs['tx-pse-1'] = txFor(first, 'tx-pse-1', 'PENDING', { created_at: new Date().toISOString() });
  const back = (await call('GET', `/cotizaciones/${token}/pago/estado?id=tx-pse-1`)).data;
  assert.equal(back.tx.status, 'PENDING');
  assert.equal(back.quote.payment.status, 'pendiente');
  assert.equal(back.quote.payment.pending, true);
  assert.equal(back.quote.payment.online, false);
  assert.equal((await call('GET', `/cotizaciones/${token}`)).data.quote.payment.online, false);   // ni por el enlace sin ?id
  assert.equal((await checkout(token)).status, 409);
  assert.equal((await quoteOf(a, q)).payment.online, false);
  // Wompi lo rechaza (evento firmado): ya se puede intentar de nuevo, y una consulta atrasada no vuelve a frenarlo
  await send(slug, { ...txs['tx-pse-1'], status: 'DECLINED' });
  assert.equal((await call('GET', `/cotizaciones/${token}`)).data.quote.payment.online, true);
  assert.equal((await call('GET', `/cotizaciones/${token}/pago/estado?id=tx-pse-1`)).data.quote.payment.online, true);
  // un PENDING que empezó hace más de 30 minutos ya no frena otro intento
  const second = (await checkout(token)).params;
  txs['tx-pse-2'] = txFor(second, 'tx-pse-2', 'PENDING', { created_at: new Date(Date.now() - 31 * 60000).toISOString() });
  assert.equal((await call('GET', `/cotizaciones/${token}/pago/estado?id=tx-pse-2`)).data.quote.payment.online, true);
  assert.equal((await checkout(token)).status, 200);
});

test('al volver con un APPROVED cuyo evento aún no llega no se ofrece pagar otra vez: se espera la confirmación', async () => {
  const { a, slug, q, token } = await setup();
  await approve(token);
  const c = (await checkout(token)).params;
  txs['tx-tarjeta-1'] = txFor(c, 'tx-tarjeta-1', 'APPROVED', { created_at: new Date().toISOString(), merchant: { public_key: KEYS.publicKey } });
  const back = (await call('GET', `/cotizaciones/${token}/pago/estado?id=tx-tarjeta-1`)).data;
  assert.deepEqual([back.tx.status, back.quote.payment.status, back.quote.payment.online, back.quote.payment.pending], ['APPROVED', 'pendiente', false, true]);
  assert.equal((await checkout(token)).status, 409);
  // el evento firmado la paga
  await send(slug, txs['tx-tarjeta-1']);
  assert.deepEqual([(await quoteOf(a, q)).payment.status, (await quoteOf(a, q)).payment.txId], ['pagado', 'tx-tarjeta-1']);
});

test('un DECLINED atrasado de un intento viejo no borra el PENDING del intento nuevo', async () => {
  const { slug, token } = await setup();
  await approve(token);
  const viejo = (await checkout(token)).params;
  const nuevo = (await checkout(token)).params;
  txs['tx-pse-nuevo'] = txFor(nuevo, 'tx-pse-nuevo', 'PENDING', { created_at: new Date().toISOString() });
  assert.equal((await call('GET', `/cotizaciones/${token}/pago/estado?id=tx-pse-nuevo`)).data.quote.payment.pending, true);
  await send(slug, txFor(viejo, 'tx-tarjeta-vieja', 'DECLINED', { created_at: new Date(Date.now() - 2 * 60000).toISOString() }));
  const pub = (await call('GET', `/cotizaciones/${token}`)).data.quote.payment;
  assert.deepEqual([pub.pending, pub.online, pub.txStatus], [true, false, 'PENDING']);
  assert.equal((await checkout(token)).status, 409);
  // el del intento nuevo sí lo resuelve
  await send(slug, { ...txs['tx-pse-nuevo'], status: 'DECLINED' });
  assert.equal((await call('GET', `/cotizaciones/${token}`)).data.quote.payment.online, true);
});

test('un APPROVED repetido o atrasado de la transacción anulada no la vuelve a dejar pagada', async () => {
  const { a, slug, q, token } = await setup();
  await approve(token);
  const tx = txFor((await checkout(token)).params, 'tx-anulada', 'APPROVED', { payment_method_type: 'CARD' });
  await send(slug, tx);
  await send(slug, { ...tx, status: 'VOIDED' });
  await send(slug, tx);                                                    // Wompi reenvía el APPROVED
  const back = await quoteOf(a, q);
  assert.deepEqual([back.payment.status, back.payment.amountPaid, back.payment.online], ['pendiente', 0, true]);
  assert.equal((await actions(a)).filter((x) => x === 'cotizacion.pagada').length, 1);
  // al revés: el VOIDED llega antes que el reintento del APPROVED
  const b = await setup('Reintentos SAS');
  await approve(b.token);
  const late = txFor((await checkout(b.token)).params, 'tx-invertida', 'APPROVED');
  await send(b.slug, { ...late, status: 'VOIDED' });
  await send(b.slug, late);
  const inv = await quoteOf(b.a, b.q);
  assert.deepEqual([inv.payment.status, inv.payment.amountPaid], ['pendiente', 0]);
  assert.ok(!(await actions(b.a)).includes('cotizacion.pagada'));
});

test('si la oficina quita su marca y Wompi sí cobró aparte, ese pago queda como el de la cotización', async () => {
  const { a, slug, q, token } = await setup('Devolucion SAS', { keys: PROD });
  await approve(token);
  txs['tx-pse-of'] = txFor((await checkout(token)).params, 'tx-pse-of', 'PENDING', { payment_method_type: 'PSE' });
  await call('GET', `/cotizaciones/${token}/pago/estado?id=tx-pse-of`);
  assert.equal((await call('POST', `/quotes/${q._id}/payment`, { as: a.token, body: { status: 'pagado' } })).status, 200);
  await send(slug, { ...txs['tx-pse-of'], status: 'APPROVED' }, PROD.eventsSecret);
  assert.deepEqual((await quoteOf(a, q)).payment.extra.map((e) => e.txId), ['tx-pse-of']);
  // el efectivo nunca llegó: la oficina quita su marca y queda el pago de Wompi (no se ofrece pagar otra vez)
  const undo = await call('POST', `/quotes/${q._id}/payment`, { as: a.token, body: { status: 'pendiente' } });
  assert.equal(undo.status, 200);
  const p = undo.data.payment;
  assert.deepEqual([p.status, p.amountPaid, p.officeAmount, p.method, p.methodType, p.txId, p.extra.length, p.online], ['pagado', 725325, 0, 'wompi', 'PSE', 'tx-pse-of', 0, false]);
  assert.equal((await checkout(token)).status, 409);
  assert.equal((await call('POST', `/quotes/${q._id}/payment`, { as: a.token, body: { status: 'pendiente' } })).status, 409);   // ya es de Wompi
  const bill = factus.buildBill({ factus: { numberingRangeId: 8 } }, await quoteOf(a, q), {}).payment_details;
  assert.deepEqual(bill.map((x) => [x.payment_form, x.payment_method_code, x.amount]), [['1', '47', '725325.00']]);
});

test('un anticipo de prueba no se completa con «Registrar el saldo»: primero se quita', async () => {
  const { a, slug, q, token } = await setup('Sandbox SAS', { deposit: 50 });
  await approve(token);
  await send(slug, txFor((await checkout(token)).params, 'tx-sandbox-anticipo', 'APPROVED'));
  const dep = (await quoteOf(a, q)).payment;
  assert.deepEqual([dep.status, dep.test, dep.amountPaid], ['anticipo', true, 362663]);
  const pay = (status) => call('POST', `/quotes/${q._id}/payment`, { as: a.token, body: { status } });
  const saldo = await pay('pagado');
  assert.equal(saldo.status, 409);
  assert.match(saldo.data.message, /prueba/);
  assert.equal((await quoteOf(a, q)).payment.officeAmount, 0);
  assert.equal((await pay('pendiente')).data.payment.status, 'pendiente');
  const full = (await pay('pagado')).data.payment;                         // la oficina cobró el total
  assert.deepEqual([full.status, full.officeAmount, full.method, full.test], ['pagado', 725325, 'oficina', false]);
});

test('un segundo pago aprobado no se pierde: queda en la cotización y en la bitácora como posible doble cobro', async () => {
  const { a, slug, q, token } = await setup();
  await approve(token);
  const c1 = (await checkout(token)).params;
  const c2 = (await checkout(token)).params;                              // dos pestañas
  await send(slug, txFor(c1, 'tx-uno', 'APPROVED'));
  await send(slug, txFor(c2, 'tx-dos', 'APPROVED'));
  await send(slug, txFor(c2, 'tx-dos', 'APPROVED'));                       // el mismo evento otra vez
  await send(slug, txFor(c1, 'tx-uno', 'APPROVED'));
  const paid = await quoteOf(a, q);
  assert.equal(paid.payment.status, 'pagado');
  assert.equal(paid.payment.txId, 'tx-uno');
  assert.deepEqual(paid.payment.extra.map((e) => [e.txId, e.amount, e.status]), [['tx-dos', 725325, 'APPROVED']]);
  assert.equal((await actions(a)).filter((x) => x === 'cotizacion.pago_duplicado').length, 1);
  // la empresa lo devuelve (Wompi lo anula): queda anotado y el pago bueno sigue
  await send(slug, txFor(c2, 'tx-dos', 'VOIDED'));
  const refunded = await quoteOf(a, q);
  assert.equal(refunded.payment.extra[0].status, 'VOIDED');
  assert.equal(refunded.payment.status, 'pagado');

  // la oficina la marcó pagada (efectivo) con un PSE en curso, y después Wompi lo aprueba
  const b = await setup('Efectivo SAS');
  await approve(b.token);
  const p = (await checkout(b.token)).params;
  txs['tx-pse-ef'] = txFor(p, 'tx-pse-ef', 'PENDING');
  await call('GET', `/cotizaciones/${b.token}/pago/estado?id=tx-pse-ef`);
  assert.equal((await call('POST', `/quotes/${b.q._id}/payment`, { as: b.a.token, body: { status: 'pagado' } })).status, 200);
  await send(b.slug, { ...txs['tx-pse-ef'], status: 'APPROVED' });
  const both = await quoteOf(b.a, b.q);
  assert.equal(both.payment.method, 'oficina');
  assert.deepEqual(both.payment.extra.map((e) => e.txId), ['tx-pse-ef']);
});

test('si Wompi anula (VOIDED) la transacción que pagó, la cotización vuelve a por cobrar y queda en la bitácora', async () => {
  const { a, slug, q, token } = await setup();
  await approve(token);
  const c = (await checkout(token)).params;
  await send(slug, txFor(c, 'tx-tarjeta', 'APPROVED', { payment_method_type: 'CARD' }));
  await send(slug, txFor(c, 'tx-otra', 'VOIDED'));                         // la anulación de otro intento no la toca
  assert.equal((await quoteOf(a, q)).payment.status, 'pagado');
  await send(slug, txFor(c, 'tx-tarjeta', 'VOIDED'));
  const back = await quoteOf(a, q);
  assert.deepEqual([back.payment.status, back.payment.amountPaid, back.payment.txStatus, back.payment.online], ['pendiente', 0, 'VOIDED', true]);
  assert.ok((await actions(a)).includes('cotizacion.pago_anulado'));
});

test('anticipo: con 50 % se cobra la mitad (fijada al primer intento), queda «anticipo» con su saldo y la oficina registra el saldo', async () => {
  const { a, slug, q, token } = await setup('Anticipo SAS', { deposit: 50, keys: PROD });
  await approve(token);
  const c = await checkout(token);
  assert.equal(c.data.due, 362663);                                       // 725.325 / 2 redondeado
  assert.equal(c.params['amount-in-cents'], '36266300');
  await call('PUT', '/company/wompi/deposit', { as: a.token, body: { depositPercent: 100 } });
  assert.equal((await checkout(token)).data.due, 362663);
  await send(slug, txFor(c.params, 'tx-anticipo', 'APPROVED'), PROD.eventsSecret);
  const dep = await quoteOf(a, q);
  assert.deepEqual([dep.payment.status, dep.payment.amountPaid, dep.payment.balance], ['anticipo', 362663, 362662]);
  const pub = (await call('GET', `/cotizaciones/${token}`)).data.quote.payment;
  assert.deepEqual([pub.status, pub.online, pub.balance], ['anticipo', false, 362662]);
  assert.equal((await checkout(token)).status, 409);
  const pay = (status) => call('POST', `/quotes/${q._id}/payment`, { as: a.token, body: { status } });
  assert.equal((await pay('pendiente')).status, 409);                    // lo que confirmó Wompi no se quita a mano
  const full = (await pay('pagado')).data.payment;                       // la oficina registra el saldo
  assert.deepEqual([full.status, full.amountPaid, full.balance, full.officeAmount, full.method], ['pagado', 725325, 0, 362662, 'wompi']);
  const undo = (await pay('pendiente')).data.payment;                    // y lo quita si fue por error
  assert.deepEqual([undo.status, undo.amountPaid, undo.balance], ['anticipo', 362663, 362662]);
});

test('la oficina marca el pago a mano y lo puede devolver a pendiente, sin cambiar lo que se cobra en línea', async () => {
  const { a, q, token } = await setup('Oficina SAS', { deposit: 50 });
  const pay = (status) => call('POST', `/quotes/${q._id}/payment`, { as: a.token, body: { status } });
  assert.equal((await pay('pagado')).status, 409);                       // sin aprobar
  await approve(token);
  const paid = (await pay('pagado')).data.payment;
  assert.deepEqual([paid.status, paid.method, paid.amountPaid, paid.balance], ['pagado', 'oficina', 725325, 0]);
  assert.equal((await checkout(token)).status, 409);
  assert.equal((await pay('pagado')).status, 409);                       // ya pagada
  const back = (await pay('pendiente')).data.payment;
  assert.deepEqual([back.status, back.amountPaid], ['pendiente', 0]);
  const c = await checkout(token);
  assert.equal(c.status, 200);
  assert.equal(c.data.due, 362663);                                       // sigue el anticipo del 50 %, no el total
});

test('un pago con las llaves de pruebas queda marcado como prueba, se puede quitar y no se factura de contado', async () => {
  const { a, slug, q, token } = await setup();
  await approve(token);
  await send(slug, txFor((await checkout(token)).params, 'tx-sandbox', 'APPROVED'));
  const paid = await quoteOf(a, q);
  assert.deepEqual([paid.payment.status, paid.payment.test], ['pagado', true]);
  assert.equal((await call('GET', `/cotizaciones/${token}`)).data.quote.payment.test, true);
  assert.equal(factus.buildBill({ factus: { numberingRangeId: 8 } }, paid, {}).payment_details[0].payment_form, '2');   // a crédito
  const undo = await call('POST', `/quotes/${q._id}/payment`, { as: a.token, body: { status: 'pendiente' } });
  assert.equal(undo.status, 200);
  assert.deepEqual([undo.data.payment.status, undo.data.payment.test, undo.data.payment.online], ['pendiente', false, true]);
  // con llaves de producción es plata real: no se quita a mano, y se factura de contado con el medio de Wompi
  const b = await setup('Produccion SAS', { keys: PROD });
  await approve(b.token);
  const p = (await checkout(b.token)).params;
  assert.equal(p['public-key'], PROD.publicKey);
  await send(b.slug, txFor(p, 'tx-real', 'APPROVED', { payment_method_type: 'PSE' }), PROD.eventsSecret);
  const real = await quoteOf(b.a, b.q);
  assert.deepEqual([real.payment.status, real.payment.test, real.payment.methodType], ['pagado', false, 'PSE']);
  assert.equal((await call('POST', `/quotes/${b.q._id}/payment`, { as: b.a.token, body: { status: 'pendiente' } })).status, 409);
  const bill = factus.buildBill({ factus: { numberingRangeId: 8 } }, real, {}).payment_details[0];
  assert.deepEqual([bill.payment_form, bill.payment_method_code], ['1', '47']);   // de contado, por transferencia (PSE)
});

test('solo se cobra en línea una cotización en pesos y con valor (no por el idioma que tenga hoy la empresa)', async () => {
  const { a } = await setup('Dolares SAS');
  const companies = mongoose.connection.collection('companies');
  const id = new mongoose.Types.ObjectId(a.id);
  const client = (await call('POST', '/clients', { as: a.token, body: { name: 'Hotel Sur', email: 'sur@dolares.com' } })).data;
  const make = async (items) => {
    const q = (await call('POST', '/quotes', { as: a.token, body: { client: client._id, title: 'X', items } })).data;
    return { q, token: (await call('POST', `/quotes/${q._id}/send`, { as: a.token })).data.path.split('/').pop() };
  };
  await companies.updateOne({ _id: id }, { $set: { lang: 'en' } });
  const usd = await make([{ description: 'Service', qty: 1, unitPrice: 1500.5, taxRate: 0 }]);
  await companies.updateOne({ _id: id }, { $set: { lang: 'es' } });
  assert.equal(usd.q.currency, 'USD');
  assert.equal((await approve(usd.token)).data.quote.payment.online, false);
  assert.equal((await checkout(usd.token)).status, 409);
  const zero = await make([{ description: 'Visita de garantía', qty: 1, unitPrice: 0 }]);
  assert.equal((await approve(zero.token)).data.quote.payment.online, false);
  assert.equal((await checkout(zero.token)).status, 409);
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
