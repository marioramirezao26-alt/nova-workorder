const crypto = require('crypto');
const dns = require('dns').promises;
const net = require('net');
const Webhook = require('../models/Webhook');
const WebhookDelivery = require('../models/WebhookDelivery');

// Avisos a los sistemas de cada empresa (webhooks): cuando se crea, cambia o borra una orden, se encola un aviso por
// cada webhook suscrito y una cola en la base lo envía con un POST firmado, reintentando si el otro lado falla.

const EVENTS = ['orden.creada', 'orden.actualizada', 'orden.estado', 'orden.borrada'];
const MAX_ATTEMPTS = 6;
const BACKOFF_MIN = [1, 5, 30, 120, 360];          // minutos entre reintentos
const DISABLE_AFTER = 50;                           // intentos fallidos seguidos y el webhook se apaga solo
const TIMEOUT_MS = 5000;

// El secreto de la firma se deriva de la llave del servidor y de una sal propia del webhook: no se guarda en la base
// y rotarlo es cambiar la sal. WEBHOOK_SECRET_KEY permite separarla de JWT_SECRET.
const rootKey = () => process.env.WEBHOOK_SECRET_KEY || process.env.JWT_SECRET || '';
const secretFor = (hook, salt) => `whsec_${crypto.createHmac('sha256', rootKey()).update(`webhook|${hook._id}|${salt}`).digest('hex')}`;
const newSalt = () => crypto.randomBytes(16).toString('hex');

// Firma: HMAC-SHA256 de «<timestamp>.<cuerpo>» con el secreto. El receptor la recalcula y rechaza avisos viejos.
const sign = (secret, timestamp, body) => crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');

// Direcciones que nunca se llaman: la red interna del servidor (evita que un webhook sirva para espiar adentro).
const privateAddress = (ip) => {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith('::ffff:')) return privateAddress(v6.slice(7));
  return v6 === '::1' || v6 === '::' || v6.startsWith('fc') || v6.startsWith('fd') || v6.startsWith('fe80');
};
const allowPrivate = () => process.env.WEBHOOK_ALLOW_PRIVATE === '1';     // solo pruebas y desarrollo

const badUrl = (message) => Object.assign(new Error(message), { statusCode: 400 });

// Revisa la dirección antes de guardarla y antes de cada envío (la IP del dominio puede cambiar).
const checkUrl = async (raw) => {
  let url;
  try {
    url = new URL(String(raw || '').trim());
  } catch {
    throw badUrl('La dirección del webhook no es válida');
  }
  if (url.protocol !== 'https:' && !(allowPrivate() && url.protocol === 'http:')) throw badUrl('El webhook debe usar https://');
  if (url.username || url.password) throw badUrl('La dirección no puede llevar usuario ni contraseña');
  if (!allowPrivate()) {
    const host = url.hostname.replace(/^\[|\]$/g, '');
    let addresses;
    try {
      addresses = net.isIP(host) ? [host] : (await dns.lookup(host, { all: true })).map((a) => a.address);
    } catch {
      throw badUrl('No encontramos ese dominio');
    }
    if (!addresses.length || addresses.some(privateAddress)) throw badUrl('El webhook no puede apuntar a una red interna');
  }
  return url.toString();
};

