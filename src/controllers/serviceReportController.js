const crypto = require('crypto');
const mongoose = require('mongoose');
const WorkOrder = require('../models/WorkOrder');
const WorkOrderFile = require('../models/WorkOrderFile');
const ChecklistTemplate = require('../models/ChecklistTemplate');
const Company = require('../models/Company');
const { companyScope } = require('../middleware/authMiddleware');
const { publicBranding } = require('../utils/branding');
const { audit } = require('../utils/audit');

// Informe de servicio (Mejora 1): checklist por tipo de servicio, fotos de antes y después, firma del cliente en el
// celular del técnico y un enlace público con el informe (para imprimir o guardar en PDF) que se le comparte al cliente.

const MAX_PHOTOS = Number(process.env.MAX_ORDER_PHOTOS) || 12;
const MAX_PHOTO_BYTES = 400 * 1024;          // el celular la reduce antes de subirla (1280 px, JPEG)
const MAX_SIGNATURE_BYTES = 60 * 1024;
const MAX_SIGNATURES = 5;                    // por orden: la vigente y hasta 4 que reemplazó el técnico

const fail = (status, message) => Object.assign(new Error(message), { statusCode: status });
const reply = (res, error, fallback) => res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : fallback });

// Lo que ve cada rol: las órdenes de su empresa; un usuario cliente, solo las de su ficha, y sin ficha ninguna (con
// `null` vería las órdenes internas, las que no tienen cliente). Las órdenes usan este mismo filtro.
const orderFilter = (req) => {
  const filter = companyScope(req);
  if (req.user.role === 'cliente') filter.client = req.user.client || { $in: [] };
  return filter;
};

// Zona horaria de la empresa para las horas que ve el cliente: es → Colombia; en → Estados Unidos (hora del Este).
const timeZoneOf = (company) => (company && company.lang === 'en' ? 'America/New_York' : 'America/Bogota');

const findOrder = async (req) => {
  const order = await WorkOrder.findOne({ $and: [orderFilter(req), { _id: req.params.id }] });
  if (!order) throw fail(404, 'Orden de trabajo no encontrada');
  return order;
};

// Llenar el informe: el administrador, o el técnico que tiene la orden. Una orden cancelada no se toca, y una completada
// solo la corrige el administrador.
const findEditable = async (req) => {
  const order = await findOrder(req);
  if (req.user.role === 'cliente') throw fail(403, 'No tienes permiso para esta acción');
  if (req.user.role === 'tecnico' && String(order.assignedTo) !== String(req.user._id)) {
    throw fail(403, 'Solo puedes llenar el informe de las órdenes que tienes asignadas');
  }
  if (order.status === 'cancelada') throw fail(409, 'La orden está cancelada');
  if (order.status === 'completada' && req.user.role !== 'admin') throw fail(409, 'La orden ya está completada');
  return order;
};

// Tipo real del archivo por sus primeros bytes (no se confía en lo que diga el navegador).
const sniff = (buf) => {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length > 12 && buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
  return null;
};

// ¿Se puede completar? Los puntos obligatorios del checklist marcados y, si la empresa lo pide, la firma del cliente.
// El administrador puede cerrar desde la oficina sin firma (la regla de la firma es para el técnico en la visita).
// Devuelve el cuerpo del 409; los puntos que faltan van también aparte (`missing`) para armar la frase en inglés.
const completionProblem = (order, company, role) => {
  const missing = (order.checklist || []).filter((i) => i.required && !i.done);
  if (missing.length) {
    const items = `${missing.slice(0, 3).map((i) => `«${i.label}»`).join(', ')}${missing.length > 3 ? '…' : ''}`;
    return { message: `Falta marcar en el checklist: ${items}`, missing: items };
  }
  if (role !== 'admin' && company && company.requireSignature && !(order.signature && order.signature.file)) {
    return { message: 'Tu empresa pide la firma del cliente antes de completar la orden' };
  }
  return null;
};

// ---- Plantillas de checklist ------------------------------------------------------------------------------------------

const cleanItems = (items) => (Array.isArray(items) ? items : [])
  .map((i) => ({ label: String((i && i.label) || '').trim().slice(0, 160), required: Boolean(i && i.required) }))
  .filter((i) => i.label);

const listTemplates = async (req, res) => {
  try {
    const filter = companyScope(req);
    if (!(req.user.role === 'admin' && req.query.all === '1')) filter.active = true;
    const items = await ChecklistTemplate.find(filter).sort({ name: 1 }).lean();
    res.status(200).json({ items });
  } catch (error) {
    reply(res, error, 'No se pudieron cargar las plantillas');
  }
};

