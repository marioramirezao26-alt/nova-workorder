// El chat de la página atendido por GABY: /api/public/chat es un proxy hacia la API servidor a servidor de GABY
// (POST /api/webchat/message y GET /api/webchat/messages). Aquí GABY es un servidor http local falso.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const crypto = require('node:crypto');
const { start, stop, reset, call } = require('./helpers');
const salesChat = require('../src/utils/salesChat');
const { resetLimits } = require('../src/utils/rateStore');
const ChatStat = require('../src/models/ChatStat');

const LLAVE = 'llave-webchat-de-prueba-0123456789';
const SAL = 'sal-de-prueba-para-la-ip';
const SESION = 'Ab3_kLm9-QrSt7uVwXyZ01';
let fake;
let gabyUrl;
let got;            // lo que recibió GABY
let mode;           // cómo responde GABY: ok | 503 | 429 | 401
let seen;           // lo que llegó a salesChat

before(async () => {
  await start();
  fake = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      got.push({ method: req.method, url: req.url, key: req.headers['x-webchat-key'], raw, body: raw ? JSON.parse(raw) : null });
      const send = (code, body) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
      if (mode === '503') return send(503, { error: 'apagado' });
      if (mode === '429') return send(429, { error: 'tope' });
      if (req.headers['x-webchat-key'] !== LLAVE) return send(401, { error: 'llave' });
      if (req.method === 'POST' && req.url === '/api/webchat/message') {
        return send(200, {
          reply: 'Servicios cuesta $49.000 por técnico al mes.',
          messages: [
            { id: 'm1', from: 'visitor', text: 'hola', at: '2026-10-28T15:00:00Z' },
            { id: 'm2', from: 'gaby', text: 'Servicios cuesta $49.000 por técnico al mes.', at: '2026-10-28T15:00:02Z' },
            { id: 'm3', from: 'hacker', text: 'no debe pasar' },
          ],
          actions: [
            { type: 'trial', url: 'https://novaworkorder.com/?l=k7Qm2xWa9pLr4tZc&app=servicios#demo', label: 'Empieza gratis' },
            { type: 'trial', url: 'javascript:alert(1)', label: 'Malo' },
            { type: 'link', url: 'https://otro-sitio.com/', label: 'Ajeno' },
          ],
          handoff: false,
          secreto: 'no debe pasar al navegador',
        });
      }
      if (req.method === 'GET' && req.url.startsWith('/api/webchat/messages?')) {
        const q = new URL(req.url, 'http://x').searchParams;
        const all = [
          { id: 'm1', from: 'visitor', text: 'hola', at: '2026-10-28T15:00:00Z' },
          { id: 'm2', from: 'gaby', text: '¡Hola! ¿En qué te ayudo?', at: '2026-10-28T15:00:02Z' },
          { id: 'm3', from: 'mario', text: 'Hola, soy Mario de NOVA. Te ayudo con tu cuenta.', at: '2026-10-28T15:05:00Z' },
        ];
        const after = q.get('after');
        return send(200, { messages: after ? all.slice(all.findIndex((m) => m.id === after) + 1) : all, handoff: true });
      }
      return send(404, {});
    });
  }).listen(0);
  gabyUrl = `http://127.0.0.1:${fake.address().port}/api/webchat`;
});
after(async () => { fake.close(); await stop(); });

beforeEach(async () => {
  await reset();
  await resetLimits();
  got = [];
  seen = [];
  mode = 'ok';
  process.env.GABY_WEBCHAT_URL = gabyUrl;
  process.env.GABY_WEBCHAT_KEY = LLAVE;
  process.env.WEBCHAT_IP_SALT = SAL;
  process.env.OPENROUTER_API_KEY = 'clave-falsa-de-prueba';
  delete process.env.CHAT_ENABLED;
  delete process.env.CHAT_DAILY_LIMIT;
  salesChat._setProvider(async (messages) => { seen.push(messages); return 'Respuesta de salesChat.'; });
});

const PAGE = { app: 'servicios', utm: { source: 'instagram', medium: 'social', campaign: 'octubre', content: '', term: '', otro: 'x' },
  ref: 'https://www.instagram.com/', referral: 'a1b2c3', l: 'k7Qm2xWa9pLr4tZc', path: '/', extra: 'no viaja' };
const ask = (body) => call('POST', '/public/chat', { body });
const turnos = [{ role: 'user', content: 'hola' }, { role: 'assistant', content: '¡Hola!' }, { role: 'user', content: '  ¿Cuánto cuesta?  ' }];

