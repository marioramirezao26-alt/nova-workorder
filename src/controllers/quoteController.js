const crypto = require('crypto');
const Quote = require('../models/Quote');
const Client = require('../models/Client');
const Company = require('../models/Company');
const WorkOrder = require('../models/WorkOrder');
const AuditLog = require('../models/AuditLog');
const { companyScope } = require('../middleware/authMiddleware');
const { publicBranding } = require('../utils/branding');
const { currencyOf, totals } = require('../utils/money');
const { colombiaDay } = require('./analyticsController');
const { audit } = require('../utils/audit');
const webhooks = require('../utils/webhooks');
const wompi = require('../services/wompi');
const { dueFor, applyTransaction } = require('../services/quotePayments');

// Cotizaciones (Mejora 3): se arman en borrador, se envían con un enlace y el cliente las aprueba o rechaza sin cuenta.
// Al aprobarse se crea la orden de trabajo con el cliente y lo cotizado.

const DEFAULT_VALID_DAYS = 15;
const fail = (status, message) => Object.assign(new Error(message), { statusCode: status });
const reply = (res, error, fallback) => res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : fallback });

// «Válida hasta el 30 de octubre» = hasta el final de ese día en Colombia (el servidor corre en UTC).
const endOfDay = (day) => new Date(`${day}T23:59:59.999-05:00`);
const defaultValidUntil = () => endOfDay(colombiaDay(new Date(Date.now() + DEFAULT_VALID_DAYS * 86400000)));
const expired = (q) => q.status === 'enviada' && q.validUntil < new Date();
const shownStatus = (q) => (expired(q) ? 'vencida' : q.status);

const view = (q) => {
  const o = typeof q.toObject === 'function' ? q.toObject() : { ...q };
  return { ...o, status: shownStatus(q), expired: expired(q) };
};

const populate = (query) => query.populate('client', 'name email phone company address').populate('createdBy', 'name').populate('workOrder', 'title status');

// Un usuario cliente solo ve las cotizaciones de su ficha, y nunca los borradores.
const quoteFilter = (req) => {
  const filter = companyScope(req);
  if (req.user.role === 'cliente') {
    filter.client = req.user.client || null;
    filter.status = { $ne: 'borrador' };
  }
  return filter;
};

const findQuote = async (req) => {
  const quote = await Quote.findOne({ $and: [quoteFilter(req), { _id: req.params.id }] });
  if (!quote) throw fail(404, 'Cotización no encontrada');
  return quote;
};

// El técnico maneja las cotizaciones que él armó; el administrador, todas las de la empresa.
const findOwn = async (req) => {
  const quote = await findQuote(req);
  if (req.user.role === 'cliente') throw fail(403, 'No tienes permiso para esta acción');
  if (req.user.role === 'tecnico' && String(quote.createdBy) !== String(req.user._id)) {
    throw fail(403, 'Solo puedes cambiar las cotizaciones que tú armaste');
  }
  return quote;
};

// Renglones limpios y totales calculados aquí (nunca los que mande el navegador).
const buildItems = (raw, currency) => {
  const items = (Array.isArray(raw) ? raw : []).map((i) => ({
    description: String((i && i.description) || '').trim().slice(0, 200),
    qty: Number(i && i.qty),
    unitPrice: Number(i && i.unitPrice),
    taxRate: i && i.taxRate !== undefined && i.taxRate !== '' ? Number(i.taxRate) : (currency === 'COP' ? 19 : 0),
  }));
  if (!items.length || items.length > 50) throw fail(400, 'La cotización lleva entre 1 y 50 renglones');
  items.forEach((i, n) => {
    if (!i.description) throw fail(400, `Escribe la descripción del renglón ${n + 1}`);
    if (!(Number.isFinite(i.qty) && i.qty > 0 && i.qty <= 100000)) throw fail(400, `Cantidad inválida en el renglón ${n + 1}`);
    if (!(Number.isFinite(i.unitPrice) && i.unitPrice >= 0 && i.unitPrice <= 10000000000)) throw fail(400, `Precio inválido en el renglón ${n + 1}`);
    if (!(Number.isFinite(i.taxRate) && i.taxRate >= 0 && i.taxRate <= 30)) throw fail(400, `Impuesto inválido en el renglón ${n + 1}`);
    i.qty = Math.round(i.qty * 100) / 100;
  });
  const t = totals(items, currency);
  return { items: t.lines, subtotal: t.subtotal, tax: t.tax, total: t.total };
};