const createTemplate = async (req, res) => {
  try {
    const items = cleanItems(req.body.items);
    if (!items.length || items.length > 40) throw fail(400, 'La plantilla lleva entre 1 y 40 puntos');
    const template = await ChecklistTemplate.create({ ...companyScope(req), name: req.body.name, items });
    await audit(req, 'checklist.crear', `Creó la plantilla de checklist «${template.name}»`, { entityId: template._id });
    res.status(201).json(template);
  } catch (error) {
    reply(res, error, 'No se pudo crear la plantilla');
  }
};

const updateTemplate = async (req, res) => {
  try {
    const template = await ChecklistTemplate.findOne({ ...companyScope(req), _id: req.params.id });
    if (!template) throw fail(404, 'Plantilla no encontrada');
    if (req.body.name !== undefined) template.name = req.body.name;
    if (req.body.items !== undefined) {
      const items = cleanItems(req.body.items);
      if (!items.length || items.length > 40) throw fail(400, 'La plantilla lleva entre 1 y 40 puntos');
      template.items = items;
    }
    if (req.body.active !== undefined) template.active = Boolean(req.body.active);
    await template.save();
    await audit(req, 'checklist.editar', `Editó la plantilla de checklist «${template.name}»`, { entityId: template._id });
    res.status(200).json(template);
  } catch (error) {
    reply(res, error, 'No se pudo guardar la plantilla');
  }
};

const deleteTemplate = async (req, res) => {
  try {
    const template = await ChecklistTemplate.findOneAndDelete({ ...companyScope(req), _id: req.params.id });
    if (!template) throw fail(404, 'Plantilla no encontrada');
    await audit(req, 'checklist.borrar', `Borró la plantilla de checklist «${template.name}»`, { entityId: template._id });
    res.status(200).json({ message: 'Plantilla eliminada (las órdenes que la usaron conservan su checklist)' });
  } catch (error) {
    reply(res, error, 'No se pudo borrar la plantilla');
  }
};

// ---- El informe dentro de la orden ------------------------------------------------------------------------------------

// Usar una plantilla en la orden (o quitar el checklist con template: null). Copia los puntos de ese momento.
const setChecklist = async (req, res) => {
  try {
    const order = await findEditable(req);
    if (!req.body.template) {
      order.checklistName = '';
      order.checklist = [];
    } else {
      const template = await ChecklistTemplate.findOne({ ...companyScope(req), _id: req.body.template, active: true });
      if (!template) throw fail(400, 'La plantilla no existe en tu empresa');
      order.checklistName = template.name;
      order.checklist = template.items.map((i) => ({ label: i.label, required: i.required, done: false, note: '' }));
    }
    await order.save();
    res.status(200).json(order);
  } catch (error) {
    reply(res, error, 'No se pudo poner el checklist');
  }
};

// Marcar los puntos: llega la lista completa en el mismo orden ({ label, done, note } por punto). El nombre de cada punto
// tiene que coincidir: si la orden cambió de plantilla mientras tanto, las marcas no caen en puntos que no se vieron.
const updateChecklist = async (req, res) => {
  try {
    const order = await findEditable(req);
    const items = req.body.items;
    if (!Array.isArray(items) || items.length !== order.checklist.length
        || order.checklist.some((item, i) => !items[i] || items[i].label !== item.label)) throw fail(400, 'El checklist cambió: actualiza la orden');
    order.checklist.forEach((item, i) => {
      item.done = Boolean(items[i] && items[i].done);
      item.note = String((items[i] && items[i].note) || '').trim().slice(0, 300);
    });
    await order.save();
    res.status(200).json(order);
  } catch (error) {
    reply(res, error, 'No se pudo guardar el checklist');
  }
};

// Foto de la visita: el cuerpo es la imagen tal cual (image/jpeg, png o webp) y ?kind=antes|despues.
const uploadPhoto = async (req, res) => {
  try {
    const kind = req.query.kind === 'antes' ? 'antes' : req.query.kind === 'despues' ? 'despues' : null;
    if (!kind) throw fail(400, 'Indica si la foto es de antes o de después');
    const data = Buffer.isBuffer(req.body) ? req.body : null;
    if (!data || !data.length) throw fail(400, 'No llegó la foto');
    if (data.length > MAX_PHOTO_BYTES) throw fail(413, 'La foto es muy pesada (máximo 400 KB)');
    const type = sniff(data);
    if (!type) throw fail(400, 'La foto debe ser JPG, PNG o WEBP');
    const order = await findEditable(req);
    if (order.attachments.length >= MAX_PHOTOS) throw fail(409, `Máximo ${MAX_PHOTOS} fotos por orden`);
    const file = await WorkOrderFile.create({ ...companyScope(req), workOrder: order._id, kind, type, data, size: data.length, by: req.user._id });
    // Cupo atómico: dos subidas a la vez no pasan del máximo.
    const updated = await WorkOrder.findOneAndUpdate(
      { ...companyScope(req), _id: order._id, [`attachments.${MAX_PHOTOS - 1}`]: { $exists: false } },
      { $push: { attachments: { file: file._id, kind, at: new Date() } } },
      { new: true }
    );
    if (!updated) {
      await WorkOrderFile.deleteOne({ ...companyScope(req), _id: file._id });
      throw fail(409, `Máximo ${MAX_PHOTOS} fotos por orden`);
    }
    res.status(201).json(updated);
  } catch (error) {
    reply(res, error, 'No se pudo guardar la foto');
  }
};

