// La página para México (novaworkorder.com/es-mx/) y el mercado mx de punta a punta: quien se registra ahí queda como
// cliente de México (pesos mexicanos, PayPal) con la app y los correos en español; su empresa cotiza en MXN con el IVA
// de México, la hora de Ciudad de México y celulares +52, sin Wompi ni Factus.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { start, stop, reset, call, company, KEY } = require('./helpers');
const { resetLimits } = require('../src/utils/rateStore');
const salesChat = require('../src/utils/salesChat');
const { currencyOf, defaultTaxRate, isColombia, isMX, isUS, marketOf, roundMoney, totals } = require('../src/utils/money');
const { timeZoneOf } = require('../src/controllers/serviceReportController');

const leer = (f) => fs.readFileSync(path.join(__dirname, '..', 'landing', f), 'utf8');
const fe = (f) => fs.readFileSync(path.join(__dirname, '..', 'frontend', 'src', f), 'utf8');
// Nada de Colombia en la portada de México (los textos legales sí dicen dónde está NOVA Desarrollos).
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

const demo = { company: 'Clima Regio', name: 'Rosa Garza', email: 'rosa@climaregio.mx', phone: '81 1234 5678', technicians: '3' };

test('el registro de /es-mx/ guarda el mercado mx y GABY lo lee en las solicitudes', async () => {
  assert.equal((await call('POST', '/public/demo', { body: { ...demo, lang: 'es', market: 'mx', kind: 'prueba', consent: true } })).status, 201);
  // en inglés siempre es Estados Unidos, aunque diga mx
  assert.equal((await call('POST', '/public/demo', { body: { ...demo, email: 'joe@coolair.com', lang: 'en', market: 'mx' } })).status, 201);
  assert.equal((await call('POST', '/public/demo', { body: { ...demo, email: 'laura@frio.co' } })).status, 201);
  const items = (await call('GET', '/platform/demo-requests', { platformKey: KEY })).data.items;
  assert.deepEqual(items.map((d) => [d.email, d.lang, d.market]), [
    ['rosa@climaregio.mx', 'es', 'mx'], ['joe@coolair.com', 'en', 'us'], ['laura@frio.co', 'es', 'co']]);
});

test('el chat de /es-mx/ cotiza en pesos mexicanos: a GABY le llega mx y el respaldo usa los datos de México', async () => {
  const seen = [];
  salesChat._setProvider(async (messages, lang, market) => { seen.push([lang, market]); return 'Servicios cuesta $299 MXN por técnico al mes.'; });
  const msg = [{ role: 'user', content: '¿Cuánto cuesta?' }];
  assert.equal((await call('POST', '/public/chat', { body: { lang: 'es', market: 'mx', messages: msg } })).status, 200);
  assert.equal((await call('POST', '/public/chat', { body: { lang: 'en', market: 'mx', messages: msg } })).status, 200);
  assert.deepEqual(seen, [['es', 'mx'], ['en', 'us']]);
  assert.equal(salesChat.systemFor('es', 'mx'), salesChat.SYSTEM_MX);
  assert.equal(salesChat.systemFor('en', 'mx'), salesChat.SYSTEM_EN);

  const f = salesChat.FACTS_MX;
  assert.match(f, /\$299 MXN \(pesos mexicanos\) por técnico al mes/);
  assert.match(f, /\$249 MXN \(pesos mexicanos\) por tienda al mes/);
  assert.match(f, /5 técnicos = \$1,495 MXN/);
  assert.match(f, /en pesos mexicanos por PayPal/);
  assert.match(f, /IVA de 16 %/);
  assert.match(f, /Mercado Pago, PayPal o Stripe/);
  assert.match(f, /Factura CFDI: NOVA todavía no la emite; está en camino/);
  assert.match(f, /7 días de prueba gratis/);
  assert.doesNotMatch(f, COLOMBIA);
  assert.doesNotMatch(f, /US\$|dólar|tiempo real|testimoni|descuento|321 392 7697|wa\.me/i);
  assert.match(salesChat.SYSTEM_MX, /español de México/);
  assert.match(salesChat.SYSTEM_MX, /Nunca menciones Colombia, pesos colombianos, Nequi, Wompi, Factus, DIAN, PSE ni Bold/);
  assert.match(salesChat.SYSTEM_MX, /nunca prometas fecha/);
  assert.match(salesChat.SYSTEM_MX, /No des números de teléfono/);
});

