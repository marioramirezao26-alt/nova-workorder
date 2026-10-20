const express = require('express');
const { protect, authorize } = require('../middleware/authMiddleware');
const { body } = require('express-validator');
const { updateBranding } = require('../controllers/brandingController');
const { publicUser } = require('../controllers/authController');
const { validateRequest } = require('../middleware/validateRequest');
const Company = require('../models/Company');
const wompi = require('../services/wompi');
const factus = require('../services/factus');
const { audit } = require('../utils/audit');
const { limiter } = require('../utils/rateStore');

// La empresa del usuario. «Mi marca»: solo el administrador cambia el logo y los colores.
const router = express.Router();

router.put('/branding', protect, authorize('admin'), updateBranding);

// Registrar la ubicación del técnico al iniciar y completar órdenes: lo activa o apaga el administrador.
router.put('/location-tracking', protect, authorize('admin'), [
  body('enabled').isBoolean().withMessage('Indica si se activa (true) o no (false)'),
  validateRequest,
], async (req, res) => {
  try {
    const company = await Company.findByIdAndUpdate(req.company._id, { locationTracking: req.body.enabled }, { new: true });
    res.status(200).json(publicUser(req.user, company));
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error al guardar el ajuste' });
  }
});

// Mapa en vivo: dónde va cada técnico mientras tiene una orden en proceso. Lo activa o apaga el administrador.
router.put('/live-tracking', protect, authorize('admin'), [
  body('enabled').isBoolean().withMessage('Indica si se activa (true) o no (false)'),
  validateRequest,
], async (req, res) => {
  try {
    const company = await Company.findByIdAndUpdate(req.company._id, { liveTracking: req.body.enabled }, { new: true });
    res.status(200).json(publicUser(req.user, company));
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error al guardar el ajuste' });
  }
});

// Informe de servicio: exigir la firma del cliente para que el técnico complete una orden.
router.put('/require-signature', protect, authorize('admin'), [
  body('enabled').isBoolean().withMessage('Indica si se activa (true) o no (false)'),
  validateRequest,
], async (req, res) => {
  try {
    const company = await Company.findByIdAndUpdate(req.company._id, { requireSignature: req.body.enabled }, { new: true });
    res.status(200).json(publicUser(req.user, company));
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error al guardar el ajuste' });
  }
});

// «Cobros con Wompi» (Integraciones): la empresa conecta SU cuenta. Lo que se devuelve nunca incluye los secretos.
const wompiView = (company) => {
  const w = (company && company.wompi) || {};
  return {
    connected: wompi.connected(company),
    available: company.lang !== 'en',                         // Wompi cobra en pesos: no aplica a empresas en dólares
    test: wompi.isTest(w.publicKey),
    publicKey: w.publicKey || '',
    merchantName: w.merchantName || '',
    depositPercent: w.depositPercent || 100,
    connectedAt: w.connectedAt || null,
    lastEventAt: w.lastEventAt || null,
    eventsPath: `/api/wompi/${company.slug}/eventos`,
  };
};
const wompiLimiter = limiter({
  name: 'wompi-conectar',
  windowMs: 60 * 60 * 1000,
  max: 10,
  onLimit: (req, res) => res.status(429).json({ message: 'Demasiados intentos. Espera un rato y vuelve a intentarlo.' }),
});

router.get('/wompi', protect, authorize('admin'), async (req, res) => {
  res.status(200).json(wompiView(await Company.findById(req.company._id)));
});

router.put('/wompi', protect, authorize('admin'), wompiLimiter, [
  body('publicKey').trim().matches(wompi.PUBLIC_KEY).withMessage('La llave pública empieza por pub_prod_ (o pub_test_ para pruebas)'),
  body('integritySecret').trim().matches(wompi.INTEGRITY).withMessage('El secreto de integridad empieza por prod_integrity_ (o test_integrity_)'),
  body('eventsSecret').trim().matches(wompi.EVENTS).withMessage('El secreto de eventos empieza por prod_events_ (o test_events_)'),
  body('depositPercent').optional().isInt({ min: 10, max: 100 }).withMessage('El anticipo va de 10 % a 100 %').toInt(),
  validateRequest,
], async (req, res) => {
  try {
    const { publicKey, integritySecret, eventsSecret } = req.body;
    const env = (k) => (k.includes('test') ? 'test' : 'prod');
    if (new Set([env(publicKey), env(integritySecret), env(eventsSecret)]).size !== 1) {
      return res.status(400).json({ message: 'Las tres llaves deben ser del mismo ambiente: todas de producción o todas de pruebas' });
    }
    if (req.company.lang === 'en') return res.status(400).json({ message: 'Wompi cobra en pesos colombianos: tu empresa trabaja en dólares' });
    const merchant = await wompi.verifyMerchant(publicKey);
    if (merchant.error) return res.status(400).json({ message: merchant.error });
    const company = await Company.findById(req.company._id);
    company.wompi = {
      publicKey, ...wompi.sealKeys({ integritySecret, eventsSecret }), merchantName: merchant.name,
      depositPercent: req.body.depositPercent || (company.wompi && company.wompi.depositPercent) || 100, connectedAt: new Date(), lastEventAt: null,
    };
    await company.save();
    await audit(req, 'empresa.wompi', `Conectó Wompi${wompi.isTest(publicKey) ? ' (pruebas)' : ''}: ${merchant.name}`);
    return res.status(200).json(wompiView(company));
  } catch (error) {
    return res.status(500).json({ message: 'No se pudo conectar Wompi' });
  }
});

