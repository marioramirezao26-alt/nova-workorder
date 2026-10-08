const WorkOrder = require('../models/WorkOrder');

const getDashboardSummary = async (req, res) => {
  try {
    const total = await WorkOrder.countDocuments();
    const statusOrder = ['pendiente', 'en_proceso', 'completada', 'cancelada'];

    const statusCounts = await WorkOrder.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const statusBreakdown = statusOrder.reduce((acc, status) => {
      acc[status] = 0;
      return acc;
    }, {});

    statusCounts.forEach((entry) => {
      if (statusBreakdown[entry._id] !== undefined) {
        statusBreakdown[entry._id] = entry.count;
      }
    });

    const pending = statusBreakdown.pendiente || 0;
    const inProgress = statusBreakdown.en_proceso || 0;
    const completed = statusBreakdown.completada || 0;
    const cancelled = statusBreakdown.cancelada || 0;

    const priorities = await WorkOrder.aggregate([
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    const recentOrders = await WorkOrder.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('createdBy', 'name email');

    const monthlyTrend = await WorkOrder.aggregate([
      {
        $project: {
          month: {
            $dateToString: {
              format: '%Y-%m',
              date: '$createdAt',
            },
          },
        },
      },
      {
        $group: {
          _id: '$month',
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $limit: 6 },
    ]);

    const topClients = await WorkOrder.aggregate([
      {
        $group: {
          _id: '$customerName',
          count: { $sum: 1 },
        },
      },
      {
        $match: {
          _id: { $ne: null, $ne: '' },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]);

    res.status(200).json({
      total,
      pending,
      inProgress,
      completed,
      cancelled,
      statusBreakdown,
      priorities,
      recentOrders,
      monthlyTrend,
      topClients,
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
