// P-047: cuando alguien crea su prueba gratis y AUTORIZÓ en el formulario («Opcional: autorizo que NOVA le avise a
// Meta…»), el servidor le manda a Meta el evento CompleteRegistration por la API de Conversiones, con el mismo event_id
// que usa el píxel del navegador (Meta no lo cuenta dos veces). Sin la casilla no se manda nada (Ley 1581: autorización
// previa e informada, /privacidad punto 6.4).
//
// Lo que va: el correo cifrado con SHA-256 (Meta no recibe el correo en claro), la IP y el navegador de la solicitud,
// _fbp/_fbc si existen (solo si antes aceptó el píxel), la página y la app. Nunca el nombre, el celular ni lo que escribió.
//
// Configuración en el .env del servidor (regla 9: la llave la pone Mario):
//   META_CAPI_TOKEN        el token de la API de Conversiones del píxel (Administrador de eventos). Sin él, no se manda nada.
//   META_PIXEL_ID          el píxel (por defecto 1088825597305014).
//   META_CAPI_TEST_CODE    opcional: el código de «Probar eventos» para verlos en el Administrador de eventos.
const crypto = require('crypto');

const VERSION = 'v21.0';
const EVENT_ID = /^[A-Za-z0-9_-]{8,64}$/;
const COOKIE = /^fb\.\d\.\d{10,13}\.[A-Za-z0-9_.-]{1,200}$/;

const sha256 = (v) => crypto.createHash('sha256').update(String(v).trim().toLowerCase()).digest('hex');
const pixel = () => String(process.env.META_PIXEL_ID || '1088825597305014').trim();
const token = () => String(process.env.META_CAPI_TOKEN || '').trim();
const configurado = () => Boolean(token() && /^\d{5,30}$/.test(pixel()));

// El evento listo para Meta (sin red). `req` da la IP, el navegador y la página; `demo`, lo que guardó el formulario.
function evento({ email, eventId, ip, userAgent, url, fbp, fbc, product, market, now = new Date() }) {
  const user = { em: [sha256(email)] };
  if (ip) user.client_ip_address = String(ip).slice(0, 64);
  if (userAgent) user.client_user_agent = String(userAgent).slice(0, 400);
  if (fbp && COOKIE.test(fbp)) user.fbp = fbp;
  if (fbc && COOKIE.test(fbc)) user.fbc = fbc;
  const ev = { event_name: 'CompleteRegistration', event_time: Math.floor(now.getTime() / 1000), action_source: 'website',
    event_source_url: String(url || 'https://novaworkorder.com/').slice(0, 500), user_data: user,
    custom_data: { content_name: product || 'servicios', market: market || 'co' } };
  if (eventId && EVENT_ID.test(eventId)) ev.event_id = eventId;
  return ev;
}

// Manda el evento; nunca lanza (un fallo de Meta jamás impide crear la prueba). Devuelve { enviado, motivo }.
async function avisarRegistro(datos, { fetchImpl = module.exports.fetchImpl || globalThis.fetch } = {}) {
  if (!configurado()) return { enviado: false, motivo: 'sin META_CAPI_TOKEN' };
  if (!datos || !datos.autorizo || !datos.email) return { enviado: false, motivo: 'sin autorización' };
  const cuerpo = { data: [evento(datos)] };
  if (process.env.META_CAPI_TEST_CODE) cuerpo.test_event_code = String(process.env.META_CAPI_TEST_CODE).slice(0, 40);
  try {
    const res = await fetchImpl(`https://graph.facebook.com/${VERSION}/${pixel()}/events?access_token=${encodeURIComponent(token())}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo), signal: AbortSignal.timeout(8000) });
    if (!res.ok) return { enviado: false, motivo: `Meta respondió ${res.status}` };
    return { enviado: true, motivo: '' };
  } catch (e) {
    return { enviado: false, motivo: e && e.name === 'TimeoutError' ? 'Meta no respondió' : 'sin red' };
  }
}

module.exports = { avisarRegistro, evento, sha256, configurado, fetchImpl: null };   // fetchImpl: las pruebas ponen uno falso
