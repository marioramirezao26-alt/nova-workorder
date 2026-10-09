const PageStat = require('../models/PageStat');
const DemoRequest = require('../models/DemoRequest');
const { channelOf } = require('../utils/channel');

const PAGES = ['/', '/privacidad', '/terminos'];
const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp\/|headless|lighthouse|pingdom|uptime|curl|wget|python/i;
const OFFSET_MS = -5 * 60 * 60 * 1000;                             // Colombia, sin horario de verano

const colombiaDay = (date = new Date()) => new Date(date.getTime() + OFFSET_MS).toISOString().slice(0, 10);

const cleanPath = (path) => {
  const p = String(path || '/').split(/[?#]/)[0].replace(/\.html$/, '').replace(/\/+$/, '') || '/';
  return PAGES.includes(p) ? p : '/otra';
};

// POST /api/public/visit — la página de ventas cuenta una visita o un clic en «Empieza gratis / Pide tu demo».
// Sin cookies: solo suma 1 a un contador del día. Los robots (y los avances de enlaces de WhatsApp o Facebook) no cuentan.
const recordVisit = async (req, res) => {
  try {
    const ua = String(req.get('user-agent') || '');
    if (!ua || BOT.test(ua)) return res.status(204).end();
    const event = req.body.event === 'clic' ? 'clic' : 'visita';
    const key = {
      day: colombiaDay(),
      path: cleanPath(req.body.path),
      channel: channelOf({ utm: req.body.utm, ref: req.body.ref, referral: req.body.referral }),
      device: /Mobi|Android|iPhone|iPad/i.test(ua) ? 'movil' : 'pc',
      event,
    };
    await PageStat.updateOne(key, { $inc: { count: 1 } }, { upsert: true });
    return res.status(204).end();
  } catch (error) {
    return res.status(204).end();                                    // la analítica nunca molesta al visitante
  }
};

// GET /api/platform/analytics?days=7 — para GABY (llave de plataforma): visitas, canales y conversión.
const getAnalytics = async (req, res) => {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 7, 1), 90);
    const to = colombiaDay();
    const from = colombiaDay(new Date(Date.now() - (days - 1) * 86400000));
    const stats = await PageStat.find({ day: { $gte: from, $lte: to } }).lean();
    // Las solicitudes se cuentan por su fecha en Colombia: desde la medianoche de `from` en UTC-5.
    const since = new Date(new Date(`${from}T00:00:00.000Z`).getTime() - OFFSET_MS);
    const requests = await DemoRequest.find({ createdAt: { $gte: since } }).select('channel kind createdAt').lean();

    const channels = {};
    const byDay = {};
    const pages = {};
    const ch = (name) => (channels[name] = channels[name] || { channel: name, visits: 0, clicks: 0, requests: 0 });
    const dy = (day) => (byDay[day] = byDay[day] || { day, visits: 0, clicks: 0, requests: 0 });
    let visits = 0;
    let clicks = 0;
    let mobile = 0;
    stats.forEach((s) => {
      if (s.event === 'visita') {
        visits += s.count;
        if (s.device === 'movil') mobile += s.count;
        ch(s.channel).visits += s.count;
        dy(s.day).visits += s.count;
        pages[s.path] = (pages[s.path] || 0) + s.count;
      } else {
        clicks += s.count;
        ch(s.channel).clicks += s.count;
        dy(s.day).clicks += s.count;
      }
    });
    requests.forEach((r) => {
      ch(r.channel || 'sin dato').requests += 1;
      dy(colombiaDay(r.createdAt)).requests += 1;
    });
    const trials = requests.filter((r) => r.kind === 'prueba').length;
    res.status(200).json({
      days, from, to, visits, clicks,
      requests: requests.length, trials, demos: requests.length - trials,
      conversion: visits ? Math.round((requests.length / visits) * 1000) / 10 : 0,   // % de visitas que dejan sus datos
      mobileShare: visits ? Math.round((mobile / visits) * 100) : 0,
      byChannel: Object.values(channels).sort((a, b) => b.visits - a.visits || b.requests - a.requests),
      byDay: Object.values(byDay).sort((a, b) => a.day.localeCompare(b.day)),
      pages: Object.entries(pages).map(([path, n]) => ({ path, visits: n })).sort((a, b) => b.visits - a.visits),
    });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error al leer la analítica' });
  }
};

module.exports = { recordVisit, getAnalytics, colombiaDay, cleanPath };
