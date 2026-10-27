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

// Mensajes de error en el idioma de la página que envía (la de Estados Unidos manda lang: 'en').
const t = (es, en) => (value, { req }) => (req.body && req.body.lang === 'en' ? en : es);

router.post('/demo', demoLimiter, [
  body('company').trim().notEmpty().withMessage(t('Escribe el nombre de tu empresa', 'Please enter your company name')).isLength({ max: 150 }),
  body('name').trim().notEmpty().withMessage(t('Escribe tu nombre', 'Please enter your name')).isLength({ max: 100 }),
  body('email').trim().isEmail().withMessage(t('Escribe un email válido', 'Please enter a valid email')).isLength({ max: 200 }),
  body('phone').optional().trim().isLength({ max: 40 }),
  body('product').optional({ checkFalsy: true }).isIn(['servicios', 'pedidos']).withMessage(t('Elige la app que te interesa', 'Choose an app')),
  body('technicians').optional({ nullable: true, checkFalsy: true }).isInt({ min: 1, max: 10000 }).withMessage(t('¿Cuántos técnicos? Un número', 'How many technicians? A number, please'))
    .toInt(),
  body('message').optional().trim().isLength({ max: 1000 }).withMessage(t('El mensaje es muy largo', 'The message is too long')),
  body('kind').optional({ checkFalsy: true }).isIn(['demo', 'prueba']).withMessage(t('Elige prueba gratis o demo', 'Choose free trial or demo')),
  body('utm').optional().isString().isLength({ max: 60 }),
  body('ref').optional().isString().isLength({ max: 500 }),
  body('referral').optional().isString().isLength({ max: 40 }),
  // La ficha del chat con GABY (?l= del enlace de prueba): texto corto; el controlador solo guarda uno con la forma esperada.
  body('l').optional({ nullable: true }).isString().isLength({ max: 64 }),
  body('source').optional({ checkFalsy: true }).isIn(['web', 'chat']),
  body('lang').optional({ checkFalsy: true }).isIn(['es', 'en']),
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
  body('lang').optional({ checkFalsy: true }).isIn(['es', 'en']),
  validateRequest,
], chat);

// El logo de cada empresa (lo muestra su app, también antes de entrar).
router.get('/logo/:id', validateObjectId, getLogo);

module.exports = router;
