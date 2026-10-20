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
const factus = require('../services/factus');
const { dueFor, notePending, pendingNow, statusFor, UNPAID } = require('../services/quotePayments');

// Cotizaciones (Mejora 3): se arman en borrador, se envían con un enlace y el cliente las aprueba o rechaza sin cuenta.
// Al aprobarse se crea la orden de trabajo con el cliente y lo cotizado.

const DEFAULT_VALID_DAYS = 15;
const fail = (status, message) => Object.assign(new Error(message), { statusCode: status });
const reply = (res, error, fallback) => res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : fallback });

// «Válida hasta el 30 de octubre» = hasta el final de ese día en Colombia (el servidor corre en UTC).
const endOfDay = (day) => new Date(`${day}T23:59:59.999-05:00`);
const defaultValidUntil = () => endOfDay(colombiaDay(new Date(Date.now() + DEFAULT_VALID_DAYS * 86400000)));
const expired = (q) => q.status === 'enviada' && q.validUntil < new Date();
// Solo la factura de producción es definitiva; la de pruebas no tiene validez fiscal ni impide facturar en producción.
// Una factura de antes de guardar el ambiente (sin env) se reconoce por su número: SETP es el prefijo del set de pruebas
// de la DIAN (habilitación); con otro prefijo es de producción.
const invoiceEnv = (inv) => inv.env || (inv.number && !/^SETP/i.test(inv.number) ? 'produccion' : 'pruebas');
const testInvoice = (inv) => Boolean(inv && inv.cufe && invoiceEnv(inv) !== 'produccion');
const shownStatus = (q) => (expired(q) ? 'vencida' : q.status);

// Lo que se cobra en línea (el fijado, o el que se fijaría hoy) y si el cliente puede pagarlo ahora mismo: aprobada, en
// pesos, con Wompi, por cobrar, con valor, y sin un intento de Wompi en curso (para no cobrarle dos veces).
const onlinePayment = (quote, company) => {
  const p = quote.payment || {};
  const chargeable = wompi.chargeable(company, quote);
  const due = p.due || (chargeable ? Math.round((quote.total * (company.wompi.depositPercent || 100)) / 100) : null);
  return { due, online: quote.status === 'aprobada' && chargeable && (p.status || 'pendiente') === 'pendiente' && !pendingNow(p) && due > 0 };
};

// La llave del enlace (con ella se aprueba sin sesión) solo la reciben el administrador, quien armó la cotización y el
// usuario cliente de la ficha; a otro técnico de la empresa no le llega.
// Una factura de pruebas (sin validez fiscal) solo la ve el administrador.
const view = (q, req) => {
  const o = typeof q.toObject === 'function' ? q.toObject() : { ...q };
  const own = ['admin', 'cliente'].includes(req.user.role) || String((o.createdBy && o.createdBy._id) || o.createdBy) === String(req.user._id);
  if (!own) delete o.publicToken;
  if (o.invoice && o.invoice.cufe && !o.invoice.env) o.invoice = { ...o.invoice, env: invoiceEnv(o.invoice) };
  if (testInvoice(o.invoice) && req.user.role !== 'admin') delete o.invoice;
  return { ...o, status: shownStatus(q), expired: expired(q), payment: { ...(o.payment || {}), online: onlinePayment(q, req.company).online } };
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
    qty: Math.round(Number(i && i.qty) * 100) / 100,          // dos decimales, y se valida ya redondeada (0,004 queda en 0)
    unitPrice: Number(i && i.unitPrice),
    taxRate: i && i.taxRate !== undefined && i.taxRate !== '' ? Number(i.taxRate) : (currency === 'COP' ? 19 : 0),
    excluded: currency === 'COP' && Boolean(i && i.excluded),   // excluido de IVA: va al 0 %
  })).map((i) => (i.excluded ? { ...i, taxRate: 0 } : i));
  if (!items.length || items.length > 50) throw fail(400, 'La cotización lleva entre 1 y 50 renglones');
  items.forEach((i, n) => {
    if (!i.description) throw fail(400, `Escribe la descripción del renglón ${n + 1}`);
    if (!(Number.isFinite(i.qty) && i.qty >= 0.01 && i.qty <= 100000)) throw fail(400, `Cantidad inválida en el renglón ${n + 1}`);
    if (!(Number.isFinite(i.unitPrice) && i.unitPrice >= 0 && i.unitPrice <= 10000000000)) throw fail(400, `Precio inválido en el renglón ${n + 1}`);
    if (!(Number.isFinite(i.taxRate) && i.taxRate >= 0 && i.taxRate <= 30)) throw fail(400, `Impuesto inválido en el renglón ${n + 1}`);
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
    res.status(200).json({ items: items.map((q) => view(q, req)) });
  } catch (error) {
    reply(res, error, 'No se pudieron cargar las cotizaciones');
  }
};

