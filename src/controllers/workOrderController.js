const WorkOrder = require('../models/WorkOrder');

const getPageOptions = (req) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(Math.max(1, Number(req.query.limit) || 10), 100);

  return { page, limit, skip: (page - 1) * limit };
};

const getWorkOrders = async (req, res) => {
  try {
    const filter = {};

    if (req.query.status && req.query.status !== 'all') {
      filter.status = req.query.status;
    }

    // Búsqueda por texto en título, descripción y cliente (?q=...)
    const query = String(req.query.q || '').trim();
    if (query) {
      const pattern = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ title: pattern }, { description: pattern }, { customerName: pattern }];
    }

    const { page, limit, skip } = getPageOptions(req);

    const [items, total] = await Promise.all([
      WorkOrder.find(filter)
        .populate('createdBy', 'name email role')
        .populate('assignedTo', 'name email role')
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
      assignedTo,
      dueDate,
      notes,
    } = req.body;

    const workOrder = await WorkOrder.create({
      title,
      description,
      status: status || 'pendiente',
      priority: priority || 'media',
      customerName,
      assignedTo,
      dueDate,
      notes,
      createdBy: req.user._id,
    });

    const populatedWorkOrder = await WorkOrder.findById(workOrder._id)
      .populate('createdBy', 'name email role')
      .populate('assignedTo', 'name email role');

    res.status(201).json(populatedWorkOrder);
  } catch (error) {
    res.status(500).json({
      message: error.message || 'Error al crear la orden de trabajo',
    });
  }
};

const getWorkOrderById = async (req, res) => {
  try {
    const workOrder = await WorkOrder.findById(req.params.id)
      .populate('createdBy', 'name email role')
      .populate('assignedTo', 'name email role');

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
      assignedTo,
      dueDate,
      notes,
    } = req.body;

    const workOrder = await WorkOrder.findById(req.params.id);

    if (!workOrder) {
      return res.status(404).json({ message: 'Orden de trabajo no encontrada' });
    }

    // Solo se cambia lo que viene en el body: así se pueden vaciar campos opcionales
    // (por ejemplo customerName: '' o assignedTo: null) en lugar de ignorarlos.
    const updates = { title, description, status, priority, customerName, assignedTo, dueDate, notes };
    Object.entries(updates).forEach(([field, value]) => {
      if (value !== undefined) {
        workOrder[field] = value === '' && ['assignedTo', 'dueDate'].includes(field) ? null : value;
      }
    });

    const updatedWorkOrder = await workOrder.save();

    const populatedWorkOrder = await WorkOrder.findById(updatedWorkOrder._id)
      .populate('createdBy', 'name email role')
      .populate('assignedTo', 'name email role');

    return res.status(200).json(populatedWorkOrder);
  } catch (error) {
    const status = error.name === 'ValidationError' || error.name === 'CastError' ? 400 : 500;
    return res.status(status).json({
      message: error.message || 'Error al actualizar la orden de trabajo',
    });
  }
};

const deleteWorkOrder = async (req, res) => {
  try {
    const workOrder = await WorkOrder.findById(req.params.id);

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

module.exports = {
  getWorkOrders,
  createWorkOrder,
  getWorkOrderById,
  updateWorkOrder,
  deleteWorkOrder,
};
