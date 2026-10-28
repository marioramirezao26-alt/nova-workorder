const express = require('express');
const { body } = require('express-validator');
const { platformAuth } = require('../middleware/platformAuth');
const { validateRequest } = require('../middleware/validateRequest');
const { validateObjectId } = require('../middleware/validateObjectId');
const { createCompany, listCompanies, getCompany, updateCompany } = require('../controllers/platformController');
const { listDemoRequests, ackDemoRequest } = require('../controllers/demoController');
const { getAnalytics } = require('../controllers/analyticsController');
const { listReviews, approveReview, rejectReview } = require('../controllers/reviewController');

const router = express.Router();

const STATUSES = ['prueba', 'activa', 'suspendida'];

router.use(platformAuth);

router.get('/companies', listCompanies);
router.post('/companies', [
  body('name').trim().notEmpty().withMessage('El nombre de la empresa es obligatorio').isLength({ max: 150 }),
  body('adminName').trim().notEmpty().withMessage('El nombre del administrador es obligatorio').isLength({ max: 100 }),
  body('adminEmail').isEmail().withMessage('El email del administrador no es válido'),
  body('maxTechnicians').optional({ nullable: true }).isInt({ min: 0, max: 10000 }).withMessage('maxTechnicians debe ser un entero'),
  body('status').optional().isIn(STATUSES).withMessage('Estado inválido'),
  body('lang').optional().isIn(['es', 'en']).withMessage('Idioma inválido: es o en'),
  body('market').optional().isIn(['co', 'us']).withMessage('Mercado inválido: co o us'),
  validateRequest,
], createCompany);
router.get('/companies/:id', validateObjectId, getCompany);
router.patch('/companies/:id', validateObjectId, [
  body('name').optional().trim().notEmpty().isLength({ max: 150 }),
  body('maxTechnicians').optional({ nullable: true }).isInt({ min: 0, max: 10000 }).withMessage('maxTechnicians debe ser un entero'),
  body('status').optional().isIn(STATUSES).withMessage('Estado inválido'),
  body('lang').optional().isIn(['es', 'en']).withMessage('Idioma inválido: es o en'),
  body('market').optional().isIn(['co', 'us']).withMessage('Mercado inválido: co o us'),
  validateRequest,
], updateCompany);

// Solicitudes de demo de la página de ventas: GABY las lee y las confirma.
router.get('/demo-requests', listDemoRequests);
router.post('/demo-requests/:id/ack', validateObjectId, ackDemoRequest);

// Analítica de la página de ventas (visitas por canal y conversión) para el resumen semanal de GABY.
router.get('/analytics', getAnalytics);

// Recomendaciones de los clientes para novaworkorder.com: GABY las lista y Mario las aprueba o rechaza desde su panel.
router.get('/reviews', listReviews);
router.post('/reviews/:id/approve', validateObjectId, approveReview);
router.post('/reviews/:id/reject', validateObjectId, [
  body('reason').optional({ nullable: true }).isString().trim().isLength({ max: 300 }).withMessage('El motivo: máximo 300 caracteres'),
  validateRequest,
], rejectReview);

module.exports = router;
