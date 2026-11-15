const crypto = require('crypto');
const { seal, open } = require('../utils/secretBox');
const { marketOf } = require('../utils/money');

// Cobro en línea con Mercado Pago (Orden 41: el proveedor exclusivo de pagos de NOVA). Cada empresa conecta SU cuenta
// (Checkout Pro, una preferencia por cobro): el dinero va directo a ella y NOVA no lo toca. Reemplaza el lugar de Wompi.
//
// NACE APAGADO, con dos candados que pone el servidor (nunca la empresa):
// - Sin MERCADOPAGO_ENABLED=1 en el entorno, todo responde «no disponible» (404/409) y nada llama a Mercado Pago:
//   `request` se niega antes de abrir la conexión.
// - Aun encendido, solo se aceptan Access Tokens que empiezan por TEST- (de prueba con certeza). Uno APP_USR- puede ser de
//   prueba o de producción y Mercado Pago no documenta cómo saberlo (documentación oficial leída el 12-nov-2026), así
//   que solo se acepta si además existe MERCADOPAGO_PRODUCCION=1, que hoy nadie pone. Con una cuenta de prueba ningún
//   pago cuenta como plata real (payment.test).
// NOVA solo crea preferencias y lee pagos: no ejecuta devoluciones ni anulaciones, no cambia montos por lo que diga un
// aviso y no guarda nada de la tarjeta (de un pago guarda su número, el estado y el tipo de medio).
//
// Lo que se usa de Mercado Pago (referencias oficiales):
// - POST /checkout/preferences con `Authorization: Bearer <access token>`: un ítem (monto y moneda los pone el servidor) y
//   una external_reference propia; responde `id` e `init_point` (sandbox_init_point con credenciales de prueba).
// - El aviso (webhook de «Tus integraciones», evento Pagos), firmado: `x-signature: ts=<n>,v1=<hex>` y `x-request-id`.
//   v1 = HMAC-SHA256 en hexadecimal, con la clave secreta del webhook de ESA empresa, del manifiesto
//   `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` (un par que no llegó no va). Fórmula de los SDK oficiales
//   (sdk-nodejs, src/utils/webhook/index.ts). El cuerpo del aviso no está firmado: de él no se usa nada.
// - Con el id del aviso se consulta GET /v1/payments/{id} con el token de esa empresa, y se decide solo con lo que
//   responde la API (status, transaction_amount, currency_id, external_reference).

const API = 'https://api.mercadopago.com';                         // fija: el access token solo viaja allá
const OFF = 'Mercado Pago no está disponible en NOVA todavía';
const TEST_ONLY = 'Por ahora NOVA solo acepta credenciales de prueba de Mercado Pago (el Access Token empieza por TEST-): el cobro real todavía no está activado';

const enabled = () => process.env.MERCADOPAGO_ENABLED === '1';
const productionAllowed = () => process.env.MERCADOPAGO_PRODUCCION === '1';

const ACCESS_TOKEN = /^(TEST|APP_USR)-[A-Za-z0-9-]{10,250}$/;
const PUBLIC_KEY = /^(TEST|APP_USR)-[A-Za-z0-9-]{8,250}$/;
const WEBHOOK_SECRET = /^[A-Za-z0-9_-]{16,200}$/;
const isTestToken = (token) => String(token || '').startsWith('TEST-');
// El candado del prefijo: TEST- siempre; APP_USR- solo con MERCADOPAGO_PRODUCCION=1.
const tokenAllowed = (token) => ACCESS_TOKEN.test(String(token || '')) && (isTestToken(token) || productionAllowed());

// Dónde opera: Colombia (pesos colombianos, sitio MCO) y México (pesos mexicanos, MLM). En Estados Unidos no hay cobro en
// línea con Mercado Pago.
const MARKETS = { co: { currency: 'COP', site: 'MCO' }, mx: { currency: 'MXN', site: 'MLM' } };
const marketInfo = (company) => MARKETS[marketOf(company)] || null;
const available = (company) => Boolean(marketInfo(company));
const currencyFor = (company) => (marketInfo(company) ? marketInfo(company).currency : null);

const connected = (company) => Boolean(company && company.mercadopago && company.mercadopago.connectedAt);
// Se puede cobrar con la cuenta de la empresa: el servidor encendido, la cuenta conectada, un país donde opera y una
// cuenta de prueba (o el permiso de producción del servidor). `test` se guarda al conectar: no hace falta abrir la llave.
const usable = (company) => enabled() && connected(company) && available(company)
  && (company.mercadopago.test !== false || productionAllowed());
// Una cotización se cobra con Mercado Pago si se hizo en la moneda del país de la empresa (una en dólares sigue en dólares).
const chargeable = (company, quote) => usable(company) && Boolean(quote) && quote.currency === currencyFor(company);

