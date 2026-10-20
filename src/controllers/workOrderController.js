const WorkOrder = require('../models/WorkOrder');
const Client = require('../models/Client');
const User = require('../models/User');
const { companyScope } = require('../middleware/authMiddleware');
const { parseLocation, stampPoint, OFFSITE_METERS } = require('../utils/geo');
const { audit } = require('../utils/audit');
const webhooks = require('../utils/webhooks');
const WorkOrderFile = require('../models/WorkOrderFile');
// Lo que ve cada rol (orderFilter): las órdenes de su empresa; un usuario cliente, solo las de su ficha de cliente.
const { completionProblem, orderFilter, timeZoneOf } = require('./serviceReportController');

// El estado y sus fechas: el inicio la primera vez que pasa a «en proceso» y el cierre al completar (se quita si sale de
// completada); el mapa en vivo es solo en proceso. Lo usan «Iniciar»/«Completar» (PATCH /status) y «Editar» (PUT).
const applyStatus = (workOrder, status) => {
  workOrder.status = status;
  if (status === 'en_proceso' && !workOrder.startedAt) workOrder.startedAt = new Date();
  workOrder.completedAt = status === 'completada' ? new Date() : null;
  if (status !== 'en_proceso') { workOrder.lastPoint = null; workOrder.offSiteSince = null; }
};

// Sello de las notas («AAAA-MM-DD HH:mm») en la hora de la empresa: el servidor corre en UTC y el cliente lee las notas
// en el informe público junto a las demás horas.
const noteStamp = (company) => new Intl.DateTimeFormat('sv-SE', {
  timeZone: timeZoneOf(company), year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
}).format(new Date());

// La ubicación del técnico es para su empresa: un usuario cliente no la ve.
const hidden = (req) => (req.user.role === 'cliente' ? '-startLocation -endLocation -lastPoint -offSiteSince' : '');

const badRequest = (message) => Object.assign(new Error(message), { statusCode: 400 });

// El cliente y el técnico de una orden tienen que ser de la misma empresa (y el técnico, activo).
const resolveRefs = async (req, { client, assignedTo }) => {
  const out = {};
  if (client !== undefined) {
    if (!client) {
      out.client = null;
    } else {
      const found = await Client.findOne({ _id: client, ...companyScope(req) });
      if (!found) throw badRequest('El cliente indicado no existe en tu empresa');
      out.client = found._id;
      out.customerName = found.name;
    }
  }
  if (assignedTo !== undefined) {
    if (!assignedTo) {
      out.assignedTo = null;
    } else {
      const tech = await User.findOne({ _id: assignedTo, ...companyScope(req), active: true, role: { $in: ['tecnico', 'admin'] } });
      if (!tech) throw badRequest('El técnico asignado no existe o no está activo en tu empresa');
      out.assignedTo = tech._id;
    }
  }
  return out;
};

const populate = (query) => query
  .populate('createdBy', 'name email role')
  .populate('assignedTo', 'name email role')
  .populate('client', 'name email phone company address location');

const getPageOptions = (req) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(Math.max(1, Number(req.query.limit) || 10), 100);

  return { page, limit, skip: (page - 1) * limit };
};

const getWorkOrders = async (req, res) => {
  try {
    const filter = orderFilter(req);

    if (req.query.status && req.query.status !== 'all') {
      filter.status = WorkOrder.schema.path('status').enumValues.includes(String(req.query.status)) ? String(req.query.status) : '__ninguno__';
    }

    // ?assigned=me: las órdenes asignadas al usuario (vista «Mis órdenes» del técnico)
    if (req.query.assigned === 'me') {
      filter.assignedTo = req.user._id;
    }

    // Búsqueda por texto en título, descripción y cliente (?q=...)
    const query = String(req.query.q || '').trim();
    if (query) {
      const pattern = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ title: pattern }, { description: pattern }, { customerName: pattern }];
    }

    const { page, limit, skip } = getPageOptions(req);

    const [items, total] = await Promise.all([
      populate(WorkOrder.find(filter).select(hidden(req)))
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      WorkOrder.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    res.status(200).json({
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: error.message || 'Error al obtener las órdenes de trabajo',
    });
  }
};

