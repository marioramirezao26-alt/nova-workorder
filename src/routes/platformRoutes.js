const express = require('express');
const { body } = require('express-validator');
const { platformAuth } = require('../middleware/platformAuth');
const { validateRequest } = require('../middleware/validateRequest');
const { validateObjectId } = require('../middleware/validateObjectId');
const { createCompany, listCompanies, getCompany, updateCompany } = require('../controllers/platformController');

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
  validateRequest,
], createCompany);
router.get('/companies/:id', validateObjectId, getCompany);
router.patch('/companies/:id', validateObjectId, [
  body('name').optional().trim().notEmpty().isLength({ max: 150 }),
  body('maxTechnicians').optional({ nullable: true }).isInt({ min: 0, max: 10000 }).withMessage('maxTechnicians debe ser un entero'),
  body('status').optional().isIn(STATUSES).withMessage('Estado inválido'),
  validateRequest,
], updateCompany);

module.exports = router;