// La referencia de un cobro: la empresa y la cotización. Al llegar un pago se separa y se compara con lo guardado: un pago
// de otra empresa (o de otro sistema) no toca nada.
const reference = (company, quote) => `NWO-${company._id}-${quote._id}`;
const parseReference = (ref) => {
  const m = /^NWO-([a-f0-9]{24})-([a-f0-9]{24})$/.exec(String(ref || ''));
  return m ? { companyId: m[1], quoteId: m[2] } : null;
};

// El monto en centavos EXACTO, o null si no es un número entero de centavos (nunca se redondea un pago para que cuadre).
const cents = (value) => {
  if (typeof value === 'boolean' || value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || Math.abs(n) > 1e12) return null;
  const c = Math.round(n * 100);
  return Math.abs(n * 100 - c) < 1e-6 ? c : null;
};

// Los estados de un pago de Mercado Pago, en los de NOVA (los que siguen en curso cuentan como PENDING).
const STATUS = {
  approved: 'APPROVED', pending: 'PENDING', in_process: 'PENDING', authorized: 'PENDING', in_mediation: 'IN_MEDIATION',
  rejected: 'REJECTED', cancelled: 'CANCELLED', refunded: 'REFUNDED', charged_back: 'CHARGED_BACK',
};
const statusOf = (pay) => STATUS[String((pay && pay.status) || '')] || '';
// ¿Tiene una devolución (aunque sea parcial)? Ante un valor que no se entiende, sí: lo revisa una persona.
const refunded = (pay) => {
  const v = pay && pay.transaction_amount_refunded;
  if (v === undefined || v === null) return false;
  const c = cents(v);
  return c === null || c > 0;
};
// El tipo de medio (CREDIT_CARD, DEBIT_CARD, BANK_TRANSFER, ACCOUNT_MONEY, TICKET…): para la factura, nada de la tarjeta.
const methodType = (pay) => String((pay && pay.payment_type_id) || '').toUpperCase().replace(/[^A-Z0-9_]/g, '').slice(0, 40);

class MercadoPagoError extends Error {}

// HTTP saliente, cambiable en las pruebas (setFetch): las pruebas nunca usan la red.
let fetchImpl = null;
const setFetch = (fn) => { fetchImpl = fn || null; };

