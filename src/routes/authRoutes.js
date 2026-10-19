const express = require('express');
const { body } = require('express-validator');
const { protect } = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validateRequest');
const { registerUser, loginUser, getProfile, changePassword, setLocationConsent, setLiveConsent } = require('../controllers/authController');
const { loginLimiter } = require('../middleware/loginLimiter');

const router = express.Router();

const loginValidation = [
  body('email').isEmail().withMessage('Debe enviar un email válido'),
  body('password').isString().notEmpty().withMessage('La contraseña es obligatoria'),
  validateRequest,
];

router.post('/register', registerUser);                  // cerrado: responde 410 (ver authController)
router.post('/login', loginLimiter, loginValidation, loginUser);
router.get('/profile', protect, getProfile);
router.put('/password', protect, [
  body('currentPassword').notEmpty().withMessage('La contraseña actual es obligatoria'),
  body('newPassword').isLength({ min: 8 }).withMessage('La nueva contraseña debe tener al menos 8 caracteres'),
  validateRequest,
], changePassword);

// El técnico autoriza o retira el registro de su ubicación al iniciar y cerrar órdenes (Ley 1581).
router.put('/location-consent', protect, [
  body('accept').isBoolean().withMessage('Indica si aceptas (true) o no (false)'),
  validateRequest,
], setLocationConsent);
router.put('/live-consent', protect, [
  body('accept').isBoolean().withMessage('Indica si aceptas (true) o no (false)'),
  validateRequest,
], setLiveConsent);

module.exports = router;
