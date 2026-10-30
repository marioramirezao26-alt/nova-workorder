// Cuenta de demostración «Frío Ejemplo SAS (demostración)» para grabar los videos de NOVA Servicios (pedido P-014).
// Todo es inventado: empresa, personas, clientes, direcciones y teléfonos (300 000 00…), fotos generadas sin personas y
// una firma de trazo. La empresa queda con `demo: true`: GABY no la ve en la lista de cuentas (ni uso, ni cobros, ni
// crecimiento), pedida por su id sale marcada y no puede enviar recomendaciones a la página.
//
//   node src/scripts/crearDemoServicios.js              crea lo que falte (se puede repetir: no duplica nada)
//   node src/scripts/crearDemoServicios.js --reiniciar  borra todo lo de la cuenta y la deja como nueva (antes de grabar)
//
// La clave de los 4 usuarios: DEMO_PASSWORD (mínimo 8 caracteres) si está definida; si no, la primera vez se genera una
// y se imprime UNA sola vez (las siguientes no se toca). --nueva-clave genera e imprime otra.
const crypto = require('crypto');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const Company = require('../models/Company');
const User = require('../models/User');
const Client = require('../models/Client');
const WorkOrder = require('../models/WorkOrder');
const WorkOrderFile = require('../models/WorkOrderFile');
const ChecklistTemplate = require('../models/ChecklistTemplate');
const Quote = require('../models/Quote');
const AuditLog = require('../models/AuditLog');
const ApiKey = require('../models/ApiKey');
const Webhook = require('../models/Webhook');
const WebhookDelivery = require('../models/WebhookDelivery');
const Review = require('../models/Review');
const { temporaryPassword } = require('../utils/passwords');
const { totals } = require('../utils/money');
const { addDays, colombiaDay, endOfDay, startOfDay } = require('../utils/colombia');
const imagenes = require('../utils/imagenesEjemplo');

const SLUG = 'frio-ejemplo-demo';
const NAME = 'Frío Ejemplo SAS (demostración)';
const DOMAIN = 'frio-ejemplo.example';            // .example: dominio reservado, nunca es el correo de alguien
const COLORS = { primary: '#0e7490', accent: '#f59e0b' };

const USERS = [
  { key: 'admin', name: 'Valeria Ejemplo', email: `admin@${DOMAIN}`, role: 'admin', phone: '300 000 0010' },
  { key: 'andres', name: 'Andrés Ejemplo', email: `andres@${DOMAIN}`, role: 'tecnico', phone: '300 000 0011' },
  { key: 'camila', name: 'Camila Muestra', email: `camila@${DOMAIN}`, role: 'tecnico', phone: '300 000 0012' },
  { key: 'julian', name: 'Julián Prueba', email: `julian@${DOMAIN}`, role: 'tecnico', phone: '300 000 0013' },
];

const CLIENTS = [
  { key: 'espiga', name: 'Panadería La Espiga (ejemplo)', email: 'compras@espiga.example', phone: '300 000 0001', address: 'Calle 10 # 20-30, Bogotá' },
  { key: 'torre', name: 'Oficinas Torre Norte (ejemplo)', email: 'administracion@torrenorte.example', phone: '300 000 0002', address: 'Carrera 15 # 85-20, Bogotá' },
  { key: 'fogon', name: 'Restaurante El Fogón (ejemplo)', email: 'cocina@elfogon.example', phone: '300 000 0003', address: 'Avenida 68 # 24-40, Bogotá' },
  { key: 'farmacia', name: 'Farmacia Central (ejemplo)', email: 'contacto@farmaciacentral.example', phone: '300 000 0004', address: 'Calle 45 # 13-22, Bogotá' },
  { key: 'hotel', name: 'Hotel Mirador (ejemplo)', email: 'mantenimiento@hotelmirador.example', phone: '300 000 0005', address: 'Carrera 7 # 72-15, Bogotá' },
  { key: 'colegio', name: 'Colegio Los Pinos (ejemplo)', email: 'rectoria@lospinos.example', phone: '300 000 0006', address: 'Calle 127 # 52-60, Bogotá' },
  { key: 'canasta', name: 'Supermercado La Canasta (ejemplo)', email: 'compras@lacanasta.example', phone: '300 000 0007', address: 'Avenida Boyacá # 64-25, Bogotá' },
  { key: 'huellitas', name: 'Veterinaria Huellitas (ejemplo)', email: 'citas@huellitas.example', phone: '300 000 0008', address: 'Calle 53 # 27-18, Bogotá' },
];

