const crypto = require('crypto');
const { seal, open } = require('../utils/secretBox');

// Cobro en línea con Wompi (Mejora 3). Cada empresa conecta SU cuenta de Wompi: el dinero va directo a ella, NOVA no lo
// toca. Las llaves secretas (integridad y eventos) se guardan cifradas (utils/secretBox) y nunca salen de la API.
// Una cotización queda «pagada» solo cuando Wompi lo confirma: por su evento firmado o consultando la transacción.

const PUBLIC_KEY = /^pub_(prod|test)_[A-Za-z0-9]{8,80}$/;
const INTEGRITY = /^(prod|test)_integrity_[A-Za-z0-9]{8,80}$/;
const EVENTS = /^(prod|test)_events_[A-Za-z0-9]{8,80}$/;
const CHECKOUT = 'https://checkout.wompi.co/p/';

const isTest = (publicKey) => String(publicKey || '').startsWith('pub_test_');
const apiBase = (publicKey) => process.env.WOMPI_API_URL
  || (isTest(publicKey) ? 'https://sandbox.wompi.co/v1' : 'https://production.wompi.co/v1');
const cents = (amount) => Math.round(Number(amount) * 100);

// Wompi no acepta dos transacciones con la misma referencia: cada intento de pago lleva un sufijo distinto, y la
// cotización se reconoce por su id.
const reference = (quote) => `NWO-${quote._id}-${crypto.randomBytes(4).toString('hex')}`;
const quoteIdFrom = (ref) => (/^NWO-([a-f0-9]{24})-[a-f0-9]{8}$/.exec(String(ref || '')) || [])[1] || null;

// Solo empresas en pesos (Wompi cobra en COP).
const connected = (company) => Boolean(company && company.wompi && company.wompi.publicKey && company.lang !== 'en');

const getJson = async (url) => {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
};

// Comprueba la llave pública con Wompi antes de guardarla: devuelve el nombre del comercio.
const verifyMerchant = async (publicKey) => {
  try {
    const { ok, data } = await getJson(`${apiBase(publicKey)}/merchants/${encodeURIComponent(publicKey)}`);
    if (!ok || !data.data) return { error: 'Wompi no reconoció esa llave pública. Cópiala completa desde tu panel de Wompi.' };
    return { name: data.data.name || data.data.legal_name || '' };
  } catch {
    return { error: 'No pudimos hablar con Wompi en este momento. Inténtalo de nuevo en un rato.' };
  }
};

const sealKeys = ({ integritySecret, eventsSecret }) => ({ integritySealed: seal(integritySecret), eventsSealed: seal(eventsSecret) });

// El enlace al checkout de Wompi por `amount` pesos, con la firma de integridad (así nadie cambia el valor ni la referencia).
const checkoutUrl = (company, quote, amount, redirectUrl) => {
  const secret = open(company.wompi.integritySealed);
  if (!secret) return null;
  const amountInCents = cents(amount);
  const ref = reference(quote);
  const signature = crypto.createHash('sha256').update(`${ref}${amountInCents}COP${secret}`).digest('hex');
  const params = new URLSearchParams({
    'public-key': company.wompi.publicKey,
    currency: 'COP',
    'amount-in-cents': String(amountInCents),
    reference: ref,
    'signature:integrity': signature,
    'redirect-url': redirectUrl,
  });
  return `${CHECKOUT}?${params.toString()}`;
};

// La firma de un evento de Wompi: SHA-256 de los valores de `signature.properties` + timestamp + secreto de eventos.
const pick = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
const validEvent = (body, eventsSecret) => {
  const sig = body && body.signature;
  if (!sig || !Array.isArray(sig.properties) || !sig.checksum || !body.timestamp || !eventsSecret) return false;
  const text = sig.properties.map((p) => String(pick(body.data, p) ?? '')).join('') + String(body.timestamp) + eventsSecret;
  const expected = crypto.createHash('sha256').update(text).digest('hex');
  const got = String(sig.checksum).toLowerCase();
  return got.length === expected.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected));
};

// Consulta una transacción directamente en Wompi (cuando el cliente vuelve del checkout).
const fetchTransaction = async (company, id) => {
  if (!/^[A-Za-z0-9-]{6,80}$/.test(String(id || ''))) return null;
  try {
    const { ok, data } = await getJson(`${apiBase(company.wompi.publicKey)}/transactions/${encodeURIComponent(id)}`);
    return ok && data.data ? data.data : null;
  } catch {
    return null;
  }
};

module.exports = {
  PUBLIC_KEY, INTEGRITY, EVENTS, connected, isTest, verifyMerchant, sealKeys, checkoutUrl, validEvent, fetchTransaction,
  reference, quoteIdFrom, cents, openEvents: (company) => open(company.wompi.eventsSealed),
};
