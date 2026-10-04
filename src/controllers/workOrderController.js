const WorkOrder = require('../models/WorkOrder');

const getWorkOrders = async (req, res) => {
  try {
    const filter = {};

    if (req.query.status && req.query.status !== 'all') {
      filter.status = req.query.status;
    }

    const workOrders = await WorkOrder.find(filter)
      .populate('createdBy', 'name email role')
      .populate('assignedTo', 'name email role')
      .sort({ createdAt: -1 });

    res.status(200).json(workOrders);
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

    if (!title || !description) {
      return res.status(400).json({
        message: 'Título y descripción son obligatorios',
      });
    }

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

    res.status(200).json(workOrder);
  } catch (error) {
    res.status(500).json({
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

    workOrder.title = title || workOrder.title;
    workOrder.description = description || workOrder.description;
    workOrder.status = status || workOrder.status;
    workOrder.priority = priority || workOrder.priority;
    workOrder.customerName = customerName || workOrder.customerName;
    workOrder.assignedTo = assignedTo || workOrder.assignedTo;
    workOrder.dueDate = dueDate || workOrder.dueDate;
    workOrder.notes = notes !== undefined ? notes : workOrder.notes;

    const updatedWorkOrder = await workOrder.save();

    const populatedWorkOrder = await WorkOrder.findById(updatedWorkOrder._id)
      .populate('createdBy', 'name email role')
      .populate('assignedTo', 'name email role');

    res.status(200).json(populatedWorkOrder);
  } catch (error) {
    res.status(500).json({
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

    res.status(200).json({
      message: 'Orden de trabajo eliminada correctamente',
    });
  } catch (error) {
    res.status(500).json({
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
































































































































































































































































