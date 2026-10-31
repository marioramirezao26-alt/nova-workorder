const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, reset, call, KEY, origin } = require('./helpers');
const { resetLimits } = require('../src/utils/rateStore');
const { channelOf, fromReferrer } = require('../src/utils/channel');
const { cleanPath } = require('../src/controllers/analyticsController');

before(start);
after(stop);
beforeEach(async () => { await reset(); await resetLimits(); });

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
  assert.equal(channelOf({ ref: 'https://www.producthunt.com/posts/novaworkorder' }), 'producthunt');
  assert.equal(channelOf({ utm: 'producthunt' }), 'producthunt');
  assert.equal(channelOf({ ref: 'https://www.g2.com/products/novaworkorder/reviews' }), 'directorio');
  assert.equal(channelOf({ ref: 'https://www.capterra.com/p/1/x/' }), 'directorio');
  assert.equal(channelOf({ utm: 'saasworthy' }), 'directorio');
  // P-034 A2: los asistentes de IA son su propio canal; Gemini no es «buscador» aunque sea de Google
  assert.equal(channelOf({ utm: 'chatgpt.com' }), 'ia');
  assert.equal(channelOf({ ref: 'https://chatgpt.com/' }), 'ia');
  assert.equal(channelOf({ ref: 'https://www.perplexity.ai/search/x' }), 'ia');
  assert.equal(channelOf({ ref: 'https://copilot.microsoft.com/' }), 'ia');
  assert.equal(channelOf({ ref: 'https://claude.ai/chat/1' }), 'ia');
  assert.equal(channelOf({ ref: 'https://gemini.google.com/app' }), 'ia');
  assert.equal(channelOf({ ref: 'https://www.google.com/' }), 'buscador');
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
  await resetLimits();
  for (let i = 0; i < 60; i += 1) await visit({ event: 'visita', path: '/' });
  assert.equal((await visit({ event: 'visita', path: '/' })).status, 204);
  const { data } = await call('GET', '/platform/analytics', { platformKey: KEY });
  assert.equal(data.visits, 60);
});

test('el enlace de recomendación de un cliente llega a GABY y cuenta como «referido»', async () => {
  await visit({ event: 'visita', path: '/', utm: 'instagram', referral: 'a1b2c3' });
  await call('POST', '/public/demo', { body: { company: 'Café Luna', name: 'Ana', email: 'a@luna.co', referral: 'A1B2C3', utm: 'instagram' } });
  await call('POST', '/public/demo', { body: { company: 'Otro', name: 'Leo', email: 'l@o.co', referral: '<script>' } });
  const [d, e] = (await call('GET', '/platform/demo-requests', { platformKey: KEY })).data.items;
  assert.equal(d.referral, 'a1b2c3');
  assert.equal(d.channel, 'referido');
  assert.equal(e.referral, null);                                                               // un código inválido se ignora
  const { data } = await call('GET', '/platform/analytics', { platformKey: KEY });
  assert.equal(data.byChannel.find((c) => c.channel === 'referido').visits, 1);
});
