// Wompi se retiró de NOVA (Orden 41: Mercado Pago es el proveedor exclusivo de pagos). Lo que se prueba:
// - toda ruta de Wompi responde 410 sin leer ni cambiar nada: conectar, el anticipo, desconectar, el aviso de pagos y el
//   pago desde la cotización pública;
// - ya no existe el DELETE que borraba las llaves: las que una empresa guardó siguen cifradas en la base, como estaban;
// - lo histórico se sigue leyendo (pagadas con Wompi, anticipos, posibles dobles cobros) y setPayment sigue igual: un
//   pago real que confirmó Wompi no se cambia a mano, la oficina registra el saldo y un pago de prueba se puede quitar.
// No hay Wompi falso: ninguna de estas rutas llama a nadie.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { start, stop, reset, call, company, login } = require('./helpers');
const { seal, open } = require('../src/utils/secretBox');

before(start);
after(stop);
beforeEach(reset);

const GONE = /Wompi ya no está disponible en NOVA/;
const oid = (id) => new mongoose.Types.ObjectId(id);
const companies = () => mongoose.connection.collection('companies');
const quotes = () => mongoose.connection.collection('quotes');

// Una empresa que conectó Wompi antes del retiro (sus llaves quedaron cifradas en la base) y una cotización de 725.325
// aprobada por el cliente con el enlace.
const setup = async (name = 'Frío Ruta') => {
  const a = await company(name);
  const wompi = {
    publicKey: 'pub_prod_AbCdEf123456', integritySealed: seal('prod_integrity_Integ123456'), eventsSealed: seal('prod_events_Event123456'),
    merchantName: 'Frío Ruta SAS', depositPercent: 100, connectedAt: new Date('2026-10-01T15:00:00Z'), lastEventAt: null,
  };
  await companies().updateOne({ _id: oid(a.id) }, { $set: { wompi } });
  const slug = (await companies().findOne({ _id: oid(a.id) })).slug;
  const client = (await call('POST', '/clients', { as: a.token, body: { name: 'Hotel Norte', email: `h@${slug}.com` } })).data;
  const q = (await call('POST', '/quotes', { as: a.token, body: { client: client._id, title: 'Mantenimiento', items: [
    { description: 'Mantenimiento', qty: 4, unitPrice: 120000, taxRate: 19 }, { description: 'Gas', qty: 2.5, unitPrice: 35000 }, { description: 'Visita', qty: 1, unitPrice: 50000, taxRate: 0 },
  ] } })).data;
  assert.equal(q.total, 725325);
  const token = (await call('POST', `/quotes/${q._id}/send`, { as: a.token })).data.path.split('/').pop();
  assert.equal((await call('POST', `/cotizaciones/${token}/aprobar`, { body: { name: 'Carlos Pérez', accept: true } })).status, 200);
  return { a, slug, q, token, wompi };
};
// Lo que Wompi dejó registrado en una cotización antes del retiro (escrito directo en la base, como quedó entonces).
const history = (q, payment) => quotes().updateOne({ _id: oid(q._id) },
  { $set: Object.fromEntries(Object.entries(payment).map(([k, v]) => [`payment.${k}`, v])) });
const quoteOf = async (a, q) => (await call('GET', `/quotes/${q._id}`, { as: a.token })).data;
const pay = (a, q, status) => call('POST', `/quotes/${q._id}/payment`, { as: a.token, body: { status } });

