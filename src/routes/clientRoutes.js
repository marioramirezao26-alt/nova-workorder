const express = require('express');
const { body } = require('express-validator');
const { protect } = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validateRequest');
const {
  getWorkOrders,
  createWorkOrder,
  getWorkOrderById,
  updateWorkOrder,
  deleteWorkOrder,
} = require('../controllers/workOrderController');

const router = express.Router();

const workOrderValidation = [
  body('title').trim().notEmpty().withMessage('El título es obligatorio').isLength({ min: 3, max: 200 }).withMessage('El título debe tener entre 3 y 200 caracteres'),
  body('description').trim().notEmpty().withMessage('La descripción es obligatoria').isLength({ min: 10, max: 2000 }).withMessage('La descripción debe tener entre 10 y 2000 caracteres'),
  body('status').optional().isIn(['pendiente', 'en_proceso', 'completada', 'cancelada']).withMessage('Estado inválido'),
  body('priority').optional().isIn(['baja', 'media', 'alta', 'urgente']).withMessage('Prioridad inválida'),
  body('customerName').optional().trim().isLength({ max: 150 }).withMessage('El cliente no debe superar 150 caracteres'),
  body('notes').optional().trim().isLength({ max: 1000 }).withMessage('Las notas no deben superar 1000 caracteres'),
  validateRequest,
];

router.use(protect);

router.get('/', getWorkOrders);
router.post('/', workOrderValidation, createWorkOrder);
router.get('/:id', getWorkOrderById);
router.put('/:id', workOrderValidation, updateWorkOrder);
router.delete('/:id', deleteWorkOrder);

module.exports = router;
