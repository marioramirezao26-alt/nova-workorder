// Cobro en línea con Mercado Pago (Orden 41): cada empresa conecta SU cuenta (Checkout Pro). Lo que se prueba:
// - apagado por defecto: sin MERCADOPAGO_ENABLED=1 todo responde «no disponible» y nada llama a Mercado Pago;
// - aun encendido, solo credenciales TEST- (APP_USR- solo con MERCADOPAGO_PRODUCCION=1);
// - aislamiento entre empresas: el aviso de A nunca toca una cotización de B;
// - la firma del aviso (buena, mala, vieja, malformada) y que el cuerpo del aviso no se cree: se consulta la API;
// - idempotencia, doble pago a payment.extra, monto o moneda distintos, devoluciones sin mover dinero, anticipo y saldo.
// Mercado Pago es falso: un `fetch` simulado (mercadopago.setFetch) que responde como su API. Ninguna prueba usa la red.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { start, stop, reset, call, company, login, origin, KEY } = require('./helpers');
const mp = require('../src/services/mercadopago');
const { open } = require('../src/utils/secretBox');

const TOKEN_A = 'TEST-1111111111111111-111111-aaaaaaaaaaaaaaaa-1001';
const TOKEN_B = 'TEST-2222222222222222-222222-bbbbbbbbbbbbbbbb-2002';
const TOKEN_MX = 'TEST-3333333333333333-333333-cccccccccccccccc-3003';
const TOKEN_PROD = 'APP_USR-4444444444444444-444444-dddddddddddddddd-4004';
const SECRET_A = 'secretoWebhookEmpresaA0123456789abcdef';
const SECRET_B = 'secretoWebhookEmpresaB0123456789abcdef';
const ACCOUNTS = {
  [TOKEN_A]: { id: 1001, nickname: 'FRIORUTA', site_id: 'MCO' },
  [TOKEN_B]: { id: 2002, nickname: 'OTRAEMPRESA', site_id: 'MCO' },
  [TOKEN_MX]: { id: 3003, nickname: 'CLIMAREGIO', site_id: 'MLM' },
  [TOKEN_PROD]: { id: 4004, nickname: 'FRIOPROD', site_id: 'MCO' },
};

// ---- Mercado Pago simulado -------------------------------------------------------------------------------------------
const calls = [];
let payments = {};                       // id → { token: cuenta dueña, body: lo que responde GET /v1/payments/{id} }
const reply = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const fake = async (url, opts = {}) => {
  const u = new URL(String(url));
  const token = String((opts.headers || {}).Authorization || '').replace(/^Bearer /, '');
  calls.push({ path: u.pathname, method: opts.method || 'GET', token, body: opts.body ? JSON.parse(opts.body) : null });
  if (u.origin !== 'https://api.mercadopago.com') return reply(400, { message: 'otro servidor' });
  const account = ACCOUNTS[token];
  if (!account) return reply(401, { message: 'invalid_token' });
  if (u.pathname === '/users/me') return reply(200, account);
  if (u.pathname === '/checkout/preferences' && opts.method === 'POST') {
    const b = JSON.parse(opts.body);
    return reply(201, {
      id: `${account.id}-pref-${calls.length}`, external_reference: b.external_reference, items: b.items,
      init_point: 'https://www.mercadopago.com.co/checkout/v1/redirect?pref_id=x',
      sandbox_init_point: 'https://sandbox.mercadopago.com.co/checkout/v1/redirect?pref_id=x',
    });
  }
  const m = /^\/v1\/payments\/(\d+)$/.exec(u.pathname);
  if (m && opts.method === 'GET') {
    const found = payments[m[1]];
    return found && found.token === token ? reply(200, found.body) : reply(404, { message: 'Payment not found' });
  }
  return reply(404, {});
};
const paymentCalls = () => calls.filter((c) => c.path.startsWith('/v1/payments'));

before(async () => { await start(); mp.setFetch(fake); });
after(async () => { mp.setFetch(null); delete process.env.MERCADOPAGO_ENABLED; delete process.env.MERCADOPAGO_PRODUCCION; await stop(); });
beforeEach(async () => {
  await reset();
  calls.length = 0;
  payments = {};
  process.env.MERCADOPAGO_ENABLED = '1';
  delete process.env.MERCADOPAGO_PRODUCCION;
});

// ---- Ayudantes -----------------------------------------------------------------------------------------------------
const oid = (id) => new mongoose.Types.ObjectId(id);
const companies = () => mongoose.connection.collection('companies');
const ITEMS_CO = [
  { description: 'Mantenimiento', qty: 4, unitPrice: 120000, taxRate: 19 }, { description: 'Gas', qty: 2.5, unitPrice: 35000 }, { description: 'Visita', qty: 1, unitPrice: 50000, taxRate: 0 },
];
const ITEMS_MX = [{ description: 'Mantenimiento minisplit', qty: 4, unitPrice: 850, taxRate: 16 }, { description: 'Refacción', qty: 1, unitPrice: 99.99, taxRate: 8 }];

