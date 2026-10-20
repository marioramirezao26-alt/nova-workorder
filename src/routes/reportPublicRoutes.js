const express = require('express');
const report = require('../controllers/serviceReportController');

// Informe de servicio público (sin sesión): lo abre el cliente con el enlace que le comparte la empresa.
const router = express.Router();

router.get('/:token', report.publicReport);
router.get('/:token/archivos/:fileId', report.publicReportFile);

module.exports = router;
