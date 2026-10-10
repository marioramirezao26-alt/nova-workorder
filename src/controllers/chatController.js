const ChatStat = require('../models/ChatStat');
const salesChat = require('../utils/salesChat');
const { colombiaDay } = require('./analyticsController');

const BUSY = 'Ahora no puedo responder. Déjanos tus datos en «Empieza gratis» o escríbenos a contacto@novaworkorder.com y te respondemos hoy.';

// GET /api/public/chat — la página pregunta si muestra la burbuja del chat.
const chatStatus = (req, res) => res.status(200).json({ enabled: salesChat.enabled() });

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

// POST /api/public/chat — { messages: [{ role: 'user' | 'assistant', content }] } → { reply }.
// El historial lo guarda el navegador del visitante; aquí no se guarda lo que escribe.
const chat = async (req, res) => {
  try {
    if (!salesChat.enabled()) return res.status(503).json({ message: BUSY });
    const messages = salesChat.clean(req.body.messages);
    if (!messages.length || messages[messages.length - 1].role !== 'user') {
      return res.status(400).json({ message: 'Escribe tu pregunta' });
    }
    const first = messages.filter((m) => m.role === 'user').length === 1;
    if (!(await take(first))) return res.status(503).json({ message: BUSY });
    const reply = await salesChat.reply(messages);
    return res.status(200).json({ reply });
  } catch (error) {
    return res.status(503).json({ message: BUSY });
  }
};

module.exports = { chat, chatStatus };
