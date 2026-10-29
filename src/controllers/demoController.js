const DemoRequest = require('../models/DemoRequest');
const { LEAD_TOKEN } = DemoRequest;
const { channelOf, REF } = require('../utils/channel');

const fields = 'company name email phone lang market product technicians message source channel referral campaign leadToken kind consentAt status receivedAt createdAt';

// `l`: la ficha del chat con GABY (enlace de prueba). Uno que no tenga la forma esperada se ignora y la solicitud sigue:
// un enlace mal copiado nunca debe impedir crear la prueba.
// El mercado: la página en inglés (/en/) siempre es de Estados Unidos; la de /es-us/ manda market: 'us' en español y la
// de /es-mx/, market: 'mx'. Cualquier otra cosa es Colombia.
const marketOf = (b) => {
  if (b && (b.lang === 'en' || b.market === 'us')) return 'us';
  if (b && b.market === 'mx') return 'mx';
  return 'co';
};

const campaignOf = (value) => {
  const c = String(value || '').trim().toLowerCase().slice(0, 60);
  return /^[a-z0-9_-]+$/.test(c) ? c : null;
};

const leadTokenOf = (value) => (typeof value === 'string' && LEAD_TOKEN.test(value.trim()) ? value.trim() : null);

// POST /api/public/demo — el formulario de la página de ventas. `website` es una trampa para bots: los humanos no lo
// ven; si viene lleno se responde igual que siempre, sin guardar nada.
const requestDemo = async (req, res) => {
  try {
    if (req.body.website) return res.status(201).json({ ok: true });
    const { company, name, email, phone = '', product = 'servicios', message = '', kind = 'demo' } = req.body;
    // Los técnicos solo cuentan para Servicios (se cobra por técnico); Pedidos se cobra por tienda.
    const technicians = product === 'pedidos' ? null : (req.body.technicians ?? null);
    // «Empieza gratis»: GABY crea la cuenta sola y envía el acceso al email, así que debe aceptar términos y privacidad.
    if (kind === 'prueba' && req.body.consent !== true) {
      return res.status(400).json({ message: req.body.lang === 'en'
        ? 'To start your trial, please accept the terms and the privacy policy'
        : 'Para empezar tu prueba acepta los términos y la política de privacidad' });
    }
    const lang = req.body.lang === 'en' ? 'en' : 'es';
    const market = marketOf(req.body);
    await DemoRequest.create({ company, name, email, phone, lang, market, product: product || 'servicios', technicians, message, source: req.body.source === 'chat' ? 'chat' : 'web',
      kind: kind || 'demo', channel: channelOf({ utm: req.body.utm, ref: req.body.ref, referral: req.body.referral }),
      referral: REF.test(String(req.body.referral || '').toLowerCase()) ? String(req.body.referral).toLowerCase() : null,
      campaign: campaignOf(req.body.campaign), leadToken: leadTokenOf(req.body.l), consentAt: kind === 'prueba' ? new Date() : null });
    return res.status(201).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ message: req.body.lang === 'en' ? 'We could not save your request. Email us at contacto@novaworkorder.com.'
      : 'No pudimos registrar tu solicitud. Escríbenos a contacto@novaworkorder.com.' });
  }
};

// GET /api/platform/demo-requests?status=nueva — para GABY (llave de plataforma).
const listDemoRequests = async (req, res) => {
  try {
    const status = ['nueva', 'recibida'].includes(req.query.status) ? req.query.status : 'nueva';
    const items = await DemoRequest.find({ status }).select(fields).sort({ createdAt: 1 }).limit(50);
    res.status(200).json({ items });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error al listar las solicitudes' });
  }
};

// POST /api/platform/demo-requests/:id/ack — GABY ya la convirtió en prospecto.
const ackDemoRequest = async (req, res) => {
  try {
    const item = await DemoRequest.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Solicitud no encontrada' });
    if (item.status !== 'recibida') {
      item.status = 'recibida';
      item.receivedAt = new Date();
      await item.save();
    }
    res.status(200).json({ _id: item._id, status: item.status, receivedAt: item.receivedAt });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error al confirmar la solicitud' });
  }
};

module.exports = { requestDemo, listDemoRequests, ackDemoRequest, marketOf };
