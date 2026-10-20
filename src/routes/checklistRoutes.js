const express = require('express');
const { body } = require('express-validator');
const { protect, authorize } = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validateRequest');
const { validateObjectId } = require('../middleware/validateObjectId');
const report = require('../controllers/serviceReportController');

// Plantillas de checklist de la empresa: el administrador las arma; el técnico las usa en sus órdenes.
const router = express.Router();
router.use(protect);

const fields = [
  body('name').optional().trim().notEmpty().withMessage('Escribe el nombre de la plantilla').isLength({ max: 80 }),
  body('items').optional().isArray({ min: 1, max: 40 }).withMessage('La plantilla lleva entre 1 y 40 puntos'),
  body('items.*.label').optional().isString().isLength({ max: 160 }).withMessage('Un punto es muy largo (máximo 160)'),
  body('active').optional().isBoolean(),
];

router.get('/', authorize('admin', 'tecnico'), report.listTemplates);
router.post('/', authorize('admin'), [body('name').exists().withMessage('Escribe el nombre de la plantilla'), body('items').exists().withMessage('Agrega al menos un punto'), ...fields, validateRequest], report.createTemplate);
router.put('/:id', authorize('admin'), validateObjectId, [...fields, validateRequest], report.updateTemplate);
router.delete('/:id', authorize('admin'), validateObjectId, report.deleteTemplate);

module.exports = router;
