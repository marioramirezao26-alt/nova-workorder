const express = require('express');
const { query } = require('express-validator');
const WorkOrder = require('../models/WorkOrder');
const User = require('../models/User');
const { protect, authorize, companyScope } = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validateRequest');

// Reportes de la empresa (solo el administrador): órdenes por día, por estado y por técnico, totales y export CSV.
// Las fechas se interpretan en hora de Colombia (UTC-5, sin horario de verano).
const router = express.Router();
router.use(protect, authorize('admin'));

const TZ = 'America/Bogota';
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const range = (req) => {
  const to = DATE.test(req.query.to || '') ? req.query.to : new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10);
  let from = DATE.test(req.query.from || '') ? req.query.from : null;
  if (!from) {
    const d = new Date(`${to}T00:00:00-05:00`);
    d.setUTCDate(d.getUTCDate() - 29);
    from = d.toISOString().slice(0, 10);
  }
  return { from, to, start: new Date(`${from}T00:00:00-05:00`), end: new Date(`${to}T23:59:59.999-05:00`) };
};

const validators = [
  query('from').optional().matches(DATE).withMessage('Fecha «desde» inválida (AAAA-MM-DD)'),
  query('to').optional().matches(DATE).withMessage('Fecha «hasta» inválida (AAAA-MM-DD)'),
  validateRequest,
];

router.get('/', validators, async (req, res) => {
  try {
    const { from, to, start, end } = range(req);
    const inRange = { ...companyScope(req), createdAt: { $gte: start, $lte: end } };

    const [byDay, byStatus, byTechRaw, created, completed] = await Promise.all([
      WorkOrder.aggregate([
        { $match: inRange },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: TZ } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      WorkOrder.aggregate([
        { $match: inRange },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      WorkOrder.aggregate([
        { $match: inRange },
        { $group: { _id: '$assignedTo', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      WorkOrder.countDocuments(inRange),
      WorkOrder.countDocuments({ ...companyScope(req), completedAt: { $gte: start, $lte: end } }),
    ]);

    // Nombres de los técnicos (dentro de la empresa); las órdenes sin asignar van juntas.
    const ids = byTechRaw.map((t) => t._id).filter(Boolean);
    const users = ids.length ? await User.find({ _id: { $in: ids }, tenant: req.user.tenant }).select('name') : [];
    const nameById = new Map(users.map((u) => [String(u._id), u.name]));
    const byTechnician = byTechRaw.map((t) => ({
      name: t._id ? (nameById.get(String(t._id)) || 'Usuario') : 'Sin asignar',
      count: t.count,
    }));

    res.status(200).json({
      from,
      to,
      totals: { created, completed },
      byDay: byDay.map((d) => ({ day: d._id, count: d.count })),
      byStatus: byStatus.map((s) => ({ status: s._id, count: s.count })),
      byTechnician,
    });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error al generar el reporte' });
  }
});

const cell = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

router.get('/orders.csv', validators, async (req, res) => {
  try {
    const { from, to, start, end } = range(req);
    const orders = await WorkOrder.find({ ...companyScope(req), createdAt: { $gte: start, $lte: end } })
      .sort({ createdAt: 1 })
      .populate('assignedTo', 'name')
      .populate('client', 'name')
      .lean();
    const header = ['Titulo', 'Cliente', 'Estado', 'Prioridad', 'Tecnico', 'Creada', 'Completada'];
    const lines = [header.join(',')];
    for (const o of orders) {
      lines.push([
        cell(o.title),
        cell(o.client?.name || o.customerName),
        o.status,
        o.priority,
        cell(o.assignedTo?.name || ''),
        new Date(o.createdAt).toISOString(),
        o.completedAt ? new Date(o.completedAt).toISOString() : '',
      ].join(','));
    }
    const csv = `﻿${lines.join('\r\n')}\r\n`;      // BOM para que Excel abra bien los acentos
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="ordenes-${from}_a_${to}.csv"`,
    });
    res.send(csv);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error al exportar' });
  }
});

module.exports = router;
