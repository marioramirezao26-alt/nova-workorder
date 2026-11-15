const express = require('express');
const { protect, authorize } = require('../middleware/authMiddleware');
const { body } = require('express-validator');
const { updateBranding } = require('../controllers/brandingController');
const { publicUser } = require('../controllers/authController');
const { validateRequest } = require('../middleware/validateRequest');
const Company = require('../models/Company');
const factus = require('../services/factus');
const mp = require('../services/mercadopago');
const { audit } = require('../utils/audit');
const { wompiGone } = require('../utils/wompiRetirado');
const { isColombia } = require('../utils/money');
const { limiter } = require('../utils/rateStore');
const { getOwnReview, saveOwnReview, withdrawOwnReview } = require('../controllers/reviewController');
const { LIMITS } = require('../models/Review');

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

// «Cobros con Wompi» se retiró (Orden 41: Mercado Pago es el proveedor exclusivo de pagos de NOVA). Toda ruta de Wompi
// (ver, conectar, cambiar el anticipo y desconectar) responde 410 y no lee ni cambia nada: ya no existe el DELETE que
// borraba las llaves, así que las que haya cifradas en la base se quedan como están, junto con la historia de los pagos.
router.use('/wompi', wompiGone);

// «Cobros con Mercado Pago» (Integraciones): la empresa conecta SU cuenta para que sus clientes paguen en línea las
// cotizaciones aprobadas. Solo el administrador la conecta; nada se activa solo. Apagado en el servidor (sin
// MERCADOPAGO_ENABLED=1) todo responde 404 y no se llama a Mercado Pago. Lo que se devuelve nunca incluye el Access Token
// ni la clave secreta del webhook.
const mpView = (company) => {
  const m = (company && company.mercadopago) || {};
  return {
    available: mp.available(company),                 // Colombia y México; en Estados Unidos no opera
    connected: mp.connected(company),
    usable: mp.usable(company),
    test: m.test !== false,
    production: mp.productionAllowed(),
    currency: mp.currencyFor(company),
    publicKey: m.publicKey || '',
    nickname: m.nickname || '',
    siteId: m.siteId || '',
    depositPercent: m.depositPercent || 100,
    connectedAt: m.connectedAt || null,
    lastEventAt: m.lastEventAt || null,
    avisosPath: `/api/mercadopago/${company.slug}/avisos`,
  };
};
const mpOff = (req, res, next) => (mp.enabled() ? next() : res.status(404).json({ message: mp.OFF }));
// Intentos de conectar Mercado Pago: su propio cupo y por empresa.
const mpLimiter = limiter({
  name: 'mercadopago-conectar',
  windowMs: 60 * 60 * 1000,
  max: 10,
  key: (req) => String(req.company._id),
  onLimit: (req, res) => res.status(429).json({ message: 'Demasiados intentos. Espera un rato y vuelve a intentarlo.' }),
});

router.get('/mercadopago', mpOff, protect, authorize('admin'), async (req, res) => {
  res.status(200).json(mpView(await Company.findById(req.company._id)));
});

router.put('/mercadopago', mpOff, protect, authorize('admin'), mpLimiter, [
  body('accessToken').isString().withMessage('Pega el Access Token de Mercado Pago').trim()
    .matches(mp.ACCESS_TOKEN).withMessage('El Access Token de Mercado Pago empieza por TEST- (credenciales de prueba)'),
  body('webhookSecret').isString().withMessage('Pega la clave secreta del webhook').trim()
    .matches(mp.WEBHOOK_SECRET).withMessage('La clave secreta del webhook está en tu cuenta de Mercado Pago → Tus integraciones → Webhooks'),
  body('publicKey').optional({ checkFalsy: true }).isString().trim().matches(mp.PUBLIC_KEY).withMessage('La Public Key empieza por TEST- (o APP_USR-)'),
  body('depositPercent').optional().isInt({ min: 10, max: 100 }).withMessage('El anticipo va de 10 % a 100 %').toInt(),
  validateRequest,
], async (req, res) => {
  try {
    const { accessToken, webhookSecret } = req.body;
    const publicKey = req.body.publicKey || '';
    if (!mp.available(req.company)) {
      return res.status(400).json({ message: 'Mercado Pago no opera para tu país en NOVA: el cobro en línea es para empresas de Colombia y México' });
    }
    // el candado del prefijo: sin MERCADOPAGO_PRODUCCION=1 en el servidor, solo credenciales TEST-
    if (!mp.tokenAllowed(accessToken)) return res.status(400).json({ message: mp.TEST_ONLY });
    if (publicKey && mp.isTestToken(publicKey) !== mp.isTestToken(accessToken)) {
      return res.status(400).json({ message: 'La Public Key y el Access Token deben ser del mismo tipo: los dos de prueba o los dos de producción' });
    }
    let account;
    try {
      account = await mp.verifyAccount(accessToken, req.company);
    } catch (error) {
      if (error instanceof mp.MercadoPagoError) return res.status(400).json({ message: error.message });
      throw error;
    }
    const company = await Company.findById(req.company._id);
    company.mercadopago = {
      ...mp.sealCredentials({ accessToken, webhookSecret }), publicKey, test: mp.isTestToken(accessToken), ...account,
      depositPercent: req.body.depositPercent || (company.mercadopago && company.mercadopago.depositPercent) || 100,
      connectedAt: new Date(), lastEventAt: null,
    };
    await company.save();
    await audit(req, 'empresa.mercadopago', `Conectó Mercado Pago${mp.isTestToken(accessToken) ? ' (pruebas)' : ''}: ${account.nickname || account.userId}`);
    return res.status(200).json(mpView(company));
  } catch (error) {
    return res.status(500).json({ message: 'No se pudo conectar Mercado Pago' });
  }
});

