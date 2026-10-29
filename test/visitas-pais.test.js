// Visitas, clics y registros de la página separados por país (mercado), para el panel «Página web por país» de GABY.
// El mercado sale de la ruta en el servidor: / → co, /es-us/ → us, /en/ → us-en, /es-mx/ → mx.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { start, stop, reset, call, KEY, origin } = require('./helpers');
const { resetLimits } = require('../src/utils/rateStore');
const { marketOfPath, marketOfRequest, cleanPath } = require('../src/controllers/analyticsController');
const PageStat = require('../src/models/PageStat');
const { colombiaDay, addDays } = require('../src/utils/colombia');

before(start);
after(stop);
beforeEach(async () => { await reset(); await resetLimits(); });

const PHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148';
const visit = (body, ua = PHONE) => fetch(`${origin()}/api/public/visit`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': ua }, body: JSON.stringify(body),
});
const demo = (body) => call('POST', '/public/demo', { body: { company: 'Frío SAS', name: 'Laura', ...body } });

test('el mercado sale de la ruta: /es-us → us, /en → us-en, /es-mx → mx y el resto → co', () => {
  assert.equal(marketOfPath('/'), 'co');
  assert.equal(marketOfPath('/privacidad'), 'co');
  assert.equal(marketOfPath('/es-us/'), 'us');
  assert.equal(marketOfPath('/es-us/terminos.html'), 'us');
  assert.equal(marketOfPath('/ES-US?utm_source=ig'), 'us');
  assert.equal(marketOfPath('/en/'), 'us-en');
  assert.equal(marketOfPath('/en/compare/jobber/'), 'us-en');
  assert.equal(marketOfPath('/es-mx/'), 'mx');
  assert.equal(marketOfPath('/enlace'), 'co');                    // no basta con empezar por «en»
  assert.equal(marketOfPath('/es-usa'), 'co');
  assert.equal(marketOfPath(undefined), 'co');
  assert.equal(marketOfPath('/wp-admin'), 'co');
  // las páginas nuevas ya no se pierden en «/otra»
  assert.equal(cleanPath('/es-us/'), '/es-us');
  assert.equal(cleanPath('/en/privacy.html'), '/en/privacy');
  assert.equal(cleanPath('/es-mx/terminos'), '/es-mx/terminos');
  // el registro: inglés es us-en (también los de antes del mercado), /es-us/ es us, /es-mx/ es mx
  assert.equal(marketOfRequest({ lang: 'en', market: 'us' }), 'us-en');
  assert.equal(marketOfRequest({ lang: 'en' }), 'us-en');
  assert.equal(marketOfRequest({ lang: 'es', market: 'us' }), 'us');
  assert.equal(marketOfRequest({ lang: 'es', market: 'mx' }), 'mx');
  assert.equal(marketOfRequest({}), 'co');
});

test('cada visita y cada clic guardan su mercado; GABY lee visitas, clics, registros y conversión por país y por día', async () => {
  for (const path of ['/', '/', '/', '/privacidad', '/es-us/', '/es-us/', '/en/', '/en/', '/en/', '/en/', '/es-mx/']) {
    assert.equal((await visit({ event: 'visita', path })).status, 204);
  }
  await visit({ event: 'clic', path: '/' });
  await visit({ event: 'clic', path: '/es-us/' });
  await visit({ event: 'clic', path: '/en/' });
  await visit({ event: 'clic', path: '/en/' });
  await visit({ event: 'visita', path: '/es-mx/' }, 'facebookexternalhit/1.1');     // un robot no cuenta en ningún país

  const saved = await PageStat.find({}).lean();
  assert.ok(saved.every((s) => ['co', 'us', 'us-en', 'mx'].includes(s.market)));
  assert.deepEqual([...new Set(saved.map((s) => s.market))].sort(), ['co', 'mx', 'us', 'us-en']);

  assert.equal((await demo({ email: 'a@co.co', kind: 'prueba', consent: true })).status, 201);
  assert.equal((await demo({ email: 'b@us.com', lang: 'es', market: 'us', kind: 'prueba', consent: true })).status, 201);
  assert.equal((await demo({ email: 'c@us.com', lang: 'en' })).status, 201);
  assert.equal((await demo({ email: 'd@mx.mx', lang: 'es', market: 'mx', kind: 'prueba', consent: true })).status, 201);
  assert.equal((await demo({ email: 'e@mx.mx', lang: 'es', market: 'mx' })).status, 201);

  const { status, data } = await call('GET', '/platform/analytics?days=30', { platformKey: KEY });
  assert.equal(status, 200);
  assert.equal(data.visits, 11);
  assert.deepEqual(data.byMarket, [
    { market: 'co', visits: 4, clicks: 1, requests: 1, trials: 1, conversion: 25 },
    { market: 'us', visits: 2, clicks: 1, requests: 1, trials: 1, conversion: 50 },
    { market: 'us-en', visits: 4, clicks: 2, requests: 1, trials: 0, conversion: 25 },
    { market: 'mx', visits: 1, clicks: 0, requests: 2, trials: 1, conversion: 200 },
  ]);
  const today = colombiaDay();
  assert.deepEqual(data.byMarketDay, [
    { day: today, market: 'co', visits: 4, clicks: 1, requests: 1 },
    { day: today, market: 'us', visits: 2, clicks: 1, requests: 1 },
    { day: today, market: 'us-en', visits: 4, clicks: 2, requests: 1 },
    { day: today, market: 'mx', visits: 1, clicks: 0, requests: 2 },
  ]);
  assert.deepEqual(data.sinPais, { visits: 0, clicks: 0 });
  // los totales de siempre siguen iguales (el resumen semanal y el panel «Tu página web» no cambian)
  assert.equal(data.requests, 5);
  assert.equal(data.clicks, 4);
  assert.deepEqual(data.pages.find((p) => p.path === '/en'), { path: '/en', visits: 4 });
});