const createWorkOrder = async (req, res) => {
  try {
    const {
      title,
      description,
      status,
      priority,
      customerName,
      client,
      assignedTo,
      dueDate,
      notes,
    } = req.body;

    // Una orden que nace completada sigue la regla de «Completar» (sin checklist todavía, solo puede faltar la firma)
    // y lleva su fecha de cierre.
    if (status === 'completada') {
      const problem = completionProblem({ checklist: [], signature: null }, req.company, req.user.role);
      if (problem) return res.status(409).json(problem);
    }
    const refs = await resolveRefs(req, { client, assignedTo });
    const workOrder = await WorkOrder.create({
      title,
      description,
      status: status || 'pendiente',
      completedAt: status === 'completada' ? new Date() : null,
      priority: priority || 'media',
      customerName,
      dueDate,
      notes,
      ...refs,
      ...companyScope(req),
      createdBy: req.user._id,
    });

    const populatedWorkOrder = await populate(WorkOrder.findById(workOrder._id));

    await audit(req, 'orden.crear', `Creó la orden «${workOrder.title}»`, { entityId: workOrder._id });
    await webhooks.emit(req.user.tenant, 'orden.creada', webhooks.orderPayload(populatedWorkOrder));
    res.status(201).json(populatedWorkOrder);
  } catch (error) {
    res.status(error.statusCode || 500).json({
      message: error.message || 'Error al crear la orden de trabajo',
    });
  }
};

const getWorkOrderById = async (req, res) => {
  try {
    const workOrder = await populate(WorkOrder.findOne({ $and: [orderFilter(req), { _id: req.params.id }] }).select(hidden(req)));

    if (!workOrder) {
      return res.status(404).json({ message: 'Orden de trabajo no encontrada' });
    }

    return res.status(200).json(workOrder);
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'Error al obtener la orden de trabajo',
    });
  }
};

const updateWorkOrder = async (req, res) => {
  try {
    const {
      title,
      description,
      status,
      priority,
      customerName,
      client,
      assignedTo,
      dueDate,
      notes,
    } = req.body;

    const workOrder = await WorkOrder.findOne({ $and: [orderFilter(req), { _id: req.params.id }] });

    if (!workOrder) {
      return res.status(404).json({ message: 'Orden de trabajo no encontrada' });
    }

    // Un técnico solo edita las órdenes que tiene asignadas o que creó, y no cambia su estado (eso va por «Iniciar» y
    // «Completar»), no se la pasa a otro técnico ni borra el historial de notas.
    if (req.user.role === 'tecnico') {
      const mine = [workOrder.assignedTo, workOrder.createdBy].some((id) => id && String(id) === String(req.user._id));
      if (!mine) return res.status(403).json({ message: 'Solo puedes editar las órdenes que tienes asignadas o que creaste' });
      const changed = (field, value) => value !== undefined && String(value ?? '') !== String(workOrder[field] ?? '');
      if (changed('status', status) || changed('notes', notes)
          || (assignedTo !== undefined && String(assignedTo || '') !== String(workOrder.assignedTo || '') && String(assignedTo || '') !== String(req.user._id))) {
        return res.status(403).json({ message: 'Como técnico no puedes cambiar el estado, el técnico asignado ni las notas desde aquí' });
      }
    }

    // Completar desde «Editar» sigue la misma regla que «Completar» (puntos obligatorios; la firma, salvo el administrador).
    const statusChanged = status !== undefined && status !== workOrder.status;
    if (statusChanged && status === 'completada') {
      const problem = completionProblem(workOrder, req.company, req.user.role);
      if (problem) return res.status(409).json(problem);
    }

    // Solo se cambia lo que viene en el body: así se pueden vaciar campos opcionales
    // (por ejemplo customerName: '' o assignedTo: null) en lugar de ignorarlos.
    const updates = { title, description, priority, customerName, dueDate, notes };
    Object.entries(updates).forEach(([field, value]) => {
      if (value !== undefined) {
        workOrder[field] = value === '' && field === 'dueDate' ? null : value;
      }
    });
    if (statusChanged) applyStatus(workOrder, status);
    Object.assign(workOrder, await resolveRefs(req, { client, assignedTo }));

    const updatedWorkOrder = await workOrder.save();

    const populatedWorkOrder = await populate(WorkOrder.findById(updatedWorkOrder._id));

    await audit(req, 'orden.editar', `Editó la orden «${updatedWorkOrder.title}»`, { entityId: updatedWorkOrder._id });
    await webhooks.emit(req.user.tenant, 'orden.actualizada', webhooks.orderPayload(populatedWorkOrder));
    return res.status(200).json(populatedWorkOrder);
  } catch (error) {
    const status = error.statusCode || (error.name === 'ValidationError' || error.name === 'CastError' ? 400 : 500);
    return res.status(status).json({
      message: error.message || 'Error al actualizar la orden de trabajo',
    });
  }
};