test('una empresa de México cotiza en pesos mexicanos con IVA del 16 %, hora de Ciudad de México y sin Wompi ni DIAN', async () => {
  const made = await call('POST', '/platform/companies', { platformKey: KEY, body: {
    name: 'Clima Regio', adminName: 'Rosa Garza', adminEmail: 'rosa@climaregio.mx', maxTechnicians: 3, lang: 'es', market: 'mx' } });
  assert.equal(made.status, 201);
  assert.equal(made.data.company.lang, 'es');
  assert.equal(made.data.company.market, 'mx');
  // en inglés siempre es us, aunque diga mx
  const en = await call('POST', '/platform/companies', { platformKey: KEY, body: { name: 'Cool', adminName: 'J', adminEmail: 'j@cool.com', lang: 'en', market: 'mx' } });
  assert.equal(en.data.company.market, 'us');

  const b = await company('Plomería del Norte');
  const patched = await call('PATCH', `/platform/companies/${b.id}`, { platformKey: KEY, body: { market: 'mx' } });
  assert.equal(patched.data.market, 'mx');
  const me = (await call('GET', '/auth/profile', { as: b.token })).data.company;
  assert.equal(me.lang, 'es');
  assert.equal(me.market, 'mx');

  const client = (await call('POST', '/clients', { as: b.token, body: { name: 'Hotel Ancira', phone: '81 8150 7000' } })).data;
  // sin decir el impuesto, cada renglón arranca con el IVA de México
  const q = await call('POST', '/quotes', { as: b.token, body: { client: client._id, title: 'Minisplits', items: [
    { description: 'Mantenimiento minisplit', qty: 4, unitPrice: 850 },
    { description: 'Refacción', qty: 1, unitPrice: 99.99, taxRate: 8 }] } });
  assert.equal(q.status, 201);
  assert.equal(q.data.currency, 'MXN');
  assert.deepEqual(q.data.items.map((i) => i.taxRate), [16, 8]);
  assert.equal(q.data.subtotal, 3499.99);
  assert.equal(q.data.tax, 552);                                                              // 544 + 8.00 (7.9992)
  assert.equal(q.data.total, 4051.99);

  // la cotización pública dice el mercado (la interfaz la pinta en MXN y su enlace «Hecho con…» lleva a /es-mx/)
  const sent = await call('POST', `/quotes/${q.data._id}/send`, { as: b.token });
  const vista = await call('GET', `/cotizaciones/${sent.data.path.split('/').pop()}`);
  assert.equal(vista.status, 200);
  assert.equal(vista.data.company.market, 'mx');
  assert.equal(vista.data.quote.currency, 'MXN');

  const wompi = await call('PUT', '/company/wompi', { as: b.token, body: { publicKey: 'pub_test_AbCdEf123456',
    integritySecret: 'test_integrity_Integ123456', eventsSecret: 'test_events_Event123456' } });
  assert.equal(wompi.status, 400);
  assert.match(wompi.data.message, /pesos colombianos/);
  const factus = await call('PUT', '/company/factus', { as: b.token, body: { env: 'sandbox', clientId: 'x', clientSecret: 'y', username: 'u@x.co',
    password: 'p', numberingRangeId: 1 } });
  assert.equal(factus.status, 400);

  // las reglas, sin base de datos
  assert.equal(marketOf({ lang: 'es', market: 'mx' }), 'mx');
  assert.equal(marketOf({ lang: 'en', market: 'mx' }), 'us');
  assert.equal(isMX({ market: 'mx' }), true);
  assert.equal(isUS({ market: 'mx' }), false);
  assert.equal(isColombia({ market: 'mx' }), false);
  assert.equal(isColombia({}), true);
  assert.equal(currencyOf({ market: 'mx' }), 'MXN');
  assert.equal(defaultTaxRate('MXN'), 16);
  assert.equal(defaultTaxRate('COP'), 19);
  assert.equal(defaultTaxRate('USD'), 0);
  assert.equal(roundMoney(85 * 0.095, 'MXN'), 8.08);                                          // centavos, como en dólares
  assert.equal(totals([{ qty: 1, unitPrice: 100, taxRate: 16 }], 'MXN').total, 116);
  assert.equal(timeZoneOf({ market: 'mx' }), 'America/Mexico_City');
  assert.equal(timeZoneOf({ market: 'us' }), 'America/New_York');
  assert.equal(timeZoneOf({}), 'America/Bogota');
});