const TEMPLATES = [
  { key: 'aire', name: 'Mantenimiento preventivo de aire acondicionado', items: [
    { label: 'Apagar y desconectar el equipo', required: true },
    { label: 'Limpiar o cambiar filtros', required: true },
    { label: 'Revisar presión del gas refrigerante', required: false },
    { label: 'Limpiar serpentín del condensador', required: false },
    { label: 'Revisar el drenaje', required: false },
    { label: 'Probar funcionamiento y temperatura de salida', required: true },
  ] },
  { key: 'nevera', name: 'Revisión de nevera o cuarto frío', items: [
    { label: 'Medir temperatura interna', required: true },
    { label: 'Revisar empaques de la puerta', required: false },
    { label: 'Limpiar condensador', required: false },
    { label: 'Revisar ruido del compresor', required: false },
    { label: 'Registrar temperatura final', required: true },
  ] },
];

// Órdenes: hace cuántos días se creó (hora de Colombia), estado, cliente, técnico, prioridad y lo del informe.
// fotos: «antes» y «después» generadas · firma: trazo de ejemplo · informe: enlace público para el cliente.
const ORDERS = [
  { title: 'Mantenimiento preventivo de 4 aires acondicionados', client: 'torre', tech: 'andres', days: 27, hour: 9, status: 'completada', priority: 'media', template: 'aire', fotos: true, firma: true, informe: true },
  { title: 'Cancelación: revisión de aire de recepción', client: 'hotel', tech: 'camila', days: 24, hour: 10, status: 'cancelada', priority: 'baja' },
  { title: 'Revisión de cuarto frío', client: 'fogon', tech: 'camila', days: 22, hour: 8, status: 'completada', priority: 'alta', template: 'nevera', fotos: true, firma: true, informe: true },
  { title: 'Instalación de aire tipo split 12.000 BTU', client: 'farmacia', tech: 'julian', days: 18, hour: 14, status: 'completada', priority: 'media', template: 'aire', firma: true },
  { title: 'Cambio de compresor de nevera exhibidora', client: 'canasta', tech: 'andres', days: 14, hour: 11, status: 'completada', priority: 'urgente', template: 'nevera', fotos: true, firma: true, informe: true },
  { title: 'Visita para cuarto frío nuevo (el cliente desistió)', client: 'canasta', tech: 'julian', days: 11, hour: 15, status: 'cancelada', priority: 'baja' },
  { title: 'Limpieza de ductos de ventilación', client: 'hotel', tech: 'camila', days: 9, hour: 9, status: 'completada', priority: 'media', template: 'aire' },
  { title: 'Recarga de gas refrigerante', client: 'espiga', tech: 'julian', days: 5, hour: 13, status: 'completada', priority: 'alta', template: 'aire', fotos: true, firma: true, informe: true },
  { title: 'Mantenimiento de nevera de vacunas', client: 'huellitas', tech: 'andres', days: 2, hour: 10, status: 'completada', priority: 'alta', template: 'nevera', firma: true },
  { title: 'Diagnóstico de aire que gotea en el salón 3', client: 'colegio', tech: 'camila', days: 3, hour: 8, status: 'en_proceso', priority: 'media', template: 'aire', fotos: 'antes' },
  { title: 'Revisión de vitrina refrigerada', client: 'espiga', tech: 'andres', days: 1, hour: 9, status: 'en_proceso', priority: 'alta', template: 'nevera' },
  { title: 'Mantenimiento trimestral de aires de habitaciones', client: 'hotel', tech: 'julian', days: 0, hour: 8, status: 'en_proceso', priority: 'media', template: 'aire' },
  { title: 'Visita técnica: la nevera no enfría', client: 'fogon', tech: 'camila', days: 2, hour: 16, status: 'pendiente', priority: 'urgente', due: 0 },
  { title: 'Instalación de termostato digital', client: 'torre', tech: 'andres', days: 1, hour: 11, status: 'pendiente', priority: 'media', due: 2, quote: 'aprobada' },
  { title: 'Revisión de ruido en la unidad condensadora', client: 'farmacia', tech: null, days: 0, hour: 9, status: 'pendiente', priority: 'baja', due: 4 },
  { title: 'Mantenimiento de aire de la sala de sistemas', client: 'colegio', tech: 'julian', days: 0, hour: 10, status: 'pendiente', priority: 'media', due: 3 },
];