const connect = (a, body) => call('PUT', '/company/mercadopago', { as: a.token, body });
// Una empresa con su cuenta de Mercado Pago conectada y una cotización enviada (aprobada, salvo `approve: false`).
const setup = async (name = 'Frío Ruta', { token = TOKEN_A, secret = SECRET_A, deposit, market, approve = true, connectIt = true } = {}) => {
  const a = await company(name);
  if (market) assert.equal((await call('PATCH', `/platform/companies/${a.id}`, { platformKey: KEY, body: { market } })).status, 200);
  const slug = (await companies().findOne({ _id: oid(a.id) })).slug;
  if (connectIt) {
    const conn = await connect(a, { accessToken: token, webhookSecret: secret, ...(deposit ? { depositPercent: deposit } : {}) });
    assert.equal(conn.status, 200, JSON.stringify(conn.data));
  }
  const client = (await call('POST', '/clients', { as: a.token, body: { name: 'Hotel Norte', email: `h@${slug}.com` } })).data;
  const q = (await call('POST', '/quotes', { as: a.token, body: { client: client._id, title: 'Mantenimiento', items: market === 'mx' ? ITEMS_MX : ITEMS_CO } })).data;
  const publicToken = (await call('POST', `/quotes/${q._id}/send`, { as: a.token })).data.path.split('/').pop();
  if (approve) assert.equal((await call('POST', `/cotizaciones/${publicToken}/aprobar`, { body: { name: 'Carlos Pérez', accept: true } })).status, 200);
  return { a, slug, q, publicToken, ref: `NWO-${a.id}-${q._id}` };
};
const checkout = (publicToken) => call('POST', `/cotizaciones/${publicToken}/mercadopago`);
const publicOf = async (publicToken) => (await call('GET', `/cotizaciones/${publicToken}`)).data;
const quoteOf = async (a, q) => (await call('GET', `/quotes/${q._id}`, { as: a.token })).data;
const actions = async (a) => (await call('GET', '/audit?limit=100', { as: a.token })).data.items.map((e) => e.action);
const pay = (a, q, status) => call('POST', `/quotes/${q._id}/payment`, { as: a.token, body: { status } });

let seq = 9000000000;
// Un pago en la cuenta `token`, tal como lo devolvería GET /v1/payments/{id}.
const addPayment = (token, over = {}) => {
  seq += 1;
  const body = {
    id: seq, status: 'approved', status_detail: 'accredited', transaction_amount: 725325, currency_id: 'COP', live_mode: false,
    collector_id: ACCOUNTS[token].id, payment_type_id: 'credit_card', date_created: new Date().toISOString(), ...over,
  };
  payments[String(body.id)] = { token, body };
  return body;
};
const setPaymentStatus = (id, over) => { payments[String(id)].body = { ...payments[String(id)].body, ...over }; };

// La firma de Mercado Pago: HMAC-SHA256 (hex) del manifiesto id:…;request-id:…;ts:…; con la clave secreta del webhook.
const signature = ({ dataId, requestId, secret, ts = Math.floor(Date.now() / 1000) }) => {
  const manifest = `${dataId ? `id:${dataId};` : ''}${requestId ? `request-id:${requestId};` : ''}ts:${ts};`;
  return `ts=${ts},v1=${crypto.createHmac('sha256', secret).update(manifest).digest('hex')}`;
};
let req = 0;
// El aviso de Mercado Pago a la URL de la empresa. `header` reemplaza la firma (null: sin firma); `bodyId`, el id del cuerpo.
const notify = async (slug, dataId, { secret = SECRET_A, ts, header, bodyId, type = 'payment', requestId } = {}) => {
  req += 1;
  const rid = requestId || `req-${req}`;
  const headers = { 'Content-Type': 'application/json', 'x-request-id': rid };
  const sig = header === undefined ? signature({ dataId: String(dataId), requestId: rid, secret, ts }) : header;
  if (sig !== null) headers['x-signature'] = sig;
  const res = await fetch(`${origin()}/api/mercadopago/${slug}/avisos?data.id=${dataId}&type=${type}`, {
    method: 'POST', headers, body: JSON.stringify({ type, action: 'payment.updated', data: { id: String(bodyId ?? dataId) } }),
  });
  return { status: res.status, data: await res.json().catch(() => null) };
};

// ---- Apagado y candados ----------------------------------------------------------------------------------------------