// Cuánto de una cotización aprobada se cobra en línea: 100 % o un anticipo.
router.put('/wompi/deposit', protect, authorize('admin'), [
  body('depositPercent').isInt({ min: 10, max: 100 }).withMessage('El anticipo va de 10 % a 100 %').toInt(),
  validateRequest,
], async (req, res) => {
  try {
    const company = await Company.findByIdAndUpdate(req.company._id, { 'wompi.depositPercent': req.body.depositPercent }, { new: true });
    await audit(req, 'empresa.wompi', `Cambió el cobro en línea al ${req.body.depositPercent} % de cada cotización`);
    res.status(200).json(wompiView(company));
  } catch (error) {
    res.status(500).json({ message: 'No se pudo guardar el ajuste' });
  }
});

router.delete('/wompi', protect, authorize('admin'), async (req, res) => {
  try {
    const company = await Company.findById(req.company._id);
    company.wompi = { publicKey: '', integritySealed: '', eventsSealed: '', merchantName: '', depositPercent: (company.wompi && company.wompi.depositPercent) || 100, connectedAt: null, lastEventAt: null };
    await company.save();
    await audit(req, 'empresa.wompi', 'Desconectó Wompi');
    res.status(200).json(wompiView(company));
  } catch (error) {
    res.status(500).json({ message: 'No se pudo desconectar Wompi' });
  }
});

// «Factura electrónica DIAN» (Integraciones): la empresa conecta su cuenta de Factus (proveedor tecnológico autorizado
// por la DIAN). Las credenciales se prueban pidiendo un token antes de guardarlas; el secreto y la contraseña quedan
// cifrados y nunca se devuelven.
const factusView = (company) => {
  const f = (company && company.factus) || {};
  return {
    connected: factus.connected(company),
    available: company.lang !== 'en',
    env: f.env || 'pruebas',
    clientId: f.clientId || '',
    username: f.username || '',
    numberingRangeId: f.numberingRangeId || null,
    connectedAt: f.connectedAt || null,
  };
};

router.get('/factus', protect, authorize('admin'), async (req, res) => {
  res.status(200).json(factusView(await Company.findById(req.company._id)));
});

router.put('/factus', protect, authorize('admin'), wompiLimiter, [
  body('env').isIn(['pruebas', 'produccion']).withMessage('Elige pruebas o producción'),
  body('clientId').trim().notEmpty().withMessage('Falta el client_id de Factus').isLength({ max: 120 }),
  body('clientSecret').trim().notEmpty().withMessage('Falta el client_secret de Factus').isLength({ max: 200 }),
  body('username').trim().isEmail().withMessage('El usuario de Factus es tu correo'),
  body('password').notEmpty().withMessage('Falta la contraseña de Factus').isLength({ max: 200 }),
  body('numberingRangeId').isInt({ min: 1 }).withMessage('Escribe el id del rango de numeración (en Factus → Rangos)').toInt(),
  validateRequest,
], async (req, res) => {
  try {
    if (req.company.lang === 'en') return res.status(400).json({ message: 'La factura electrónica DIAN es para empresas en Colombia' });
    const company = await Company.findById(req.company._id);
    company.factus = { env: req.body.env, ...factus.sealCredentials(req.body), numberingRangeId: req.body.numberingRangeId, connectedAt: new Date() };
    try {
      await factus.token(company);                       // si no da token, no se guarda nada
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }
    await company.save();
    await audit(req, 'empresa.factus', `Conectó la factura electrónica (${req.body.env})`);
    return res.status(200).json(factusView(company));
  } catch (error) {
    return res.status(500).json({ message: 'No se pudo conectar la factura electrónica' });
  }
});

router.delete('/factus', protect, authorize('admin'), async (req, res) => {
  try {
    const company = await Company.findById(req.company._id);
    company.factus = { env: 'pruebas', clientId: '', clientSecretSealed: '', username: '', passwordSealed: '', numberingRangeId: null, connectedAt: null };
    await company.save();
    await audit(req, 'empresa.factus', 'Desconectó la factura electrónica');
    res.status(200).json(factusView(company));
  } catch (error) {
    res.status(500).json({ message: 'No se pudo desconectar la factura electrónica' });
  }
});

module.exports = router;
