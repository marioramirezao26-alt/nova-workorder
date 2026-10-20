const express = require('express');
const { body } = require('express-validator');
const { protect, authorize } = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validateRequest');
const { validateObjectId } = require('../middleware/validateObjectId');
const { workOrderValidation, statusValidation } = require('./workOrderValidation');
const {
  getWorkOrders,
  createWorkOrder,
  getWorkOrderById,
  updateWorkOrder,
  deleteWorkOrder,
  updateWorkOrderStatus,
  pingWorkOrder,
  liveWorkOrders,
} = require('../controllers/workOrderController');

const router = express.Router();

router.use(protect);

router.get('/', authorize('admin', 'tecnico', 'cliente'), getWorkOrders);
router.get('/live', authorize('admin'), liveWorkOrders);
router.post('/', authorize('admin', 'tecnico'), workOrderValidation, createWorkOrder);
router.get('/:id', authorize('admin', 'tecnico', 'cliente'), validateObjectId, getWorkOrderById);
router.put('/:id', authorize('admin', 'tecnico'), validateObjectId, workOrderValidation, updateWorkOrder);
router.delete('/:id', authorize('admin'), validateObjectId, deleteWorkOrder);
router.patch('/:id/status', authorize('admin', 'tecnico'), validateObjectId, statusValidation, updateWorkOrderStatus);
router.post('/:id/ping', authorize('admin', 'tecnico'), validateObjectId, [
  body('location.lat').isFloat({ min: -90, max: 90 }).withMessage('Latitud inválida'),
  body('location.lng').isFloat({ min: -180, max: 180 }).withMessage('Longitud inválida'),
  validateRequest,
], pingWorkOrder);

module.exports = router;
