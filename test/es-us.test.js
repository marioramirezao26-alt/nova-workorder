// La página para hispanos en Estados Unidos (novaworkorder.com/es-us/): el mercado (co | us) va aparte del idioma.
// Quien se registra ahí queda como cliente de EE. UU. (dólares, PayPal) con la app y los correos en español.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { start, stop, reset, call, company, KEY } = require('./helpers');
const { resetLimits } = require('../src/utils/rateStore');
const salesChat = require('../src/utils/salesChat');
const { isUS, marketOf, currencyOf } = require('../src/utils/money');

const leer = (f) => fs.readFileSync(path.join(__dirname, '..', 'landing', f), 'utf8');
const COLOMBIA = /Colombia|Nequi|DIAN|Factus|Wompi|\bPSE\b|\bCOP\b|Bold|\$49\.000|\$39\.000|hecho en/i;

before(start);
after(stop);
beforeEach(async () => {
  await reset();
  await resetLimits();
  delete process.env.GABY_WEBCHAT_KEY;
  process.env.OPENROUTER_API_KEY = 'clave-falsa-de-prueba';
  delete process.env.CHAT_ENABLED;
});

const demo = { company: 'Aire Fresco LLC', name: 'Rosa Díaz', email: 'rosa@airefresco.com', phone: '(713) 555-0142', technicians: '3' };

test('el registro guarda el mercado aparte del idioma y GABY lo lee en las solicitudes', async () => {
  assert.equal((await call('POST', '/public/demo', { body: { ...demo, market: 'ar' } })).status, 400);   // mx es la etapa 2
  assert.equal((await call('POST', '/public/demo', { body: { ...demo, lang: 'es', market: 'us', kind: 'prueba', consent: true } })).status, 201);
  assert.equal((await call('POST', '/public/demo', { body: { ...demo, email: 'joe@coolair.com', lang: 'en' } })).status, 201);
  assert.equal((await call('POST', '/public/demo', { body: { ...demo, email: 'laura@frio.co' } })).status, 201);
  // en inglés pero diciendo co: la página en inglés siempre es de Estados Unidos
  assert.equal((await call('POST', '/public/demo', { body: { ...demo, email: 'ann@x.com', lang: 'en', market: 'co' } })).status, 201);
  const items = (await call('GET', '/platform/demo-requests', { platformKey: KEY })).data.items;
  assert.deepEqual(items.map((d) => [d.email, d.lang, d.market]), [
    ['rosa@airefresco.com', 'es', 'us'], ['joe@coolair.com', 'en', 'us'], ['laura@frio.co', 'es', 'co'], ['ann@x.com', 'en', 'us']]);
});

test('el chat de /es-us/ responde en español con precios en dólares (respaldo sin GABY)', async () => {
  const seen = [];
  salesChat._setProvider(async (messages, lang, market) => { seen.push([lang, market]); return 'Servicios cuesta US$29 por técnico al mes.'; });
  const msg = [{ role: 'user', content: '¿Cuánto cuesta?' }];
  assert.equal((await call('POST', '/public/chat', { body: { lang: 'es', market: 'us', messages: msg } })).status, 200);
  assert.equal((await call('POST', '/public/chat', { body: { lang: 'es', messages: msg } })).status, 200);
  assert.equal((await call('POST', '/public/chat', { body: { lang: 'en', messages: msg } })).status, 200);
  assert.equal((await call('POST', '/public/chat', { body: { lang: 'es', market: 'ar', messages: msg } })).status, 400);
  assert.deepEqual(seen, [['es', 'us'], ['es', 'co'], ['en', 'us']]);
  assert.equal(salesChat.systemFor('es', 'us'), salesChat.SYSTEM_US_ES);
  assert.equal(salesChat.systemFor('es', 'co'), salesChat.SYSTEM);
  assert.equal(salesChat.systemFor('en', 'us'), salesChat.SYSTEM_EN);
  const f = salesChat.FACTS_US_ES;
  assert.match(f, /US\$29 \(dólares\) por técnico al mes/);
  assert.match(f, /US\$19 \(dólares\) por tienda al mes/);
  assert.match(f, /5 técnicos = US\$145/);
  assert.match(f, /PayPal/);
  assert.match(f, /Stripe, PayPal o Square/);
  assert.match(f, /7 días de prueba gratis/);
  assert.doesNotMatch(f, COLOMBIA);
  assert.doesNotMatch(f, /tiempo real|testimoni|descuento|310 376 7561|321 392 7697|wa\.me/i);
  assert.match(salesChat.SYSTEM_US_ES, /Nunca menciones pesos, Nequi, Wompi, Factus, DIAN, PSE ni Bold/);
  assert.match(salesChat.SYSTEM_US_ES, /No des números de teléfono/);
});