const resolveClient = async (req, id) => {
  const client = await Client.findOne({ _id: id, ...companyScope(req) });
  if (!client) throw fail(400, 'El cliente indicado no existe en tu empresa');
  return client._id;
};

const listQuotes = async (req, res) => {
  try {
    const filter = quoteFilter(req);
    const status = String(req.query.status || '');
    if (status === 'vencida') Object.assign(filter, { status: 'enviada', validUntil: { $lt: new Date() } });
    else if (status === 'enviada') Object.assign(filter, { status: 'enviada', validUntil: { $gte: new Date() } });
    else if (Quote.STATUSES.includes(status) && !(req.user.role === 'cliente' && status === 'borrador')) filter.status = status;
    const q = String(req.query.q || '').trim();
    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ title: rx }, ...(/^#?\d+$/.test(q) ? [{ number: Number(q.replace('#', '')) }] : [])];
    }
    const items = await populate(Quote.find(filter).sort({ createdAt: -1 }).limit(Math.min(Number(req.query.limit) || 50, 200)));
    res.status(200).json({ items: items.map(view) });
  } catch (error) {
    reply(res, error, 'No se pudieron cargar las cotizaciones');
  }
};

const getQuote = async (req, res) => {
  try {
    const quote = await findQuote(req);
    res.status(200).json(view(await populate(Quote.findOne({ ...companyScope(req), _id: quote._id }))));
  } catch (error) {
    reply(res, error, 'No se pudo cargar la cotización');
  }
};

const createQuote = async (req, res) => {
  try {
    const currency = currencyOf(req.company);
    const client = await resolveClient(req, req.body.client);
    const money = buildItems(req.body.items, currency);
    const { quoteSeq: number } = await Company.findByIdAndUpdate(req.user.tenant, { $inc: { quoteSeq: 1 } }, { new: true });
    const quote = await Quote.create({
      ...companyScope(req),
      number,
      client,
      title: req.body.title,
      notes: req.body.notes || '',
      currency,
      ...money,
      validUntil: req.body.validUntil ? endOfDay(req.body.validUntil) : defaultValidUntil(),
      createdBy: req.user._id,
    });
    await audit(req, 'cotizacion.crear', `Creó la cotización #${quote.number} «${quote.title}»`, { entityId: quote._id });
    res.status(201).json(view(await populate(Quote.findOne({ ...companyScope(req), _id: quote._id }))));
  } catch (error) {
    reply(res, error, 'No se pudo crear la cotización');
  }
};

// Solo se edita en borrador: para cambiar una enviada, primero se vuelve a borrador (el enlace deja de mostrarla).
const updateQuote = async (req, res) => {
  try {
    const quote = await findOwn(req);
    if (quote.status !== 'borrador') throw fail(409, 'Solo se edita una cotización en borrador. Vuélvela a borrador primero.');
    if (req.body.client !== undefined) quote.client = await resolveClient(req, req.body.client);
    if (req.body.title !== undefined) quote.title = req.body.title;
    if (req.body.notes !== undefined) quote.notes = req.body.notes;
    if (req.body.validUntil !== undefined) quote.validUntil = req.body.validUntil ? endOfDay(req.body.validUntil) : defaultValidUntil();
    if (req.body.items !== undefined) Object.assign(quote, buildItems(req.body.items, quote.currency));
    await quote.save();
    await audit(req, 'cotizacion.editar', `Editó la cotización #${quote.number}`, { entityId: quote._id });
    res.status(200).json(view(await populate(Quote.findOne({ ...companyScope(req), _id: quote._id }))));
  } catch (error) {
    reply(res, error, 'No se pudo guardar la cotización');
  }
};

const deleteQuote = async (req, res) => {
  try {
    const quote = await findQuote(req);
    if (quote.status === 'aprobada') throw fail(409, 'Una cotización aprobada no se borra');
    await Quote.deleteOne({ ...companyScope(req), _id: quote._id });
    await audit(req, 'cotizacion.borrar', `Borró la cotización #${quote.number}`, { entityId: quote._id });
    res.status(200).json({ message: 'Cotización eliminada' });
  } catch (error) {
    reply(res, error, 'No se pudo borrar la cotización');
  }
};