const deleteWorkOrder = async (req, res) => {
  try {
    const workOrder = await WorkOrder.findOne({ $and: [orderFilter(req), { _id: req.params.id }] });

    if (!workOrder) {
      return res.status(404).json({ message: 'Orden de trabajo no encontrada' });
    }

    const title = workOrder.title;
    await workOrder.deleteOne();
    await WorkOrderFile.deleteMany({ ...companyScope(req), workOrder: workOrder._id });   // sus fotos y su firma

    await audit(req, 'orden.borrar', `Borró la orden «${title}»`, { entityId: workOrder._id });
    await webhooks.emit(req.user.tenant, 'orden.borrada', webhooks.orderPayload(workOrder));
    return res.status(200).json({
      message: 'Orden de trabajo eliminada correctamente',
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'Error al eliminar la orden de trabajo',
    });
  }
};

// Cambio rápido de estado desde el celular del técnico: solo el estado (y una nota opcional).
// Un técnico solo mueve las órdenes que tiene asignadas; el administrador, cualquiera de su empresa.
const updateWorkOrderStatus = async (req, res) => {
  try {
    const workOrder = await WorkOrder.findOne({ $and: [orderFilter(req), { _id: req.params.id }] });

    if (!workOrder) {
      return res.status(404).json({ message: 'Orden de trabajo no encontrada' });
    }

    if (req.user.role === 'tecnico' && String(workOrder.assignedTo) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Solo puedes actualizar las órdenes que tienes asignadas' });
    }

    const { status, note } = req.body;
    // Una orden completada solo la reabre el administrador: el técnico no la saca de ahí para cambiar fotos o firma.
    if (req.user.role === 'tecnico' && workOrder.status === 'completada' && status !== 'completada') {
      return res.status(403).json({ message: 'Una orden completada solo la reabre el administrador' });
    }
    // Informe de servicio: sin los puntos obligatorios del checklist (ni la firma, si la empresa la pide) no se completa.
    if (status === 'completada' && workOrder.status !== 'completada') {
      const problem = completionProblem(workOrder, req.company, req.user.role);
      if (problem) return res.status(409).json(problem);
    }
    applyStatus(workOrder, status);
    // Ubicación al iniciar y al completar: solo si la empresa la activó y este usuario la autorizó (Ley 1581).
    const loc = parseLocation(req.body.location);
    if (loc && req.company && req.company.locationTracking && req.user.locationConsentAt
        && (status === 'en_proceso' || status === 'completada')) {
      const client = workOrder.client ? await Client.findOne({ _id: workOrder.client, ...companyScope(req) }) : null;
      const point = stampPoint(loc, client && client.location);
      if (status === 'en_proceso') {
        workOrder.startLocation = point;
        workOrder.lastPoint = point;
        workOrder.offSiteSince = point.offSite ? point.at : null;
      }
      if (status === 'completada') {
        workOrder.endLocation = point;
        if (client && !(client.location && Number.isFinite(client.location.lat))) {
          client.location = { lat: loc.lat, lng: loc.lng, source: 'visita', at: new Date() };    // aprendida en la visita
          await client.save();
        }
      }
    }
    if (note) {
      workOrder.notes = `${workOrder.notes ? `${workOrder.notes}\n` : ''}[${noteStamp(req.company)} · ${req.user.name}] ${note}`.slice(-5000);
    }
    await workOrder.save();

    await audit(req, 'orden.estado', `Cambió la orden «${workOrder.title}» a «${workOrder.status}»`, { entityId: workOrder._id, meta: { status: workOrder.status } });
    const populated = await populate(WorkOrder.findById(workOrder._id));
    await webhooks.emit(req.user.tenant, 'orden.estado', webhooks.orderPayload(populated));
    return res.status(200).json(populated);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Error al actualizar el estado' });
  }
};