test('una empresa hispana de EE. UU. usa la app en español y cotiza en dólares; Wompi y la DIAN no aplican', async () => {
  const made = await call('POST', '/platform/companies', { platformKey: KEY, body: {
    name: 'Aire Fresco LLC', adminName: 'Rosa Díaz', adminEmail: 'rosa@airefresco.com', maxTechnicians: 3, lang: 'es', market: 'us' } });
  assert.equal(made.status, 201);
  assert.equal(made.data.company.lang, 'es');
  assert.equal(made.data.company.market, 'us');
  assert.equal((await call('POST', '/platform/companies', { platformKey: KEY, body: { name: 'X', adminName: 'X', adminEmail: 'x@x.co', market: 'ar' } })).status, 400);
  const en = await call('POST', '/platform/companies', { platformKey: KEY, body: { name: 'Cool', adminName: 'J', adminEmail: 'j@cool.com', lang: 'en' } });
  assert.equal(en.data.company.market, 'us');                                                  // en inglés siempre es us
  const co = await company('Frío Total');
  assert.equal((await call('GET', `/platform/companies/${co.id}`, { platformKey: KEY })).data.market, 'co');   // sin decir nada

  const b = await company('Plomería Rápida LLC');
  const patched = await call('PATCH', `/platform/companies/${b.id}`, { platformKey: KEY, body: { market: 'us' } });
  assert.equal(patched.data.market, 'us');
  assert.equal(patched.data.lang, 'es');
  const me = (await call('GET', '/auth/profile', { as: b.token })).data.company;
  assert.equal(me.lang, 'es');
  assert.equal(me.market, 'us');
  const client = (await call('POST', '/clients', { as: b.token, body: { name: 'Hotel Houston', email: 'h@houston.com' } })).data;
  const q = await call('POST', '/quotes', { as: b.token, body: { client: client._id, title: 'Destape', items: [{ description: 'Destape de drenaje', qty: 2, unitPrice: 89.5 }] } });
  assert.equal(q.data.currency, 'USD');
  assert.equal(q.data.total, 179);
  const wompi = await call('PUT', '/company/wompi', { as: b.token, body: { publicKey: 'pub_test_AbCdEf123456',
    integritySecret: 'test_integrity_Integ123456', eventsSecret: 'test_events_Event123456' } });
  assert.equal(wompi.status, 400);
  assert.match(wompi.data.message, /pesos colombianos/);
  // la orden que sale de la cotización queda en el idioma de la empresa (español), aunque sea de EE. UU.
  await call('POST', `/quotes/${q.data._id}/send`, { as: b.token });
  await call('POST', `/quotes/${q.data._id}/approve`, { as: b.token });
  const [order] = (await call('GET', '/workorders?limit=50', { as: b.token })).data.items;
  assert.match(order.title, /^Cotización #1: Destape/);

  // las reglas, sin base de datos
  assert.equal(isUS({ lang: 'es', market: 'us' }), true);
  assert.equal(isUS({ lang: 'en' }), true);                                                    // las de antes
  assert.equal(isUS({ lang: 'es' }), false);
  assert.equal(marketOf({ lang: 'en', market: 'co' }), 'us');
  assert.equal(currencyOf({ lang: 'es', market: 'us' }), 'USD');
  assert.equal(currencyOf({ lang: 'es', market: 'co' }), 'COP');
});

test('la página /es-us/: en español, en dólares, sin nada de Colombia y con el mercado en el formulario, el chat y el píxel', () => {
  const html = leer('es-us/index.html');
  assert.match(html, /<html lang="es-US">/);
  assert.match(html, /<link rel="canonical" href="https:\/\/novaworkorder\.com\/es-us\/" \/>/);
  assert.doesNotMatch(html, COLOMBIA);
  assert.doesNotMatch(html, /<video|\.mp4|data-poster/);                                    // sin videos por ahora
  assert.doesNotMatch(html, /tiempo real|testimonio|clientes felices|descuento/i);
  assert.match(html, /US\$29 <small>por técnico al mes<\/small>/);
  assert.match(html, /US\$19 <small>por tienda al mes<\/small>/);
  assert.match(html, /"priceCurrency":"USD"/);
  assert.doesNotMatch(html, /"priceCurrency":"COP"/);
  assert.match(html, /var PRECIO_TECNICO = 29;/);
  assert.match(html, /<b id="calc-total">US\$145<\/b>/);
  assert.match(html, /PayPal/);
  assert.match(html, /Stripe, PayPal o Square/);
  // el formulario y el chat dicen el mercado; el píxel lo manda en sus eventos
  assert.match(html, /lang: 'es', market: 'us' \};/);
  assert.match(html, /session: session, page: page, lang: 'es', market: 'us' \}/);
  assert.match(html, /var MERCADO = 'us';/);
  assert.match(html, /fbq\('track', 'PageView', \{ market: MERCADO \}\)/);
  assert.match(html, /var d = \{ market: MERCADO \};/);
  // enlaces propios: privacidad y términos de EE. UU. en español, el inglés y ninguno a la de Colombia
  for (const href of html.match(/href="\/(privacidad|terminos)[^"]*"/g) || []) assert.fail(`enlace a la versión de Colombia: ${href}`);
  assert.match(html, /href="\/es-us\/privacidad"/);
  assert.match(html, /href="\/es-us\/terminos"/);
  assert.match(html, /href="\/en\/" hreflang="en-US" lang="en">English</);
  // el WhatsApp, discreto: solo al final de las preguntas, en el pie y como respaldo sin chat; nunca en la portada
  const enlaces = html.match(/wa\.me\/[^"?]*/g) || [];
  assert.equal(enlaces.length, 3);
  for (const e of enlaces) assert.equal(e, 'wa.me/573213927697');
  assert.ok(html.indexOf('wa.me/') > html.indexOf('id="preguntas"'), 'ningún WhatsApp antes de las preguntas');
  assert.doesNotMatch(html, /\+57|321 392 7697/);
  const barra = html.slice(html.indexOf('<nav class="mbar"'), html.indexOf('</nav>', html.indexOf('<nav class="mbar"')));
  assert.doesNotMatch(barra, /wa\.me|i-wa/);
  // las imágenes son las de esta página (datos de EE. UU., en español) y existen
  for (const src of html.match(/\/img\/[a-z0-9-]+\.webp/g)) {
    assert.match(src, /-es-us\.webp$/);
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'landing', src)), `falta ${src}`);
  }
});

