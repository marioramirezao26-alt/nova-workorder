const Quote = require('../models/Quote');
const AuditLog = require('../models/AuditLog');
const wompi = require('./wompi');

// El cobro de una cotización aprobada: todo o el anticipo que fije la empresa. Se fija al primer intento de pago, así
// cambiar el porcentaje después no descuadra los pagos en curso.
const dueFor = async (quote, company) => {
  if (quote.payment && quote.payment.due) return quote.payment.due;
  const percent = (company.wompi && company.wompi.depositPercent) || 100;
  const due = Math.round((quote.total * percent) / 100);
  await Quote.updateOne({ tenant: quote.tenant, _id: quote._id, 'payment.due': null }, { $set: { 'payment.due': due } });
  const fresh = await Quote.findOne({ tenant: quote.tenant, _id: quote._id }).select('payment');
  return fresh.payment.due;
};

// «Por cobrar» en la base: también las cotizaciones de antes de Wompi, que no tienen el campo payment (Mongoose pone el
// valor por defecto al leerlas, pero un filtro por 'pendiente' no las encuentra).
const UNPAID = { 'payment.status': { $nin: ['anticipo', 'pagado'] } };
const statusFor = (paid, total) => (paid <= 0 ? 'pendiente' : paid >= total ? 'pagado' : 'anticipo');

// Un intento de pago sigue en curso (PSE, Nequi… quedan PENDING un rato): mientras tanto no se ofrece pagar otra vez.
const PENDING_MS = 30 * 60 * 1000;
const pendingNow = (payment) => Boolean(payment && payment.txStatus === 'PENDING' && payment.txAt
  && Date.now() - new Date(payment.txAt).getTime() < PENDING_MS);

const log = async (company, quote, action, summary, meta) => {
  try {
    await AuditLog.create({ tenant: company._id, user: null, userName: 'Wompi', action, summary, entityId: quote._id, meta });
  } catch {
    // la bitácora es secundaria
  }
};

// La cotización (de ESTA empresa, aprobada, en pesos) de una transacción de Wompi cuyo valor y moneda coinciden con lo
// que se cobra; si no, null.
const matching = async (company, tx) => {
  const id = tx && wompi.quoteIdFrom(tx.reference);
  if (!id) return null;
  const quote = await Quote.findOne({ tenant: company._id, _id: id, status: 'aprobada' });
  if (!quote || quote.currency !== 'COP' || !quote.payment || !quote.payment.due) return null;
  if (Number(tx.amount_in_cents) !== wompi.cents(quote.payment.due) || tx.currency !== 'COP') return null;   // no cuadra
  return quote;
};
const startedAt = (tx) => {
  const at = new Date(tx.created_at);
  return Number.isNaN(at.getTime()) || at > new Date() ? new Date() : at;
};

// Anota el último intento mientras la cotización siga por cobrar. Un PENDING no pisa el estado final que Wompi ya haya
// dado de esa misma transacción (si el evento llegó antes que la consulta), y un intento que empezó antes no pisa el
// PENDING de otro (un DECLINED atrasado de un intento viejo no vuelve a ofrecer pagar con el nuevo en curso).
const noteAttempt = (company, quote, tx, status) => {
  const txId = String(tx.id || '');
  const at = startedAt(tx);
  return Quote.findOneAndUpdate(
    {
      tenant: company._id, _id: quote._id, ...UNPAID,
      $or: [{ 'payment.txStatus': { $ne: 'PENDING' } }, { 'payment.txId': txId }, { 'payment.txAt': { $lte: at } }],
      ...(status === 'PENDING' ? { $nor: [{ 'payment.txId': txId, 'payment.txStatus': { $ne: 'PENDING' } }] } : {}),
    },
    { $set: { 'payment.txId': txId, 'payment.txStatus': status, 'payment.txAt': at } },
    { new: true }
  );
};