test('apagado por defecto: sin MERCADOPAGO_ENABLED=1 todo responde no disponible y nada llama a Mercado Pago', async () => {
  const { a, slug, q, publicToken } = await setup();
  assert.equal((await checkout(publicToken)).status, 200);              // encendido sí (para tener la cuenta conectada)
  const p1 = addPayment(TOKEN_A, { external_reference: `NWO-${a.id}-${q._id}` });
  calls.length = 0;
  for (const off of [undefined, '0', 'true', 'si']) {
    if (off === undefined) delete process.env.MERCADOPAGO_ENABLED; else process.env.MERCADOPAGO_ENABLED = off;
    for (const [method, path, body] of [['GET', '/company/mercadopago'], ['PUT', '/company/mercadopago', { accessToken: TOKEN_A, webhookSecret: SECRET_A }],
      ['PUT', '/company/mercadopago/deposit', { depositPercent: 50 }], ['DELETE', '/company/mercadopago']]) {
      const r = await call(method, path, { as: a.token, body });
      assert.equal(r.status, 404, `${off} ${method} ${path}`);
      assert.match(r.data.message, /Mercado Pago no está disponible/);
    }
    const pub = await publicOf(publicToken);
    assert.equal(pub.quote.payment.online, false);
    assert.equal((await quoteOf(a, q)).payment.online, false);
    assert.equal((await checkout(publicToken)).status, 404);
    assert.equal((await notify(slug, p1.id)).status, 404);
  }
  assert.equal(calls.length, 0);                                           // ni una llamada a Mercado Pago
  assert.equal((await quoteOf(a, q)).payment.status, 'pendiente');
  assert.ok((await companies().findOne({ _id: oid(a.id) })).mercadopago.connectedAt);   // apagar no borra la cuenta
  // el módulo mismo se niega a llamar apagado
  delete process.env.MERCADOPAGO_ENABLED;
  await assert.rejects(() => mp.verifyAccount(TOKEN_A, { market: 'co' }), /no está disponible/);
  assert.equal(calls.length, 0);
});

test('aun encendido solo se aceptan credenciales TEST-: APP_USR- solo con MERCADOPAGO_PRODUCCION=1', async () => {
  const a = await company('Candado SAS');
  const r1 = await connect(a, { accessToken: TOKEN_PROD, webhookSecret: SECRET_A });
  assert.equal(r1.status, 400);
  assert.match(r1.data.message, /solo acepta credenciales de prueba/);
  assert.equal((await connect(a, { accessToken: 'abc', webhookSecret: SECRET_A })).status, 400);
  assert.equal((await connect(a, { accessToken: TOKEN_A, webhookSecret: 'corta' })).status, 400);
  assert.equal((await connect(a, { accessToken: TOKEN_A, webhookSecret: SECRET_A, publicKey: 'APP_USR-abcdef123456' })).status, 400);   // mezcladas
  assert.equal(calls.length, 0);                                           // nada de eso llegó a Mercado Pago
  const mx = await connect(a, { accessToken: TOKEN_MX, webhookSecret: SECRET_A });
  assert.equal(mx.status, 400);                                            // una cuenta de México para una empresa de Colombia
  assert.match(mx.data.message, /otro país/);

  // con el permiso de producción del servidor (simulado) entra; al quitarlo, la cuenta deja de usarse sin llamar a nadie
  process.env.MERCADOPAGO_PRODUCCION = '1';
  const prod = await setup('Frío Prod', { token: TOKEN_PROD });
  assert.equal((await call('GET', '/company/mercadopago', { as: prod.a.token })).data.test, false);
  delete process.env.MERCADOPAGO_PRODUCCION;
  const info = (await call('GET', '/company/mercadopago', { as: prod.a.token })).data;
  assert.deepEqual([info.connected, info.usable, info.production], [true, false, false]);
  assert.equal((await publicOf(prod.publicToken)).quote.payment.online, false);
  assert.equal((await checkout(prod.publicToken)).status, 409);
  const p = addPayment(TOKEN_PROD, { external_reference: prod.ref, live_mode: true });
  calls.length = 0;
  assert.equal((await notify(prod.slug, p.id)).status, 409);
  assert.equal(calls.length, 0);
  // reglas del módulo
  assert.equal(mp.tokenAllowed(TOKEN_A), true);
  assert.equal(mp.tokenAllowed(TOKEN_PROD), false);
  assert.equal(mp.tokenAllowed('TEST-'), false);
});

