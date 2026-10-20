const express = require('express');
const { body } = require('express-validator');
const ApiKey = require('../models/ApiKey');
const Webhook = require('../models/Webhook');
const WebhookDelivery = require('../models/WebhookDelivery');
const { protect, authorize, companyScope } = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validateRequest');
const { validateObjectId } = require('../middleware/validateObjectId');
const { hashKey, newKey } = require('../middleware/apiKeyAuth');
const webhooks = require('../utils/webhooks');
const { audit } = require('../utils/audit');

// «Integraciones» del administrador: llaves de API y webhooks de su empresa.
// La llave completa y el secreto del webhook se muestran UNA sola vez, al crearlos (o al rotar el secreto).
const router = express.Router();
router.use(protect, authorize('admin'));

const MAX_KEYS = 10;
const MAX_HOOKS = 5;

// Los errores inesperados van al manejador general (500) en vez de dejar la petición colgada.
const safe = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const fail = (res, error, fallback) => res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : fallback });

const keyView = (k) => ({
  _id: k._id, name: k.name, prefix: k.prefix, scope: k.scope, lastUsedAt: k.lastUsedAt, createdAt: k.createdAt,
});
const hookView = (h) => ({
  _id: h._id, url: h.url, events: h.events, active: h.active, failures: h.failures, lastStatus: h.lastStatus,
  lastAt: h.lastAt, createdAt: h.createdAt,
});

// ---- Llaves de API ----

router.get('/keys', safe(async (req, res) => {
  const keys = await ApiKey.find({ ...companyScope(req), revokedAt: null }).sort({ createdAt: -1 }).lean();
  res.json({ items: keys.map(keyView) });
}));

router.post('/keys', [
  body('name').trim().notEmpty().withMessage('Ponle un nombre a la llave (por ejemplo, «ERP»)').isLength({ max: 60 }).withMessage('El nombre no debe superar 60 caracteres'),
  body('scope').optional().isIn(['lectura', 'escritura']).withMessage('Permiso inválido'),
  validateRequest,
], safe(async (req, res) => {
  try {
    if (await ApiKey.countDocuments({ ...companyScope(req), revokedAt: null }) >= MAX_KEYS) {
      return res.status(400).json({ message: `Máximo ${MAX_KEYS} llaves activas: revoca una que ya no uses` });
    }
    const raw = newKey();
    const key = await ApiKey.create({
      ...companyScope(req), name: req.body.name, scope: req.body.scope || 'lectura',
      prefix: raw.slice(0, 12), hash: hashKey(raw), createdBy: req.user._id,
    });
    await audit(req, 'api.llave.crear', `Creó la llave de API «${key.name}» (${key.scope})`, { entityId: key._id });
    return res.status(201).json({ ...keyView(key), key: raw });
  } catch (error) {
    return fail(res, error, 'No se pudo crear la llave');
  }
}));

router.delete('/keys/:id', validateObjectId, safe(async (req, res) => {
  const key = await ApiKey.findOneAndUpdate({ ...companyScope(req), _id: req.params.id, revokedAt: null }, { revokedAt: new Date() });
  if (!key) return res.status(404).json({ message: 'Llave no encontrada' });
  await audit(req, 'api.llave.revocar', `Revocó la llave de API «${key.name}»`, { entityId: key._id });
  return res.json({ message: 'Llave revocada' });
}));

// ---- Webhooks ----

const eventsValidation = body('events').isArray({ min: 1 }).withMessage('Elige al menos un evento')
  .custom((list) => list.every((e) => webhooks.EVENTS.includes(e))).withMessage('Evento inválido');

router.get('/webhooks', safe(async (req, res) => {
  const hooks = await Webhook.find(companyScope(req)).sort({ createdAt: -1 }).lean();
  res.json({ items: hooks.map(hookView), events: webhooks.EVENTS });
}));