// Enviar: pasa a «enviada» y devuelve el enlace público para compartirlo (WhatsApp, correo…).
const sendQuote = async (req, res) => {
  try {
    const quote = await findOwn(req);
    if (!['borrador', 'enviada'].includes(quote.status)) throw fail(409, 'La cotización ya tiene una respuesta del cliente');
    if (quote.validUntil < new Date()) throw fail(409, 'La fecha de validez ya pasó: cámbiala antes de enviarla');
    if (!quote.publicToken) quote.publicToken = crypto.randomBytes(18).toString('base64url');
    if (quote.status === 'borrador') {
      quote.status = 'enviada';
      quote.sentAt = new Date();
      await audit(req, 'cotizacion.enviar', `Envió la cotización #${quote.number}`, { entityId: quote._id });
    }
    await quote.save();
    res.status(200).json({ path: `/cotizacion/${quote.publicToken}`, quote: view(await populate(Quote.findOne({ ...companyScope(req), _id: quote._id }))) });
  } catch (error) {
    reply(res, error, 'No se pudo enviar la cotización');
  }
};

// Volver a borrador (para corregirla o reenviarla después de un rechazo o de vencerse).
const reopenQuote = async (req, res) => {
  try {
    const quote = await findOwn(req);
    if (!['enviada', 'rechazada'].includes(quote.status)) throw fail(409, 'Solo una cotización enviada o rechazada vuelve a borrador');
    const updated = await Quote.findOneAndUpdate(
      { ...companyScope(req), _id: quote._id, status: quote.status },
      { $set: { status: 'borrador', decidedAt: null, decidedBy: '', decidedVia: '', decisionNote: '' } },
      { new: true }
    );
    if (!updated) throw fail(409, 'La cotización cambió mientras tanto. Actualiza la lista.');
    await audit(req, 'cotizacion.reabrir', `Volvió a borrador la cotización #${quote.number}`, { entityId: quote._id });
    res.status(200).json(view(await populate(Quote.findOne({ ...companyScope(req), _id: quote._id }))));
  } catch (error) {
    reply(res, error, 'No se pudo volver a borrador');
  }
};

// La orden de trabajo que sale de una cotización aprobada (una sola: si ya existe, no se crea otra).
const createOrderFrom = async (quote) => {
  const client = await Client.findOne({ tenant: quote.tenant, _id: quote.client });
  const lines = quote.items.map((i) => `- ${i.qty} × ${i.description}`).join('\n');
  const order = await WorkOrder.create({
    tenant: quote.tenant,
    title: `Cotización #${quote.number}: ${quote.title}`.slice(0, 200),
    description: `Trabajo aprobado en la cotización #${quote.number}.\n${lines}`.slice(0, 2000),
    status: 'pendiente',
    priority: 'media',
    client: client ? client._id : null,
    customerName: client ? client.name : '',
    createdBy: quote.createdBy,
    quote: quote._id,
  });
  const linked = await Quote.findOneAndUpdate({ tenant: quote.tenant, _id: quote._id, workOrder: null }, { $set: { workOrder: order._id } }, { new: true });
  if (!linked) {                                     // otra petición ya la había creado: se queda la primera
    await WorkOrder.deleteOne({ tenant: quote.tenant, _id: order._id });
    return Quote.findOne({ tenant: quote.tenant, _id: quote._id });
  }
  const populated = await WorkOrder.findOne({ tenant: quote.tenant, _id: order._id }).populate('client', 'name').populate('assignedTo', 'name');
  await webhooks.emit(quote.tenant, 'orden.creada', webhooks.orderPayload(populated));
  return linked;
};

// Aprobar o rechazar, una sola vez: el cambio se condiciona a que siga «enviada» y vigente (dos clics no aprueban dos veces).
const decide = async (quote, { approve, name, note, via }) => {
  const filter = { tenant: quote.tenant, _id: quote._id, status: 'enviada', validUntil: { $gte: new Date() } };
  const updated = await Quote.findOneAndUpdate(filter, { $set: {
    status: approve ? 'aprobada' : 'rechazada', decidedAt: new Date(), decidedBy: name, decidedVia: via, decisionNote: note || '',
  } }, { new: true });
  if (!updated) {
    const fresh = await Quote.findOne({ tenant: quote.tenant, _id: quote._id });
    if (fresh && expired(fresh)) throw fail(409, 'La cotización ya venció. Pide a la empresa que te envíe una nueva.');
    throw fail(409, 'La cotización ya tiene una respuesta');
  }
  return approve ? createOrderFrom(updated) : updated;
};

