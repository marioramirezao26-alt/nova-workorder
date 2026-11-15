const Quote = require('../models/Quote');
const AuditLog = require('../models/AuditLog');
const mp = require('./mercadopago');
const { roundMoney } = require('../utils/money');

// El cobro de una cotización aprobada: todo o el anticipo que fije la empresa, en línea con su cuenta de Mercado Pago
// (Wompi se retiró en la Orden 41: lo que confirmó antes se sigue leyendo igual en cada cotización). Lo demás lo registra
// la oficina a mano (quoteController.setPayment).

// «Por cobrar» en la base: también las cotizaciones de antes del cobro en línea, que no tienen el campo payment
// (Mongoose pone el valor por defecto al leerlas, pero un filtro por 'pendiente' no las encuentra).
const UNPAID = { 'payment.status': { $nin: ['anticipo', 'pagado'] } };
const statusFor = (paid, total) => (paid <= 0 ? 'pendiente' : paid >= total ? 'pagado' : 'anticipo');

// Lo que se cobraría hoy en línea (el total o el anticipo), con el redondeo de la moneda (pesos enteros o centavos).
const dueAmount = (quote, company) => {
  const percent = (company && company.mercadopago && company.mercadopago.depositPercent) || 100;
  return roundMoney((quote.total * percent) / 100, quote.currency);
};
// Se fija al primer intento de pago: cambiar el porcentaje después no descuadra los pagos en curso.
const dueFor = async (quote, company) => {
  if (quote.payment && quote.payment.due) return quote.payment.due;
  await Quote.updateOne({ tenant: quote.tenant, _id: quote._id, 'payment.due': null }, { $set: { 'payment.due': dueAmount(quote, company) } });
  const fresh = await Quote.findOne({ tenant: quote.tenant, _id: quote._id }).select('payment');
  return fresh.payment.due;
};

// Un intento de pago sigue en curso (PSE, efectivo… quedan pendientes un rato): mientras tanto no se ofrece pagar otra vez.
const PENDING_MS = 30 * 60 * 1000;
const pendingNow = (payment) => Boolean(payment && payment.txStatus === 'PENDING' && payment.txAt
  && Date.now() - new Date(payment.txAt).getTime() < PENDING_MS);

// Lo que Mercado Pago reporta después de cobrar (devolución, contracargo o disputa): se anota y se avisa; NOVA no mueve
// dinero ni cambia el estado del cobro: eso lo decide el administrador (setPayment le deja marcarla por cobrar).
const REVERSED = ['REFUNDED', 'CHARGED_BACK', 'IN_MEDIATION'];
const SETTLED = ['APPROVED', ...REVERSED];
const REVERSED_LABEL = { REFUNDED: 'una devolución', CHARGED_BACK: 'un contracargo', IN_MEDIATION: 'una disputa' };

const log = async (company, quote, action, summary, meta) => {
  try {
    await AuditLog.create({ tenant: company._id, user: null, userName: 'Mercado Pago', action, summary, entityId: quote._id, meta });
  } catch {
    // la bitácora es secundaria
  }
};

const startedAt = (pay) => {
  const at = new Date(pay.date_created);
  return Number.isNaN(at.getTime()) || at > new Date() ? new Date() : at;
};

// Anota el último intento mientras la cotización siga por cobrar. Un PENDING no pisa el estado final que ya se tenga de
// ese mismo pago, y un intento que empezó antes no pisa el PENDING de otro (un rechazo atrasado de un intento viejo no
// vuelve a ofrecer pagar mientras el nuevo sigue en curso).
const noteAttempt = (company, quote, txId, status, at) => Quote.findOneAndUpdate(
  {
    tenant: company._id, _id: quote._id, ...UNPAID,
    $or: [{ 'payment.txStatus': { $ne: 'PENDING' } }, { 'payment.txId': txId }, { 'payment.txAt': { $lte: at } }],
    ...(status === 'PENDING' ? { $nor: [{ 'payment.txId': txId, 'payment.txStatus': { $ne: 'PENDING' } }] } : {}),
  },
  { $set: { 'payment.txId': txId, 'payment.txStatus': status, 'payment.txAt': at } },
  { new: true }
);

// Por qué un pago consultado a Mercado Pago NO se concilia con la cotización, o '' si cuadra: aprobada, con su cobro en
// línea fijado, la referencia guardada exacta, la moneda de la cotización, el monto exacto al centavo, de la cuenta
// conectada y, con una cuenta de prueba, un pago de prueba.
const mismatch = (company, quote, pay) => {
  const p = quote.payment || {};
  if (quote.status !== 'aprobada') return 'la cotización no está aprobada';
  if (!p.due || !p.ref) return 'la cotización no tenía un cobro en línea preparado';
  if (String(pay.external_reference || '') !== p.ref) return 'la referencia no es la guardada';
  if (String(pay.currency_id || '') !== quote.currency) return `la moneda es ${pay.currency_id || 'ninguna'} y la cotización está en ${quote.currency}`;
  const got = mp.cents(pay.transaction_amount);
  if (got === null || got !== mp.cents(p.due)) return `el monto es ${pay.transaction_amount} y se cobraba ${p.due}`;
  const m = company.mercadopago || {};
  if (m.userId && pay.collector_id !== undefined && pay.collector_id !== null && String(pay.collector_id) !== m.userId) return 'el pago es de otra cuenta de Mercado Pago';
  if (m.test !== false && pay.live_mode === true) return 'Mercado Pago dice que es un pago real y la cuenta conectada es de prueba';
  return '';
};