router.post('/webhooks', [
  body('url').isString().withMessage('La dirección es obligatoria'),
  eventsValidation,
  validateRequest,
], safe(async (req, res) => {
  try {
    if (await Webhook.countDocuments(companyScope(req)) >= MAX_HOOKS) {
      return res.status(400).json({ message: `Máximo ${MAX_HOOKS} webhooks por empresa` });
    }
    const url = await webhooks.checkUrl(req.body.url);
    const salt = webhooks.newSalt();
    const hook = await Webhook.create({ ...companyScope(req), url, events: [...new Set(req.body.events)], salt, createdBy: req.user._id });
    await audit(req, 'webhook.crear', `Creó el webhook ${url}`, { entityId: hook._id });
    return res.status(201).json({ ...hookView(hook), secret: webhooks.secretFor(hook, salt) });
  } catch (error) {
    return fail(res, error, 'No se pudo crear el webhook');
  }
}));

// Cambia eventos o lo prende/apaga. Al prenderlo de nuevo, el conteo de fallos vuelve a cero.
router.patch('/webhooks/:id', validateObjectId, [
  eventsValidation.optional(),
  body('active').optional().isBoolean().withMessage('Valor inválido'),
  validateRequest,
], safe(async (req, res) => {
  const hook = await Webhook.findOne({ ...companyScope(req), _id: req.params.id });
  if (!hook) return res.status(404).json({ message: 'Webhook no encontrado' });
  if (req.body.events) hook.events = [...new Set(req.body.events)];
  if (req.body.active !== undefined) {
    hook.active = Boolean(req.body.active);
    if (hook.active) hook.failures = 0;
  }
  await hook.save();
  await audit(req, 'webhook.editar', `Editó el webhook ${hook.url}${hook.active ? '' : ' (apagado)'}`, { entityId: hook._id });
  return res.json(hookView(hook));
}));

router.delete('/webhooks/:id', validateObjectId, safe(async (req, res) => {
  const hook = await Webhook.findOneAndDelete({ ...companyScope(req), _id: req.params.id });
  if (!hook) return res.status(404).json({ message: 'Webhook no encontrado' });
  await WebhookDelivery.deleteMany({ ...companyScope(req), webhook: hook._id });
  await audit(req, 'webhook.borrar', `Borró el webhook ${hook.url}`, { entityId: hook._id });
  return res.json({ message: 'Webhook borrado' });
}));

// Secreto nuevo: el anterior deja de valer de inmediato.
router.post('/webhooks/:id/secret', validateObjectId, safe(async (req, res) => {
  const hook = await Webhook.findOne({ ...companyScope(req), _id: req.params.id });
  if (!hook) return res.status(404).json({ message: 'Webhook no encontrado' });
  hook.salt = webhooks.newSalt();
  await hook.save();
  await audit(req, 'webhook.secreto', `Cambió el secreto del webhook ${hook.url}`, { entityId: hook._id });
  return res.json({ secret: webhooks.secretFor(hook, hook.salt) });
}));

// Aviso de prueba («ping») solo a este webhook, para que el otro sistema confirme que recibe y valida la firma.
router.post('/webhooks/:id/test', validateObjectId, safe(async (req, res) => {
  const hook = await Webhook.findOne({ ...companyScope(req), _id: req.params.id });
  if (!hook) return res.status(404).json({ message: 'Webhook no encontrado' });
  const d = await WebhookDelivery.create({
    ...companyScope(req), webhook: hook._id, event: 'ping',
    payload: { event: 'ping', createdAt: new Date().toISOString(), data: { message: 'Prueba desde NOVA WORKORDER' } },
    lockedUntil: new Date(Date.now() + 60000),
  });
  await webhooks.deliver(d.toObject());
  const done = await WebhookDelivery.findOne({ ...companyScope(req), _id: d._id }).lean();
  return res.json({ ok: done.status === 'entregado', responseStatus: done.responseStatus, error: done.lastError });
}));

router.get('/webhooks/:id/deliveries', validateObjectId, safe(async (req, res) => {
  const list = await WebhookDelivery.find({ ...companyScope(req), webhook: req.params.id }).sort({ createdAt: -1 }).limit(20).lean();
  res.json({
    items: list.map((d) => ({
      _id: d._id, event: d.event, status: d.status, attempts: d.attempts, responseStatus: d.responseStatus,
      error: d.lastError, at: d.createdAt, deliveredAt: d.deliveredAt,
    })),
  });
}));

module.exports = router;