const DESCRIPTIONS = {
  aire: 'Limpieza de filtros, revisión de gas y prueba de funcionamiento de los equipos.',
  nevera: 'Revisión de temperatura, empaques y compresor. Dejar registro de la temperatura final.',
  otro: 'Visita técnica para revisar el equipo y dejar recomendaciones al cliente.',
};

// Cotizaciones: aprobada (con su orden), enviada y esperando respuesta, y rechazada.
const QUOTES = [
  { status: 'aprobada', title: 'Instalación de termostato digital', client: 'torre', sent: 6, decided: 5,
    decidedBy: 'Administración Torre Norte (ejemplo)', note: 'Aprobada. Pueden venir el jueves en la mañana.',
    items: [{ description: 'Termostato digital programable', qty: 1, unitPrice: 280000 }, { description: 'Mano de obra de instalación', qty: 1, unitPrice: 150000 }] },
  { status: 'enviada', title: 'Mantenimiento anual de 6 aires acondicionados', client: 'hotel', sent: 2,
    items: [{ description: 'Mantenimiento preventivo por equipo', qty: 6, unitPrice: 120000 }, { description: 'Kit de filtros por equipo', qty: 6, unitPrice: 35000 }] },
  { status: 'rechazada', title: 'Cuarto frío modular de 2 × 2 m', client: 'canasta', sent: 12, decided: 10,
    decidedBy: 'Compras La Canasta (ejemplo)', note: 'Por ahora no está en el presupuesto.',
    items: [{ description: 'Cuarto frío modular 2 × 2 × 2,4 m con puerta', qty: 1, unitPrice: 9800000 }, { description: 'Instalación y puesta en marcha', qty: 1, unitPrice: 1500000 }] },
];

const flag = (name) => process.argv.includes(name);

// Una fecha de hace `days` días a la `hour` de Colombia (el servidor corre en UTC), nunca en el futuro.
const at = (days, hour, minutes = 0) => {
  const date = new Date(startOfDay(addDays(colombiaDay(), -days)).getTime() + (hour * 60 + minutes) * 60000);
  const limit = Date.now() - 15 * 60000;
  return date.getTime() > limit ? new Date(limit) : date;
};

// Cambia fechas directo en la base, sin que `timestamps` las pise (las órdenes son de los últimos 30 días).
const stamp = (Model, _id, fields) => Model.collection.updateOne({ _id }, { $set: fields });

// Borra todo lo de la empresa demo, menos la empresa y sus 4 usuarios (los que Luna haya creado en una grabación, sí).
const limpiar = async (tenant) => {
  const scope = { tenant };
  await Promise.all([WorkOrder, WorkOrderFile, Quote, Client, ChecklistTemplate, AuditLog, ApiKey, Webhook, WebhookDelivery, Review]
    .map((Model) => Model.deleteMany(scope)));
  await User.deleteMany({ tenant, email: { $nin: USERS.map((u) => u.email) } });
};

