// P-034 A3, A6, A7, A8, A9 y A11: precios con URL propia, 404 de verdad, publicar solo la web, blog por mercado,
// datos estructurados y llms.txt.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const paginas = require('../src/scripts/paginas');
const blog = require('../src/scripts/blog');

const RAIZ = path.join(__dirname, '..');
const leer = (rel) => fs.readFileSync(path.join(RAIZ, 'landing', rel), 'utf8');
const montos = (html, seccion) => {
  const i = html.indexOf(`<section id="${seccion}">`);
  return [...html.slice(i, html.indexOf('</section>', i)).matchAll(/<div class="amount">([^<]+)<small>/g)].map((m) => m[1].trim());
};

test('cada mercado tiene su página de precios, con los mismos precios de su portada', () => {
  for (const p of paginas.PRECIOS) {
    const html = leer(p.archivo);
    const portada = leer(p.portada);
    assert.ok(montos(portada, p.seccion).length >= 2, p.portada);
    assert.deepEqual(montos(html, p.seccion), montos(portada, p.seccion), p.archivo);
    assert.match(html, new RegExp(`<link rel="canonical" href="https://novaworkorder\\.com${p.ruta}" />`));
    assert.match(html, new RegExp(`<html lang="${p.lang}">`));
    assert.match(html, /<h1>/);
    assert.doesNotMatch(html, /data-chat/);                               // el chat necesita el JS de la portada
    assert.doesNotMatch(html, /href="#(?!i-)/);                           // todo «#…» va a la portada
    assert.match(html, new RegExp(`href="${p.inicio}#demo"`));
    assert.match(html, /<use href="#i-/);                                  // los íconos siguen funcionando
    for (const x of paginas.PRECIOS) assert.match(html, new RegExp(`hreflang="${x.lang}" href="https://novaworkorder\\.com${x.ruta}"`));
  }
  // sin precios viejos ni el de fundador
  for (const p of paginas.PRECIOS) assert.doesNotMatch(leer(p.archivo), /fundador|14 días|14 days/i, p.archivo);
});

test('las páginas de precios están al día con las portadas (corre node src/scripts/paginas.js si falla)', () => {
  const antes = paginas.PRECIOS.map((p) => leer(p.archivo));
  paginas.construir();
  paginas.PRECIOS.forEach((p, i) => assert.equal(leer(p.archivo), antes[i], p.archivo));
});

test('una ruta que no existe da 404 con una página útil, no un 302 al inicio', () => {
  const caddy = fs.readFileSync(path.join(RAIZ, 'deploy', 'Caddyfile'), 'utf8');
  assert.doesNotMatch(caddy, /redir @noexiste/);
  assert.match(caddy, /rewrite \* \/404\.html/);
  assert.match(caddy, /file_server \{\s*status 404\s*\}/);
  const html = leer('404.html');
  assert.match(html, /<meta name="robots" content="noindex" \/>/);
  assert.match(html, /href="\/"/);
  assert.match(html, /href="\/blog\/"/);
  assert.match(html, /href="\/en\/"/);
});

test('publicar-web.sh publica solo la página: sin npm, sin compilar y sin reiniciar, y avisa a IndexNow', () => {
  const sh = fs.readFileSync(path.join(RAIZ, 'deploy', 'publicar-web.sh'), 'utf8');
  assert.doesNotMatch(sh.replace(/^#.*$/gm, ''), /\bnpm\b|systemctl|\bcaddy\b/);
  assert.match(sh, /indexnow\.js/);
  assert.match(sh, /tar -xf "\$TAR" -C "\$TMP" landing docs\/blog/);
  assert.match(sh, /set -euo pipefail/);
});

test('blog por mercado: /es-mx/blog/ y /es-us/blog/ existen, con su llamado y los artículos en español', () => {
  const es = blog.articulos().filter((a) => a.lang === 'es');
  for (const [codigo, lang] of [['es-mx', 'es-MX'], ['es-us', 'es-US']]) {
    const html = leer(`${codigo}/blog/index.html`);
    assert.match(html, new RegExp(`<html lang="${lang}">`));
    assert.match(html, new RegExp(`<link rel="canonical" href="https://novaworkorder\\.com/${codigo}/blog/" />`));
    assert.match(html, new RegExp(`<a class="btn" href="/${codigo}/#demo" data-kind="prueba">`));
    for (const a of es) assert.match(html, new RegExp(`href="${blog.urlDe(a)}"`), `${codigo}: ${a.slug}`);
    assert.match(leer('blog/index.html'), new RegExp(`hreflang="${lang}" href="https://novaworkorder\\.com/${codigo}/blog/"`));
  }
  const mapa = leer('sitemap.xml');
  assert.match(mapa, /<loc>https:\/\/novaworkorder\.com\/es-mx\/blog\/<\/loc><lastmod>/);
  assert.match(mapa, /<loc>https:\/\/novaworkorder\.com\/es-us\/blog\/<\/loc><lastmod>/);
});

test('las comparaciones en español tienen ruta y plantilla (/comparar/), con dateModified', () => {
  const art = blog.articulos().find((a) => a.lang === 'es');
  const comp = { ...art, seccion: 'comparar', slug: 'prueba-comparar', actualizado: '2026-11-02' };
  assert.equal(blog.urlDe(comp), '/comparar/prueba-comparar/');
  assert.equal(blog.urlDe({ ...comp, lang: 'es-mx' }), '/es-mx/comparar/prueba-comparar/');
});

test('datos estructurados: la marca y la fundación sin quitar el nombre legal; lastmod en todo el mapa', () => {
  for (const f of ['index.html', 'es-mx/index.html', 'es-us/index.html', 'en/index.html']) {
    const html = leer(f);
    assert.match(html, /"name":"NOVA Desarrollos","alternateName":"NOVAWORKORDER"/, f);
    assert.match(html, /"foundingDate":"2026","foundingLocation":\{"@type":"Place","name":"Cúcuta, Norte de Santander, Colombia"\}/, f);
  }
  for (const f of ['en/compare/index.html', 'en/compare/jobber/index.html', 'en/compare/housecall-pro/index.html']) {
    assert.match(leer(f), /"dateModified":"\d{4}-\d{2}-\d{2}"/, f);
  }
  const urls = leer('sitemap.xml').match(/<url>.*<\/url>/g);
  for (const u of urls) assert.match(u, /<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/, u);
});

test('llms.txt: corto, con los precios y el blog, sin datos inventados', () => {
  const txt = leer('llms.txt');
  assert.ok(txt.length < 8000);
  assert.match(txt, /^# NOVAWORKORDER$/m);
  assert.match(txt, /https:\/\/novaworkorder\.com\/precios/);
  for (const a of blog.articulos().filter((x) => x.seccion !== 'comparar')) assert.ok(txt.includes(`https://novaworkorder.com${blog.urlDe(a)}`), a.slug);
  assert.doesNotMatch(txt, /\d+\s?%|clientes felices|testimoni|14 días/i);
});
