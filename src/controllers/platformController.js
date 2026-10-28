const crypto = require('crypto');
const Company = require('../models/Company');
const User = require('../models/User');
const WorkOrder = require('../models/WorkOrder');
const Quote = require('../models/Quote');
const { temporaryPassword } = require('../utils/passwords');
const { marketOf } = require('../utils/money');

// API de plataforma: la usa GABY para entregar el producto cuando un cliente paga (crear la empresa y su
// administrador), ajustar el plan (técnicos incluidos) y suspender o reactivar por pagos.

const slugify = (name) => String(name).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'empresa';

// Uso de la cuenta: GABY lo mira cada día durante la prueba para avisarle a NOVA a quién llamar (sin técnicos, sin
// órdenes, o el administrador nunca entró: sigue con la contraseña temporal) y en qué paso va (órdenes completadas,
// informes compartidos y cotizaciones enviadas). Los campos solo se agregan: GABY lee los que ya existían.
// `reportsShared`: órdenes cuyo informe tiene enlace para el cliente («Compartir informe»); la app no sabe si el
// enlace de verdad se envió por WhatsApp, pero sin enlace no hay informe que mandar.
// `quotesSent`: cotizaciones enviadas alguna vez al cliente (las que pasaron de borrador a enviada).
// Para acompañar la prueba de 7 días (solo fechas en ISO UTC y conteos, nada de datos de personas):
// `lastLoginAt`: último ingreso de cualquier usuario de la empresa (se guarda en la empresa al iniciar sesión).
// `lastActivityAt`: lo más reciente entre la última orden creada o cambiada (el informe de servicio, sus fotos, la firma
// y el enlace viven en la orden) y la última cotización creada o cambiada. null si no hay ninguna.
// `ordersLast24h`: órdenes creadas en las últimas 24 horas.
// `activeTechnicians7d`: técnicos distintos con alguna orden iniciada o completada en los últimos 7 días (el técnico
// es quien tiene la orden asignada).
// Cada consulta va por la empresa y usa un índice que empieza por `tenant`: nada recorre órdenes de otras empresas.
const HOUR_MS = 60 * 60 * 1000;
const iso = (date) => (date ? new Date(date).toISOString() : null);

const usage = async (company) => {
  const tenant = company._id;
  const now = Date.now();
  const since24h = new Date(now - 24 * HOUR_MS);
  const since7d = new Date(now - 7 * 24 * HOUR_MS);
  const [technicians, users, workOrders, admin, completedOrders, reportsShared, quotesSent,
    lastOrder, lastQuote, ordersLast24h, workedBy] = await Promise.all([
    User.countDocuments({ tenant, role: 'tecnico', active: true }),
    User.countDocuments({ tenant, active: true }),
    WorkOrder.countDocuments({ tenant }),
    User.findOne({ tenant, email: company.contactEmail }).select('mustChangePassword'),
    WorkOrder.countDocuments({ tenant, status: 'completada' }),
    WorkOrder.countDocuments({ tenant, reportToken: { $type: 'string' } }),
    Quote.countDocuments({ tenant, sentAt: { $ne: null } }),
    WorkOrder.findOne({ tenant }).sort({ updatedAt: -1 }).select('updatedAt').lean(),
    Quote.findOne({ tenant }).sort({ updatedAt: -1 }).select('updatedAt').lean(),
    WorkOrder.countDocuments({ tenant, createdAt: { $gte: since24h } }),
    WorkOrder.distinct('assignedTo', { tenant, assignedTo: { $ne: null },
      $or: [{ tenant, startedAt: { $gte: since7d } }, { tenant, completedAt: { $gte: since7d } }] }),
  ]);
  const activeTechnicians7d = workedBy.length
    ? await User.countDocuments({ tenant, _id: { $in: workedBy }, role: 'tecnico' })
    : 0;
  const last = Math.max(lastOrder ? new Date(lastOrder.updatedAt).getTime() : 0, lastQuote ? new Date(lastQuote.updatedAt).getTime() : 0);
  return {
    technicians, users, workOrders, adminEntered: Boolean(admin && !admin.mustChangePassword), completedOrders, reportsShared, quotesSent,
    lastLoginAt: iso(company.lastLoginAt),
    lastActivityAt: last ? iso(last) : null,
    ordersLast24h,
    activeTechnicians7d,
  };
};

const view = async (company) => ({
  _id: company._id,
  name: company.name,
  slug: company.slug,
  status: company.status,
  maxTechnicians: company.maxTechnicians,
  contactEmail: company.contactEmail,
  lang: company.lang || 'es',
  market: marketOf(company),
  createdAt: company.createdAt,
  usage: await usage(company),
});

const createCompany = async (req, res) => {
  try {
    const { name, adminName, adminEmail, maxTechnicians = null, status = 'activa', lang = 'es' } = req.body;
    // El mercado va aparte del idioma (una empresa hispana de EE. UU.: es + us); en inglés siempre es us.
    const market = lang === 'en' || req.body.market === 'us' ? 'us' : 'co';
    const email = String(adminEmail).toLowerCase();

    if (await User.findOne({ email })) {
      return res.status(409).json({ message: 'Ya existe un usuario con ese email' });
    }

    let slug = slugify(name);
    if (await Company.findOne({ slug })) slug = `${slug}-${crypto.randomBytes(3).toString('hex')}`;

    const company = await Company.create({ name, slug, status, maxTechnicians, contactEmail: email, lang, market });
    const password = temporaryPassword();
    try {
      await User.create({ name: adminName, email, password, role: 'admin', tenant: company._id, mustChangePassword: true });
    } catch (error) {
      await company.deleteOne();                     // sin administrador no queda una empresa huérfana
      throw error;
    }

    // La contraseña temporal sale una sola vez: GABY se la entrega al cliente y él la cambia al entrar.
    res.status(201).json({ company: await view(company), admin: { email, temporaryPassword: password } });
  } catch (error) {
    res.status(error.name === 'ValidationError' ? 400 : 500).json({ message: error.message || 'Error al crear la empresa' });
  }
};

const listCompanies = async (req, res) => {
  try {
    const companies = await Company.find().sort({ createdAt: -1 }).limit(500);
    res.status(200).json({ items: await Promise.all(companies.map(view)) });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error al listar las empresas' });
  }
};

const getCompany = async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ message: 'Empresa no encontrada' });
    res.status(200).json(await view(company));
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error al obtener la empresa' });
  }
};

const updateCompany = async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ message: 'Empresa no encontrada' });

    const { name, status, maxTechnicians, lang, market } = req.body;
    if (name !== undefined) company.name = name;
    if (lang !== undefined) company.lang = lang;
    if (market !== undefined) company.market = market;
    if (status !== undefined) company.status = status;
    if (maxTechnicians !== undefined) company.maxTechnicians = maxTechnicians;
    await company.save();

    res.status(200).json(await view(company));
  } catch (error) {
    res.status(error.name === 'ValidationError' ? 400 : 500).json({ message: error.message || 'Error al actualizar la empresa' });
  }
};

module.exports = { createCompany, listCompanies, getCompany, updateCompany, slugify };
