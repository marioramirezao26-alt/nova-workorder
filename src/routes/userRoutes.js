const express = require('express');
const { body } = require('express-validator');
const { protect, authorize } = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validateRequest');
const { validateObjectId } = require('../middleware/validateObjectId');
const { getUsers, createUser, updateUser } = require('../controllers/userController');

const router = express.Router();
const ROLES = ['admin', 'tecnico', 'cliente'];

router.use(protect);

router.get('/', authorize('admin', 'tecnico'), getUsers);
router.post('/', authorize('admin'), [
  body('name').trim().notEmpty().withMessage('El nombre es obligatorio').isLength({ max: 100 }),
  body('email').isEmail().withMessage('Debe enviar un email válido'),
  body('role').isIn(ROLES).withMessage('Rol inválido'),
  body('password').optional().isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres'),
  body('client').optional({ nullable: true }).isMongoId().withMessage('Cliente inválido'),
  validateRequest,
], createUser);
router.put('/:id', authorize('admin'), validateObjectId, [
  body('name').optional().trim().notEmpty().isLength({ max: 100 }),
  body('role').optional().isIn(ROLES).withMessage('Rol inválido'),
  body('active').optional().isBoolean().withMessage('active debe ser verdadero o falso'),
  body('client').optional({ nullable: true }).isMongoId().withMessage('Cliente inválido'),
  body('resetPassword').optional().isBoolean(),
  validateRequest,
], updateUser);

module.exports = router;
