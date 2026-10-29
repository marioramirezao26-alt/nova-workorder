// /en/ renovada como las versiones en español (inglés sencillo, dólares, PayPal, market us), el SEO técnico de las cuatro
// portadas (title, description, canonical, hreflang, Open Graph, JSON-LD, sitemap y robots) y el blog estático de
// /blog/ y /en/blog/. Todo se lee de los archivos: no hace falta servidor ni base de datos.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { preguntas, conFaq, PORTADAS } = require('../src/scripts/faqLanding');
const blog = require('../src/scripts/blog');

const LANDING = path.join(__dirname, '..', 'landing');
const leer = (f) => fs.readFileSync(path.join(LANDING, f), 'utf8');
const SITIO = 'https://novaworkorder.com';
// Como Caddy (deploy/Caddyfile): try_files {path} {path}.html {path}/index.html
const archivoDe = (ruta) => {
  const p = decodeURIComponent(ruta.split(/[?#]/)[0]);
  for (const c of [p, `${p}.html`, path.join(p, 'index.html')]) {
    const f = path.join(LANDING, c);
    if (fs.existsSync(f) && fs.statSync(f).isFile()) return f;
  }
  return null;
};
const jsonLd = (html) => [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
const nodos = (html) => jsonLd(html).flatMap((j) => (j['@graph'] ? j['@graph'] : [j]));
const meta = (html, prop) => (html.match(new RegExp(`<meta (?:property|name)="${prop}" content="([^"]*)"`)) || [])[1];

test('/en/: inglés sencillo, dólares y PayPal, market us y lang en, como /es-us/', () => {
  const html = leer('en/index.html');
  assert.match(html, /<html lang="en-US">/);
  assert.match(html, /<link rel="canonical" href="https:\/\/novaworkorder\.com\/en\/" \/>/);
  assert.match(html, /\$29 <small>per technician a month<\/small>/);
  assert.match(html, /\$19 <small>per store a month<\/small>/);
  assert.match(html, /var PRECIO_TECNICO = 29;/);
  assert.match(html, /<b id="calc-total">\$145<\/b>/);
  assert.match(html, /PayPal/);
  assert.match(html, /Stripe, PayPal or Square/);
  assert.match(html, /7 days free/);
  assert.match(html, /no credit card/i);
  assert.doesNotMatch(html, /14-day|14 days|real[- ]time|testimonial|happy customers|discount/i);
  assert.doesNotMatch(html, /Colombia|Nequi|DIAN|Factus|Wompi|\bPSE\b|\bCOP\b|Bold|\$49\.000|\$39\.000|[Mm]ade in/);
  // el formulario y el chat dicen idioma y mercado; el píxel manda el mercado
  assert.match(html, /lang: 'en', market: 'us' \};/);
  assert.match(html, /session: session, page: page, lang: 'en', market: 'us' \}/);
  assert.match(html, /var MERCADO = 'us';/);
  assert.match(html, /fbq\('track', 'PageView', \{ market: MERCADO \}\)/);
  assert.doesNotMatch(html, /lang: 'es'/);
  // lo que queda en español en el código son comentarios, no textos que vea el visitante
  const visible = html.replace(/<!--[\s\S]*?-->/g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\/\/ [^\n]*$/gm, '');
  assert.doesNotMatch(visible, /Pregúntale|Empieza gratis|técnicos|Enviando|¡Listo!|Servicios|Pedidos/);
  // las secciones que enlazan GABY (#stores), las comparaciones (#start) y la propia página
  for (const id of ['features', 'stores', 'pricing', 'faq', 'start']) assert.match(html, new RegExp(`<section id="${id}"`), id);
  assert.match(html, /location\.hash === '#stores'\) form\.product\.value = 'pedidos'/);
  // los legales en inglés, las versiones en español y el blog
  assert.match(html, /href="\/en\/terms"/);
  assert.match(html, /href="\/en\/privacy"/);
  assert.match(html, /href="\/en\/blog\/"/);
  for (const href of html.match(/href="\/(privacidad|terminos|es-us\/privacidad)[^"]*"/g) || []) assert.fail(`enlace a un legal en español: ${href}`);
  // WhatsApp discreto: solo al final de las preguntas, en el pie y como respaldo sin chat
  const wa = html.match(/wa\.me\/[^"?]*/g) || [];
  assert.equal(wa.length, 3);
  for (const e of wa) assert.equal(e, 'wa.me/573213927697');
  assert.ok(html.indexOf('wa.me/') > html.indexOf('<section id="faq"'), 'ningún WhatsApp antes de las preguntas');
  const barra = html.slice(html.indexOf('<nav class="mbar"'), html.indexOf('</nav>', html.indexOf('<nav class="mbar"')));
  assert.doesNotMatch(barra, /wa\.me|i-wa/);
  assert.match(html, /<p class="wa-alt" data-wa-alt hidden>/);
  // capturas de la app en inglés con datos de EE. UU., y que existan
  const imgs = html.match(/\/img\/[a-z0-9-]+\.webp/g);
  assert.equal(imgs.length, 4);
  for (const src of imgs) {
    assert.match(src, /-en\.webp$/);
    assert.ok(fs.existsSync(path.join(LANDING, src)), `falta ${src}`);
  }
  // inicio.css conoce los id en inglés (si no, el formulario de #start se desarma)
  const css = leer('inicio.css');
  assert.match(css, /:is\(#demo, #start\) \.wrap/);
  assert.match(css, /:is\(#pedidos, #stores\) \.phones/);
});

test('privacidad y términos en inglés dicen lo que hoy es cierto: Store, el chat que se guarda, el píxel con consentimiento y PayPal', () => {
  const privacy = leer('en/privacy.html');
  const terms = leer('en/terms.html');
  for (const doc of [privacy, terms]) {
    assert.match(doc, /<html lang="en-US">/);
    assert.match(doc, /<link rel="canonical" href="https:\/\/novaworkorder\.com\/en\/(privacy|terms)" \/>/);
    assert.match(doc, /hreflang="es-US"/);
    assert.match(doc, /NOVAWORKORDER Store/);
    assert.match(doc, /PayPal/);
    assert.match(doc, /based in Colombia|Republic of Colombia|NOVA Desarrollos<\/b>, Colombia/);   // quién es NOVA, sin esconderlo
    assert.doesNotMatch(doc, /Nequi|DIAN|Factus|Wompi|\bPSE\b|\bCOP\b|Bold|real[- ]time/);
  }
  assert.match(privacy, /id="chat"/);
  assert.match(privacy, /The conversation is kept|the conversation is kept/);
  assert.match(privacy, /id="medicion"/);
  assert.match(privacy, /<b>Only if you accept<\/b>/);
  assert.doesNotMatch(privacy, /doesn't keep|isn't stored|not stored on our servers/);
  assert.match(terms, /<b>\$29<\/b> \(US dollars\)/);
  assert.match(terms, /<b>\$19<\/b>/);
  assert.match(terms, /<b>5 days<\/b>/);
  assert.match(terms, /Stripe, PayPal or Square/);
});

test('comparaciones y socios: coherentes con lo que hace la app hoy', () => {
  for (const f of ['en/compare/index.html', 'en/compare/jobber/index.html', 'en/compare/housecall-pro/index.html', 'en/partners/index.html']) {
    const html = leer(f);
    assert.doesNotMatch(html, /real time|Book a demo|14-day free trial/, f);
    assert.match(html, /href="\/en\/blog\/"/, f);
    for (const href of html.match(/href="\/en\/#[a-z-]+"/g) || []) {
      const id = href.match(/#([a-z-]+)/)[1];
      assert.match(leer('en/index.html'), new RegExp(`<section id="${id}"`), `${f}: /en/#${id} no existe`);
    }
  }
  for (const f of ['en/compare/jobber/index.html', 'en/compare/housecall-pro/index.html']) {
    const html = leer(f);
    assert.match(html, /<th scope="row">(Quotes|Estimates \(quotes\))<\/th><td><span class="yes">Yes<\/span>/, f);
    assert.match(html, /<th scope="row">(Invoices|Invoicing)<\/th><td><span class="no">Not included<\/span>/, f);
    assert.match(html, /Service report with photos and customer signature/, f);
  }
});

test('SEO de las cuatro portadas: title, description, canonical, hreflang, Open Graph y JSON-LD con precio por moneda', () => {
  const versiones = {
    'index.html': { url: '/', lang: 'es-CO', moneda: 'COP', precios: ['49000', '39000'], pais: 'CO' },
    'en/index.html': { url: '/en/', lang: 'en-US', moneda: 'USD', precios: ['29', '19'], pais: 'US' },
    'es-us/index.html': { url: '/es-us/', lang: 'es-US', moneda: 'USD', precios: ['29', '19'], pais: 'US' },
    'es-mx/index.html': { url: '/es-mx/', lang: 'es-MX', moneda: 'MXN', precios: ['299', '249'], pais: 'MX' },
  };
  const hreflang = { 'es-CO': '/', 'en-US': '/en/', 'es-US': '/es-us/', 'es-MX': '/es-mx/', 'x-default': '/' };
  for (const [f, v] of Object.entries(versiones)) {
    const html = leer(f);
    assert.match(html, new RegExp(`<html lang="${v.lang}">`), f);
    const titulo = html.match(/<title>([^<]+)<\/title>/)[1];
    assert.ok(titulo.length >= 30 && titulo.length <= 90, `${f}: title de ${titulo.length}`);
    assert.match(titulo, /NOVAWORKORDER/);
    const desc = meta(html, 'description');
    assert.ok(desc && desc.length >= 100 && desc.length <= 230, `${f}: description de ${desc && desc.length}`);
    assert.match(html, new RegExp(`<link rel="canonical" href="${SITIO}${v.url}" />`), f);
    for (const [h, u] of Object.entries(hreflang)) assert.match(html, new RegExp(`<link rel="alternate" hreflang="${h}" href="${SITIO}${u}" />`), `${f}: ${h}`);
    for (const p of ['og:title', 'og:description', 'og:image', 'og:url', 'og:locale', 'og:type', 'twitter:card']) assert.ok(meta(html, p), `${f}: falta ${p}`);
    assert.equal(meta(html, 'og:url'), `${SITIO}${v.url}`);
    assert.ok(archivoDe(new URL(meta(html, 'og:image')).pathname), `${f}: no existe la imagen de og:image`);
    // JSON-LD: Organization, las dos apps con su Offer en la moneda de la versión y FAQPage con las preguntas reales
    const n = nodos(html);
    assert.ok(n.some((x) => x['@type'] === 'Organization' && x.name === 'NOVA Desarrollos'), `${f}: Organization`);
    const apps = n.filter((x) => x['@type'] === 'SoftwareApplication');
    assert.equal(apps.length, 2, f);
    assert.deepEqual(apps.map((a) => a.offers.price), v.precios, f);
    for (const a of apps) {
      assert.equal(a.offers.priceCurrency, v.moneda, f);
      assert.equal(a.offers.priceSpecification.priceCurrency, v.moneda, f);
      assert.equal(a.offers.eligibleRegion.name, v.pais, f);
    }
    const faq = n.find((x) => x['@type'] === 'FAQPage');
    assert.ok(faq, `${f}: FAQPage`);
    assert.deepEqual(faq.mainEntity.map((q) => [q.name, q.acceptedAnswer.text]), preguntas(html).map((p) => [p.q, p.a]), f);
    assert.ok(faq.mainEntity.length >= 15, f);
    assert.equal(conFaq(html), html, `${f}: corre node src/scripts/faqLanding.js`);
    // sin «Colombia» en ninguna portada (la marca no se ata a un país; lo legal va en los legales)
    assert.doesNotMatch(html.replace(/<script[\s\S]*?<\/script>/g, ''), /Colombia/, f);
  }
  assert.deepEqual(PORTADAS, Object.keys(versiones));
  // los precios que ve la gente, por versión
  assert.match(leer('index.html'), /\$49\.000 <small>COP por técnico al mes/);
  assert.match(leer('index.html'), /\$39\.000/);
  assert.match(leer('es-us/index.html'), /US\$29 <small>por técnico al mes<\/small>/);
  assert.match(leer('es-mx/index.html'), /\$299 MXN/);
  assert.match(leer('es-mx/index.html'), /\$249 MXN/);
});

test('sitemap.xml válido y completo, y robots.txt lo anuncia', () => {
  const xml = leer('sitemap.xml');
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>\n<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  assert.match(xml, /<\/urlset>\n?$/);
  // bien formado: cada <url> con un solo <loc> y, si trae, un <lastmod> con fecha; nada suelto entre ellos
  const cuerpo = xml.replace(/^<\?xml[^>]*>\n<urlset[^>]*>/, '').replace(/<\/urlset>\n?$/, '').replace(/<!--[\s\S]*?-->/g, '');
  const urls = cuerpo.match(/<url>[\s\S]*?<\/url>/g);
  assert.equal(cuerpo.replace(/<url>[\s\S]*?<\/url>/g, '').trim(), '');
  const locs = urls.map((u) => {
    assert.match(u, /^<url><loc>[^<]+<\/loc>(<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>)?<\/url>$/);
    return u.match(/<loc>([^<]+)<\/loc>/)[1];
  });
  assert.equal(new Set(locs).size, locs.length, 'sin repetidos');
  for (const loc of locs) {
    assert.ok(loc.startsWith(`${SITIO}/`), loc);
    assert.doesNotMatch(loc, /&(?!amp;)/);
    assert.ok(archivoDe(new URL(loc).pathname), `el sitemap apunta a algo que no existe: ${loc}`);
  }
  for (const u of ['/', '/en/', '/es-us/', '/es-mx/', '/blog/', '/en/blog/', '/en/privacy', '/en/terms', '/en/compare/', '/en/partners/']) {
    assert.ok(locs.includes(`${SITIO}${u}`), `falta ${u}`);
  }
  for (const a of blog.articulos()) assert.ok(locs.includes(`${SITIO}${blog.urlDe(a)}`), `falta ${blog.urlDe(a)}`);
  assert.match(leer('robots.txt'), /^Sitemap: https:\/\/novaworkorder\.com\/sitemap\.xml$/m);
  assert.doesNotMatch(leer('robots.txt'), /Disallow: \/\s*$/m);
  // Caddy sirve /blog/ y /en/blog/<artículo>/ igual que /es-us/: con try_files
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'deploy', 'Caddyfile'), 'utf8'), /try_files \{path\} \{path\}\.html \{path\}\/index\.html/);
});

test('el blog: 6 artículos en español y 2 en inglés, útiles, honestos y con su SEO', () => {
  const todos = blog.articulos();
  const es = todos.filter((a) => a.lang === 'es');
  const en = todos.filter((a) => a.lang === 'en');
  assert.equal(es.length, 6);
  assert.equal(en.length, 2);
  for (const a of todos) {
    const n = blog.palabras(a.cuerpo);
    assert.ok(n >= 700 && n <= 1200, `${a.slug}: ${n} palabras`);
    // nada inventado: ni cifras de mercado, ni testimonios, ni clientes, ni «tiempo real»
    assert.doesNotMatch(a.cuerpo, /\d+\s?%|por ciento|percent|estudios? (dicen|muestran)|según (un|una) (estudio|encuesta)|studies show|survey/i, a.slug);
    assert.doesNotMatch(a.cuerpo, /testimoni|nuestros clientes (dicen|nos)|our customers (say|tell)|clientes felices|happy customers|tiempo real|real[- ]time/i, a.slug);
    assert.match(a.cuerpo, /<h2>(Cómo ayuda NOVAWORKORDER|How NOVAWORKORDER helps)<\/h2>/, a.slug);

    const ruta = blog.urlDe(a);
    const html = fs.readFileSync(archivoDe(ruta), 'utf8');
    assert.match(html, new RegExp(`<html lang="${a.lang === 'es' ? 'es' : 'en-US'}">`));
    assert.match(html, new RegExp(`<link rel="canonical" href="${SITIO}${ruta}" />`), a.slug);
    assert.equal(meta(html, 'description'), a.descripcion.replace(/"/g, '&quot;'));
    assert.ok(a.descripcion.length >= 90 && a.descripcion.length <= 200, `${a.slug}: description de ${a.descripcion.length}`);
    assert.equal(meta(html, 'og:type'), 'article');
    assert.equal(meta(html, 'og:url'), `${SITIO}${ruta}`);
    assert.equal(meta(html, 'og:image'), `${SITIO}/img/blog/${a.slug}.jpg`);
    assert.ok(fs.existsSync(path.join(LANDING, 'img', 'blog', `${a.slug}.jpg`)), `${a.slug}: falta la portada`);
    assert.match(html, /<link rel="stylesheet" href="\/estilos\.css" \/>/);
    assert.match(html, /<link rel="stylesheet" href="\/blog\.css" \/>/);
    const n2 = nodos(html);
    const art = n2.find((x) => x['@type'] === 'Article');
    assert.ok(art, `${a.slug}: Article`);
    assert.equal(art.headline, a.titulo);
    assert.equal(art.datePublished, a.fecha);
    assert.equal(art.image, `${SITIO}/img/blog/${a.slug}.jpg`);
    assert.equal(art.author['@id'], `${SITIO}/#org`);
    const migas = n2.find((x) => x['@type'] === 'BreadcrumbList');
    assert.deepEqual(migas.itemListElement.map((i) => i.item), [`${SITIO}${a.lang === 'es' ? '/' : '/en/'}`, `${SITIO}${a.lang === 'es' ? '/blog/' : '/en/blog/'}`, `${SITIO}${ruta}`]);
    // botón «Empieza gratis» hacia el formulario de una portada real
    assert.match(html, a.lang === 'es' ? /<a class="btn" href="\/#demo" data-kind="prueba">Empieza gratis<\/a>/ : /<a class="btn" href="\/en\/#start" data-kind="prueba">Start free<\/a>/);
    // enlaces internos entre artículos (en el cuerpo y en «Sigue leyendo») y que todo enlace interno exista
    const enCuerpo = (a.cuerpo.match(/href="\/(en\/)?blog\/[^"]+"/g) || []).length;
    assert.ok(enCuerpo >= 1, `${a.slug}: sin enlaces a otros artículos en el texto`);
    assert.ok((a.relacionados || []).length >= 1, `${a.slug}: sin relacionados`);
    for (const href of new Set((html.match(/href="\/[^"]*"/g) || []).map((h) => h.slice(6, -1)))) {
      assert.ok(archivoDe(href), `${a.slug}: enlace roto ${href}`);
    }
    // hreflang entre la versión en español y la traducción en inglés
    if (a.alterno) {
      const par = todos.find((x) => x.slug === a.alterno);
      assert.match(html, new RegExp(`hreflang="${par.lang === 'es' ? 'es' : 'en-US'}" href="${SITIO}${blog.urlDe(par)}"`), a.slug);
    }
  }
  // los índices
  for (const [f, lista] of [['blog/index.html', es], ['en/blog/index.html', en]]) {
    const html = leer(f);
    for (const a of lista) assert.match(html, new RegExp(`href="${blog.urlDe(a)}"`), f);
    const n = nodos(html);
    assert.ok(n.some((x) => x['@type'] === 'Blog' && x.blogPost.length === lista.length), f);
    assert.ok(n.some((x) => x['@type'] === 'BreadcrumbList'), f);
    assert.match(html, /<link rel="canonical" href="https:\/\/novaworkorder\.com\/(en\/)?blog\/" \/>/);
  }
  // «Blog» en el pie de las páginas en español
  for (const f of ['index.html', 'es-us/index.html', 'es-mx/index.html']) assert.match(leer(f), /<a href="\/blog\/">Blog<\/a>/, f);
});
