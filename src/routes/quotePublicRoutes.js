const express = require('express');
const { body } = require('express-validator');
const { validateRequest } = require('../middleware/validateRequest');
const { quoteLimiter } = require('../middleware/quoteLimiter');
const quotes = require('../controllers/quoteController');
const { wompiGone } = require('../utils/wompiRetirado');

// Cotización pública (sin sesión): la abre el cliente con el enlace que le comparte la empresa y la aprueba o rechaza.
const router = express.Router();

const who = body('name').isString().trim().isLength({ min: 3, max: 100 }).withMessage('Escribe tu nombre completo');

router.get('/:token', quotes.publicQuote);
router.post('/:token/aprobar', quoteLimiter, [
  who,
  body('accept').custom((v) => v === true).withMessage('Marca la casilla para aceptar la cotización'),
  validateRequest,
], quotes.publicApprove);
router.post('/:token/rechazar', quoteLimiter, [
  who,
  body('note').optional().isString().isLength({ max: 500 }).withMessage('El motivo es muy largo (máximo 500)'),
  validateRequest,
], quotes.publicReject);

// El pago en línea con Wompi (y su consulta al volver del checkout) se retiró: responde 410 sin leer la cotización.
router.use('/:token/pago', wompiGone);

module.exports = router;