test('con la llave de GABY la página puede recuperar la conversación; sin nada, el chat no aparece', async () => {
  assert.deepEqual((await call('GET', '/public/chat')).data, { enabled: true, history: true });
  delete process.env.GABY_WEBCHAT_KEY;
  assert.deepEqual((await call('GET', '/public/chat')).data, { enabled: true, history: false });   // sigue salesChat
  delete process.env.OPENROUTER_API_KEY;
  assert.deepEqual((await call('GET', '/public/chat')).data, { enabled: false, history: false });
  process.env.GABY_WEBCHAT_KEY = LLAVE;
  process.env.CHAT_ENABLED = 'false';                                                              // apaga los dos
  assert.deepEqual((await call('GET', '/public/chat')).data, { enabled: false, history: false });
});

test('reenvía a GABY solo el mensaje nuevo, con la llave, la sesión y el hash de la IP (nunca la IP)', async () => {
  const res = await ask({ session: SESION, messages: turnos, page: PAGE });
  assert.equal(res.status, 200);
  assert.equal(got.length, 1);
  const [r] = got;
  assert.equal(r.method, 'POST');
  assert.equal(r.url, '/api/webchat/message');
  assert.equal(r.key, LLAVE);
  assert.deepEqual(Object.keys(r.body).sort(), ['ip_hash', 'lang', 'market', 'page', 'session', 'text']);
  assert.equal(r.body.session, SESION);
  assert.equal(r.body.text, '¿Cuánto cuesta?');                                    // solo lo nuevo, sin el historial
  assert.equal(r.body.lang, 'es');
  assert.equal(r.body.market, 'co');                                                 // sin market: Colombia
  assert.deepEqual(r.body.page, { app: 'servicios', utm: { source: 'instagram', medium: 'social', campaign: 'octubre', content: '', term: '' },
    ref: 'https://www.instagram.com/', referral: 'a1b2c3', l: 'k7Qm2xWa9pLr4tZc', path: '/' });
  assert.match(r.body.ip_hash, /^[0-9a-f]{64}$/);
  const posibles = ['127.0.0.1', '::ffff:127.0.0.1', '::1'].map((ip) => crypto.createHash('sha256').update(ip + SAL).digest('hex'));
  assert.ok(posibles.includes(r.body.ip_hash), 'ip_hash = sha256(ip + sal)');
  assert.doesNotMatch(r.raw, /127\.0\.0\.1|::1/);
  // al navegador llega lo que sabe mostrar, limpio
  assert.equal(res.data.reply, 'Servicios cuesta $49.000 por técnico al mes.');
  assert.deepEqual(res.data.messages.map((m) => [m.id, m.from]), [['m1', 'visitor'], ['m2', 'gaby']]);
  assert.deepEqual(res.data.actions, [{ type: 'trial', url: 'https://novaworkorder.com/?l=k7Qm2xWa9pLr4tZc&app=servicios#demo', label: 'Empieza gratis' }]);
  assert.equal(res.data.handoff, false);
  assert.equal(res.data.secreto, undefined);
  assert.equal(seen.length, 0);                                                       // salesChat no se usó
  const [stat] = await ChatStat.find().lean();
  assert.equal(stat.messages, 1);                                                     // se cuenta en el día
});

test('a GABY le llega el mercado: /es-us/ es us en español; la página en inglés siempre es us', async () => {
  await ask({ session: SESION, messages: turnos, page: { ...PAGE, path: '/es-us/' }, lang: 'es', market: 'us' });
  await ask({ session: SESION, messages: turnos, page: PAGE, lang: 'en' });
  await ask({ session: SESION, messages: turnos, page: PAGE, lang: 'en', market: 'co' });
  assert.deepEqual(got.map((r) => [r.body.lang, r.body.market]), [['es', 'us'], ['en', 'us'], ['en', 'us']]);
  assert.equal(got[0].body.page.path, '/es-us/');
});

