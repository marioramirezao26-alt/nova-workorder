const express = require('express');
const { body } = require('express-validator');
const { validateRequest } = require('../middleware/validateRequest');
const { demoLimiter } = require('../middleware/demoLimiter');
const { requestDemo } = require('../controllers/demoController');

// Rutas sin sesión que usa la página de ventas (novaworkorder.com). Caddy solo deja pasar /api/public/* en ese dominio.
const router = express.Router();

router.post('/demo', demoLimiter, [
  body('company').trim().notEmpty().withMessage('Escribe el nombre de tu empresa').isLength({ max: 150 }),
  body('name').trim().notEmpty().withMessage('Escribe tu nombre').isLength({ max: 100 }),
  body('email').trim().isEmail().withMessage('Escribe un email válido').isLength({ max: 200 }),
  body('phone').optional().trim().isLength({ max: 40 }),
  body('product').optional({ checkFalsy: true }).isIn(['servicios', 'pedidos']).withMessage('Elige la app que te interesa'),
  body('technicians').optional({ nullable: true, checkFalsy: true }).isInt({ min: 1, max: 10000 }).withMessage('¿Cuántos técnicos? Un número')
    .toInt(),
  body('message').optional().trim().isLength({ max: 1000 }).withMessage('El mensaje es muy largo'),
  validateRequest,
], requestDemo);

module.exports = router;