// Lo que viaja de una orden: datos del trabajo, nunca la ubicación del técnico (Ley 1581).
const orderPayload = (o) => {
  const ref = (v, field = 'name') => (v && typeof v === 'object' && v._id ? { id: String(v._id), [field]: v[field] || '' } : (v ? { id: String(v) } : null));
  return {
    id: String(o._id),
    title: o.title,
    description: o.description,
    status: o.status,
    priority: o.priority,
    customerName: o.customerName || '',
    client: ref(o.client),
    assignedTo: ref(o.assignedTo),
    dueDate: o.dueDate || null,
    startedAt: o.startedAt || null,
    completedAt: o.completedAt || null,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
};

// Encola el aviso para cada webhook activo de la empresa suscrito al evento. Nunca interrumpe la operación del usuario.
const emit = async (tenant, event, data) => {
  try {
    const hooks = await Webhook.find({ tenant, active: true, events: event }).select('_id').lean();
    if (!hooks.length) return;
    const createdAt = new Date().toISOString();
    await WebhookDelivery.insertMany(hooks.map((h) => ({
      tenant, webhook: h._id, event, payload: { event, createdAt, data },
    })));
    kick();
  } catch (error) {
    console.error(`Webhook ${event} no encolado: ${error.message}`);
  }
};

// Envía un aviso ya apartado y deja anotado el resultado (y el próximo intento si falló).
const deliver = async (d) => {
  const hook = await Webhook.findOne({ _id: d.webhook, tenant: d.tenant }).select('+salt');
  if (!hook || !hook.active) {
    await WebhookDelivery.updateOne({ _id: d._id }, { status: 'fallido', lastError: 'webhook apagado o borrado', lockedUntil: null });
    return;
  }
  const body = JSON.stringify({ id: String(d._id), ...d.payload });
  const timestamp = Math.floor(Date.now() / 1000);
  let ok = false;
  let responseStatus = null;
  let lastError = '';
  try {
    const url = await checkUrl(hook.url);
    const res = await fetch(url, {
      method: 'POST',
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'NovaWorkorder-Webhooks/1',
        'X-Nova-Event': d.event,
        'X-Nova-Delivery': String(d._id),
        'X-Nova-Timestamp': String(timestamp),
        'X-Nova-Signature': `sha256=${sign(secretFor(hook, hook.salt), timestamp, body)}`,
      },
      body,
    });
    responseStatus = res.status;
    ok = res.status >= 200 && res.status < 300;
    if (!ok) lastError = `respondió ${res.status}`;
    await res.body?.cancel().catch(() => {});
  } catch (error) {
    lastError = error.name === 'TimeoutError' ? 'timeout' : (error.statusCode ? error.message : 'sin conexión');
  }

  const attempts = d.attempts + 1;
  const done = ok || attempts >= MAX_ATTEMPTS;
  await WebhookDelivery.updateOne({ _id: d._id }, {
    attempts,
    responseStatus,
    lastError,
    lockedUntil: null,
    status: ok ? 'entregado' : (done ? 'fallido' : 'pendiente'),
    deliveredAt: ok ? new Date() : null,
    nextAttemptAt: new Date(Date.now() + (BACKOFF_MIN[attempts - 1] || 0) * 60000),
  });
  const failures = ok ? 0 : hook.failures + 1;
  await Webhook.updateOne({ _id: hook._id, tenant: hook.tenant }, {
    failures,
    lastStatus: ok ? String(responseStatus) : lastError,
    lastAt: new Date(),
    ...(failures >= DISABLE_AFTER ? { active: false } : {}),
  });
};

// Aparta y envía los avisos que tocan. Con varias instancias cada aviso lo toma una sola (findOneAndUpdate atómico).
const processDue = async ({ max = 20 } = {}) => {
  let sent = 0;
  while (sent < max) {
    const now = new Date();
    // eslint-disable-next-line no-await-in-loop
    const d = await WebhookDelivery.findOneAndUpdate(
      { status: 'pendiente', nextAttemptAt: { $lte: now }, $or: [{ lockedUntil: null }, { lockedUntil: { $lte: now } }] },
      { lockedUntil: new Date(now.getTime() + 60000) },
      { new: true, sort: { nextAttemptAt: 1 }, allowCrossTenant: true }
    ).lean();
    if (!d) break;
    // eslint-disable-next-line no-await-in-loop
    await deliver(d);
    sent += 1;
  }
  return sent;
};

// La cola: revisa cada 15 s y, al encolar algo, enseguida. En las pruebas no corre sola (se llama processDue).
let timer = null;
let running = null;
const run = () => {
  if (running) return running;
  running = processDue({ max: 50 }).catch((error) => console.error(`Cola de webhooks: ${error.message}`))
    .finally(() => { running = null; });
  return running;
};
const kick = () => { if (timer) setImmediate(run); };
const startWorker = () => {
  if (!timer) timer = setInterval(run, 15000);
  timer.unref();
};
const stopWorker = async () => {
  if (timer) clearInterval(timer);
  timer = null;
  await running;
};

module.exports = {
  EVENTS, emit, deliver, processDue, startWorker, stopWorker, checkUrl, secretFor, newSalt, sign, orderPayload, privateAddress,
};
