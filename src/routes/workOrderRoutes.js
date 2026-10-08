const express = require('express');
const { body } = require('express-validator');
const { protect, authorize } = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validateRequest');
const { validateObjectId } = require('../middleware/validateObjectId');
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
  body('client').optional({ nullable: true, checkFalsy: true }).isMongoId().withMessage('Cliente inválido'),
  body('assignedTo').optional({ nullable: true, checkFalsy: true }).isMongoId().withMessage('Técnico inválido'),
  body('dueDate').optional({ nullable: true, checkFalsy: true }).isISO8601().withMessage('Fecha límite inválida'),
  validateRequest,
];

router.use(protect);

router.get('/', authorize('admin', 'tecnico', 'cliente'), getWorkOrders);
router.post('/', authorize('admin', 'tecnico'), workOrderValidation, createWorkOrder);
router.get('/:id', authorize('admin', 'tecnico', 'cliente'), validateObjectId, getWorkOrderById);
router.put('/:id', authorize('admin', 'tecnico'), validateObjectId, workOrderValidation, updateWorkOrder);
router.delete('/:id', authorize('admin'), validateObjectId, deleteWorkOrder);

module.exports = router;
