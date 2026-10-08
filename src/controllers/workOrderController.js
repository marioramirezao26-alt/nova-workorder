const WorkOrder = require('../models/WorkOrder');
const Client = require('../models/Client');
const User = require('../models/User');
const { companyScope } = require('../middleware/authMiddleware');

// Lo que ve cada rol: las órdenes de su empresa; un usuario cliente, solo las de su ficha de cliente.
const orderFilter = (req) => {
  const filter = companyScope(req);
  if (req.user.role === 'cliente') filter.client = req.user.client || null;
  return filter;
};

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
  .populate('client', 'name email phone company address');

const getPageOptions = (req) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(Math.max(1, Number(req.query.limit) || 10), 100);

  return { page, limit, skip: (page - 1) * limit };
};

const getWorkOrders = async (req, res) => {
  try {
    const filter = orderFilter(req);

    if (req.query.status && req.query.status !== 'all') {
      filter.status = req.query.status;
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
      populate(WorkOrder.find(filter))
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

    const refs = await resolveRefs(req, { client, assignedTo });
    const workOrder = await WorkOrder.create({
      title,
      description,
      status: status || 'pendiente',
      priority: priority || 'media',
      customerName,
      dueDate,
      notes,
      ...refs,
      ...companyScope(req),
      createdBy: req.user._id,
    });

    const populatedWorkOrder = await populate(WorkOrder.findById(workOrder._id));

    res.status(201).json(populatedWorkOrder);
  } catch (error) {
    res.status(error.statusCode || 500).json({
      message: error.message || 'Error al crear la orden de trabajo',
    });
  }
};

const getWorkOrderById = async (req, res) => {
  try {
    const workOrder = await populate(WorkOrder.findOne({ $and: [orderFilter(req), { _id: req.params.id }] }));

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

    // Solo se cambia lo que viene en el body: así se pueden vaciar campos opcionales
    // (por ejemplo customerName: '' o assignedTo: null) en lugar de ignorarlos.
    const updates = { title, description, status, priority, customerName, dueDate, notes };
    Object.entries(updates).forEach(([field, value]) => {
      if (value !== undefined) {
        workOrder[field] = value === '' && field === 'dueDate' ? null : value;
      }
    });
    Object.assign(workOrder, await resolveRefs(req, { client, assignedTo }));

    const updatedWorkOrder = await workOrder.save();

    const populatedWorkOrder = await populate(WorkOrder.findById(updatedWorkOrder._id));

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

    await workOrder.deleteOne();

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
    workOrder.status = status;
    if (status === 'en_proceso' && !workOrder.startedAt) workOrder.startedAt = new Date();
    if (status === 'completada') workOrder.completedAt = new Date();
    if (status !== 'completada') workOrder.completedAt = null;
    if (note) {
      const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
      workOrder.notes = `${workOrder.notes ? `${workOrder.notes}\n` : ''}[${stamp} · ${req.user.name}] ${note}`.slice(-5000);
    }
    await workOrder.save();

    return res.status(200).json(await populate(WorkOrder.findById(workOrder._id)));
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Error al actualizar el estado' });
  }
};

module.exports = {
  updateWorkOrderStatus,
  getWorkOrders,
  createWorkOrder,
  getWorkOrderById,
  updateWorkOrder,
  deleteWorkOrder,
};
