const express = require('express');
const { body } = require('express-validator');
const { protect } = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validateRequest');
const { registerUser, loginUser, getProfile } = require('../controllers/authController');

const router = express.Router();

const registerValidation = [
  body('name').trim().notEmpty().withMessage('El nombre es obligatorio').isLength({ max: 100 }).withMessage('El nombre no debe superar 100 caracteres'),
  body('email').isEmail().withMessage('Debe enviar un email válido'),
  body('password').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
  validateRequest,
];

const loginValidation = [
  body('email').isEmail().withMessage('Debe enviar un email válido'),
  body('password').notEmpty().withMessage('La contraseña es obligatoria'),
  validateRequest,
];

router.post('/register', registerValidation, registerUser);
router.post('/login', loginValidation, loginUser);
router.get('/profile', protect, getProfile);

module.exports = router;
