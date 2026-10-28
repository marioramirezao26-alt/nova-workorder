const WorkOrder = require('../models/WorkOrder');
const { companyScope } = require('../middleware/authMiddleware');
const { TZ } = require('../utils/colombia');

const getDashboardSummary = async (req, res) => {
  try {
    // Solo la empresa del usuario; un usuario cliente, solo las órdenes de su ficha (sin ficha, ninguna).
    const scope = companyScope(req);
    if (req.user.role === 'cliente') scope.client = req.user.client || { $in: [] };
    const match = { $match: scope };
    const total = await WorkOrder.countDocuments(scope);
    const statusOrder = ['pendiente', 'en_proceso', 'completada', 'cancelada'];

    const statusCounts = await WorkOrder.aggregate([
      match,
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
      match,
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    const recentOrders = await WorkOrder.find(scope)
      .select(req.user.role === 'cliente' ? '-startLocation -endLocation -lastPoint -offSiteSince' : '')
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('createdBy', 'name email');

    // El mes de Colombia en que se creó (en UTC, la creada el 31 después de las 7 p. m. contaba en el mes siguiente).
    const monthlyTrend = await WorkOrder.aggregate([
      match,
      {
        $project: {
          month: {
            $dateToString: {
              format: '%Y-%m',
              date: '$createdAt',
              timezone: TZ,
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
      match,
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

    // Aviso del administrador: cotizaciones que el cliente aprobó y cuya orden sigue sin técnico (nadie se ha enterado).
    // Es el mismo filtro de «Órdenes» con ?origin=quote&assigned=none&status=open.
    const approvedQuotesUnassigned = req.user.role === 'admin'
      ? await WorkOrder.countDocuments({ ...scope, quote: { $ne: null }, assignedTo: null, status: { $in: ['pendiente', 'en_proceso'] } })
      : 0;

    res.status(200).json({
      total,
      approvedQuotesUnassigned,
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
