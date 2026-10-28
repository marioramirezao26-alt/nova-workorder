const ChatStat = require('../models/ChatStat');
const salesChat = require('../utils/salesChat');
const gaby = require('../utils/gabyWebchat');
const { colombiaDay } = require('./analyticsController');

const BUSY = 'Ahora no puedo responder. Déjanos tus datos en «Empieza gratis» o escríbenos a contacto@novaworkorder.com y te respondemos hoy.';
const BUSY_EN = 'I can\'t answer right now. Leave your details in "Start free" or email us at contacto@novaworkorder.com and we\'ll reply today.';
const LIMIT = 'Hablamos mucho por hoy 😊. Para seguir, déjanos tus datos en «Empieza gratis» o escríbenos a contacto@novaworkorder.com.';
const LIMIT_EN = 'We\'ve talked a lot today 😊. To keep going, leave your details in "Start free" or email us at contacto@novaworkorder.com.';
const BAD_SESSION = 'Sesión de chat inválida. Recarga la página.';

// GET /api/public/chat — la página pregunta si muestra la burbuja del chat y si puede recuperar la conversación
// (`history`: el chat lo atiende GABY y la conversación vive allá).
const chatStatus = (req, res) => res.status(200).json({
  enabled: gaby.configured() || salesChat.enabled(),
  history: gaby.configured(),
});

// Suma un mensaje al contador del día solo si no pasa el tope. Con el tope lleno devuelve false.
const take = async (first) => {
  const limit = salesChat.dailyLimit();
  try {
    const doc = await ChatStat.findOneAndUpdate(
      { day: colombiaDay(), messages: { $lt: limit } },
      { $inc: { messages: 1, conversations: first ? 1 : 0 } },
      { upsert: true, new: true }
    );
    return Boolean(doc);
  } catch (error) {
    if (error.code === 11000) return false;            // el día ya existe y llegó al tope: el upsert choca con el índice
    throw error;
  }
};

// Lo que atiende GABY también se cuenta en el día (sin tope: el gasto de GABY lo controla GABY).
const count = (first) => ChatStat.updateOne({ day: colombiaDay() }, { $inc: { messages: 1, conversations: first ? 1 : 0 } }, { upsert: true })
  .catch(() => {});

// Reenvía el mensaje nuevo a GABY. Devuelve true si ya respondió al navegador; false para seguir con salesChat.
const viaGaby = async (req, res, { session, text, en, first }) => {
  try {
    const r = await gaby.send({ session, text, lang: en ? 'en' : 'es', page: req.body.page, ip: req.ip });
    if (r.status === 429) { res.status(429).json({ message: en ? LIMIT_EN : LIMIT }); return true; }
    if (r.status === 200 && (r.data.reply || r.data.messages.length)) {
      count(first);
      res.status(200).json(r.data);
      return true;
    }
    console.error(`Chat: GABY respondió ${r.status}; sigue salesChat`);
  } catch (error) {
    console.error(`Chat: GABY no responde (${error.name === 'AbortError' ? 'tiempo agotado' : error.message}); sigue salesChat`);
  }
  return false;
};

// POST /api/public/chat — { messages: [{ role: 'user' | 'assistant', content }], session?, page?, lang? } → { reply }.
// Con `session` y GABY configurada, solo el último mensaje viaja a GABY (que guarda la conversación) y la respuesta trae
// también { messages, actions, handoff }. Sin sesión (la página en inglés) o si GABY falla, responde salesChat con el
// historial que guarda el navegador, y aquí no se guarda lo que escribe.
const chat = async (req, res) => {
  const en = req.body.lang === 'en';
  const busy = en ? BUSY_EN : BUSY;
  try {
    const { session } = req.body;
    if (session !== undefined && session !== null && !gaby.validSession(session)) return res.status(400).json({ message: BAD_SESSION });
    const messages = salesChat.clean(req.body.messages);
    if (!messages.length || messages[messages.length - 1].role !== 'user') {
      return res.status(400).json({ message: en ? 'Type your question' : 'Escribe tu pregunta' });
    }
    const first = messages.filter((m) => m.role === 'user').length === 1;
    if (session && gaby.configured()) {
      const text = messages[messages.length - 1].content.slice(0, 1000);
      if (await viaGaby(req, res, { session, text, en, first })) return undefined;
    }
    if (!salesChat.enabled()) return res.status(503).json({ message: busy });
    if (!(await take(first))) return res.status(503).json({ message: busy });
    const reply = await salesChat.reply(messages, en ? 'en' : 'es');
    return res.status(200).json({ reply });
  } catch (error) {
    return res.status(503).json({ message: busy });
  }
};

// GET /api/public/chat/messages?session=&after= — la conversación guardada en GABY (al abrir el chat) y lo nuevo (cada
// pocos segundos mientras está abierto: por ejemplo, lo que Mario contesta desde el panel).
const chatMessages = async (req, res) => {
  const { session, after } = req.query;
  if (!gaby.validSession(session)) return res.status(400).json({ message: BAD_SESSION });
  if (after !== undefined && !gaby.validAfter(after)) return res.status(400).json({ message: 'Parámetro after inválido' });
  if (!gaby.configured()) return res.status(503).json({ message: BUSY });
  try {
    const r = await gaby.messages({ session, after });
    if (r.status === 200) return res.status(200).json(r.data);
    if (r.status === 404) return res.status(200).json({ messages: [], handoff: false });   // sesión que GABY aún no conoce
    return res.status(503).json({ message: BUSY });
  } catch (error) {
    return res.status(503).json({ message: BUSY });
  }
};

module.exports = { chat, chatStatus, chatMessages };