test('los contadores de antes del mercado: las páginas de Colombia cuentan como co y «/otra» queda sin país', async () => {
  const day = addDays(colombiaDay(), -3);
  await PageStat.collection.insertMany([
    { day, path: '/', channel: 'directo', device: 'pc', event: 'visita', count: 5 },
    { day, path: '/privacidad', channel: 'directo', device: 'pc', event: 'visita', count: 1 },
    { day, path: '/', channel: 'directo', device: 'pc', event: 'clic', count: 2 },
    { day, path: '/otra', channel: 'instagram', device: 'movil', event: 'visita', count: 3 },
    { day, path: '/otra', channel: 'instagram', device: 'movil', event: 'clic', count: 1 },
  ]);
  await visit({ event: 'visita', path: '/es-us/' });
  const { data } = await call('GET', '/platform/analytics?days=7', { platformKey: KEY });
  assert.deepEqual(data.byMarket.find((m) => m.market === 'co'), { market: 'co', visits: 6, clicks: 2, requests: 0, trials: 0, conversion: 0 });
  assert.equal(data.byMarket.find((m) => m.market === 'us').visits, 1);
  assert.deepEqual(data.sinPais, { visits: 3, clicks: 1 });
  assert.equal(data.visits, 10);                                                        // el total sí las cuenta
  assert.deepEqual(data.byMarketDay.map((r) => [r.day, r.market]), [[day, 'co'], [colombiaDay(), 'us']]);
  // fuera del periodo no cuenta
  const one = (await call('GET', '/platform/analytics?days=1', { platformKey: KEY })).data;
  assert.equal(one.byMarket.find((m) => m.market === 'co').visits, 0);
});

test('el índice viejo (sin mercado) se cambia por el nuevo al arrancar, y así dos países el mismo día no chocan', async () => {
  const coll = PageStat.collection;
  await coll.dropIndexes();
  await coll.createIndex({ day: 1, path: 1, channel: 1, device: 1, event: 1 }, { unique: true, name: PageStat.OLD_INDEX });
  await PageStat.syncMarketIndex();
  await PageStat.syncMarketIndex();                                                      // idempotente
  const names = (await coll.indexes()).map((i) => i.name);
  assert.ok(!names.includes(PageStat.OLD_INDEX));
  assert.ok(names.includes('dia_ruta_canal_equipo_evento_mercado'));
  const key = { day: colombiaDay(), path: '/otra', channel: 'directo', device: 'pc', event: 'visita' };
  await PageStat.updateOne({ ...key, market: 'co' }, { $inc: { count: 1 } }, { upsert: true });
  await PageStat.updateOne({ ...key, market: 'us' }, { $inc: { count: 1 } }, { upsert: true });
  assert.equal(await PageStat.countDocuments(key), 2);
  await mongoose.model('PageStat').syncIndexes();
});

test('el blog también cuenta: /blog/ es co y /en/blog/ es us-en, cada uno con el mismo contador de las portadas', async () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const leer = (f) => fs.readFileSync(path.join(__dirname, '..', 'landing', f), 'utf8');
  for (const f of ['blog/index.html', 'blog/plantilla-orden-de-servicio/index.html', 'en/blog/index.html',
    'en/blog/organize-work-orders-without-paper/index.html']) {
    const html = leer(f);
    assert.match(html, /fetch\('\/api\/public\/visit'/, `${f}: sin contador`);
    assert.match(html, /track\('visita'\)/);
    assert.match(html, /track\('clic'\)/);
  }
  assert.equal(marketOfPath('/blog/'), 'co');
  assert.equal(marketOfPath('/blog/plantilla-orden-de-servicio/'), 'co');
  assert.equal(marketOfPath('/en/blog/organize-work-orders-without-paper/'), 'us-en');
  assert.equal(cleanPath('/blog/plantilla-orden-de-servicio/'), '/blog');
  assert.equal(cleanPath('/en/blog/'), '/en/blog');
  assert.equal(cleanPath('/blog/<script>'), '/otra');
  await visit({ event: 'visita', path: '/blog/plantilla-orden-de-servicio/' });
  await visit({ event: 'visita', path: '/en/blog/' });
  await visit({ event: 'clic', path: '/en/blog/write-a-quote-customers-approve-fast/' });
  const { data } = await call('GET', '/platform/analytics?days=1', { platformKey: KEY });
  assert.equal(data.byMarket.find((m) => m.market === 'co').visits, 1);
  assert.deepEqual(data.byMarket.find((m) => m.market === 'us-en'), { market: 'us-en', visits: 1, clicks: 1, requests: 0, trials: 0, conversion: 0 });
  assert.deepEqual(data.pages.map((p) => p.path).sort(), ['/blog', '/en/blog']);
});
