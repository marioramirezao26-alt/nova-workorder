const express = require('express');
const { body } = require('express-validator');
const { protect } = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validateRequest');
const {
  getClients,
  createClient,
  getClientById,
  updateClient,
  deleteClient,
} = require('../controllers/clientController');

const router = express.Router();

const clientValidation = [
  body('name').trim().notEmpty().withMessage('El nombre del cliente es obligatorio'),
  body('email').isEmail().withMessage('Debe enviar un email válido'),
  body('phone').optional().trim().isLength({ max: 30 }).withMessage('El teléfono no debe superar 30 caracteres'),
  body('company').optional().trim().isLength({ max: 150 }).withMessage('La empresa no debe superar 150 caracteres'),
  body('address').optional().trim().isLength({ max: 250 }).withMessage('La dirección no debe superar 250 caracteres'),
  validateRequest,
];

router.use(protect);

router.get('/', getClients);
router.post('/', clientValidation, createClient);
router.get('/:id', getClientById);
router.put('/:id', clientValidation, updateClient);
router.delete('/:id', deleteClient);

module.exports = router;