const request = async (token, method, path, body) => {
  if (!enabled()) throw new MercadoPagoError(OFF);
  if (!tokenAllowed(token)) throw new MercadoPagoError(TEST_ONLY);
  let res;
  try {
    res = await (fetchImpl || globalThis.fetch)(`${API}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new MercadoPagoError('No pudimos hablar con Mercado Pago en este momento. Inténtalo de nuevo en un rato.');
  }
  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data: data && typeof data === 'object' ? data : {} };
};

// Comprueba el Access Token antes de guardarlo (GET /users/me) y que la cuenta sea del país de la empresa.
const verifyAccount = async (token, company) => {
  const { ok, data } = await request(token, 'GET', '/users/me');
  if (!ok || !data.id) throw new MercadoPagoError('Mercado Pago no reconoció ese Access Token. Cópialo completo desde «Tus integraciones» → Credenciales de prueba.');
  const site = String(data.site_id || '');
  if (site !== marketInfo(company).site) {
    throw new MercadoPagoError(`Esa cuenta de Mercado Pago es de otro país (${site || 'sin país'}): conecta la de ${marketOf(company) === 'mx' ? 'México' : 'Colombia'}.`);
  }
  return { userId: String(data.id).slice(0, 40), nickname: String(data.nickname || '').slice(0, 120), siteId: site };
};

const sealCredentials = ({ accessToken, webhookSecret }) => ({ accessTokenSealed: seal(accessToken), webhookSecretSealed: seal(webhookSecret) });
const openToken = (company) => open(company.mercadopago && company.mercadopago.accessTokenSealed);
const openSecret = (company) => open(company.mercadopago && company.mercadopago.webhookSecretSealed);

const SITES = ['mercadopago.com.co', 'mercadopago.com.mx', 'mercadopago.com'];
const safeUrl = (url) => {
  try {
    const u = new URL(String(url || ''));
    const host = u.hostname.toLowerCase();
    return u.protocol === 'https:' && SITES.some((s) => host === s || host.endsWith(`.${s}`)) ? u.toString() : '';
  } catch {
    return '';
  }
};

// La preferencia de Checkout Pro por exactamente `amount` (en la moneda del país de la empresa), con la referencia de la
// cotización. No lleva el correo ni los datos del cliente, ni notification_url: el aviso llega por el webhook que la
// empresa configura en su cuenta. Devuelve { id, url } con una dirección de Mercado Pago.
const createPreference = async (company, quote, amount, backUrl) => {
  const token = openToken(company);
  if (!token) throw new MercadoPagoError('La empresa debe conectar Mercado Pago de nuevo para recibir pagos');
  const currency = currencyFor(company);
  const c = cents(amount);
  if (!currency || c === null || c <= 0) throw new MercadoPagoError('Esta cotización no se cobra en línea');
  const ref = reference(company, quote);
  const body = {
    items: [{ id: `COT-${quote.number}`, title: `Cotización #${quote.number}: ${quote.title}`.slice(0, 250), quantity: 1, unit_price: c / 100, currency_id: currency }],
    external_reference: ref,
    back_urls: { success: backUrl, pending: backUrl, failure: backUrl },
    ...(String(backUrl).startsWith('https://') ? { auto_return: 'approved' } : {}),
  };
  const { ok, status, data } = await request(token, 'POST', '/checkout/preferences', body);
  if (!ok) throw new MercadoPagoError(`Mercado Pago no creó el pago (respondió ${status}). Inténtalo de nuevo en un rato.`);
  const url = (isTestToken(token) && safeUrl(data.sandbox_init_point)) || safeUrl(data.init_point);
  if (!data.id || !url) throw new MercadoPagoError('Mercado Pago no devolvió el enlace de pago');
  if (data.external_reference !== undefined && String(data.external_reference) !== ref) throw new MercadoPagoError('Mercado Pago devolvió el enlace con otra referencia');
  return { id: String(data.id).slice(0, 120), url };
};

// El pago, consultado con el token de ESA empresa (Mercado Pago solo devuelve los pagos de esa cuenta).
const fetchPayment = async (company, id) => {
  const pid = String(id || '');
  if (!/^\d{1,20}$/.test(pid)) throw new MercadoPagoError('El id del pago no es válido');
  const { ok, status, data } = await request(openToken(company), 'GET', `/v1/payments/${pid}`);
  if (!ok) throw new MercadoPagoError(`Mercado Pago respondió ${status} al consultar el pago`);
  if (String(data.id) !== pid) throw new MercadoPagoError('Mercado Pago no devolvió ese pago');
  return data;
};

// ---- La firma del aviso -------------------------------------------------------------------------------------------

const TOLERANCE_MS = 10 * 60 * 1000;     // un aviso firmado hace más de 10 minutos (o con la hora adelantada) no vale
// (ts, v1) de `x-signature`, o null si no tiene exactamente la forma: ts en dígitos y v1 de 64 hexadecimales.
const parseSignature = (header) => {
  let ts = '';
  let v1 = '';
  for (const part of String(header || '').split(',')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const key = part.slice(0, i).trim().toLowerCase();
    const value = part.slice(i + 1).trim();
    if (key === 'ts') ts = value;
    else if (key === 'v1') v1 = value.toLowerCase();
  }
  return /^\d{1,16}$/.test(ts) && /^[0-9a-f]{64}$/.test(v1) ? { ts, v1 } : null;
};
const manifest = ({ dataId, requestId, ts }) => [['id', dataId], ['request-id', requestId]]
  .filter(([, v]) => v).map(([k, v]) => `${k}:${v};`).join('') + `ts:${ts};`;
// Mercado Pago manda ts en segundos; si llega en milisegundos (13 dígitos o más) también se entiende.
const tsMillis = (ts) => (ts.length >= 13 ? Number(ts) : Number(ts) * 1000);

const validSignature = ({ header, requestId, dataId, secret, now = Date.now() }) => {
  const sig = parseSignature(header);
  if (!sig || !secret) return false;
  if (Math.abs(now - tsMillis(sig.ts)) > TOLERANCE_MS) return false;
  // el id va en minúsculas (así lo firma Mercado Pago si es alfanumérico; uno de pago son solo dígitos)
  const text = manifest({ dataId: String(dataId || '').trim().toLowerCase(), requestId: String(requestId || '').trim(), ts: sig.ts });
  const expected = crypto.createHmac('sha256', secret).update(text).digest();
  return crypto.timingSafeEqual(expected, Buffer.from(sig.v1, 'hex'));
};

module.exports = {
  API, OFF, TEST_ONLY, ACCESS_TOKEN, PUBLIC_KEY, WEBHOOK_SECRET, TOLERANCE_MS, MercadoPagoError,
  enabled, productionAllowed, isTestToken, tokenAllowed, available, currencyFor, connected, usable, chargeable,
  reference, parseReference, cents, statusOf, refunded, methodType,
  setFetch, verifyAccount, sealCredentials, openSecret, createPreference, fetchPayment,
  parseSignature, manifest, validSignature,
};
