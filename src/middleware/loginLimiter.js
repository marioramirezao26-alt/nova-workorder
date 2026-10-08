// Límite de intentos fallidos de inicio de sesión, en memoria (un solo proceso): 10 por IP y email cada 15 minutos.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 10;
const failures = new Map();

const keyFor = (req) => `${req.ip}|${String(req.body?.email || '').toLowerCase()}`;

const prune = (now) => {
  for (const [key, entry] of failures) {
    if (now - entry.first > WINDOW_MS) failures.delete(key);
  }
};

const loginLimiter = (req, res, next) => {
  const now = Date.now();
  prune(now);
  const entry = failures.get(keyFor(req));

  if (entry && entry.count >= MAX_FAILURES) {
    return res.status(429).json({ message: 'Demasiados intentos fallidos. Espera 15 minutos e inténtalo de nuevo.' });
  }

  return next();
};

const recordFailure = (req) => {
  const key = keyFor(req);
  const entry = failures.get(key) || { count: 0, first: Date.now() };
  entry.count += 1;
  failures.set(key, entry);
};

const clearFailures = (req) => failures.delete(keyFor(req));

module.exports = { loginLimiter, recordFailure, clearFailures, _failures: failures };
