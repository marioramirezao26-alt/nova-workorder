// P-047: el aviso del registro a Meta desde el servidor (API de Conversiones), solo con la casilla de autorización.
const { test, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { start, stop, reset, call, KEY } = require('./helpers');
const { resetLimits } = require('../src/utils/rateStore');
const mc = require('../src/services/metaConversiones');
const { avisos } = require('../src/controllers/demoController');

before(start);
after(stop);
let enviados;
beforeEach(async () => {
  await reset(); await resetLimits();
  enviados = [];
  mc.fetchImpl = async (url, opts) => { enviados.push({ url, body: JSON.parse(opts.body) }); return { ok: true, status: 200 }; };
  process.env.META_CAPI_TOKEN = 'token-de-prueba';
  delete process.env.META_CAPI_TEST_CODE;
});
afterEach(() => { mc.fetchImpl = null; delete process.env.META_CAPI_TOKEN; });

const prueba = { company: 'Frío Total SAS', name: 'Laura Gómez', email: ' Laura@FrioTotal.com ', phone: '3109998877',
  technicians: '4', kind: 'prueba', consent: true, product: 'servicios' };
const esperar = () => Promise.all([...avisos]);

test('con la casilla: guarda la autorización y le avisa a Meta con el correo cifrado y el mismo event_id', async () => {
  const fbp = 'fb.1.1730000000000.123456789';
  const r = await call('POST', '/public/demo', { body: { ...prueba, meta_ok: true, event_id: 'rabc12345xyz', fbp, fbc: 'malo' } });
  assert.equal(r.status, 201);
  await esperar();
  assert.equal(enviados.length, 1);
  const { url, body } = enviados[0];
  assert.match(url, /^https:\/\/graph\.facebook\.com\/v\d+\.\d+\/1088825597305014\/events\?access_token=token-de-prueba$/);
  const [ev] = body.data;
  assert.equal(ev.event_name, 'CompleteRegistration');
  assert.equal(ev.event_id, 'rabc12345xyz');
  assert.equal(ev.action_source, 'website');
  assert.deepEqual(ev.user_data.em, [mc.sha256('laura@friototal.com')]);
  assert.equal(ev.user_data.fbp, fbp);
  assert.ok(!('fbc' in ev.user_data));                                              // un _fbc mal formado no va
  const texto = JSON.stringify(body);
  for (const dato of ['Laura', 'Gómez', 'friototal', '3109998877', 'Frío Total']) assert.ok(!texto.includes(dato), dato);
  const [d] = (await call('GET', '/platform/demo-requests', { platformKey: KEY })).data.items;
  assert.ok(d.metaConsentAt && d.consentAt);
});

test('sin la casilla, sin token o si no es la prueba, no se manda nada', async () => {
  await call('POST', '/public/demo', { body: { ...prueba, event_id: 'rabc12345xyz' } });
  await call('POST', '/public/demo', { body: { ...prueba, kind: 'demo', consent: false, meta_ok: true } });
  delete process.env.META_CAPI_TOKEN;
  await call('POST', '/public/demo', { body: { ...prueba, email: 'otra@frio.co', meta_ok: true } });
  await esperar();
  assert.equal(enviados.length, 0);
  const items = (await call('GET', '/platform/demo-requests', { platformKey: KEY })).data.items;
  assert.equal(items.filter((x) => x.metaConsentAt).length, 1);                     // la autorizó aunque falte el token
  assert.equal((await call('POST', '/public/demo', { body: { ...prueba, meta_ok: 'true' } })).status, 400);   // solo true de verdad
});

test('si Meta falla, la prueba se crea igual', async () => {
  mc.fetchImpl = async () => { throw new Error('sin red'); };
  assert.equal((await call('POST', '/public/demo', { body: { ...prueba, meta_ok: true } })).status, 201);
  await esperar();
  assert.equal((await mc.avisarRegistro({ autorizo: true, email: 'a@b.co' })).enviado, false);
  mc.fetchImpl = async () => ({ ok: false, status: 400 });
  assert.deepEqual(await mc.avisarRegistro({ autorizo: true, email: 'a@b.co' }), { enviado: false, motivo: 'Meta respondió 400' });
});

test('la casilla está en las 4 portadas, sin marcar, y la privacidad lo explica', () => {
  const leer = (f) => fs.readFileSync(path.join(__dirname, '..', 'landing', f), 'utf8');
  for (const [f, priv] of [['index.html', '/privacidad'], ['es-mx/index.html', '/es-mx/privacidad'],
    ['es-us/index.html', '/es-us/privacidad'], ['en/index.html', '/en/privacy']]) {
    const html = leer(f);
    assert.match(html, new RegExp(`<label class="wide consent" id="meta-field"><input type="checkbox" name="meta_ok" /> <span>(Opcional|Optional):[^<]*<a href="${priv}#medicion">`), f);
    assert.ok(!/name="meta_ok"[^>]*checked/.test(html), `${f}: nunca viene marcada`);
    assert.match(html, /data\.meta_ok = form\.meta_ok\.checked === true;/, f);
    assert.match(html, /\{ eventID: eventId \}/, f);                                   // el píxel con el mismo id
    assert.match(html, /window\.fbq\('track', nombre, d, opciones \|\| \{\}\);/, f);
  }
  for (const f of ['privacidad.html', 'es-mx/privacidad.html', 'es-us/privacidad.html']) {
    assert.match(leer(f), /Aviso de tu registro desde nuestro servidor \(opcional\)[\s\S]*huella SHA-256[\s\S]*Es voluntario/, f);
  }
  assert.match(leer('en/privacy.html'), /Notice of your sign-up from our server \(optional\)[\s\S]*SHA-256 hash/);
});