test('las rutas de Wompi de la empresa responden 410 y las llaves guardadas no se borran', async () => {
  const { a, wompi } = await setup();
  const made = await call('POST', '/users', { as: a.token, body: { name: 'Ana', email: 'ana@frioruta.com', role: 'tecnico' } });
  const tech = await login('ana@frioruta.com', made.data.temporaryPassword);
  const body = { publicKey: 'pub_test_AbCdEf123456', integritySecret: 'test_integrity_Integ123456', eventsSecret: 'test_events_Event123456', depositPercent: 50 };
  for (const as of [a.token, tech, undefined]) {
    for (const [method, path] of [['GET', '/company/wompi'], ['PUT', '/company/wompi'], ['PUT', '/company/wompi/deposit'], ['DELETE', '/company/wompi']]) {
      const r = await call(method, path, { as, body: method === 'PUT' ? body : undefined });
      assert.equal(r.status, 410, `${method} ${path}`);
      assert.match(r.data.message, GONE);
    }
  }
  // el DELETE ya no existe: las llaves siguen cifradas, iguales, y el anticipo no cambió
  const raw = (await companies().findOne({ _id: oid(a.id) })).wompi;
  assert.equal(raw.publicKey, wompi.publicKey);
  assert.equal(raw.integritySealed, wompi.integritySealed);
  assert.equal(raw.eventsSealed, wompi.eventsSealed);
  assert.equal(open(raw.integritySealed), 'prod_integrity_Integ123456');
  assert.equal(raw.depositPercent, 100);
  assert.equal(raw.merchantName, 'Frío Ruta SAS');
  // y los secretos no salen por la API de la empresa
  assert.ok(!JSON.stringify((await call('GET', '/auth/profile', { as: a.token })).data).includes('Integ123456'));
});

test('el aviso de Wompi responde 410 y no toca la cotización ni la empresa', async () => {
  const { a, slug, q } = await setup();
  await history(q, { due: 725325, txId: 'tx-1', txStatus: 'PENDING', txAt: new Date() });
  const event = {
    event: 'transaction.updated',
    timestamp: 1760000000,
    data: { transaction: { id: 'tx-1', reference: `NWO-${q._id}-0a1b2c3d`, amount_in_cents: 72532500, currency: 'COP', status: 'APPROVED' } },
    signature: { properties: ['transaction.id'], checksum: 'a'.repeat(64) },
  };
  for (const s of [slug, 'no-existe']) {
    const r = await call('POST', `/wompi/${s}/eventos`, { body: event });
    assert.equal(r.status, 410);
    assert.match(r.data.message, GONE);
  }
  const p = (await quoteOf(a, q)).payment;
  assert.deepEqual([p.status, p.amountPaid, p.method, p.txId, p.txStatus], ['pendiente', 0, '', 'tx-1', 'PENDING']);
  assert.equal((await companies().findOne({ _id: oid(a.id) })).wompi.lastEventAt, null);
  const actions = (await call('GET', '/audit?limit=50', { as: a.token })).data.items.map((e) => e.action);
  assert.ok(!actions.some((x) => /pagada|pago_/.test(x)), actions.join(','));
});

test('la cotización pública ya no ofrece pagar con Wompi: el pago y su consulta responden 410', async () => {
  const { a, q, token } = await setup();
  const pub = (await call('GET', `/cotizaciones/${token}`)).data;
  assert.equal(pub.quote.status, 'aprobada');
  assert.equal(pub.quote.payment.status, 'pendiente');
  assert.equal(pub.quote.payment.online, false);
  assert.equal(pub.quote.payment.pending, false);
  assert.equal((await quoteOf(a, q)).payment.online, false);
  for (const path of [`/cotizaciones/${token}/pago`, `/cotizaciones/${token}/pago/estado?id=tx-1`]) {
    const r = await call('GET', path);
    assert.equal(r.status, 410, path);
    assert.match(r.data.message, GONE);
  }
  assert.equal((await quoteOf(a, q)).payment.due, null);                    // nada se fijó para cobrar
});

