const express = require('express');
const { protect, authorize } = require('../middleware/authMiddleware');
const { updateBranding } = require('../controllers/brandingController');

// La empresa del usuario. «Mi marca»: solo el administrador cambia el logo y los colores.
const router = express.Router();

router.put('/branding', protect, authorize('admin'), updateBranding);

module.exports = router;