const crearDemoServicios = async ({ reiniciar = false, password = process.env.DEMO_PASSWORD || '', nuevaClave = false, log = console.log } = {}) => {
  if (password && password.length < 8) throw new Error('DEMO_PASSWORD debe tener al menos 8 caracteres');

  // Los correos de la demo no pueden ser de usuarios de otra empresa (no se le quita la cuenta a nadie).
  let company = await Company.findOne({ slug: SLUG });
  const ajenos = await User.find({ email: { $in: USERS.map((u) => u.email) }, ...(company ? { tenant: { $ne: company._id } } : {}) });
  if (ajenos.length) throw new Error(`El correo ${ajenos[0].email} ya es de otra empresa: no se toca`);
  if (!company) {
    const otra = await Company.findOne({ name: NAME });
    if (otra) throw new Error(`Ya hay una empresa llamada «${NAME}» con otro enlace: revísala antes de seguir`);
  }

  const settings = {
    name: NAME, slug: SLUG, status: 'activa', demo: true, contactEmail: USERS[0].email, lang: 'es', market: 'co',
    maxTechnicians: null, locationTracking: false, liveTracking: false, requireSignature: false,
    branding: { primary: COLORS.primary, accent: COLORS.accent, logo: imagenes.logo(COLORS.primary, COLORS.accent), logoType: 'image/png', updatedAt: new Date() },
  };
  if (!company) {
    company = await Company.create(settings);
    log(`Empresa creada: ${NAME}`);
  } else {
    Object.assign(company, settings);
    await company.save();
  }
  const tenant = company._id;

  if (reiniciar) {
    await limpiar(tenant);
    company.quoteSeq = 0;
    company.lastLoginAt = null;
    await company.save();
    log('Datos anteriores borrados (--reiniciar)');
  }

  // Usuarios: con DEMO_PASSWORD se les pone esa; sin ella, se genera una solo si falta alguno o con --nueva-clave.
  const existing = await User.find({ tenant, email: { $in: USERS.map((u) => u.email) } });
  let clave = password;
  let printed = false;
  if (!clave && (nuevaClave || existing.length < USERS.length)) {
    clave = temporaryPassword();
    printed = true;
  }
  const users = {};
  for (const data of USERS) {
    let user = existing.find((u) => u.email === data.email);
    if (!user) user = new User({ name: data.name, email: data.email, password: clave, role: data.role, tenant });
    else if (clave) user.password = clave;
    Object.assign(user, { name: data.name, role: data.role, phone: data.phone, tenant, client: null, active: true, mustChangePassword: false });
    await user.save();
    users[data.key] = user;
  }

  // Clientes y plantillas de checklist: se buscan por nombre y se crean si faltan.
  const clients = {};
  for (const data of CLIENTS) {
    const { key, ...fields } = data;
    clients[key] = await Client.findOneAndUpdate({ tenant, name: fields.name },
      { $set: { ...fields, company: fields.name, active: true, tenant } }, { upsert: true, new: true });
  }
  const templates = {};
  for (const data of TEMPLATES) {
    templates[data.key] = await ChecklistTemplate.findOneAndUpdate({ tenant, name: data.name },
      { $set: { items: data.items, active: true, tenant } }, { upsert: true, new: true });
  }

  // Órdenes: cada una se crea solo si no hay otra con el mismo título en la empresa.
  let createdOrders = 0;
  const orders = {};
  for (const [i, data] of ORDERS.entries()) {
    const found = await WorkOrder.findOne({ tenant, title: data.title });
    if (found) { orders[data.title] = found; continue; }
    const client = clients[data.client];
    const tech = data.tech ? users[data.tech] : null;
    const createdAt = at(data.days, data.hour, (i * 7) % 50);
    const template = data.template ? templates[data.template] : null;
    const done = data.status === 'completada';
    const startedAt = ['en_proceso', 'completada'].includes(data.status) ? new Date(createdAt.getTime() + 60 * 60000) : null;
    const completedAt = done ? new Date(Math.min(startedAt.getTime() + 150 * 60000, Date.now() - 5 * 60000)) : null;
    const checklist = template ? template.items.map((item, n) => ({
      label: item.label, required: item.required,
      done: done || (data.status === 'en_proceso' && n < 2),
      note: done && n === template.items.length - 1 ? 'Todo quedó funcionando bien.' : '',
    })) : [];
    const order = await WorkOrder.create({
      tenant, title: data.title, description: DESCRIPTIONS[data.template || 'otro'], status: data.status, priority: data.priority,
      client: client._id, customerName: client.name, assignedTo: tech ? tech._id : null, createdBy: users.admin._id,
      dueDate: data.due !== undefined ? endOfDay(addDays(colombiaDay(), data.due)) : null,
      notes: done ? 'Se le explicó al cliente el trabajo realizado.' : '',
      startedAt, completedAt, checklistName: template ? template.name : '', checklist,
    });

    const attachments = [];
    const kinds = data.fotos === true ? ['antes', 'despues'] : data.fotos ? [data.fotos] : [];
    for (const kind of kinds) {
      const bytes = imagenes.photo(kind, i + 1);
      const file = await WorkOrderFile.create({ tenant, workOrder: order._id, kind, type: 'image/png', data: bytes, size: bytes.length, by: tech ? tech._id : null });
      attachments.push({ file: file._id, kind, at: kind === 'antes' ? startedAt : completedAt || startedAt });
    }
    if (attachments.length) order.attachments = attachments;
    if (data.firma && done) {
      const bytes = imagenes.signature();
      const file = await WorkOrderFile.create({ tenant, workOrder: order._id, kind: 'firma', type: 'image/png', data: bytes, size: bytes.length, by: tech ? tech._id : null });
      order.signature = { name: `Encargado de ${client.name}`, signedAt: completedAt, file: file._id };
    }
    if (data.informe && done) order.reportToken = crypto.randomBytes(18).toString('base64url');
    await order.save();
    await stamp(WorkOrder, order._id, { createdAt, updatedAt: completedAt || startedAt || createdAt });
    orders[data.title] = order;
    createdOrders += 1;
  }

  // Cotizaciones: se buscan por título; el consecutivo de la empresa queda en la más alta.
  let createdQuotes = 0;
  for (const data of QUOTES) {
    if (await Quote.findOne({ tenant, title: data.title })) continue;
    const { quoteSeq: number } = await Company.findByIdAndUpdate(tenant, { $inc: { quoteSeq: 1 } }, { new: true });
    const t = totals(data.items.map((i) => ({ ...i, taxRate: 19, excluded: false })), 'COP');
    const sentAt = at(data.sent, 10);
    const decidedAt = data.decided !== undefined ? at(data.decided, 15) : null;
    const linked = data.status === 'aprobada' ? orders[ORDERS.find((o) => o.quote === 'aprobada').title] : null;
    const quote = await Quote.create({
      tenant, number, client: clients[data.client]._id, title: data.title,
      notes: 'Precios de ejemplo con IVA del 19 %. Garantía de 3 meses en mano de obra.',
      items: t.lines, currency: 'COP', subtotal: t.subtotal, tax: t.tax, total: t.total,
      validUntil: endOfDay(addDays(colombiaDay(sentAt), 15)), status: data.status,
      publicToken: data.status === 'enviada' ? crypto.randomBytes(18).toString('base64url') : undefined,
      sentAt, decidedAt, decidedBy: data.decidedBy || '', decidedVia: decidedAt ? 'cliente' : '', decisionNote: data.note || '',
      workOrder: linked ? linked._id : null, createdBy: users.admin._id,
    });
    if (linked) await WorkOrder.updateOne({ tenant, _id: linked._id }, { $set: { quote: quote._id } }, { timestamps: false });
    await stamp(Quote, quote._id, { createdAt: new Date(sentAt.getTime() - 30 * 60000), updatedAt: decidedAt || sentAt });
    createdQuotes += 1;
  }

  log(`Listo: ${NAME} (${SLUG}) con ${USERS.length} usuarios, ${CLIENTS.length} clientes, `
    + `${createdOrders} órdenes y ${createdQuotes} cotizaciones nuevas`);
  log(`Entra con ${USERS[0].email} (administradora); técnicos: ${USERS.slice(1).map((u) => u.email).join(', ')}`);
  if (printed) log(`Clave de los 4 usuarios (se muestra UNA sola vez; guárdala): ${clave}`);
  else if (password) log('Clave: la de DEMO_PASSWORD');
  else log('Clave: no cambió (usa --nueva-clave para generar otra)');
  return { company, users, clients, password: printed ? clave : null };
};

module.exports = { crearDemoServicios, SLUG, NAME, USERS, CLIENTS, ORDERS, QUOTES, TEMPLATES };

if (require.main === module) {
  dotenv.config();
  // eslint-disable-next-line global-require
  const connectDB = require('../config/db');
  (async () => {
    try {
      await connectDB();
      await crearDemoServicios({ reiniciar: flag('--reiniciar'), nuevaClave: flag('--nueva-clave') });
    } catch (error) {
      console.error(`No se pudo preparar la cuenta de demostración: ${error.message}`);
      process.exitCode = 1;
    } finally {
      await mongoose.disconnect();
    }
  })();
}