test('lo histórico se lee: una cotización pagada con Wompi sigue pagada y no se cambia a mano', async () => {
  const { a, q, token } = await setup();
  const paidAt = new Date('2026-10-20T15:00:00Z');
  await history(q, { due: 725325, status: 'pagado', amountPaid: 725325, balance: 0, method: 'wompi', methodType: 'CARD', txId: 'tx-ok', txStatus: 'APPROVED', paidAt });
  const p = (await quoteOf(a, q)).payment;
  assert.deepEqual([p.status, p.amountPaid, p.method, p.methodType, p.txId, p.online], ['pagado', 725325, 'wompi', 'CARD', 'tx-ok', false]);
  assert.equal(new Date(p.paidAt).toISOString(), paidAt.toISOString());
  const pub = (await call('GET', `/cotizaciones/${token}`)).data.quote.payment;
  assert.deepEqual([pub.status, pub.amountPaid, pub.balance, pub.online], ['pagado', 725325, 0, false]);
  const undo = await pay(a, q, 'pendiente');
  assert.equal(undo.status, 409);
  assert.match(undo.data.message, /lo confirmó Wompi/);
  assert.equal((await pay(a, q, 'pagado')).status, 409);                     // ya está pagada
  assert.equal((await quoteOf(a, q)).payment.status, 'pagado');
});

test('anticipo de Wompi: la oficina registra el saldo y lo puede quitar; lo de Wompi se queda', async () => {
  const { a, q } = await setup();
  await history(q, { due: 362663, status: 'anticipo', amountPaid: 362663, balance: 362662, method: 'wompi', methodType: 'PSE', txId: 'tx-ant', txStatus: 'APPROVED', paidAt: new Date() });
  const full = await pay(a, q, 'pagado');
  assert.equal(full.status, 200);
  const f = full.data.payment;
  assert.deepEqual([f.status, f.amountPaid, f.balance, f.officeAmount, f.method], ['pagado', 725325, 0, 362662, 'wompi']);
  const back = await pay(a, q, 'pendiente');
  assert.equal(back.status, 200);
  const b = back.data.payment;
  assert.deepEqual([b.status, b.amountPaid, b.officeAmount, b.method, b.due], ['anticipo', 362663, 0, 'wompi', 362663]);
  assert.equal((await pay(a, q, 'pendiente')).status, 409);                  // el anticipo lo confirmó Wompi
});

test('un pago de prueba de Wompi se puede quitar (no es plata real)', async () => {
  const { a, q } = await setup();
  await history(q, { due: 725325, status: 'pagado', amountPaid: 725325, balance: 0, method: 'wompi', methodType: 'CARD', test: true, txId: 'tx-prueba', txStatus: 'APPROVED', paidAt: new Date() });
  const undo = await pay(a, q, 'pendiente');
  assert.equal(undo.status, 200);
  const p = undo.data.payment;
  assert.deepEqual([p.status, p.amountPaid, p.method, p.test, p.paidAt], ['pendiente', 0, '', false, null]);
});

test('un posible doble cobro de Wompi sigue a la vista y, si la oficina quita lo suyo, ese pago queda como el de la cotización', async () => {
  const { a, q } = await setup();
  await history(q, {
    due: 725325, status: 'pagado', amountPaid: 725325, balance: 0, officeAmount: 725325, method: 'oficina', paidAt: new Date(),
    extra: [{ txId: 'tx-pse', amount: 725325, status: 'APPROVED', methodType: 'PSE', test: false, at: new Date('2026-10-21T15:00:00Z') }],
  });
  assert.deepEqual((await quoteOf(a, q)).payment.extra.map((e) => [e.txId, e.amount, e.status]), [['tx-pse', 725325, 'APPROVED']]);
  const undo = await pay(a, q, 'pendiente');
  assert.equal(undo.status, 200);
  const p = undo.data.payment;
  assert.deepEqual([p.status, p.amountPaid, p.officeAmount, p.method, p.methodType, p.txId, p.extra.length], ['pagado', 725325, 0, 'wompi', 'PSE', 'tx-pse', 0]);
  assert.equal((await pay(a, q, 'pendiente')).status, 409);                  // ahora es de Wompi
});
