const crypto = require('crypto');
const Company = require('../models/Company');
const User = require('../models/User');
const WorkOrder = require('../models/WorkOrder');
const Quote = require('../models/Quote');
const { temporaryPassword } = require('../utils/passwords');

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
const usage = async (company) => {
  const tenant = company._id;
  const [technicians, users, workOrders, admin, completedOrders, reportsShared, quotesSent] = await Promise.all([
    User.countDocuments({ tenant, role: 'tecnico', active: true }),
    User.countDocuments({ tenant, active: true }),
    WorkOrder.countDocuments({ tenant }),
    User.findOne({ tenant, email: company.contactEmail }).select('mustChangePassword'),
    WorkOrder.countDocuments({ tenant, status: 'completada' }),
    WorkOrder.countDocuments({ tenant, reportToken: { $type: 'string' } }),
    Quote.countDocuments({ tenant, sentAt: { $ne: null } }),
  ]);
  return { technicians, users, workOrders, adminEntered: Boolean(admin && !admin.mustChangePassword), completedOrders, reportsShared, quotesSent };
};

const view = async (company) => ({
  _id: company._id,
  name: company.name,
  slug: company.slug,
  status: company.status,
  maxTechnicians: company.maxTechnicians,
  contactEmail: company.contactEmail,
  lang: company.lang || 'es',
  createdAt: company.createdAt,
  usage: await usage(company),
});

const createCompany = async (req, res) => {
  try {
    const { name, adminName, adminEmail, maxTechnicians = null, status = 'activa', lang = 'es' } = req.body;
    const email = String(adminEmail).toLowerCase();

    if (await User.findOne({ email })) {
      return res.status(409).json({ message: 'Ya existe un usuario con ese email' });
    }

    let slug = slugify(name);
    if (await Company.findOne({ slug })) slug = `${slug}-${crypto.randomBytes(3).toString('hex')}`;

    const company = await Company.create({ name, slug, status, maxTechnicians, contactEmail: email, lang });
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

    const { name, status, maxTechnicians, lang } = req.body;
    if (name !== undefined) company.name = name;
    if (lang !== undefined) company.lang = lang;
    if (status !== undefined) company.status = status;
    if (maxTechnicians !== undefined) company.maxTechnicians = maxTechnicians;
    await company.save();

    res.status(200).json(await view(company));
  } catch (error) {
    res.status(error.name === 'ValidationError' ? 400 : 500).json({ message: error.message || 'Error al actualizar la empresa' });
  }
};

module.exports = { createCompany, listCompanies, getCompany, updateCompany, slugify };
