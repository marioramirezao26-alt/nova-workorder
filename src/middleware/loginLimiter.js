// Límite de intentos fallidos de inicio de sesión: 10 por IP y email cada 15 minutos, y 30 por IP (la misma IP probando
// muchas cuentas). Los contadores viven en la base (rateStore), así valen con varias instancias de la app.
const store = require('../utils/rateStore');

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 10;
const MAX_PER_IP = 30;

const keyFor = (req) => `login|${req.ip}|${String(req.body?.email || '').toLowerCase()}`;
const ipKey = (req) => `login|${req.ip}|*`;

const loginLimiter = async (req, res, next) => {
  try {
    const [byAccount, byIp] = await Promise.all([store.peek(keyFor(req)), store.peek(ipKey(req))]);
    if (byAccount >= MAX_FAILURES || byIp >= MAX_PER_IP) {
      return res.status(429).json({ message: 'Demasiados intentos fallidos. Espera 15 minutos e inténtalo de nuevo.' });
    }
  } catch (error) {
    console.error(`Límite de inicio de sesión sin base: ${error.message}`);
  }
  return next();
};

const recordFailure = async (req) => {
  try {
    await Promise.all([store.hit(keyFor(req), WINDOW_MS), store.hit(ipKey(req), WINDOW_MS)]);
  } catch (error) {
    console.error(`No se pudo anotar el intento fallido: ${error.message}`);
  }
};

const clearFailures = async (req) => {
  try {
    await store.clear(keyFor(req));
  } catch (error) {
    console.error(`No se pudo limpiar el contador de inicio de sesión: ${error.message}`);
  }
};

module.exports = { loginLimiter, recordFailure, clearFailures };