// La foto se saca de la orden con una operación atómica (no pisa una subida ni otro borrado al mismo tiempo) y solo
// después se borra su archivo: ni la orden apunta a un archivo borrado ni queda un archivo suelto.
const deletePhoto = async (req, res) => {
  try {
    const order = await findEditable(req);
    const fileId = req.params.fileId;
    if (!mongoose.isValidObjectId(fileId)) throw fail(404, 'Foto no encontrada');
    const updated = await WorkOrder.findOneAndUpdate(
      { ...companyScope(req), _id: order._id, 'attachments.file': fileId },
      { $pull: { attachments: { file: fileId } } },
      { new: true }
    );
    if (!updated) throw fail(404, 'Foto no encontrada');
    await WorkOrderFile.deleteOne({ ...companyScope(req), _id: fileId, workOrder: order._id });
    res.status(200).json(updated);
  } catch (error) {
    reply(res, error, 'No se pudo borrar la foto');
  }
};

// Una foto o la firma de una orden que el usuario puede ver.
const sendFile = (res, file) => {
  res.set({ 'Content-Type': file.type, 'Cache-Control': 'private, max-age=86400', 'Content-Disposition': 'inline' });
  res.status(200).send(file.data);
};

const getFile = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.fileId)) throw fail(404, 'Archivo no encontrado');
    const order = await findOrder(req);
    const file = await WorkOrderFile.findOne({ ...companyScope(req), _id: req.params.fileId, workOrder: order._id });
    if (!file) throw fail(404, 'Archivo no encontrado');
    sendFile(res, file);
  } catch (error) {
    reply(res, error, 'No se pudo cargar el archivo');
  }
};

// Firma del cliente: { name, image: "data:image/png;base64,…" } dibujada en el celular. Reemplaza la vigente solo si
// nadie firmó entre tanto. Si la reemplaza el técnico, la anterior se conserva en la orden (queda en la bitácora), con
// cupo: con MAX_SIGNATURES guardadas, otro cambio lo hace el administrador, que al reemplazarla borra las anteriores.
const sign = async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name || name.length > 100) throw fail(400, 'Escribe el nombre de quien firma');
    const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(String(req.body.image || ''));
    if (!match) throw fail(400, 'La firma no es válida');
    const data = Buffer.from(match[1], 'base64');
    if (data.length > MAX_SIGNATURE_BYTES) throw fail(413, 'La firma quedó muy pesada: bórrala y fírmala más simple');
    if (sniff(data) !== 'image/png') throw fail(400, 'La firma no es válida');
    const order = await findEditable(req);
    const previous = order.signature && order.signature.file;
    // Las firmas guardadas de la orden, leídas antes de crear la nueva: el cupo del técnico y lo que borra el administrador
    // (nunca una firma que llegue después de esta lectura).
    const stored = (await WorkOrderFile.find({ ...companyScope(req), workOrder: order._id, kind: 'firma' }).select('_id').lean()).map((f) => f._id);
    if (req.user.role !== 'admin' && stored.length >= MAX_SIGNATURES) throw fail(409, 'La firma ya se cambió varias veces: pide al administrador que la corrija');
    const file = await WorkOrderFile.create({ ...companyScope(req), workOrder: order._id, kind: 'firma', type: 'image/png', data, size: data.length, by: req.user._id });
    const updated = await WorkOrder.findOneAndUpdate(
      { ...companyScope(req), _id: order._id, 'signature.file': previous || null },
      { $set: { signature: { name, signedAt: new Date(), file: file._id } } },
      { new: true }
    );
    if (!updated) {
      await WorkOrderFile.deleteOne({ ...companyScope(req), _id: file._id });
      throw fail(409, 'La firma cambió: actualiza la orden');
    }
    if (req.user.role === 'admin' && stored.length) await WorkOrderFile.deleteMany({ ...companyScope(req), _id: { $in: stored } });
    await audit(req, 'orden.firma', `Registró la firma de ${name} en la orden «${order.title}»`,
      { entityId: order._id, meta: previous ? { reemplazada: String(previous) } : {} });
    res.status(200).json(updated);
  } catch (error) {
    reply(res, error, 'No se pudo guardar la firma');
  }
};

