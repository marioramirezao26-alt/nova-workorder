const WorkOrder = require('../models/WorkOrder');

const getDashboardSummary = async (req, res) => {
  try {
    const total = await WorkOrder.countDocuments();
    const pending = await WorkOrder.countDocuments({ status: 'pendiente' });
    const inProgress = await WorkOrder.countDocuments({ status: 'en_proceso' });
    const completed = await WorkOrder.countDocuments({ status: 'completada' });
    const cancelled = await WorkOrder.countDocuments({ status: 'cancelada' });

    const priorities = await WorkOrder.aggregate([
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 },
        },
      },
    ]);

    const recentOrders = await WorkOrder.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('createdBy', 'name email');

    res.status(200).json({
      total,
      pending,
      inProgress,
      completed,
      cancelled,
      priorities,
      recentOrders,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message || 'Error al generar el resumen del dashboard',
    });
  }
};

module.exports = {
  getDashboardSummary,
};