const getQuote = async (req, res) => {
  try {
    const quote = await findQuote(req);
    res.status(200).json(view(await populate(Quote.findOne({ ...companyScope(req), _id: quote._id })), req));
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
    res.status(201).json(view(await populate(Quote.findOne({ ...companyScope(req), _id: quote._id })), req));
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
    res.status(200).json(view(await populate(Quote.findOne({ ...companyScope(req), _id: quote._id })), req));
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
    res.status(200).json({ path: `/cotizacion/${quote.publicToken}`, quote: view(await populate(Quote.findOne({ ...companyScope(req), _id: quote._id })), req) });
  } catch (error) {
    reply(res, error, 'No se pudo enviar la cotización');
  }
};

// Volver a borrador (para corregirla o reenviarla después de un rechazo o de vencerse). La llave se borra: al reenviarla
// sale otra, y el enlace anterior (o una página abierta desde antes) ya no la muestra ni la aprueba con lo que cambió.
const reopenQuote = async (req, res) => {
  try {
    const quote = await findOwn(req);
    if (!['enviada', 'rechazada'].includes(quote.status)) throw fail(409, 'Solo una cotización enviada o rechazada vuelve a borrador');
    const updated = await Quote.findOneAndUpdate(
      { ...companyScope(req), _id: quote._id, status: quote.status },
      { $set: { status: 'borrador', decidedAt: null, decidedBy: '', decidedVia: '', decisionNote: '' }, $unset: { publicToken: 1 } },
      { new: true }
    );
    if (!updated) throw fail(409, 'La cotización cambió mientras tanto. Actualiza la lista.');
    await audit(req, 'cotizacion.reabrir', `Volvió a borrador la cotización #${quote.number}`, { entityId: quote._id });
    res.status(200).json(view(await populate(Quote.findOne({ ...companyScope(req), _id: quote._id })), req));
  } catch (error) {
    reply(res, error, 'No se pudo volver a borrador');
  }
};

