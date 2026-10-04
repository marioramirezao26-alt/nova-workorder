const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const {
  getWorkOrders,
  createWorkOrder,
  getWorkOrderById,
  updateWorkOrder,
  deleteWorkOrder,
} = require('../controllers/workOrderController');

const router = express.Router();

router.use(protect);

router.get('/', getWorkOrders);
router.post('/', createWorkOrder);
router.get('/:id', getWorkOrderById);
router.put('/:id', updateWorkOrder);
router.delete('/:id', deleteWorkOrder);

module.exports = router;
