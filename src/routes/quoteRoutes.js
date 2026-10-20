const express = require('express');
const { body, query } = require('express-validator');
const { protect, authorize } = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validateRequest');
const { validateObjectId } = require('../middleware/validateObjectId');
const quotes = require('../controllers/quoteController');
const factus = require('../services/factus');

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
router.post('/:id/payment', authorize('admin'), validateObjectId, [
  body('status').isIn(['pagado', 'pendiente']).withMessage('Estado de pago inválido'),
  validateRequest,
], quotes.setPayment);
router.post('/:id/invoice', authorize('admin'), validateObjectId, [
  body('buyer').optional({ nullable: true }).isObject(),
  body('buyer.docType').optional().isIn(Object.keys(factus.DOC_TYPES)).withMessage('Tipo de documento inválido'),
  // NIT y cédula: solo dígitos (el NIT sin el DV); cédula de extranjería y pasaporte: letras y números.
  body('buyer.identification').optional({ checkFalsy: true }).trim().custom((value, { req }) => {
    if (['CE', 'PP'].includes(req.body.buyer.docType)) {
      if (!/^[A-Za-z0-9]{3,20}$/.test(value)) throw new Error('El documento lleva de 3 a 20 letras o números, sin espacios ni guiones');
    } else if (!/^\d{5,15}$/.test(value)) {
      throw new Error('El número de documento lleva de 5 a 15 dígitos, sin puntos ni guion (el DV va aparte)');
    }
    return true;
  }),
  // El DV es opcional (Factus lo calcula); si se escribe con un NIT, tiene que ser el que da el algoritmo de la DIAN.
  body('buyer.dv').optional({ checkFalsy: true }).matches(/^\d$/).withMessage('El dígito de verificación es un solo dígito').bail()
    .custom((dv, { req }) => {
      const { docType, identification } = req.body.buyer;
      if (docType === 'NIT' && /^\d{5,15}$/.test(String(identification || '')) && factus.nitDv(identification) !== dv) {
        throw new Error('El dígito de verificación no corresponde a ese NIT. Revisa el número o deja el DV vacío: Factus lo calcula');
      }
      return true;
    }),
  body('buyer.country').optional({ checkFalsy: true }).trim().matches(/^[A-Za-z]{2}$/).withMessage('El país va con su código de dos letras (CO, VE, US…)'),
  body('buyer.name').if(body('buyer.identification').exists({ checkFalsy: true })).trim().notEmpty().withMessage('Escribe el nombre o la razón social').isLength({ max: 120 }),
  body('buyer.email').optional({ checkFalsy: true }).isEmail().withMessage('Correo inválido'),
  body('buyer.address').optional().trim().isLength({ max: 200 }),
  body('buyer.phone').optional().trim().isLength({ max: 30 }),
  validateRequest,
], quotes.invoiceQuote);

module.exports = router;
