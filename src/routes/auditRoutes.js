const express = require('express');
const { query } = require('express-validator');
const AuditLog = require('../models/AuditLog');
const { protect, authorize, companyScope } = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validateRequest');

// La bitácora de la empresa: quién hizo qué y cuándo. Solo el administrador la ve.
const router = express.Router();
router.use(protect, authorize('admin'));

const view = (e) => ({
  _id: e._id,
  action: e.action,
  summary: e.summary,
  user: e.userName || e.userEmail || 'Alguien',
  at: e.createdAt,
});

router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('Página inválida'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Límite inválido'),
  validateRequest,
], async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(Math.max(1, Number(req.query.limit) || 30), 100);
    const filter = companyScope(req);
    const [items, total] = await Promise.all([
      AuditLog.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      AuditLog.countDocuments(filter),
    ]);
    res.status(200).json({
      items: items.map(view),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1, hasMore: page * limit < total },
    });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error al cargar la actividad' });
  }
});

module.exports = router;