test('conectar: solo el administrador, la cuenta se comprueba, los secretos van cifrados y no salen; EE. UU. no opera', async () => {
  const a = await company('Conectar SAS');
  const made = await call('POST', '/users', { as: a.token, body: { name: 'Ana', email: 'ana@conectarsas.com', role: 'tecnico' } });
  const tech = await login('ana@conectarsas.com', made.data.temporaryPassword);
  assert.equal((await call('GET', '/company/mercadopago', { as: tech })).status, 403);
  assert.equal((await call('PUT', '/company/mercadopago', { as: tech, body: { accessToken: TOKEN_A, webhookSecret: SECRET_A } })).status, 403);
  assert.equal((await call('GET', '/company/mercadopago')).status, 401);
  assert.equal((await call('GET', '/company/mercadopago', { as: a.token })).data.connected, false);   // nada se conecta solo
  const ok = await connect(a, { accessToken: TOKEN_A, webhookSecret: SECRET_A, publicKey: 'TEST-pk-0123456789' });
  assert.equal(ok.status, 200);
  assert.deepEqual([ok.data.connected, ok.data.usable, ok.data.test, ok.data.nickname, ok.data.currency], [true, true, true, 'FRIORUTA', 'COP']);
  assert.match(ok.data.avisosPath, /^\/api\/mercadopago\/[a-z0-9-]+\/avisos$/);
  assert.deepEqual(calls.map((c) => [c.method, c.path, c.token]), [['GET', '/users/me', TOKEN_A]]);
  const text = JSON.stringify(ok.data) + JSON.stringify((await call('GET', '/company/mercadopago', { as: a.token })).data)
    + JSON.stringify((await call('GET', '/auth/profile', { as: a.token })).data);
  assert.ok(!text.includes(TOKEN_A) && !text.includes(SECRET_A));
  const raw = (await companies().findOne({ _id: oid(a.id) })).mercadopago;
  assert.ok(raw.accessTokenSealed.startsWith('v1.') && !raw.accessTokenSealed.includes('1111111111'));
  assert.equal(open(raw.accessTokenSealed), TOKEN_A);
  assert.equal(open(raw.webhookSecretSealed), SECRET_A);
  assert.ok((await actions(a)).includes('empresa.mercadopago'));
  const off = await call('DELETE', '/company/mercadopago', { as: a.token });
  assert.equal(off.data.connected, false);

  const us = await company('Plomería Rápida LLC');
  await call('PATCH', `/platform/companies/${us.id}`, { platformKey: KEY, body: { market: 'us' } });
  assert.equal((await call('GET', '/company/mercadopago', { as: us.token })).data.available, false);
  const r = await connect(us, { accessToken: TOKEN_A, webhookSecret: SECRET_A });
  assert.equal(r.status, 400);
  assert.match(r.data.message, /no opera para tu país/);
});

// ---- Cobrar ----------------------------------------------------------------------------------------------------------