// Aplica a una cotización lo que respondió la API de Mercado Pago sobre un pago (nunca lo que diga el cuerpo del aviso).
// - El pago es de ESTA empresa: la referencia trae su id y el de una cotización suya; si no, no se toca nada.
// - approved: cobra lo que se cobraba en línea (el total queda «pagado»; un anticipo, «anticipo» con su saldo). Si ya
//   estaba cobrada (por Mercado Pago, por la oficina o por otro pago), no se descarta: queda en payment.extra y en la
//   bitácora como posible doble cobro para devolver (NOVA no devuelve: lo hace la empresa en su cuenta).
// - refunded, charged_back, in_mediation (o un approved con devolución): se anotan y se avisa; no se cambia el cobro.
// - pending, in_process, authorized, rejected, cancelled: solo se anotan como último intento mientras siga por cobrar.
// Es idempotente: el mismo pago dos veces (dos avisos, o dos a la vez) no cobra dos veces; todo cambio es condicional.
const applyMercadoPago = async (company, pay) => {
  const ref = mp.parseReference(pay && pay.external_reference);
  if (!ref || ref.companyId !== String(company._id)) return { result: 'ajeno' };
  const quote = await Quote.findOne({ tenant: company._id, _id: ref.quoteId });
  if (!quote) return { result: 'ajeno' };
  const txId = String(pay.id);
  const problem = mismatch(company, quote, pay);
  if (problem) {
    await log(company, quote, 'cotizacion.pago_no_cuadra', `Mercado Pago avisó del pago ${txId} de la cotización #${quote.number}, pero ${problem}: no se registró`, { txId });
    return { result: 'no_cuadra', quote };
  }
  const p = quote.payment;
  const where = { tenant: company._id, _id: quote._id };
  const status = mp.statusOf(pay) === 'APPROVED' && mp.refunded(pay) ? 'REFUNDED' : mp.statusOf(pay);
  const test = (company.mercadopago && company.mercadopago.test !== false) || pay.live_mode !== true;
  const kind = mp.methodType(pay);
  const amount = `${p.due} ${quote.currency}`;
  const mine = p.method === 'mercadopago' && p.txId === txId && SETTLED.includes(p.txStatus);
  const extra = (p.extra || []).find((e) => e.txId === txId && e.method === 'mercadopago');

  if (REVERSED.includes(status)) {
    if (mine) {
      const updated = await Quote.findOneAndUpdate({ ...where, 'payment.method': 'mercadopago', 'payment.txId': txId, 'payment.txStatus': { $ne: status } },
        { $set: { 'payment.txStatus': status } }, { new: true });
      if (updated) {
        await log(company, quote, 'cotizacion.pago_devuelto', `Mercado Pago reporta ${REVERSED_LABEL[status]} del pago ${txId} (${amount}) de la cotización #${quote.number}. NOVA no movió dinero: revísalo en tu cuenta de Mercado Pago y, si corresponde, márcala por cobrar.`, { txId, status });
      }
      return { result: 'devolucion', quote: updated || quote };
    }
    if (extra && extra.status !== status) {
      const updated = await Quote.findOneAndUpdate({ ...where, 'payment.extra': { $elemMatch: { txId, method: 'mercadopago', status: { $ne: status } } } },
        { $set: { 'payment.extra.$.status': status } }, { new: true });
      return { result: 'devolucion', quote: updated || quote };
    }
    return { result: 'ignorado', quote };
  }

  if (status === 'APPROVED') {
    if (mine || extra) return { result: 'repetido', quote };                    // el mismo aviso otra vez: nada cambia
    const paid = Math.min(p.due, quote.total);
    const updated = await Quote.findOneAndUpdate(
      { ...where, ...UNPAID, 'payment.extra.txId': { $ne: txId } },
      { $set: {
        'payment.status': statusFor(paid, quote.total), 'payment.amountPaid': paid, 'payment.balance': roundMoney(quote.total - paid, quote.currency),
        'payment.officeAmount': 0, 'payment.method': 'mercadopago', 'payment.methodType': kind, 'payment.test': test,
        'payment.txId': txId, 'payment.txStatus': 'APPROVED', 'payment.txAt': startedAt(pay), 'payment.paidAt': new Date(),
      } },
      { new: true }
    );
    if (updated) {
      await log(company, quote, 'cotizacion.pagada', `Mercado Pago confirmó el pago${test ? ' de prueba' : ''} ${txId} (${amount}) de la cotización #${quote.number}`, { txId });
      return { result: 'pagada', quote: updated };
    }
    // Ya estaba cobrada: queda como posible doble cobro (una sola vez por pago, aunque lleguen dos avisos a la vez).
    const dup = await Quote.findOneAndUpdate(
      { ...where, 'payment.extra.txId': { $ne: txId }, $nor: [{ 'payment.txId': txId, 'payment.txStatus': { $in: SETTLED } }] },
      { $push: { 'payment.extra': { txId, amount: p.due, status: 'APPROVED', methodType: kind, test, at: new Date(), method: 'mercadopago' } } },
      { new: true }
    );
    if (dup) {
      await log(company, quote, 'cotizacion.pago_duplicado', `Mercado Pago aprobó otro pago${test ? ' de prueba' : ''} ${txId} (${amount}) de la cotización #${quote.number}, que ya estaba cobrada: posible doble cobro para devolver desde tu cuenta de Mercado Pago`, { txId });
      return { result: 'duplicado', quote: dup };
    }
    return { result: 'repetido', quote };
  }

  if (['PENDING', 'REJECTED', 'CANCELLED'].includes(status)) {
    return { result: 'intento', quote: (await noteAttempt(company, quote, txId, status, startedAt(pay))) || quote };
  }
  return { result: 'ignorado', quote };
};

module.exports = { dueAmount, dueFor, pendingNow, applyMercadoPago, statusFor, UNPAID, REVERSED };
