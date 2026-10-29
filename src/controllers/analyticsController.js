const PageStat = require('../models/PageStat');
const DemoRequest = require('../models/DemoRequest');
const { channelOf } = require('../utils/channel');
const { addDays, colombiaDay, startOfDay } = require('../utils/colombia');

const PAGES = ['/', '/privacidad', '/terminos',
  '/en', '/en/privacy', '/en/terms', '/en/compare', '/en/compare/jobber', '/en/compare/housecall-pro', '/en/partners',
  '/es-us', '/es-us/privacidad', '/es-us/terminos', '/es-mx', '/es-mx/privacidad', '/es-mx/terminos'];
const MARKETS = PageStat.MARKETS;                                  // co, us, us-en, mx
const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp\/|headless|lighthouse|pingdom|uptime|curl|wget|python/i;
const cleanPath = (path) => {
  const p = String(path || '/').split(/[?#]/)[0].replace(/\.html$/, '').replace(/\/+$/, '') || '/';
  return PAGES.includes(p) ? p : '/otra';
};

// El mercado de una visita sale de la ruta que manda la página (location.pathname), en el servidor: /es-us → us,
// /en → us-en, /es-mx → mx y todo lo demás (/, /privacidad, rutas raras) → co. Nunca de la IP ni del navegador.
const marketOfPath = (path) => {
  const p = String(path || '/').split(/[?#]/)[0].toLowerCase();
  const first = p.split('/').filter(Boolean)[0] || '';
  if (first === 'es-us') return 'us';
  if (first === 'en') return 'us-en';
  if (first === 'es-mx') return 'mx';
  return 'co';
};

// Los contadores de antes del mercado no lo traen: las páginas conocidas eran todas de Colombia; los de «/otra» mezclaban
// /es-us/, /en/ y /es-mx/ con rutas raras y no se pueden repartir (van a `sinPais`).
const marketOfStat = (s) => s.market || (s.path === '/otra' ? null : 'co');

// El mercado de una solicitud: la de /en/ trae lang en (antes del mercado también); /es-us/ trae market us en español.
const marketOfRequest = (r) => {
  if (r.lang === 'en') return 'us-en';
  if (r.market === 'us') return 'us';
  if (r.market === 'mx') return 'mx';
  return 'co';
};

const pct = (n, d) => (d ? Math.round((n / d) * 1000) / 10 : 0);

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
      market: marketOfPath(req.body.path),
    };
    await PageStat.updateOne(key, { $inc: { count: 1 } }, { upsert: true });
    return res.status(204).end();
  } catch (error) {
    return res.status(204).end();                                    // la analítica nunca molesta al visitante
  }
};

// GET /api/platform/analytics?days=7 — para GABY (llave de plataforma): visitas, canales y conversión.
// byMarket: por país en todo el periodo; byMarketDay: un renglón por día y mercado (solo los que tienen algo).
const getAnalytics = async (req, res) => {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 7, 1), 90);
    const to = colombiaDay();
    const from = addDays(to, -(days - 1));
    const stats = await PageStat.find({ day: { $gte: from, $lte: to } }).lean();
    // Las solicitudes se cuentan por su fecha en Colombia: desde la medianoche de `from` en Colombia.
    const since = startOfDay(from);
    const requests = await DemoRequest.find({ createdAt: { $gte: since } }).select('channel kind market lang createdAt').lean();

    const channels = {};
    const byDay = {};
    const pages = {};
    const ch = (name) => (channels[name] = channels[name] || { channel: name, visits: 0, clicks: 0, requests: 0 });
    const dy = (day) => (byDay[day] = byDay[day] || { day, visits: 0, clicks: 0, requests: 0 });
    const markets = Object.fromEntries(MARKETS.map((m) => [m, { market: m, visits: 0, clicks: 0, requests: 0, trials: 0 }]));
    const marketDays = {};
    const md = (day, m) => (marketDays[`${day}|${m}`] = marketDays[`${day}|${m}`] || { day, market: m, visits: 0, clicks: 0, requests: 0 });
    const sinPais = { visits: 0, clicks: 0 };
    let visits = 0;
    let clicks = 0;
    let mobile = 0;
    stats.forEach((s) => {
      const m = marketOfStat(s);
      const field = s.event === 'visita' ? 'visits' : 'clicks';
      if (m) {
        markets[m][field] += s.count;
        md(s.day, m)[field] += s.count;
      } else {
        sinPais[field] += s.count;
      }
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
      const day = colombiaDay(r.createdAt);
      const m = marketOfRequest(r);
      ch(r.channel || 'sin dato').requests += 1;
      dy(day).requests += 1;
      markets[m].requests += 1;
      if (r.kind === 'prueba') markets[m].trials += 1;
      md(day, m).requests += 1;
    });
    const trials = requests.filter((r) => r.kind === 'prueba').length;
    res.status(200).json({
      days, from, to, visits, clicks,
      requests: requests.length, trials, demos: requests.length - trials,
      conversion: pct(requests.length, visits),                        // % de visitas que dejan sus datos
      mobileShare: visits ? Math.round((mobile / visits) * 100) : 0,
      byChannel: Object.values(channels).sort((a, b) => b.visits - a.visits || b.requests - a.requests),
      byDay: Object.values(byDay).sort((a, b) => a.day.localeCompare(b.day)),
      pages: Object.entries(pages).map(([path, n]) => ({ path, visits: n })).sort((a, b) => b.visits - a.visits),
      byMarket: MARKETS.map((m) => ({ ...markets[m], conversion: pct(markets[m].requests, markets[m].visits) })),
      byMarketDay: Object.values(marketDays).sort((a, b) => a.day.localeCompare(b.day) || MARKETS.indexOf(a.market) - MARKETS.indexOf(b.market)),
      sinPais,
    });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error al leer la analítica' });
  }
};

module.exports = { recordVisit, getAnalytics, cleanPath, marketOfPath, marketOfRequest };