// Enlace público del informe: se crea la primera vez y luego es siempre el mismo. Con { rotate: true } se cambia por uno
// nuevo y el anterior deja de servir (se mandó a quien no era, o el cliente pide que deje de circular); eso lo hace el
// administrador o el técnico de la orden.
const reportLink = async (req, res) => {
  try {
    const order = await findOrder(req);
    if (req.user.role === 'tecnico' && String(order.assignedTo) !== String(req.user._id)) {
      throw fail(403, 'Solo puedes compartir el informe de las órdenes que tienes asignadas');
    }
    const rotate = Boolean(req.body && req.body.rotate === true);
    if (rotate && req.user.role === 'cliente') throw fail(403, 'No tienes permiso para esta acción');
    if (!order.reportToken || rotate) {
      order.reportToken = crypto.randomBytes(18).toString('base64url');
      await order.save();
      if (rotate) await audit(req, 'orden.enlace', `Cambió el enlace del informe de la orden «${order.title}» (el anterior dejó de servir)`, { entityId: order._id });
    }
    res.status(200).json({ path: `/informe/${order.reportToken}`, token: order.reportToken });
  } catch (error) {
    reply(res, error, 'No se pudo crear el enlace del informe');
  }
};

// ---- El informe público (sin sesión, con la llave del enlace) --------------------------------------------------------

// La orden se busca por su llave, que no lleva empresa: es la excepción explícita del guard de empresas.
const byToken = (token) => (/^[A-Za-z0-9_-]{20,40}$/.test(String(token || ''))
  ? WorkOrder.findOne({ reportToken: token }).setOptions({ allowCrossTenant: true })
    .populate('assignedTo', 'name').populate('client', 'name address phone company')
  : null);

const publicReport = async (req, res) => {
  try {
    const order = await byToken(req.params.token);
    if (!order) throw fail(404, 'Este informe no existe');
    const company = await Company.findById(order.tenant);
    if (!company || company.status === 'suspendida') throw fail(404, 'Este informe no existe');
    res.set('Cache-Control', 'no-store');
    res.status(200).json({
      company: { id: company._id, name: company.name, lang: company.lang || 'es', timeZone: timeZoneOf(company), branding: publicBranding(company) },
      order: {
        title: order.title,
        description: order.description,
        status: order.status,
        customerName: order.client ? order.client.name : order.customerName || '',
        client: order.client ? { name: order.client.name, company: order.client.company || '', address: order.client.address || '', phone: order.client.phone || '' } : null,
        technician: order.assignedTo ? order.assignedTo.name : '',
        createdAt: order.createdAt,
        startedAt: order.startedAt,
        completedAt: order.completedAt,
        notes: order.notes || '',
        checklistName: order.checklistName,
        checklist: order.checklist.map((i) => ({ label: i.label, done: i.done, note: i.note })),
        photos: order.attachments.map((a) => ({ id: a.file, kind: a.kind, at: a.at })),
        signature: order.signature && order.signature.file ? { name: order.signature.name, signedAt: order.signature.signedAt, id: order.signature.file } : null,
      },
    });
  } catch (error) {
    reply(res, error, 'No se pudo cargar el informe');
  }
};

const publicReportFile = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.fileId)) throw fail(404, 'Archivo no encontrado');
    const order = await byToken(req.params.token);
    if (!order) throw fail(404, 'Archivo no encontrado');
    const company = await Company.findById(order.tenant).select('status');
    if (!company || company.status === 'suspendida') throw fail(404, 'Archivo no encontrado');
    // Solo los archivos que el informe muestra: sus fotos y su firma vigente.
    const shown = [...order.attachments.map((a) => String(a.file)), order.signature && order.signature.file ? String(order.signature.file) : null];
    if (!shown.includes(req.params.fileId)) throw fail(404, 'Archivo no encontrado');
    const file = await WorkOrderFile.findOne({ tenant: order.tenant, _id: req.params.fileId, workOrder: order._id });
    if (!file) throw fail(404, 'Archivo no encontrado');
    sendFile(res, file);
  } catch (error) {
    reply(res, error, 'No se pudo cargar el archivo');
  }
};

module.exports = {
  completionProblem, orderFilter, timeZoneOf,
  listTemplates, createTemplate, updateTemplate, deleteTemplate,
  setChecklist, updateChecklist, uploadPhoto, deletePhoto, getFile, sign, reportLink,
  publicReport, publicReportFile,
  MAX_PHOTOS,
};
