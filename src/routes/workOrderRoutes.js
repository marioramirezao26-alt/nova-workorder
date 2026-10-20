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
const report = require('../controllers/serviceReportController');

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

// Informe de servicio: checklist, fotos de antes y después, firma del cliente y enlace público del informe.
const photoBody = express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '450kb' });
router.put('/:id/checklist', authorize('admin', 'tecnico'), validateObjectId, [
  body('template').optional({ nullable: true }).isMongoId().withMessage('Plantilla inválida'),
  validateRequest,
], report.setChecklist);
router.patch('/:id/checklist', authorize('admin', 'tecnico'), validateObjectId, [
  body('items').isArray({ max: 40 }).withMessage('Checklist inválido'),
  validateRequest,
], report.updateChecklist);
router.post('/:id/files', authorize('admin', 'tecnico'), validateObjectId, photoBody, report.uploadPhoto);
router.get('/:id/files/:fileId', authorize('admin', 'tecnico', 'cliente'), validateObjectId, report.getFile);
router.delete('/:id/files/:fileId', authorize('admin', 'tecnico'), validateObjectId, report.deletePhoto);
router.post('/:id/signature', authorize('admin', 'tecnico'), validateObjectId, report.sign);
router.post('/:id/report-link', authorize('admin', 'tecnico', 'cliente'), validateObjectId, report.reportLink);

module.exports = router;