// Mapa en vivo: el celular del técnico manda dónde está cada minuto mientras la orden está «en proceso». Solo se guarda
// si la empresa activó el mapa en vivo, el técnico lo autorizó (aparte de iniciar y completar) y la orden es suya y está
// en proceso; nunca fuera de una orden.
const pingEveryMs = () => (Number.isFinite(Number(process.env.PING_EVERY_SECONDS)) && process.env.PING_EVERY_SECONDS !== ''
  ? Number(process.env.PING_EVERY_SECONDS) : 30) * 1000;
const pingWorkOrder = async (req, res) => {
  try {
    const loc = parseLocation(req.body.location);
    if (!loc) return res.status(400).json({ message: 'Ubicación inválida' });
    if (!(req.company && req.company.liveTracking && req.user.liveConsentAt)) {
      return res.status(200).json({ stored: false, reason: 'sin_autorizacion' });
    }
    const filter = { ...companyScope(req), _id: req.params.id, assignedTo: req.user._id, status: 'en_proceso' };
    const order = await WorkOrder.findOne(filter).select('client lastPoint offSiteSince');
    if (!order) return res.status(409).json({ message: 'Solo se comparte la ubicación de una orden tuya en proceso' });
    const now = Date.now();
    if (order.lastPoint && order.lastPoint.at && now - new Date(order.lastPoint.at).getTime() < pingEveryMs()) {
      return res.status(200).json({ stored: false, reason: 'muy_seguido', lastPoint: order.lastPoint });
    }
    const client = order.client ? await Client.findOne({ _id: order.client, ...companyScope(req) }).select('location') : null;
    const point = stampPoint(loc, client && client.location);
    const offSiteSince = point.offSite ? (order.offSiteSince || point.at) : null;
    await WorkOrder.updateOne(filter, {
      $push: { trail: { $each: [point], $slice: -200 } },
      $set: { lastPoint: point, offSiteSince },
    });
    return res.status(200).json({ stored: true, lastPoint: point, offSiteSince });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Error al guardar la ubicación' });
  }
};

// Para el administrador: las órdenes en proceso con dónde va cada técnico, el cliente y el recorrido de hoy.
const liveWorkOrders = async (req, res) => {
  try {
    const items = await WorkOrder.find({ ...companyScope(req), status: 'en_proceso' })
      .select('+trail title priority startedAt dueDate assignedTo client customerName startLocation lastPoint offSiteSince')
      .populate('assignedTo', 'name')
      .populate('client', 'name address phone location')
      .sort({ startedAt: 1 })
      .limit(100)
      .lean();
    return res.status(200).json({ items, offSiteMeters: OFFSITE_METERS(), tracking: Boolean(req.company && req.company.liveTracking) });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Error al cargar el mapa' });
  }
};

module.exports = {
  pingWorkOrder,
  liveWorkOrders,
  updateWorkOrderStatus,
  getWorkOrders,
  createWorkOrder,
  getWorkOrderById,
  updateWorkOrder,
  deleteWorkOrder,
};
