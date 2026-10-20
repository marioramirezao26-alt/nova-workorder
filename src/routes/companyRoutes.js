const express = require('express');
const { protect, authorize } = require('../middleware/authMiddleware');
const { body } = require('express-validator');
const { updateBranding } = require('../controllers/brandingController');
const { publicUser } = require('../controllers/authController');
const { validateRequest } = require('../middleware/validateRequest');
const Company = require('../models/Company');

// La empresa del usuario. «Mi marca»: solo el administrador cambia el logo y los colores.
const router = express.Router();

router.put('/branding', protect, authorize('admin'), updateBranding);

// Registrar la ubicación del técnico al iniciar y completar órdenes: lo activa o apaga el administrador.
router.put('/location-tracking', protect, authorize('admin'), [
  body('enabled').isBoolean().withMessage('Indica si se activa (true) o no (false)'),
  validateRequest,
], async (req, res) => {
  try {
    const company = await Company.findByIdAndUpdate(req.company._id, { locationTracking: req.body.enabled }, { new: true });
    res.status(200).json(publicUser(req.user, company));
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error al guardar el ajuste' });
  }
});

// Mapa en vivo: dónde va cada técnico mientras tiene una orden en proceso. Lo activa o apaga el administrador.
router.put('/live-tracking', protect, authorize('admin'), [
  body('enabled').isBoolean().withMessage('Indica si se activa (true) o no (false)'),
  validateRequest,
], async (req, res) => {
  try {
    const company = await Company.findByIdAndUpdate(req.company._id, { liveTracking: req.body.enabled }, { new: true });
    res.status(200).json(publicUser(req.user, company));
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error al guardar el ajuste' });
  }
});

// Informe de servicio: exigir la firma del cliente para que el técnico complete una orden.
router.put('/require-signature', protect, authorize('admin'), [
  body('enabled').isBoolean().withMessage('Indica si se activa (true) o no (false)'),
  validateRequest,
], async (req, res) => {
  try {
    const company = await Company.findByIdAndUpdate(req.company._id, { requireSignature: req.body.enabled }, { new: true });
    res.status(200).json(publicUser(req.user, company));
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error al guardar el ajuste' });
  }
});

module.exports = router;