// Aplica a una cotización lo que dice el evento FIRMADO de Wompi sobre una transacción (nunca la consulta pública).
// - APPROVED: cobra lo que se cobraba en línea (el total queda «pagado»; un anticipo, «anticipo» con su saldo). Si ya
//   estaba cobrada (por Wompi, por la oficina o por otro intento), no se descarta: queda en payment.extra y en la
//   bitácora como posible doble cobro para devolver.
// - VOIDED de la transacción que pagó: se devuelve el pago (queda lo que haya registrado la oficina) y queda en la bitácora.
//   Un APPROVED repetido o atrasado de una transacción ya anulada no la vuelve a cobrar.
// - Lo demás (PENDING, DECLINED, ERROR) solo se anota como último intento mientras siga por cobrar.
// Es idempotente: el mismo evento dos veces no cambia nada.
const applyTransaction = async (company, tx) => {
  const quote = await matching(company, tx);
  if (!quote) return null;
  const p = quote.payment;
  const txId = String(tx.id || '');
  const status = String(tx.status || '').toUpperCase();
  const where = { tenant: company._id, _id: quote._id };
  const money = `$ ${Number(p.due).toLocaleString('es-CO')}`;

  if (txId && txId === p.txId && ['APPROVED', 'VOIDED'].includes(p.txStatus)) {
    // la que ya pagó: otra vez el mismo evento (o un pago de prueba que la oficina ya quitó) no cambia nada; la que Wompi
    // ya anuló, tampoco (su APPROVED puede llegar repetido, o atrasado después del VOIDED)
    if (status !== 'VOIDED' || p.txStatus !== 'APPROVED' || p.method !== 'wompi') return quote;
    const office = p.officeAmount || 0;
    const updated = await Quote.findOneAndUpdate({ ...where, 'payment.txId': txId, 'payment.txStatus': 'APPROVED' }, { $set: {
      'payment.status': statusFor(office, quote.total), 'payment.amountPaid': office, 'payment.balance': quote.total - office,
      'payment.method': office > 0 ? 'oficina' : '', 'payment.methodType': '', 'payment.test': false,
      'payment.txStatus': 'VOIDED', ...(office > 0 ? {} : { 'payment.paidAt': null }),
    } }, { new: true });
    if (updated) await log(company, quote, 'cotizacion.pago_anulado', `Wompi anuló el pago de ${money} de la cotización #${quote.number}: vuelve a quedar por cobrar`, { txId });
    return updated || quote;
  }

  if (status === 'APPROVED') {
    const test = wompi.isTest(company.wompi && company.wompi.publicKey);
    const methodType = String(tx.payment_method_type || '').toUpperCase().slice(0, 40);
    const paid = Math.min(p.due, quote.total);
    const updated = await Quote.findOneAndUpdate({ ...where, ...UNPAID }, { $set: {
      'payment.status': statusFor(paid, quote.total), 'payment.amountPaid': paid, 'payment.balance': quote.total - paid, 'payment.officeAmount': 0,
      'payment.method': 'wompi', 'payment.methodType': methodType, 'payment.test': test,
      'payment.txId': txId, 'payment.txStatus': 'APPROVED', 'payment.txAt': startedAt(tx), 'payment.paidAt': new Date(),
    } }, { new: true });
    if (updated) {
      await log(company, quote, 'cotizacion.pagada', `Wompi confirmó el pago${test ? ' de prueba' : ''} de ${money} de la cotización #${quote.number}`, { txId });
      return updated;
    }
    const extra = await Quote.findOneAndUpdate(
      { ...where, 'payment.extra.txId': { $ne: txId }, $nor: [{ 'payment.txId': txId, 'payment.txStatus': 'APPROVED' }] },
      { $push: { 'payment.extra': { txId, amount: p.due, status: 'APPROVED', methodType, test, at: new Date() } } },
      { new: true }
    );
    if (extra) {
      await log(company, quote, 'cotizacion.pago_duplicado', `Wompi aprobó otro pago${test ? ' de prueba' : ''} de ${money} de la cotización #${quote.number}, que ya estaba cobrada: posible doble cobro para devolver`, { txId });
    }
    return extra || quote;
  }

  if (status === 'VOIDED' && (p.extra || []).some((e) => e.txId === txId)) {
    // un cobro de más que la empresa ya anuló en Wompi
    return (await Quote.findOneAndUpdate({ ...where, 'payment.extra.txId': txId }, { $set: { 'payment.extra.$.status': 'VOIDED' } }, { new: true })) || quote;
  }
  return (await noteAttempt(company, quote, tx, status)) || quote;
};

// Lo que trae el cliente al volver del checkout (?id=), consultado en Wompi: no cambia el pago, que es solo del evento
// firmado (esa consulta es pública y devuelve transacciones de cualquier comercio). Un PENDING, o un APPROVED cuyo evento
// aún no llega, sí se anota como intento en curso (PENDING), para no ofrecerle pagar de nuevo durante 30 minutos mientras
// Wompi lo resuelve o lo confirma. Si Wompi dice que la transacción es de otro comercio, no se anota.
const notePending = async (company, tx) => {
  if (!['PENDING', 'APPROVED'].includes(String((tx && tx.status) || '').toUpperCase())) return null;
  const merchant = tx.merchant && tx.merchant.public_key;
  if (merchant && merchant !== company.wompi.publicKey) return null;
  const quote = await matching(company, tx);
  return quote ? noteAttempt(company, quote, tx, 'PENDING') : null;
};

module.exports = { dueFor, applyTransaction, notePending, pendingNow, statusFor, UNPAID };