// Aprobación de la oficina (el cliente aprobó por teléfono o en persona).
const approveQuote = async (req, res) => {
  try {
    const quote = await findOwn(req);
    const done = await decide(quote, { approve: true, name: req.user.name, note: req.body.note, via: 'oficina' });
    await audit(req, 'cotizacion.aprobar', `Marcó como aprobada la cotización #${quote.number}`, { entityId: quote._id });
    res.status(200).json(view(await populate(Quote.findOne({ ...companyScope(req), _id: done._id }))));
  } catch (error) {
    reply(res, error, 'No se pudo aprobar la cotización');
  }
};

// Si la orden no se alcanzó a crear al aprobar (un fallo de la base), se crea aquí.
const convertQuote = async (req, res) => {
  try {
    const quote = await findOwn(req);
    if (quote.status !== 'aprobada') throw fail(409, 'Solo una cotización aprobada se convierte en orden');
    const done = quote.workOrder ? quote : await createOrderFrom(quote);
    res.status(200).json(view(await populate(Quote.findOne({ ...companyScope(req), _id: done._id }))));
  } catch (error) {
    reply(res, error, 'No se pudo crear la orden');
  }
};

// ---- La cotización pública (sin sesión, con la llave del enlace) -------------------------------------------------------

const byToken = (token) => (/^[A-Za-z0-9_-]{20,40}$/.test(String(token || ''))
  ? Quote.findOne({ publicToken: token, status: { $ne: 'borrador' } }).setOptions({ allowCrossTenant: true })
  : null);

const loadPublic = async (token) => {
  const quote = await byToken(token);
  if (!quote) throw fail(404, 'Esta cotización no existe o ya no está disponible');
  const company = await Company.findById(quote.tenant);
  if (!company || company.status === 'suspendida') throw fail(404, 'Esta cotización no existe o ya no está disponible');
  return { quote, company };
};

const publicView = async (quote, company) => {
  const client = await Client.findOne({ tenant: quote.tenant, _id: quote.client }).select('name company');
  return {
    company: { id: company._id, name: company.name, lang: company.lang || 'es', branding: publicBranding(company) },
    quote: {
      number: quote.number,
      title: quote.title,
      notes: quote.notes,
      items: quote.items.map((i) => ({ description: i.description, qty: i.qty, unitPrice: i.unitPrice, taxRate: i.taxRate, amount: i.amount, tax: i.tax })),
      currency: quote.currency,
      subtotal: quote.subtotal,
      tax: quote.tax,
      total: quote.total,
      validUntil: quote.validUntil,
      sentAt: quote.sentAt,
      status: shownStatus(quote),
      client: client ? { name: client.name, company: client.company || '' } : null,
      decidedAt: quote.decidedAt,
      decidedBy: quote.decidedBy,
      // El cobro: cuánto (si ya se fijó), si está pagada y si se puede pagar en línea ahora mismo.
      payment: {
        status: quote.payment ? quote.payment.status : 'pendiente',
        due: quote.payment && quote.payment.due ? quote.payment.due
          : (wompi.connected(company) ? Math.round((quote.total * (company.wompi.depositPercent || 100)) / 100) : null),
        paidAt: quote.payment ? quote.payment.paidAt : null,
        online: quote.status === 'aprobada' && wompi.connected(company) && !(quote.payment && quote.payment.status === 'pagado'),
        txStatus: quote.payment ? quote.payment.txStatus : '',
      },
    },
  };
};

const publicQuote = async (req, res) => {
  try {
    const { quote, company } = await loadPublic(req.params.token);
    res.set('Cache-Control', 'no-store');
    res.status(200).json(await publicView(quote, company));
  } catch (error) {
    reply(res, error, 'No se pudo cargar la cotización');
  }
};

