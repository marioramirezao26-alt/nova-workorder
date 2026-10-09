const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, reset, call, KEY, origin } = require('./helpers');
const { _hits } = require('../src/middleware/demoLimiter');
const { _visitHits } = require('../src/middleware/visitLimiter');
const { channelOf, fromReferrer } = require('../src/utils/channel');
const { cleanPath } = require('../src/controllers/analyticsController');

before(start);
after(stop);
beforeEach(async () => { await reset(); _hits.clear(); _visitHits.clear(); });

const PHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148';
const PC = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0';

const visit = (body, ua = PHONE) => fetch(`${origin()}/api/public/visit`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': ua }, body: JSON.stringify(body),
});

test('el canal sale del utm_source o del sitio que trajo al visitante', () => {
  assert.equal(channelOf({ utm: 'Instagram' }), 'instagram');
  assert.equal(channelOf({ utm: 'ig', ref: 'https://www.linkedin.com/feed' }), 'instagram');     // el utm manda
  assert.equal(channelOf({ utm: 'cualquiercosa' }), 'otro');
  assert.equal(channelOf({ ref: 'https://l.facebook.com/l.php?u=x' }), 'facebook');
  assert.equal(channelOf({ ref: 'https://lnkd.in/abc' }), 'linkedin');
  assert.equal(channelOf({ ref: 'https://www.google.com.co/' }), 'buscador');
  assert.equal(fromReferrer('https://novaworkorder.com/privacidad'), 'directo');
  assert.equal(channelOf({}), 'directo');
  assert.equal(cleanPath('/privacidad.html?x=1'), '/privacidad');
  assert.equal(cleanPath('/wp-admin'), '/otra');
});

test('cuenta visitas y clics sin cookies; GABY lee canales y conversión', async () => {
  assert.equal((await visit({ event: 'visita', path: '/', utm: 'instagram' })).status, 204);
  await visit({ event: 'visita', path: '/', utm: 'instagram' });
  await visit({ event: 'clic', path: '/', utm: 'instagram' });
  await visit({ event: 'visita', path: '/', ref: 'https://www.linkedin.com/' }, PC);
  await visit({ event: 'visita', path: '/' }, 'facebookexternalhit/1.1');                      // avance de enlace: no cuenta
  const res = await visit({ event: 'visita', path: '/' }, 'Mozilla/5.0 bot');
  assert.equal(res.headers.get('set-cookie'), null);
  await call('POST', '/public/demo', { body: { company: 'Frío', name: 'Laura', email: 'l@f.co', utm: 'instagram', kind: 'prueba', consent: true } });

  assert.equal((await call('GET', '/platform/analytics')).status, 401);                        // solo con la llave
  const { data } = await call('GET', '/platform/analytics?days=7', { platformKey: KEY });
  assert.equal(data.visits, 3);
  assert.equal(data.clicks, 1);
  assert.equal(data.requests, 1);
  assert.equal(data.trials, 1);
  assert.equal(data.conversion, 33.3);
  assert.equal(data.mobileShare, 67);
  assert.deepEqual(data.byChannel[0], { channel: 'instagram', visits: 2, clicks: 1, requests: 1 });
  assert.deepEqual(data.byChannel[1], { channel: 'linkedin', visits: 1, clicks: 0, requests: 0 });
  assert.equal(data.byDay.length, 1);
  assert.deepEqual(data.pages, [{ path: '/', visits: 3 }]);
  const [d] = (await call('GET', '/platform/demo-requests', { platformKey: KEY })).data.items;
  assert.equal(d.channel, 'instagram');                                                         // GABY sabe de dónde llegó
});

test('los contadores tienen límite por IP y nunca fallan hacia el visitante', async () => {
  assert.equal((await visit({ event: 'otra-cosa' })).status, 400);
  _visitHits.clear();
  for (let i = 0; i < 60; i += 1) await visit({ event: 'visita', path: '/' });
  assert.equal((await visit({ event: 'visita', path: '/' })).status, 204);
  const { data } = await call('GET', '/platform/analytics', { platformKey: KEY });
  assert.equal(data.visits, 60);
});