test('hreflang entre las tres versiones, enlace discreto «¿Estás en EE. UU.?» y sitemap', () => {
  const tres = [/hreflang="es-CO" href="https:\/\/novaworkorder\.com\/"/, /hreflang="en-US" href="https:\/\/novaworkorder\.com\/en\/"/,
    /hreflang="es-US" href="https:\/\/novaworkorder\.com\/es-us\/"/];
  for (const f of ['index.html', 'en/index.html', 'es-us/index.html']) for (const h of tres) assert.match(leer(f), h, f);
  assert.match(leer('index.html'), /<a href="\/es-us\/" hreflang="es-US">¿Estás en EE\. UU\.\?<\/a>/);
  assert.match(leer('en/index.html'), /href="\/es-us\/" hreflang="es-US" lang="es">Español/);
  const sitemap = leer('sitemap.xml');
  for (const u of ['/es-us/', '/es-us/privacidad', '/es-us/terminos']) assert.match(sitemap, new RegExp(`<loc>https://novaworkorder\\.com${u}</loc>`));
  // la página de Colombia manda el mercado co en sus eventos del píxel
  assert.match(leer('index.html'), /fbq\('track', 'PageView', \{ market: 'co' \}\)/);
});

test('privacidad y términos de /es-us/ son los de EE. UU. en español: PayPal y dólares, sin medios de pago de Colombia', () => {
  const terminos = leer('es-us/terminos.html');
  const privacidad = leer('es-us/privacidad.html');
  for (const doc of [terminos, privacidad]) {
    assert.match(doc, /<html lang="es-US">/);
    assert.doesNotMatch(doc, /Nequi|DIAN|Factus|Wompi|\bPSE\b|\bCOP\b|Bold|\$49\.000|\$39\.000/);
    assert.match(doc, /PayPal/);
    assert.match(doc, /href="\/es-us\/"/);
  }
  assert.match(terminos, /<b>US\$29<\/b>/);
  assert.match(terminos, /<b>US\$19<\/b>/);
  assert.match(terminos, /<b>5 días<\/b>/);
  assert.match(terminos, /Stripe, PayPal o Square/);
  assert.match(privacidad, /id="chat"/);
  assert.match(privacidad, /id="medicion"/);
  assert.match(privacidad, /California/);
});

test('Caddy sirve /es-us/ igual que /en/ (carpeta con index.html y páginas sin .html)', () => {
  const caddy = fs.readFileSync(path.join(__dirname, '..', 'deploy', 'Caddyfile'), 'utf8');
  assert.match(caddy, /try_files \{path\} \{path\}\.html \{path\}\/index\.html/);
  for (const f of ['es-us/index.html', 'es-us/privacidad.html', 'es-us/terminos.html']) {
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'landing', f)), f);
  }
  // el despliegue copia la carpeta landing completa, con sus subcarpetas
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'deploy', 'actualizar.sh'), 'utf8'), /cp -r "\$DEST\/landing" \/var\/www\/novaworkorder/);
});

test('la interfaz de Servicios toma el mercado (no el idioma) para la moneda, los celulares y el enlace a la página', async () => {
  const fe = (f) => fs.readFileSync(path.join(__dirname, '..', 'frontend', 'src', f), 'utf8');
  assert.match(fe('views/Quotes.jsx'), /const currency = companyCurrency\(user\.company\);/);
  for (const f of ['views/Quotes.jsx', 'views/Orders.jsx', 'views/ServiceReport.jsx']) {
    assert.doesNotMatch(fe(f), /whatsappLink\([^)]*user\.company\?\.lang\)/, f);
    assert.match(fe(f), /phoneRegion\(user\.company\)/, f);
  }
  assert.match(fe('ui.jsx'), /lang === 'en' \? 'en\/' : market === 'us' \? 'es-us\/' : market === 'mx' \? 'es-mx\/' : ''/);
  assert.match(fe('views/PublicQuote.jsx'), /novaLink\('cotizacion', company\.name, company\.lang, company\.market\)/);
  assert.match(fe('views/PublicReport.jsx'), /novaLink\('informe', company\.name, company\.lang, company\.market\)/);
});
