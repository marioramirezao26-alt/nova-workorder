const express = require('express');
const { apiKeyAuth, requireWrite } = require('../middleware/apiKeyAuth');
const { validateObjectId } = require('../middleware/validateObjectId');
const { workOrderValidation, statusValidation } = require('./workOrderValidation');
const { getWorkOrders, getWorkOrderById, createWorkOrder, updateWorkOrderStatus } = require('../controllers/workOrderController');
const { getClients, getClientById } = require('../controllers/clientController');

// API pública con llave de empresa (docs/API.md). Reúsa los mismos controladores y validaciones del panel: la llave
// actúa como el administrador que la creó, siempre dentro de su empresa. No borra nada.
const router = express.Router();
router.use(apiKeyAuth);

router.get('/workorders', getWorkOrders);
router.get('/workorders/:id', validateObjectId, getWorkOrderById);
router.post('/workorders', requireWrite, workOrderValidation, createWorkOrder);
// Por la API nunca viaja la ubicación del técnico: esa solo la manda su celular, con su autorización.
const noLocation = (req, res, next) => { if (req.body) delete req.body.location; next(); };
router.patch('/workorders/:id/status', requireWrite, validateObjectId, noLocation, statusValidation, updateWorkOrderStatus);
router.get('/clients', getClients);
router.get('/clients/:id', validateObjectId, getClientById);

router.use((req, res) => res.status(404).json({ message: 'Ruta no encontrada en la API v1' }));

module.exports = router;
