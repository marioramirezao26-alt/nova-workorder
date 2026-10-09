const DemoRequest = require('../models/DemoRequest');
const { channelOf, REF } = require('../utils/channel');

const fields = 'company name email phone product technicians message source channel referral kind consentAt status receivedAt createdAt';

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
      return res.status(400).json({ message: 'Para empezar tu prueba acepta los términos y la política de privacidad' });
    }
    await DemoRequest.create({ company, name, email, phone, product: product || 'servicios', technicians, message, source: 'web',
      kind: kind || 'demo', channel: channelOf({ utm: req.body.utm, ref: req.body.ref, referral: req.body.referral }),
      referral: REF.test(String(req.body.referral || '').toLowerCase()) ? String(req.body.referral).toLowerCase() : null, consentAt: kind === 'prueba' ? new Date() : null });
    return res.status(201).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ message: 'No pudimos registrar tu solicitud. Escríbenos a contacto@novaworkorder.com.' });
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

module.exports = { requestDemo, listDemoRequests, ackDemoRequest };
