const express = require('express');
const { body } = require('express-validator');
const { validateRequest } = require('../middleware/validateRequest');
const { quoteLimiter } = require('../middleware/quoteLimiter');
const quotes = require('../controllers/quoteController');

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

module.exports = router;