// Cuánto de una cotización aprobada se cobra en línea: 100 % o un anticipo.
router.put('/mercadopago/deposit', mpOff, protect, authorize('admin'), [
  body('depositPercent').isInt({ min: 10, max: 100 }).withMessage('El anticipo va de 10 % a 100 %').toInt(),
  validateRequest,
], async (req, res) => {
  try {
    const company = await Company.findByIdAndUpdate(req.company._id, { 'mercadopago.depositPercent': req.body.depositPercent }, { new: true });
    await audit(req, 'empresa.mercadopago', `Cambió el cobro en línea al ${req.body.depositPercent} % de cada cotización`);
    res.status(200).json(mpView(company));
  } catch (error) {
    res.status(500).json({ message: 'No se pudo guardar el ajuste' });
  }
});

// Desconectar: lo decide el administrador. Las cotizaciones ya cobradas conservan su historia.
router.delete('/mercadopago', mpOff, protect, authorize('admin'), async (req, res) => {
  try {
    const company = await Company.findById(req.company._id);
    const depositPercent = (company.mercadopago && company.mercadopago.depositPercent) || 100;
    company.mercadopago = {
      accessTokenSealed: '', webhookSecretSealed: '', publicKey: '', test: true, userId: '', nickname: '', siteId: '',
      depositPercent, connectedAt: null, lastEventAt: null,
    };
    await company.save();
    await audit(req, 'empresa.mercadopago', 'Desconectó Mercado Pago');
    res.status(200).json(mpView(company));
  } catch (error) {
    res.status(500).json({ message: 'No se pudo desconectar Mercado Pago' });
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

// Intentos de conectar Factus: su propio cupo y por empresa (no gasta el de Mercado Pago ni el de otra empresa en la misma red).
const factusLimiter = limiter({
  name: 'factus-conectar',
  windowMs: 60 * 60 * 1000,
  max: 10,
  key: (req) => String(req.company._id),
  onLimit: (req, res) => res.status(429).json({ message: 'Demasiados intentos. Espera un rato y vuelve a intentarlo.' }),
});

router.put('/factus', protect, authorize('admin'), factusLimiter, [
  body('env').isIn(['pruebas', 'produccion']).withMessage('Elige pruebas o producción'),
  body('clientId').trim().notEmpty().withMessage('Falta el client_id de Factus').isLength({ max: 120 }),
  body('clientSecret').trim().notEmpty().withMessage('Falta el client_secret de Factus').isLength({ max: 200 }),
  body('username').trim().isEmail().withMessage('El usuario de Factus es tu correo'),
  body('password').notEmpty().withMessage('Falta la contraseña de Factus').isLength({ max: 200 }),
  body('numberingRangeId').isInt({ min: 1 }).withMessage('Escribe el id del rango de numeración (en Factus → Rangos)').toInt(),
  validateRequest,
], async (req, res) => {
  try {
    if (!isColombia(req.company)) return res.status(400).json({ message: 'La factura electrónica DIAN es para empresas en Colombia' });
    const company = await Company.findById(req.company._id);
    company.factus = { env: req.body.env, ...factus.sealCredentials(req.body), numberingRangeId: req.body.numberingRangeId, connectedAt: new Date() };
    factus.forget(company._id);                          // los tokens de antes no prueban nada
    try {
      await factus.token(company, { fresh: true });      // si no da token, no se guarda nada
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
    factus.forget(company._id);
    await audit(req, 'empresa.factus', 'Desconectó la factura electrónica');
    res.status(200).json(factusView(company));
  } catch (error) {
    res.status(500).json({ message: 'No se pudo desconectar la factura electrónica' });
  }
});

// «Recomiéndanos»: el administrador deja la opinión de su empresa para novaworkorder.com (una por empresa). Queda
// pendiente hasta que Mario la apruebe desde GABY; desde la app nadie la aprueba. La empresa la puede retirar.
const reviewLimiter = limiter({
  name: 'resena',
  windowMs: 60 * 60 * 1000,
  max: 20,
  key: (req) => String(req.company._id),
  onLimit: (req, res) => res.status(429).json({ message: 'Demasiados envíos. Espera un rato y vuelve a intentarlo.' }),
});
const optionalText = (field, max, label) => body(field).optional({ nullable: true }).isString().withMessage(`${label} no es válido`)
  .trim().isLength({ max }).withMessage(`${label}: máximo ${max} caracteres`);

router.get('/review', protect, authorize('admin'), getOwnReview);
router.put('/review', protect, authorize('admin'), reviewLimiter, [
  body('rating').custom((v) => Number.isInteger(v) && v >= 1 && v <= 5).withMessage('Elige una calificación de 1 a 5 estrellas'),
  body('text').isString().withMessage('Escribe tu opinión').trim()
    .isLength({ min: LIMITS.textMin, max: LIMITS.textMax }).withMessage(`La opinión va de ${LIMITS.textMin} a ${LIMITS.textMax} caracteres`),
  body('name').isString().withMessage('Escribe tu nombre').trim()
    .isLength({ min: LIMITS.nameMin, max: LIMITS.nameMax }).withMessage(`Tu nombre va de ${LIMITS.nameMin} a ${LIMITS.nameMax} caracteres`),
  optionalText('role', LIMITS.roleMax, 'El cargo'),
  optionalText('city', LIMITS.cityMax, 'La ciudad'),
  body('consent').custom((v) => v === true).withMessage('Para publicarla necesitamos tu autorización: marca la casilla'),
  validateRequest,
], saveOwnReview);
router.delete('/review', protect, authorize('admin'), withdrawOwnReview);

module.exports = router;