test('pagar: solo aprobada; la preferencia va por el valor exacto, en pesos, con la referencia de la empresa y la cotización', async () => {
  const { a, q, publicToken, ref } = await setup('Frío Ruta', { approve: false });
  assert.equal((await checkout(publicToken)).status, 409);                 // enviada, sin aprobar
  await call('POST', `/cotizaciones/${publicToken}/aprobar`, { body: { name: 'Carlos Pérez', accept: true } });
  const pub = await publicOf(publicToken);
  assert.deepEqual([pub.quote.payment.online, pub.quote.payment.due, pub.quote.payment.onlineTest], [true, 725325, true]);
  assert.equal((await quoteOf(a, q)).payment.online, true);                // el portal del cliente también ofrece pagar
  calls.length = 0;
  const c = await checkout(publicToken);
  assert.equal(c.status, 200, JSON.stringify(c.data));
  assert.match(c.data.checkoutUrl, /^https:\/\/sandbox\.mercadopago\.com\.co\//);   // cuenta de prueba: el Sandbox
  assert.deepEqual([c.data.due, c.data.test], [725325, true]);
  const [pref] = calls;
  assert.deepEqual([pref.method, pref.path, pref.token], ['POST', '/checkout/preferences', TOKEN_A]);
  assert.equal(pref.body.external_reference, ref);
  assert.deepEqual(pref.body.items.map((i) => [i.quantity, i.unit_price, i.currency_id]), [[1, 725325, 'COP']]);
  assert.equal(pref.body.payer, undefined);                                // ni correo ni datos del cliente
  assert.equal(pref.body.notification_url, undefined);
  assert.match(pref.body.back_urls.success, new RegExp(`/cotizacion/${publicToken}$`));
  assert.equal((await quoteOf(a, q)).payment.ref, ref);
});

test('la firma del aviso: buena sí; mala, vieja, adelantada o malformada no (y no se consulta nada)', async () => {
  const { a, slug, q, publicToken, ref } = await setup();
  await checkout(publicToken);
  const p = addPayment(TOKEN_A, { external_reference: ref });
  calls.length = 0;
  const now = Math.floor(Date.now() / 1000);
  const good = signature({ dataId: String(p.id), requestId: 'r-1', secret: SECRET_A, ts: now });
  const v1 = good.split('v1=')[1];
  for (const [label, opts] of [
    ['otra clave', { secret: 'otraClaveSecretaQueNoEsLaDeA0123' }],
    ['vieja', { ts: now - 11 * 60 }],
    ['adelantada', { ts: now + 11 * 60 }],
    ['sin firma', { header: null }],
    ['ts con letras', { header: `ts=12a4,v1=${v1}`, requestId: 'r-1' }],
    ['v1 corto', { header: `ts=${now},v1=${v1.slice(0, 63)}`, requestId: 'r-1' }],
    ['v1 no hex', { header: `ts=${now},v1=${'z'.repeat(64)}`, requestId: 'r-1' }],
    ['sin ts', { header: `v1=${v1}`, requestId: 'r-1' }],
    ['otro request-id', { header: good, requestId: 'r-2' }],
  ]) {
    assert.equal((await notify(slug, p.id, opts)).status, 401, label);
  }
  assert.equal((await notify(slug, p.id, { header: good, requestId: 'r-1', bodyId: p.id + 1 })).status, 400);   // el cuerpo dice otro pago
  assert.equal((await notify(slug, String(p.id + 1), { header: good, requestId: 'r-1' })).status, 401);         // la firma es de otro id
  assert.equal(paymentCalls().length, 0);
  assert.equal((await quoteOf(a, q)).payment.status, 'pendiente');
  assert.equal((await notify(slug, p.id, { header: good, requestId: 'r-1' })).status, 200);
  assert.equal((await quoteOf(a, q)).payment.status, 'pagado');
  // reglas del módulo: sin request-id el par no va; ts en milisegundos también se entiende
  assert.equal(mp.manifest({ dataId: '123', requestId: '', ts: '1' }), 'id:123;ts:1;');
  const ms = Date.now();
  const msSig = `ts=${ms},v1=${crypto.createHmac('sha256', SECRET_A).update(`id:5;ts:${ms};`).digest('hex')}`;
  assert.equal(mp.validSignature({ header: msSig, dataId: '5', secret: SECRET_A }), true);
  assert.equal(mp.validSignature({ header: msSig, dataId: '5', secret: '' }), false);
  // otro evento (no de pagos), bien firmado: se responde y no se consulta nada
  calls.length = 0;
  assert.equal((await notify(slug, 77, { type: 'merchant_order' })).status, 200);
  assert.equal(calls.length, 0);
});

test('el aviso no se cree: se consulta la API con el token de la empresa y se decide con lo que responda', async () => {
  const { a, slug, q, publicToken, ref } = await setup();
  await checkout(publicToken);
  // la API dice «en proceso» (PSE): no se paga, y no se ofrece pagar otra vez mientras tanto
  const p = addPayment(TOKEN_A, { external_reference: ref, status: 'in_process', payment_type_id: 'bank_transfer' });
  calls.length = 0;
  assert.equal((await notify(slug, p.id)).status, 200);
  assert.deepEqual(calls.map((c) => [c.method, c.path, c.token]), [['GET', `/v1/payments/${p.id}`, TOKEN_A]]);
  let pub = (await publicOf(publicToken)).quote.payment;
  assert.deepEqual([pub.status, pub.pending, pub.online], ['pendiente', true, false]);
  assert.equal((await checkout(publicToken)).status, 409);
  // la API dice «rechazado»: queda anotado y se puede pagar de nuevo
  setPaymentStatus(p.id, { status: 'rejected' });
  assert.equal((await notify(slug, p.id)).status, 200);
  pub = (await publicOf(publicToken)).quote.payment;
  assert.deepEqual([pub.status, pub.pending, pub.online, pub.txStatus], ['pendiente', false, true, 'REJECTED']);
  // un pago que la API no reconoce en la cuenta de esta empresa: 502 (Mercado Pago reintenta) y nada cambia
  assert.equal((await notify(slug, 123456789)).status, 502);
  // la API dice aprobado: ahora sí
  setPaymentStatus(p.id, { status: 'approved' });
  assert.equal((await notify(slug, p.id)).status, 200);
  const paid = (await quoteOf(a, q)).payment;
  assert.deepEqual([paid.status, paid.amountPaid, paid.balance, paid.method, paid.methodType, paid.txId, paid.test], ['pagado', 725325, 0, 'mercadopago', 'BANK_TRANSFER', String(p.id), true]);
  assert.ok((await companies().findOne({ _id: oid(a.id) })).mercadopago.lastEventAt);
});

test('aislamiento: el aviso de la empresa A jamás toca una cotización de la empresa B', async () => {
  const A = await setup('Empresa Alfa', { token: TOKEN_A, secret: SECRET_A });
  const B = await setup('Empresa Beta', { token: TOKEN_B, secret: SECRET_B });
  await checkout(A.publicToken);
  await checkout(B.publicToken);
  // un pago de la cuenta de A con la referencia de B (o con la empresa A y la cotización de B), avisado a A
  const p1 = addPayment(TOKEN_A, { external_reference: B.ref });
  const p2 = addPayment(TOKEN_A, { external_reference: `NWO-${A.a.id}-${B.q._id}` });
  for (const p of [p1, p2]) {
    const r = await notify(A.slug, p.id, { secret: SECRET_A });
    assert.equal(r.status, 200);
    assert.equal(r.data.result, 'ajeno');
  }
  // un pago de la cuenta de B avisado a la URL de A: la API de A no lo tiene
  const p3 = addPayment(TOKEN_B, { external_reference: B.ref, collector_id: 2002 });
  assert.equal((await notify(A.slug, p3.id, { secret: SECRET_A })).status, 502);
  // y el aviso a la URL de B firmado con la clave de A no vale
  assert.equal((await notify(B.slug, p3.id, { secret: SECRET_A })).status, 401);
  assert.equal(paymentCalls().filter((c) => c.token === TOKEN_B).length, 0);
  for (const x of [A, B]) assert.equal((await quoteOf(x.a, x.q)).payment.status, 'pendiente');
  // el bueno, a B con su clave, solo paga la de B
  assert.equal((await notify(B.slug, p3.id, { secret: SECRET_B })).status, 200);
  assert.equal((await quoteOf(B.a, B.q)).payment.status, 'pagado');
  assert.equal((await quoteOf(A.a, A.q)).payment.status, 'pendiente');
  assert.ok(!(await actions(A.a)).includes('cotizacion.pagada'));
});

test('idempotencia: el mismo pago avisado dos veces (o dos a la vez) se cobra una sola vez', async () => {
  const { a, slug, q, publicToken, ref } = await setup();
  await checkout(publicToken);
  const p = addPayment(TOKEN_A, { external_reference: ref });
  assert.equal((await notify(slug, p.id)).status, 200);
  assert.equal((await notify(slug, p.id)).status, 200);
  await Promise.all([notify(slug, p.id), notify(slug, p.id), notify(slug, p.id)]);
  const paid = (await quoteOf(a, q)).payment;
  assert.deepEqual([paid.status, paid.amountPaid, paid.extra.length], ['pagado', 725325, 0]);
  assert.equal((await actions(a)).filter((x) => x === 'cotizacion.pagada').length, 1);
});

test('un segundo pago aprobado no se pierde: queda en payment.extra como posible doble cobro, una sola vez', async () => {
  const { a, slug, q, publicToken, ref } = await setup();
  await checkout(publicToken);
  const first = addPayment(TOKEN_A, { external_reference: ref });
  const second = addPayment(TOKEN_A, { external_reference: ref, payment_type_id: 'bank_transfer' });
  assert.equal((await notify(slug, first.id)).status, 200);
  assert.equal((await notify(slug, second.id)).status, 200);
  await Promise.all([notify(slug, second.id), notify(slug, second.id)]);
  const p = (await quoteOf(a, q)).payment;
  assert.deepEqual([p.status, p.txId, p.amountPaid], ['pagado', String(first.id), 725325]);
  assert.deepEqual(p.extra.map((e) => [e.txId, e.amount, e.status, e.method]), [[String(second.id), 725325, 'APPROVED', 'mercadopago']]);
  assert.equal((await actions(a)).filter((x) => x === 'cotizacion.pago_duplicado').length, 1);
  assert.ok(!calls.some((c) => c.method !== 'GET' && c.path !== '/checkout/preferences'));   // ninguna devolución
});

test('cobrada por la oficina y luego por Mercado Pago (pago real): queda como doble cobro y, si la oficina quita lo suyo, ese es el pago', async () => {
  process.env.MERCADOPAGO_PRODUCCION = '1';                                // simulado: una cuenta APP_USR con pagos reales
  const { a, slug, q, publicToken, ref } = await setup('Frío Real', { token: TOKEN_PROD });
  await checkout(publicToken);
  assert.equal((await pay(a, q, 'pagado')).status, 200);
  const p = addPayment(TOKEN_PROD, { external_reference: ref, live_mode: true });
  assert.equal((await notify(slug, p.id)).status, 200);
  assert.deepEqual((await quoteOf(a, q)).payment.extra.map((e) => [e.txId, e.test]), [[String(p.id), false]]);
  const undo = await pay(a, q, 'pendiente');
  assert.equal(undo.status, 200);
  const x = undo.data.payment;
  assert.deepEqual([x.status, x.amountPaid, x.method, x.txId, x.extra.length], ['pagado', 725325, 'mercadopago', String(p.id), 0]);
  const again = await pay(a, q, 'pendiente');
  assert.equal(again.status, 409);                                         // ahora lo confirmó Mercado Pago
  assert.match(again.data.message, /lo confirmó Mercado Pago/);
});

test('monto, moneda, referencia, cuenta o ambiente distintos: no se concilia y queda en la bitácora', async () => {
  const { a, slug, q, publicToken, ref } = await setup();
  const early = addPayment(TOKEN_A, { external_reference: ref });          // antes de preparar el cobro: sin referencia guardada
  assert.equal((await notify(slug, early.id)).data.result, 'no_cuadra');
  await checkout(publicToken);
  for (const over of [
    { transaction_amount: 725324 }, { transaction_amount: 725325.5 }, { transaction_amount: '725325abc' }, { currency_id: 'USD' },
    { currency_id: 'MXN' }, { live_mode: true }, { collector_id: 9999 },
  ]) {
    const p = addPayment(TOKEN_A, { external_reference: ref, ...over });
    const r = await notify(slug, p.id);
    assert.equal(r.status, 200);
    assert.equal(r.data.result, 'no_cuadra', JSON.stringify(over));
  }
  const p = (await quoteOf(a, q)).payment;
  assert.deepEqual([p.status, p.amountPaid, p.method, p.extra.length], ['pendiente', 0, '', 0]);
  assert.equal((await actions(a)).filter((x) => x === 'cotizacion.pago_no_cuadra').length, 8);
});

test('devolución o contracargo: se anota y se avisa, NOVA no mueve dinero ni cambia el cobro; lo decide el administrador', async () => {
  process.env.MERCADOPAGO_PRODUCCION = '1';                                // simulado, para que el pago cuente como real
  const { a, slug, q, publicToken, ref } = await setup('Frío Devolución', { token: TOKEN_PROD });
  await checkout(publicToken);
  const p = addPayment(TOKEN_PROD, { external_reference: ref, live_mode: true });
  assert.equal((await notify(slug, p.id)).status, 200);
  assert.equal((await pay(a, q, 'pendiente')).status, 409);                // un pago real que confirmó Mercado Pago
  setPaymentStatus(p.id, { status: 'refunded', transaction_amount_refunded: 725325 });
  assert.equal((await notify(slug, p.id)).status, 200);
  assert.equal((await notify(slug, p.id)).status, 200);                    // otra vez: no se anota dos veces
  const x = (await quoteOf(a, q)).payment;
  assert.deepEqual([x.status, x.amountPaid, x.method, x.txStatus], ['pagado', 725325, 'mercadopago', 'REFUNDED']);
  assert.equal((await actions(a)).filter((y) => y === 'cotizacion.pago_devuelto').length, 1);
  assert.ok(!calls.some((c) => /refund|cancel/.test(c.path) || (c.method !== 'GET' && c.path !== '/checkout/preferences')));
  assert.equal((await pay(a, q, 'pagado')).status, 409);
  const undo = await pay(a, q, 'pendiente');                               // ahora sí lo puede quitar el administrador
  assert.equal(undo.status, 200);
  assert.deepEqual([undo.data.payment.status, undo.data.payment.amountPaid, undo.data.payment.method], ['pendiente', 0, '']);
  // un aprobado con devolución parcial también se trata como devolución; un contracargo, igual
  const other = await setup('Frío Contracargo', { token: TOKEN_PROD });
  await checkout(other.publicToken);
  const c = addPayment(TOKEN_PROD, { external_reference: other.ref, live_mode: true });
  await notify(other.slug, c.id);
  setPaymentStatus(c.id, { status: 'charged_back' });
  await notify(other.slug, c.id);
  assert.equal((await quoteOf(other.a, other.q)).payment.txStatus, 'CHARGED_BACK');
  setPaymentStatus(c.id, { status: 'approved', transaction_amount_refunded: 1000 });
  await notify(other.slug, c.id);
  assert.equal((await quoteOf(other.a, other.q)).payment.txStatus, 'REFUNDED');
  assert.equal((await quoteOf(other.a, other.q)).payment.status, 'pagado');
});

test('anticipo y saldo: con 50 % se cobra la mitad (fijada al primer intento) y la oficina registra el saldo', async () => {
  process.env.MERCADOPAGO_PRODUCCION = '1';                                // simulado: pago real, para registrar el saldo
  const { a, slug, q, publicToken, ref } = await setup('Frío Anticipo', { token: TOKEN_PROD, deposit: 50 });
  const c = await checkout(publicToken);
  assert.equal(c.data.due, 362663);
  assert.equal(calls.find((x) => x.path === '/checkout/preferences').body.items[0].unit_price, 362663);
  await call('PUT', '/company/mercadopago/deposit', { as: a.token, body: { depositPercent: 30 } });
  assert.equal((await publicOf(publicToken)).quote.payment.due, 362663);  // cambiar el porcentaje no descuadra el fijado
  const p = addPayment(TOKEN_PROD, { external_reference: ref, live_mode: true, transaction_amount: 362663 });
  assert.equal((await notify(slug, p.id)).status, 200);
  let x = (await quoteOf(a, q)).payment;
  assert.deepEqual([x.status, x.amountPaid, x.balance, x.method, x.test], ['anticipo', 362663, 362662, 'mercadopago', false]);
  const pub = (await publicOf(publicToken)).quote.payment;
  assert.deepEqual([pub.status, pub.online, pub.balance], ['anticipo', false, 362662]);
  assert.equal((await checkout(publicToken)).status, 409);                 // el saldo se acuerda con la empresa
  const full = await pay(a, q, 'pagado');
  assert.equal(full.status, 200);
  x = full.data.payment;
  assert.deepEqual([x.status, x.amountPaid, x.balance, x.officeAmount, x.method], ['pagado', 725325, 0, 362662, 'mercadopago']);
  const back = await pay(a, q, 'pendiente');                               // la oficina quita lo suyo: queda el anticipo
  assert.deepEqual([back.data.payment.status, back.data.payment.amountPaid, back.data.payment.method], ['anticipo', 362663, 'mercadopago']);
  assert.equal((await pay(a, q, 'pendiente')).status, 409);
});

test('con una cuenta de prueba el pago queda marcado como prueba: no es plata real y se puede quitar', async () => {
  const { a, slug, q, publicToken, ref } = await setup('Frío Pruebas', { deposit: 50 });
  await checkout(publicToken);
  const p = addPayment(TOKEN_A, { external_reference: ref, transaction_amount: 362663 });
  assert.equal((await notify(slug, p.id)).status, 200);
  assert.equal((await quoteOf(a, q)).payment.test, true);
  const r = await pay(a, q, 'pagado');
  assert.equal(r.status, 409);
  assert.match(r.data.message, /pago de prueba/);
  const undo = await pay(a, q, 'pendiente');
  assert.deepEqual([undo.data.payment.status, undo.data.payment.amountPaid, undo.data.payment.test], ['pendiente', 0, false]);
});

test('México: se cobra en pesos mexicanos, con centavos exactos', async () => {
  const { a, slug, q, publicToken, ref } = await setup('Clima Regio', { token: TOKEN_MX, market: 'mx' });
  assert.equal(q.currency, 'MXN');
  assert.equal(q.total, 4051.99);
  const c = await checkout(publicToken);
  assert.equal(c.status, 200, JSON.stringify(c.data));
  const pref = calls.find((x) => x.path === '/checkout/preferences');
  assert.deepEqual(pref.body.items.map((i) => [i.unit_price, i.currency_id]), [[4051.99, 'MXN']]);
  const wrong = addPayment(TOKEN_MX, { external_reference: ref, transaction_amount: 4051.99, currency_id: 'COP' });
  assert.equal((await notify(slug, wrong.id)).data.result, 'no_cuadra');
  const p = addPayment(TOKEN_MX, { external_reference: ref, transaction_amount: 4051.99, currency_id: 'MXN' });
  assert.equal((await notify(slug, p.id)).status, 200);
  const x = (await quoteOf(a, q)).payment;
  assert.deepEqual([x.status, x.amountPaid, x.method], ['pagado', 4051.99, 'mercadopago']);
});

test('reglas del módulo: referencia, centavos exactos y estados', () => {
  const ref = mp.reference({ _id: 'a'.repeat(24) }, { _id: 'b'.repeat(24) });
  assert.deepEqual(mp.parseReference(ref), { companyId: 'a'.repeat(24), quoteId: 'b'.repeat(24) });
  for (const bad of ['', 'NWO-x-y', `NWO-${'b'.repeat(24)}-0a1b2c3d`, `${ref}-extra`, null]) assert.equal(mp.parseReference(bad), null);
  assert.equal(mp.cents(725325), 72532500);
  assert.equal(mp.cents('4051.99'), 405199);
  assert.equal(mp.cents(4051.999), null);
  for (const bad of [true, null, undefined, '', 'abc', Infinity]) assert.equal(mp.cents(bad), null);
  assert.equal(mp.statusOf({ status: 'in_process' }), 'PENDING');
  assert.equal(mp.statusOf({ status: 'raro' }), '');
  assert.equal(mp.refunded({ transaction_amount_refunded: 0 }), false);
  assert.equal(mp.refunded({ transaction_amount_refunded: 'x' }), true);   // ante la duda, devolución
  assert.equal(mp.parseSignature('ts=1,v1=abc'), null);
  assert.deepEqual(mp.parseSignature(` ts=12 , v1=${'A'.repeat(64)}`), { ts: '12', v1: 'a'.repeat(64) });
});
