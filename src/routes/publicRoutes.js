const express = require('express');
const { body } = require('express-validator');
const { validateRequest } = require('../middleware/validateRequest');
const { demoLimiter } = require('../middleware/demoLimiter');
const { requestDemo } = require('../controllers/demoController');
const { visitLimiter } = require('../middleware/visitLimiter');
const { recordVisit } = require('../controllers/analyticsController');
const { getLogo } = require('../controllers/brandingController');
const { validateObjectId } = require('../middleware/validateObjectId');
const { chatLimiter } = require('../middleware/chatLimiter');
const { chat, chatStatus } = require('../controllers/chatController');

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
  body('kind').optional({ checkFalsy: true }).isIn(['demo', 'prueba']).withMessage('Elige prueba gratis o demo'),
  body('utm').optional().isString().isLength({ max: 60 }),
  body('ref').optional().isString().isLength({ max: 500 }),
  body('referral').optional().isString().isLength({ max: 40 }),
  body('source').optional({ checkFalsy: true }).isIn(['web', 'chat']),
  validateRequest,
], requestDemo);

// Contadores anónimos de la página (sin cookies): visitas y clics en «Empieza gratis / Pide tu demo».
router.post('/visit', visitLimiter, [
  body('event').optional().isIn(['visita', 'clic']),
  body('path').optional().isString().isLength({ max: 200 }),
  body('utm').optional().isString().isLength({ max: 60 }),
  body('ref').optional().isString().isLength({ max: 500 }),
  body('referral').optional().isString().isLength({ max: 40 }),
  validateRequest,
], recordVisit);

// El chat «GABY · Ventas» de la página: responde precios y dudas. Sin OPENROUTER_API_KEY no aparece.
router.get('/chat', chatStatus);
router.post('/chat', chatLimiter, [
  body('messages').isArray({ min: 1, max: 30 }).withMessage('Escribe tu pregunta'),
  body('messages.*.content').isString().isLength({ max: 2000 }),
  validateRequest,
], chat);

// El logo de cada empresa (lo muestra su app, también antes de entrar).
router.get('/logo/:id', validateObjectId, getLogo);

module.exports = router;