// La orden de trabajo que sale de una cotización aprobada (una sola: si ya existe, no se crea otra), con el título en el
// idioma de la empresa (lo ven el técnico, los reportes y el webhook). `created` dice si la creó esta petición.
const createOrderFrom = async (quote) => {
  const client = await Client.findOne({ tenant: quote.tenant, _id: quote.client });
  const company = await Company.findById(quote.tenant).select('lang');
  const en = Boolean(company && company.lang === 'en');
  const lines = quote.items.map((i) => `- ${i.qty} × ${i.description}`).join('\n');
  const order = await WorkOrder.create({
    tenant: quote.tenant,
    title: `${en ? 'Quote' : 'Cotización'} #${quote.number}: ${quote.title}`.slice(0, 200),
    description: `${en ? `Work approved in quote #${quote.number}.` : `Trabajo aprobado en la cotización #${quote.number}.`}\n${lines}`.slice(0, 2000),
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
    return { quote: await Quote.findOne({ tenant: quote.tenant, _id: quote._id }), created: false };
  }
  const populated = await WorkOrder.findOne({ tenant: quote.tenant, _id: order._id }).populate('client', 'name').populate('assignedTo', 'name');
  await webhooks.emit(quote.tenant, 'orden.creada', webhooks.orderPayload(populated));
  return { quote: linked, created: true };
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
  return approve ? (await createOrderFrom(updated)).quote : updated;
};

// Aprobación de la oficina (el cliente aprobó por teléfono o en persona).
const approveQuote = async (req, res) => {
  try {
    const quote = await findOwn(req);
    const done = await decide(quote, { approve: true, name: req.user.name, note: req.body.note, via: 'oficina' });
    await audit(req, 'cotizacion.aprobar', `Marcó como aprobada la cotización #${quote.number}`, { entityId: quote._id });
    res.status(200).json(view(await populate(Quote.findOne({ ...companyScope(req), _id: done._id })), req));
  } catch (error) {
    reply(res, error, 'No se pudo aprobar la cotización');
  }
};

// Si la orden no se alcanzó a crear al aprobar (un fallo de la base) o se borró después, se crea aquí.
const convertQuote = async (req, res) => {
  try {
    const quote = await findOwn(req);
    if (quote.status !== 'aprobada') throw fail(409, 'Solo una cotización aprobada se convierte en orden');
    if (quote.workOrder && !(await WorkOrder.exists({ tenant: quote.tenant, _id: quote.workOrder }))) {
      // la orden enlazada ya no existe (se borró sin desligarla): se desliga y se crea otra
      await Quote.updateOne({ tenant: quote.tenant, _id: quote._id, workOrder: quote.workOrder }, { $set: { workOrder: null } });
      quote.workOrder = null;
    }
    // Solo anota la petición que enlazó la orden: con dos «Crear la orden» a la vez, la otra no la creó.
    const { quote: done, created } = quote.workOrder ? { quote, created: false } : await createOrderFrom(quote);
    if (created) {
      await audit(req, 'cotizacion.convertir', `Creó la orden de la cotización #${quote.number}`, { entityId: quote._id, meta: { workOrder: String(done.workOrder) } });
    }
    res.status(200).json(view(await populate(Quote.findOne({ ...companyScope(req), _id: done._id })), req));
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
      items: quote.items.map((i) => ({ description: i.description, qty: i.qty, unitPrice: i.unitPrice, taxRate: i.taxRate, excluded: Boolean(i.excluded), amount: i.amount, tax: i.tax })),
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
      // La factura electrónica de producción, cuando ya tiene CUFE (para descargarla); la de pruebas no se muestra.
      invoice: quote.invoice && quote.invoice.cufe && !testInvoice(quote.invoice)
        ? { number: quote.invoice.number, publicUrl: quote.invoice.publicUrl, validated: quote.invoice.validated !== false } : null,
      // El cobro: cuánto se cobra en línea, lo pagado y el saldo, si se puede pagar ahora mismo y si hay un intento de
      // Wompi en curso; «test» si se pagó con las llaves de pruebas.
      payment: {
        status: (quote.payment && quote.payment.status) || 'pendiente',
        ...onlinePayment(quote, company),
        amountPaid: (quote.payment && quote.payment.amountPaid) || 0,
        balance: quote.total - ((quote.payment && quote.payment.amountPaid) || 0),
        paidAt: quote.payment ? quote.payment.paidAt : null,
        pending: pendingNow(quote.payment),
        test: Boolean(quote.payment && quote.payment.test),
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
        // el nombre lo escribe quien tenga el enlace: la IP y el navegador quedan como constancia de dónde vino
        meta: { ip: req.ip || '', userAgent: String(req.get('user-agent') || '').slice(0, 300) },
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
// No se da otro mientras el último intento siga en curso en Wompi (menos de 30 minutos).
const publicCheckout = async (req, res) => {
  try {
    const { quote } = await loadPublic(req.params.token);
    const company = await Company.findById(quote.tenant).select('+wompi.integritySealed');
    const p = quote.payment || {};
    if (quote.status !== 'aprobada') throw fail(409, 'Primero aprueba la cotización');
    if (!wompi.connected(company)) throw fail(409, 'Esta empresa no recibe pagos en línea');
    if (!wompi.chargeable(company, quote)) throw fail(409, 'Esta cotización no se cobra en línea');
    if (p.status === 'pagado') throw fail(409, 'Esta cotización ya está pagada');
    if (p.status === 'anticipo') throw fail(409, 'El anticipo ya está pagado: el saldo se acuerda con la empresa');
    if (pendingNow(p)) throw fail(409, 'Wompi está procesando un pago de esta cotización. Espera unos minutos antes de intentarlo de nuevo.');
    const due = await dueFor(quote, company);
    if (!(due > 0)) throw fail(409, 'Esta cotización no se cobra en línea');
    const url = wompi.checkoutUrl(company, quote, due, `${appUrl(req)}/cotizacion/${quote.publicToken}`);
    if (!url) throw fail(409, 'La empresa debe conectar Wompi de nuevo para recibir pagos');
    res.status(200).json({ checkoutUrl: url, due });
  } catch (error) {
    reply(res, error, 'No se pudo preparar el pago');
  }
};

// El cliente vuelve del checkout con ?id=<transacción>: se consulta en Wompi para mostrarle cómo va («tx»), pero el pago
// solo lo cambia el evento firmado (la consulta es pública: Wompi devuelve la transacción de cualquier comercio). La
// página vuelve a consultar unas veces mientras llega el evento.
const publicPaymentStatus = async (req, res) => {
  try {
    const { quote, company } = await loadPublic(req.params.token);
    let current = quote;
    let tx = null;
    if (wompi.chargeable(company, quote) && req.query.id) {
      const found = await wompi.fetchTransaction(company, String(req.query.id));
      if (found && wompi.quoteIdFrom(found.reference) === String(quote._id)) {
        tx = { status: String(found.status || '').toUpperCase() };
        current = (await notePending(company, found)) || quote;
      }
    }
    res.set('Cache-Control', 'no-store');
    res.status(200).json({ ...(await publicView(current, company)), tx });
  } catch (error) {
    reply(res, error, 'No se pudo consultar el pago');
  }
};

// La oficina registra a mano lo que falta (efectivo, transferencia; con un anticipo de Wompi, el saldo) o quita lo que
// registró si fue por error. Lo que confirmó Wompi no se toca desde aquí, salvo un pago de prueba (no es plata real).
// No toca lo que se cobra en línea (payment.due): marcar y desmarcar deja el mismo anticipo.
const setPayment = async (req, res) => {
  try {
    const quote = await findQuote(req);
    if (quote.status !== 'aprobada') throw fail(409, 'Solo se cobra una cotización aprobada');
    const p = quote.payment;
    const paid = req.body.status === 'pagado';
    if (paid && p.status === 'pagado') throw fail(409, 'Esta cotización ya está pagada');
    // El saldo de un anticipo de prueba no es lo que falta (el anticipo no es plata real): primero se quita el de prueba.
    if (paid && p.test) throw fail(409, 'El anticipo es un pago de prueba: quítalo con «Marcar por cobrar» antes de registrar el pago');
    if (!paid && p.method === 'wompi' && !p.test && !p.officeAmount && p.status !== 'pendiente') throw fail(409, 'Este pago lo confirmó Wompi: no se cambia a mano');
    const online = p.method === 'wompi' && !p.test ? Math.max(0, (p.amountPaid || 0) - (p.officeAmount || 0)) : 0;   // lo que pagó Wompi
    const set = paid
      ? { 'payment.status': 'pagado', 'payment.amountPaid': quote.total, 'payment.balance': 0, 'payment.officeAmount': quote.total - online, 'payment.method': online ? 'wompi' : 'oficina', 'payment.paidAt': new Date() }
      : { 'payment.status': statusFor(online, quote.total), 'payment.amountPaid': online, 'payment.balance': quote.total - online, 'payment.officeAmount': 0, 'payment.method': online ? 'wompi' : '', ...(online ? {} : { 'payment.paidAt': null }) };
    if (!online) Object.assign(set, { 'payment.test': false, 'payment.methodType': '' });
    // Si la oficina quita lo suyo y Wompi sí cobró aparte (un pago real que llegó con la cotización ya marcada y quedó
    // como posible doble cobro), ese pasa a ser el pago: no se devuelve la plata buena ni se le cobra otra vez al cliente.
    const real = !paid && !online && (p.extra || []).find((e) => e.status === 'APPROVED' && !e.test);
    if (real) {
      const amount = Math.min(real.amount, quote.total);
      Object.assign(set, {
        'payment.status': statusFor(amount, quote.total), 'payment.amountPaid': amount, 'payment.balance': quote.total - amount,
        'payment.method': 'wompi', 'payment.methodType': real.methodType || '', 'payment.txId': real.txId, 'payment.txStatus': 'APPROVED',
        'payment.paidAt': real.at || new Date(),
      });
    }
    const same = p.status === 'pendiente' ? UNPAID : { 'payment.status': p.status };    // si Wompi la cambió mientras tanto, no se pisa
    const done = await Quote.updateOne(
      { ...companyScope(req), _id: quote._id, ...same, ...(real ? { 'payment.extra': { $elemMatch: { txId: real.txId, status: 'APPROVED' } } } : {}) },
      { $set: set, ...(real ? { $pull: { 'payment.extra': { txId: real.txId } } } : {}) }
    );
    if (!done.matchedCount) throw fail(409, 'La cotización cambió mientras tanto. Actualiza la lista.');
    await audit(req, 'cotizacion.pago', real ? `Quitó el pago que registró la oficina en la cotización #${quote.number}: queda el que cobró Wompi (${real.txId})`
      : paid && online ? `Registró como pagado el saldo de la cotización #${quote.number}`
        : `Marcó la cotización #${quote.number} como ${paid ? 'pagada' : 'pendiente de pago'}`, { entityId: quote._id });
    res.status(200).json(view(await populate(Quote.findOne({ ...companyScope(req), _id: quote._id })), req));
  } catch (error) {
    reply(res, error, 'No se pudo guardar el pago');
  }
};

// Factura electrónica DIAN de una cotización aprobada (en pesos): a consumidor final o a nombre del cliente (cédula,
// NIT…). Con la de producción no se vuelve a facturar; con una de pruebas tampoco mientras la empresa siga en pruebas,
// pero al pasar a producción se factura de verdad. Si falla, queda anotado el error para reintentar (Factus no duplica:
// misma referencia). Si Factus devuelve una factura ya hecha a otro comprador, se guarda la de Factus y se avisa.
const invoiceQuote = async (req, res) => {
  try {
    const quote = await findQuote(req);
    const current = () => populate(Quote.findOne({ ...companyScope(req), _id: quote._id }));
    if (quote.invoice && quote.invoice.cufe && !testInvoice(quote.invoice)) return res.status(200).json(view(await current(), req));
    if (quote.status !== 'aprobada') throw fail(409, 'Solo se factura una cotización aprobada');
    if (quote.currency !== 'COP') throw fail(409, 'Solo se facturan ante la DIAN cotizaciones en pesos');
    const company = await Company.findById(req.company._id).select('+factus.clientSecretSealed +factus.passwordSealed');
    if (!factus.connected(company)) throw fail(409, 'Conecta la factura electrónica en «Integraciones» primero');
    const env = company.factus.env === 'produccion' ? 'produccion' : 'pruebas';
    if (quote.invoice && quote.invoice.cufe && env === 'pruebas') return res.status(200).json(view(await current(), req));
    const buyer = factus.buyerFrom(req.body.buyer);
    let notice = '';
    try {
      const result = await factus.emit(company, factus.buildBill(company, quote, buyer));
      const buyerName = result.buyerName || buyer.names || buyer.company || '';
      const buyerId = result.buyerId || buyer.identification;
      if (buyerId !== buyer.identification) {
        notice = `Factus ya tenía la factura ${result.number} de esta cotización, a nombre de ${buyerName} (${buyerId}). Para cambiar el comprador hay que anularla con una nota crédito.`;
      }
      await Quote.updateOne({ ...companyScope(req), _id: quote._id }, { $set: { invoice: {
        number: result.number, cufe: result.cufe, publicUrl: result.publicUrl, qr: result.qr, env, validated: result.validated,
        buyerName, buyerId, at: new Date(), error: '',
      } } });
      await audit(req, 'cotizacion.factura', `Facturó la cotización #${quote.number} (${result.number}${env === 'pruebas' ? ', de pruebas' : ''})`, { entityId: quote._id, meta: { invoice: result.number, env } });
    } catch (error) {
      if (!(error instanceof factus.FactusError)) throw error;
      await Quote.updateOne({ ...companyScope(req), _id: quote._id }, { $set: { 'invoice.error': error.message, 'invoice.at': new Date() } });
      return res.status(502).json({ message: error.message });
    }
    return res.status(200).json({ ...view(await current(), req), ...(notice ? { notice } : {}) });
  } catch (error) {
    return reply(res, error, 'No se pudo facturar la cotización');
  }
};

module.exports = {
  invoiceQuote,
  publicCheckout, publicPaymentStatus, setPayment,
  listQuotes, getQuote, createQuote, updateQuote, deleteQuote, sendQuote, reopenQuote, approveQuote, convertQuote,
  publicQuote, publicApprove: publicDecision(true), publicReject: publicDecision(false),
  endOfDay,
};
