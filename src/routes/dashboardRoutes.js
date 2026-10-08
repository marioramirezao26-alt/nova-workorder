const express = require('express');
const { protect, authorize } = require('../middleware/authMiddleware');
const { getDashboardSummary } = require('../controllers/dashboardController');

const router = express.Router();

router.use(protect);
router.get('/summary', authorize('admin', 'tecnico', 'cliente'), getDashboardSummary);

module.exports = router;