test('la interfaz de Servicios: MXN con IVA de México, celulares +52, sin Wompi ni Factus y el enlace a /es-mx/', async () => {
  const quotes = fe('views/Quotes.jsx');
  assert.match(quotes, /const currency = companyCurrency\(user\.company\);/);
  assert.match(quotes, /const DEFAULT_TAX = \{ COP: 19, MXN: 16, USD: 0 \};/);
  assert.match(quotes, /<option value="16">16 %<\/option>/);
  assert.match(quotes, /<option value="8">\{t\('8 % \(frontera\)'\)\}<\/option>/);
  const ui = fe('ui.jsx');
  assert.match(ui, /export const phoneRegion = \(company\) => \(\{ co: 'es', us: 'en', mx: 'mx' \}\)\[companyMarket\(company\)\];/);
  assert.match(ui, /lang === 'mx'\) number = d\.length === 10 \? `52\$\{d\}`/);
  assert.match(ui, /market === 'mx' \? 'es-mx\/' : ''/);
  assert.match(ui, /MXN: 'es-MX'/);
  // la vista previa del formulario redondea los pesos mexicanos a centavos, como el servidor
  const [, round, fn] = /(const round = [\s\S]*?;)\nexport const quoteTotals = ([\s\S]*?\n};)/.exec(ui);
  const quoteTotals = new Function(`${round}\nreturn ${fn}`)();
  assert.deepEqual(quoteTotals([{ qty: 4, unitPrice: 850, taxRate: 16 }, { qty: 1, unitPrice: 99.99, taxRate: 8 }], 'MXN'),
    { subtotal: 3499.99, tax: 552, total: 4051.99 });
  assert.match(fe('views/Integrations.jsx'), /\{colombiaCompany\(user\?\.company\) && <WompiCard api=\{api\} \/>\}/);
  assert.match(fe('views/Integrations.jsx'), /\{colombiaCompany\(user\?\.company\) && <FactusCard api=\{api\} \/>\}/);
  // el enlace de WhatsApp, con la misma regla de ui.jsx: 10 dígitos en México van con 52
  const mx = (d) => (d.length === 10 ? `52${d}` : (/^52\d{10}$/.test(d) || /^521\d{10}$/.test(d) ? d : ''));
  assert.equal(mx('8112345678'), '528112345678');
  assert.equal(mx('3312345678'), '523312345678');                                             // Guadalajara, no Colombia
  assert.equal(mx('5218112345678'), '5218112345678');
});

test('la página /es-mx/: en español de México, en pesos mexicanos, sin nada de Colombia y con el mercado mx en el formulario, el chat y el píxel', () => {
  const html = leer('es-mx/index.html');
  assert.match(html, /<html lang="es-MX">/);
  assert.match(html, /<link rel="canonical" href="https:\/\/novaworkorder\.com\/es-mx\/" \/>/);
  assert.match(html, /<meta property="og:locale" content="es_MX" \/>/);
  assert.doesNotMatch(html, COLOMBIA);
  assert.doesNotMatch(html, /US\$|dólar|Stripe, PayPal o Square/i);
  assert.doesNotMatch(html, /<video|\.mp4|data-poster/);                                    // sin videos
  assert.doesNotMatch(html, /tiempo real|testimonio|clientes felices|descuento/i);
  assert.match(html, /\$299 MXN <small>por técnico al mes<\/small>/);
  assert.match(html, /\$249 MXN <small>por tienda al mes<\/small>/);
  assert.match(html, /"priceCurrency":"MXN"/);
  assert.doesNotMatch(html, /"priceCurrency":"(COP|USD)"/);
  assert.match(html, /"eligibleRegion":\{"@type":"Country","name":"MX"\}/);
  assert.match(html, /var PRECIO_TECNICO = 299;/);
  assert.match(html, /<b id="calc-total">\$1,495 MXN<\/b>/);
  assert.match(html, /PayPal/);
  assert.match(html, /Mercado Pago, PayPal o Stripe/);
  assert.match(html, /La factura CFDI está en camino/);
  assert.match(html, /sin letras chiquitas/);
  assert.match(html, /celular/);
  assert.match(html, /cotizaci/i);
  // el formulario y el chat dicen el mercado; el píxel lo manda en sus eventos
  assert.match(html, /lang: 'es', market: 'mx' \};/);
  assert.match(html, /session: session, page: page, lang: 'es', market: 'mx' \}/);
  assert.match(html, /var MERCADO = 'mx';/);
  assert.match(html, /fbq\('track', 'PageView', \{ market: MERCADO \}\)/);
  assert.match(html, /placeholder="81 1234 5678"/);
  // enlaces propios: privacidad y términos de México; ninguno a las versiones de Colombia
  for (const href of html.match(/href="\/(privacidad|terminos)[^"]*"/g) || []) assert.fail(`enlace a la versión de Colombia: ${href}`);
  for (const href of html.match(/href="\/es-us\/(privacidad|terminos)[^"]*"/g) || []) assert.fail(`enlace a los textos de EE. UU.: ${href}`);
  assert.match(html, /href="\/es-mx\/privacidad"/);
  assert.match(html, /href="\/es-mx\/terminos"/);
  assert.match(html, /<a href="\/es-us\/" hreflang="es-US">¿Estás en EE\. UU\.\?<\/a>/);
  // el WhatsApp, discreto: solo al final de las preguntas, en el pie y como respaldo sin chat; nunca en la portada
  const enlaces = html.match(/wa\.me\/[^"?]*/g) || [];
  assert.equal(enlaces.length, 3);
  for (const e of enlaces) assert.equal(e, 'wa.me/573213927697');
  assert.match(html, /para%20M%C3%A9xico%20y%20quiero/);
  assert.ok(html.indexOf('wa.me/') > html.indexOf('id="preguntas"'), 'ningún WhatsApp antes de las preguntas');
  assert.doesNotMatch(html, /\+57|321 392 7697/);
  const barra = html.slice(html.indexOf('<nav class="mbar"'), html.indexOf('</nav>', html.indexOf('<nav class="mbar"')));
  assert.doesNotMatch(barra, /wa\.me|i-wa/);
  // las imágenes son las de esta página (datos de México) y existen
  const imgs = html.match(/\/img\/[a-z0-9-]+\.webp/g);
  assert.equal(imgs.length, 4);
  for (const src of imgs) {
    assert.match(src, /-es-mx\.webp$/);
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'landing', src)), `falta ${src}`);
  }
});

