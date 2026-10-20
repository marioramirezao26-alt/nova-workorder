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

// Aplica a una cotización lo que Wompi dice de una transacción (por su evento firmado o consultándola). Solo cuenta si la
// referencia es de una cotización de ESTA empresa, aprobada, y el valor y la moneda coinciden con lo que se cobra.
// Es idempotente: el mismo evento dos veces no cambia nada, y una vez pagada no la mueve un intento fallido posterior.
const applyTransaction = async (company, tx) => {
  if (!tx) return null;
  const id = wompi.quoteIdFrom(tx.reference);
  if (!id) return null;
  const quote = await Quote.findOne({ tenant: company._id, _id: id, status: 'aprobada' });
  if (!quote || !quote.payment || !quote.payment.due) return quote;
  if (Number(tx.amount_in_cents) !== wompi.cents(quote.payment.due) || tx.currency !== 'COP') return quote;   // no cuadra
  if (quote.payment.status === 'pagado') return quote;
  const status = String(tx.status || '').toUpperCase();
  const set = { 'payment.txId': String(tx.id || ''), 'payment.txStatus': status };
  if (status === 'APPROVED') Object.assign(set, { 'payment.status': 'pagado', 'payment.method': 'wompi', 'payment.paidAt': new Date() });
  const updated = await Quote.findOneAndUpdate({ tenant: company._id, _id: id, 'payment.status': 'pendiente' }, { $set: set }, { new: true });
  if (updated && status === 'APPROVED') {
    try {
      await AuditLog.create({
        tenant: company._id, user: null, userName: 'Wompi', action: 'cotizacion.pagada',
        summary: `Wompi confirmó el pago de la cotización #${quote.number}`, entityId: quote._id, meta: { txId: String(tx.id || '') },
      });
    } catch {
      // la bitácora es secundaria
    }
  }
  return updated || quote;
};

module.exports = { dueFor, applyTransaction };
