// El chat de la página (novaworkorder.com) atendido por GABY: este servidor es un proxy hacia la API servidor a servidor
// de GABY (`/api/webchat`), para que cada visitante quede en el CRM y GABY lo atienda igual que por WhatsApp, y Mario
// pueda contestarle desde su panel. Con GABY_WEBCHAT_KEY vacía, o si GABY no responde, el chat sigue con salesChat.js.
//
// A GABY nunca le llega la IP del visitante: solo `ip_hash` = sha256(ip + sal). La sal es WEBCHAT_IP_SALT; sin ella se
// deriva de JWT_SECRET (que GABY no conoce), nunca de la llave compartida.
const crypto = require('crypto');

const DEFAULT_URL = 'http://127.0.0.1:8000/api/webchat';
const SEND_TIMEOUT_MS = 20000;            // GABY responde con un modelo: margen, y aun así queda tiempo para salesChat
const READ_TIMEOUT_MS = 5000;
const SESSION = /^[A-Za-z0-9_-]{16,64}$/;
const AFTER = /^[A-Za-z0-9_.:-]{1,64}$/;
const LEAD = /^[A-Za-z0-9]{8,32}$/;       // el código de la ficha del enlace de prueba (landing/enlace.js)
const FROM = ['visitor', 'gaby', 'mario'];

const url = () => String(process.env.GABY_WEBCHAT_URL || DEFAULT_URL).replace(/\/+$/, '');
const key = () => process.env.GABY_WEBCHAT_KEY || '';
const configured = () => Boolean(key()) && process.env.CHAT_ENABLED !== 'false';
const validSession = (s) => typeof s === 'string' && SESSION.test(s);
const validAfter = (a) => typeof a === 'string' && AFTER.test(a);

const salt = () => process.env.WEBCHAT_IP_SALT
  || crypto.createHash('sha256').update(`nova-webchat-ip|${process.env.JWT_SECRET || ''}`).digest('hex');
const ipHash = (ip) => crypto.createHash('sha256').update(`${String(ip || '')}${salt()}`).digest('hex');

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// De dónde viene el visitante: solo campos conocidos, cortos y con la forma esperada.
const cleanPage = (page) => {
  const p = page && typeof page === 'object' && !Array.isArray(page) ? page : {};
  const u = p.utm && typeof p.utm === 'object' && !Array.isArray(p.utm) ? p.utm : {};
  const app = str(p.app, 20).toLowerCase();
  const referral = str(p.referral, 40).toLowerCase();
  const l = str(p.l, 64);
  return {
    app: ['servicios', 'pedidos'].includes(app) ? app : '',
    utm: Object.fromEntries(['source', 'medium', 'campaign', 'content', 'term'].map((k) => [k, str(u[k], 100)])),
    ref: str(p.ref, 500),
    referral: /^[a-z0-9-]{3,20}$/.test(referral) ? referral : '',
    l: LEAD.test(l) ? l : '',
    path: str(p.path, 200) || '/',
  };
};

// Lo que devuelve GABY pasa por aquí antes de llegar al navegador: solo lo que la página sabe mostrar.
const cleanMessages = (list) => (Array.isArray(list) ? list : [])
  .filter((m) => m && FROM.includes(m.from) && typeof m.text === 'string' && m.text.trim()
    && (typeof m.id === 'string' || typeof m.id === 'number'))
  .slice(-200)
  .map((m) => ({ id: String(m.id).slice(0, 64), from: m.from, text: m.text.slice(0, 4000), at: typeof m.at === 'string' ? m.at.slice(0, 40) : '' }));
// Los botones solo llevan a novaworkorder.com (o a una ruta de esta misma página): nada de javascript: ni sitios ajenos.
const SAFE_URL = /^(https:\/\/([a-z0-9-]+\.)*novaworkorder\.com([/?#]|$)|\/(?![/\\])|#)/i;
const cleanActions = (list) => (Array.isArray(list) ? list : [])
  .filter((a) => a && typeof a.url === 'string' && SAFE_URL.test(a.url.trim()) && typeof a.label === 'string' && a.label.trim())
  .slice(0, 3)
  .map((a) => ({ type: str(a.type, 20) || 'link', url: a.url.trim().slice(0, 500), label: a.label.trim().slice(0, 80) }));

const request = async (method, path, { body, timeout }) => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(`${url()}${path}`, {
      method,
      signal: ctrl.signal,
      headers: { 'x-webchat-key': key(), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    let data = {};
    try { data = await res.json(); } catch { data = {}; }
    return { status: res.status, data: data && typeof data === 'object' ? data : {} };
  } finally {
    clearTimeout(timer);
  }
};

// POST {url}/message. Devuelve { status, data } con data ya limpio; un error de red o de tiempo sale como excepción.
// market: 'us' (EE. UU., en dólares; lang 'en' siempre lo es), 'mx' (México, en pesos mexicanos) o 'co'. GABY cotiza
// según el mercado y habla según lang.
const send = async ({ session, text, lang, market, page, ip }) => {
  const en = lang === 'en';
  const r = await request('POST', '/message', {
    timeout: SEND_TIMEOUT_MS,
    body: { session, text: String(text).slice(0, 1000), lang: en ? 'en' : 'es',
      market: en || market === 'us' ? 'us' : market === 'mx' ? 'mx' : 'co',
      page: cleanPage(page), ip_hash: ipHash(ip) },
  });
  if (r.status !== 200) return { status: r.status, data: {} };
  const reply = str(r.data.reply, 4000);
  const messages = cleanMessages(r.data.messages);
  return { status: 200, data: { reply, messages, actions: cleanActions(r.data.actions), handoff: Boolean(r.data.handoff) } };
};

// GET {url}/messages?session=&after=
const messages = async ({ session, after }) => {
  const q = new URLSearchParams({ session });
  if (after) q.set('after', after);
  const r = await request('GET', `/messages?${q}`, { timeout: READ_TIMEOUT_MS });
  if (r.status !== 200) return { status: r.status, data: {} };
  return { status: 200, data: { messages: cleanMessages(r.data.messages), handoff: Boolean(r.data.handoff) } };
};

module.exports = { configured, validSession, validAfter, ipHash, cleanPage, cleanMessages, cleanActions, send, messages, DEFAULT_URL };
