const mongoose = require('mongoose');

// Contadores de límites (inicio de sesión, chat, demo, visitas) en la base, no en la memoria del proceso: así valen igual
// con una o con varias instancias de la app detrás del balanceador, y sobreviven a un reinicio. Cada contador caduca
// solo (índice TTL sobre `resetAt`), así la colección no crece.
const rateSchema = new mongoose.Schema(
  {
    _id: { type: String },                 // la clave del contador (p. ej. «login|1.2.3.4|ana@x.com»)
    count: { type: Number, default: 0 },
    resetAt: { type: Date, required: true },
  },
  { versionKey: false }
);
rateSchema.index({ resetAt: 1 }, { expireAfterSeconds: 0 });

const RateLimit = mongoose.models.RateLimit || mongoose.model('RateLimit', rateSchema);

// Suma uno al contador (en una sola operación atómica: dos peticiones a la vez no se saltan el límite) y devuelve el
// total de la ventana actual. Si la ventana venció, empieza de nuevo en 1.
const hit = async (key, windowMs) => {
  const now = new Date();
  const doc = await RateLimit.findOneAndUpdate(
    { _id: key },
    [{
      $set: {
        count: { $cond: [{ $gt: ['$resetAt', now] }, { $add: ['$count', 1] }, 1] },
        resetAt: { $cond: [{ $gt: ['$resetAt', now] }, '$resetAt', new Date(now.getTime() + windowMs)] },
      },
    }],
    { upsert: true, new: true }
  ).lean();
  return doc.count;
};

// Cuánto lleva el contador en la ventana actual, sin sumar.
const peek = async (key) => {
  const doc = await RateLimit.findById(key).lean();
  return doc && doc.resetAt > new Date() ? doc.count : 0;
};

const clear = (key) => RateLimit.deleteOne({ _id: key });

// Middleware de límite simple: `max` peticiones por IP (o por lo que diga `key`) cada `windowMs`. Si la base no responde,
// deja pasar (un límite caído no debe tumbar la app) y lo deja anotado en el log.
const limiter = ({ name, windowMs, max, onLimit, key = (req) => req.ip }) => async (req, res, next) => {
  try {
    if (await hit(`${name}|${key(req)}`, windowMs) > max) return onLimit(req, res);
  } catch (error) {
    console.error(`Límite ${name} sin base: ${error.message}`);
  }
  return next();
};

module.exports = { hit, peek, clear, limiter, RateLimit };

// Solo pruebas: borra todos los contadores.
module.exports.resetLimits = () => RateLimit.deleteMany({});
