const express = require('express');
const { body, query } = require('express-validator');
const { protect, authorize } = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validateRequest');
const { validateObjectId } = require('../middleware/validateObjectId');
const quotes = require('../controllers/quoteController');

// Cotizaciones de la empresa: las arman el administrador y los técnicos; un usuario cliente ve las suyas.
const router = express.Router();
router.use(protect);

const fields = [
  body('client').optional().isMongoId().withMessage('Elige el cliente'),
  body('title').optional().trim().notEmpty().withMessage('El título es obligatorio').isLength({ max: 150 }).withMessage('El título no debe superar 150 caracteres'),
  body('notes').optional().isString().trim().isLength({ max: 2000 }).withMessage('Las condiciones no deben superar 2000 caracteres'),
  body('validUntil').optional({ nullable: true, checkFalsy: true }).matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Fecha de validez inválida'),
  body('items').optional().isArray({ min: 1, max: 50 }).withMessage('La cotización lleva entre 1 y 50 renglones'),
];

router.get('/', authorize('admin', 'tecnico', 'cliente'), [query('q').optional().isString().isLength({ max: 80 }), validateRequest], quotes.listQuotes);
router.post('/', authorize('admin', 'tecnico'), [
  body('client').exists({ checkFalsy: true }).withMessage('Elige el cliente'),
  body('title').exists({ checkFalsy: true }).withMessage('El título es obligatorio'),
  body('items').exists().withMessage('Agrega al menos un renglón'),
  ...fields, validateRequest,
], quotes.createQuote);
router.get('/:id', authorize('admin', 'tecnico', 'cliente'), validateObjectId, quotes.getQuote);
router.put('/:id', authorize('admin', 'tecnico'), validateObjectId, [...fields, validateRequest], quotes.updateQuote);
router.delete('/:id', authorize('admin'), validateObjectId, quotes.deleteQuote);
router.post('/:id/send', authorize('admin', 'tecnico'), validateObjectId, quotes.sendQuote);
router.post('/:id/reopen', authorize('admin', 'tecnico'), validateObjectId, quotes.reopenQuote);
router.post('/:id/approve', authorize('admin'), validateObjectId, [body('note').optional().isString().isLength({ max: 500 }), validateRequest], quotes.approveQuote);
router.post('/:id/convert', authorize('admin'), validateObjectId, quotes.convertQuote);

module.exports = router;
