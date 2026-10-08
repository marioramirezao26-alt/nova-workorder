const express = require('express');
const { body } = require('express-validator');
const { protect } = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validateRequest');
const { registerUser, loginUser, getProfile, changePassword } = require('../controllers/authController');
const { loginLimiter } = require('../middleware/loginLimiter');

const router = express.Router();

const loginValidation = [
  body('email').isEmail().withMessage('Debe enviar un email válido'),
  body('password').notEmpty().withMessage('La contraseña es obligatoria'),
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

module.exports = router;