test('si GABY falla, no responde o no está configurada, contesta salesChat y el visitante no se queda sin respuesta', async () => {
  mode = '503';
  let res = await ask({ session: SESION, messages: [{ role: 'user', content: 'a' }] });
  assert.equal(res.status, 200);
  assert.deepEqual(res.data, { reply: 'Respuesta de salesChat.' });
  assert.equal(got.length, 1);

  mode = 'ok';
  process.env.GABY_WEBCHAT_KEY = 'otra-llave-que-gaby-no-conoce';                       // GABY responde 401
  res = await ask({ session: SESION, messages: [{ role: 'user', content: 'b' }] });
  assert.deepEqual(res.data, { reply: 'Respuesta de salesChat.' });

  process.env.GABY_WEBCHAT_KEY = LLAVE;
  process.env.GABY_WEBCHAT_URL = 'http://127.0.0.1:1/api/webchat';                     // nadie escucha
  res = await ask({ session: SESION, messages: [{ role: 'user', content: 'c' }] });
  assert.deepEqual(res.data, { reply: 'Respuesta de salesChat.' });

  process.env.GABY_WEBCHAT_URL = gabyUrl;
  delete process.env.GABY_WEBCHAT_KEY;                                                  // no configurada: ni lo intenta
  got = [];
  res = await ask({ session: SESION, messages: [{ role: 'user', content: 'd' }] });
  assert.deepEqual(res.data, { reply: 'Respuesta de salesChat.' });
  assert.equal(got.length, 0);

  process.env.GABY_WEBCHAT_KEY = LLAVE;                                                 // sin sesión (la página en inglés)
  res = await ask({ lang: 'en', messages: [{ role: 'user', content: 'How much?' }] });
  assert.deepEqual(res.data, { reply: 'Respuesta de salesChat.' });
  assert.equal(got.length, 0);
  assert.equal(seen.length, 5);

  // con GABY caída y salesChat sin clave: el aviso de siempre, con el correo
  delete process.env.OPENROUTER_API_KEY;
  mode = '503';
  res = await ask({ session: SESION, messages: [{ role: 'user', content: 'e' }] });
  assert.equal(res.status, 503);
  assert.match(res.data.message, /contacto@novaworkorder\.com/);
});

test('el tope de GABY (429) llega al visitante sin gastar en salesChat; el límite por IP se conserva', async () => {
  mode = '429';
  const res = await ask({ session: SESION, messages: [{ role: 'user', content: 'a' }] });
  assert.equal(res.status, 429);
  assert.match(res.data.message, /Empieza gratis/);
  assert.equal(seen.length, 0);

  mode = 'ok';
  for (let i = 1; i < 30; i += 1) assert.equal((await ask({ session: SESION, messages: [{ role: 'user', content: `p${i}` }] })).status, 200);
  assert.equal((await ask({ session: SESION, messages: [{ role: 'user', content: 'otra' }] })).status, 429);
  assert.equal(got.length, 30);                                                         // la 31 no llegó a GABY
});

test('sesión inválida: rechazada sin llegar a GABY', async () => {
  for (const session of ['corta', 'con espacios y más de dieciséis', 'a'.repeat(65), 'ñandú-ñandú-ñandú-1', 123]) {
    const res = await ask({ session, messages: [{ role: 'user', content: 'hola' }] });
    assert.equal(res.status, 400, String(session));
  }
  assert.equal((await call('GET', '/public/chat/messages?session=corta')).status, 400);
  assert.equal((await call('GET', '/public/chat/messages')).status, 400);
  assert.equal((await call('GET', `/public/chat/messages?session=${SESION}&after=${encodeURIComponent('m1"><')}`)).status, 400);
  assert.equal(got.length, 0);
  assert.equal(seen.length, 0);
});

test('GET de mensajes: trae la conversación y lo nuevo (las respuestas de Mario) desde GABY', async () => {
  const all = await call('GET', `/public/chat/messages?session=${SESION}`);
  assert.equal(all.status, 200);
  assert.deepEqual(all.data.messages.map((m) => [m.id, m.from]), [['m1', 'visitor'], ['m2', 'gaby'], ['m3', 'mario']]);
  assert.equal(all.data.handoff, true);
  assert.equal(got[0].method, 'GET');
  assert.equal(got[0].key, LLAVE);
  assert.equal(got[0].url, `/api/webchat/messages?session=${SESION}`);

  const nuevo = await call('GET', `/public/chat/messages?session=${SESION}&after=m2`);
  assert.deepEqual(nuevo.data.messages, [{ id: 'm3', from: 'mario', text: 'Hola, soy Mario de NOVA. Te ayudo con tu cuenta.', at: '2026-10-28T15:05:00Z' }]);
  assert.equal(got[1].url, `/api/webchat/messages?session=${SESION}&after=m2`);

  mode = '503';
  assert.equal((await call('GET', `/public/chat/messages?session=${SESION}`)).status, 503);
  delete process.env.GABY_WEBCHAT_KEY;
  got = [];
  assert.equal((await call('GET', `/public/chat/messages?session=${SESION}`)).status, 503);
  assert.equal(got.length, 0);
});

test('la burbuja usa la sesión, recupera el historial, consulta lo nuevo y avisa que la conversación se guarda', () => {
  const html = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'landing', 'index.html'), 'utf8');
  assert.match(html, /localStorage\.getItem\('nova-chat-session'\)/);
  assert.match(html, /\/api\/public\/chat\/messages\?session=/);
  assert.match(html, /POLL_MS = 8000/);
  assert.match(html, /visibilitychange/);
  assert.match(html, /Equipo NOVA/);
  assert.match(html, /GABY es una asistente virtual con IA\. Guardamos esta conversación para atenderte \(<a href="\/privacidad#chat">política de privacidad<\/a>\)/);
});