test('hreflang es-MX en las cuatro portadas, enlaces discretos entre versiones y sitemap', () => {
  const cuatro = [/hreflang="es-CO" href="https:\/\/novaworkorder\.com\/"/, /hreflang="en-US" href="https:\/\/novaworkorder\.com\/en\/"/,
    /hreflang="es-US" href="https:\/\/novaworkorder\.com\/es-us\/"/, /hreflang="es-MX" href="https:\/\/novaworkorder\.com\/es-mx\/"/];
  for (const f of ['index.html', 'en/index.html', 'es-us/index.html', 'es-mx/index.html']) for (const h of cuatro) assert.match(leer(f), h, f);
  assert.match(leer('index.html'), /<a href="\/es-mx\/" hreflang="es-MX">¿Estás en México\?<\/a>/);
  assert.match(leer('es-us/index.html'), /<a href="\/es-mx\/" hreflang="es-MX">¿Estás en México\?<\/a>/);
  assert.match(leer('en/index.html'), /href="\/es-mx\/" hreflang="es-MX" lang="es">Español \(México\)/);
  const sitemap = leer('sitemap.xml');
  for (const u of ['/es-mx/', '/es-mx/privacidad', '/es-mx/terminos']) assert.match(sitemap, new RegExp(`<loc>https://novaworkorder\\.com${u}</loc>`));
});

test('privacidad y términos de /es-mx/: pesos mexicanos y PayPal, CFDI en camino, derechos ARCO y la verdad sobre NOVA Desarrollos', () => {
  const terminos = leer('es-mx/terminos.html');
  const privacidad = leer('es-mx/privacidad.html');
  for (const doc of [terminos, privacidad]) {
    assert.match(doc, /<html lang="es-MX">/);
    assert.doesNotMatch(doc, /Nequi|DIAN|Factus|Wompi|\bPSE\b|\bCOP\b|Bold|\$49\.000|\$39\.000|US\$|dólares/);
    assert.match(doc, /PayPal/);
    assert.match(doc, /href="\/es-mx\/"/);
    assert.match(doc, /sede en Colombia/);                                                    // quién es NOVA, sin esconderlo
  }
  assert.match(terminos, /<b>\$299 MXN<\/b>/);
  assert.match(terminos, /<b>\$249 MXN<\/b>/);
  assert.match(terminos, /<b>5 días<\/b>/);
  assert.match(terminos, /no emite factura CFDI; está en camino/);
  assert.match(terminos, /Mercado Pago, PayPal o Stripe/);
  assert.match(terminos, /leyes de la República de Colombia/);
  assert.match(privacidad, /id="chat"/);
  assert.match(privacidad, /id="medicion"/);
  assert.match(privacidad, /derechos ARCO/);
  assert.match(privacidad, /país de la página \(México\)/);
});
