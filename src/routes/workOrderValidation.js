const { body } = require('express-validator');
const { validateRequest } = require('../middleware/validateRequest');

// Validación de órdenes, compartida por el panel (/api/workorders) y la API con llave (/api/v1).
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

const statusValidation = [
  body('status').isIn(['pendiente', 'en_proceso', 'completada', 'cancelada']).withMessage('Estado inválido'),
  body('note').optional().trim().isLength({ max: 500 }).withMessage('La nota no debe superar 500 caracteres'),
  body('location.lat').optional().isFloat({ min: -90, max: 90 }).withMessage('Latitud inválida'),
  body('location.lng').optional().isFloat({ min: -180, max: 180 }).withMessage('Longitud inválida'),
  validateRequest,
];

module.exports = { workOrderValidation, statusValidation };