const publicDecision = (approve) => async (req, res) => {
  try {
    const { quote, company } = await loadPublic(req.params.token);
    const name = String(req.body.name || '').trim();
    const done = await decide(quote, { approve, name, note: String(req.body.note || '').trim().slice(0, 500), via: 'cliente' });
    try {
      await AuditLog.create({
        tenant: quote.tenant, user: null, userName: `Cliente: ${name}`, action: approve ? 'cotizacion.aprobada' : 'cotizacion.rechazada',
        summary: `${name} ${approve ? 'aprobó' : 'rechazó'} la cotización #${quote.number} desde el enlace`, entityId: quote._id,
      });
    } catch {
      // la bitácora es secundaria
    }
    res.status(200).json(await publicView(done, company));
  } catch (error) {
    reply(res, error, 'No se pudo registrar tu respuesta');
  }
};

// A dónde vuelve el cliente después de pagar: APP_URL si está, si no la dirección por la que entró.
const appUrl = (req) => (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');

// Pagar en línea una cotización aprobada: el enlace firmado al checkout de Wompi por lo que se cobra (todo o anticipo).
const publicCheckout = async (req, res) => {
  try {
    const { quote } = await loadPublic(req.params.token);
    const company = await Company.findById(quote.tenant).select('+wompi.integritySealed');
    if (quote.status !== 'aprobada') throw fail(409, 'Primero aprueba la cotización');
    if (!wompi.connected(company)) throw fail(409, 'Esta empresa no recibe pagos en línea');
    if (quote.payment && quote.payment.status === 'pagado') throw fail(409, 'Esta cotización ya está pagada');
    const due = await dueFor(quote, company);
    const url = wompi.checkoutUrl(company, quote, due, `${appUrl(req)}/cotizacion/${quote.publicToken}`);
    if (!url) throw fail(409, 'La empresa debe conectar Wompi de nuevo para recibir pagos');
    res.status(200).json({ checkoutUrl: url, due });
  } catch (error) {
    reply(res, error, 'No se pudo preparar el pago');
  }
};

// El cliente vuelve del checkout con ?id=<transacción>: se consulta en Wompi y se aplica (además del evento firmado).
const publicPaymentStatus = async (req, res) => {
  try {
    const { quote, company } = await loadPublic(req.params.token);
    let current = quote;
    if (wompi.connected(company) && req.query.id) {
      const tx = await wompi.fetchTransaction(company, String(req.query.id));
      if (tx && wompi.quoteIdFrom(tx.reference) === String(quote._id)) current = (await applyTransaction(company, tx)) || quote;
    }
    res.set('Cache-Control', 'no-store');
    res.status(200).json(await publicView(current, company));
  } catch (error) {
    reply(res, error, 'No se pudo consultar el pago');
  }
};

// La oficina marca el pago a mano (efectivo, transferencia) o lo devuelve a pendiente si se marcó por error. Un pago
// confirmado por Wompi no se toca desde aquí.
const setPayment = async (req, res) => {
  try {
    const quote = await findQuote(req);
    if (quote.status !== 'aprobada') throw fail(409, 'Solo se cobra una cotización aprobada');
    if (quote.payment && quote.payment.method === 'wompi' && quote.payment.status === 'pagado') throw fail(409, 'Este pago lo confirmó Wompi: no se cambia a mano');
    const paid = req.body.status === 'pagado';
    await Quote.updateOne({ ...companyScope(req), _id: quote._id }, { $set: {
      'payment.status': paid ? 'pagado' : 'pendiente', 'payment.method': paid ? 'oficina' : '', 'payment.paidAt': paid ? new Date() : null,
      ...(paid && !(quote.payment && quote.payment.due) ? { 'payment.due': quote.total } : {}),
    } });
    await audit(req, 'cotizacion.pago', `Marcó la cotización #${quote.number} como ${paid ? 'pagada' : 'pendiente de pago'}`, { entityId: quote._id });
    res.status(200).json(view(await populate(Quote.findOne({ ...companyScope(req), _id: quote._id }))));
  } catch (error) {
    reply(res, error, 'No se pudo guardar el pago');
  }
};

module.exports = {
  publicCheckout, publicPaymentStatus, setPayment,
  listQuotes, getQuote, createQuote, updateQuote, deleteQuote, sendQuote, reopenQuote, approveQuote, convertQuote,
  publicQuote, publicApprove: publicDecision(true), publicReject: publicDecision(false),
  endOfDay,
};
