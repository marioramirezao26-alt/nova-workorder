// P-034 A3, A6, A7, A8, A9 y A11: precios con URL propia, 404 de verdad, publicar solo la web, blog por mercado,
// datos estructurados y llms.txt.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const paginas = require('../src/scripts/paginas');
const blog = require('../src/scripts/blog');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { llenar } = require('../deploy/llenar-vendedor.js');

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
    assert.match(html, new RegExp(`href="${p.inicio}#${p.lang === 'en-US' ? 'start' : 'demo'}"`));
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
    assert.match(html, /"alternateName":"NOVAWORKORDER","brand":\{"@type":"Brand","name":"NOVAWORKORDER"\},\s*"foundingDate":"2026"/, f);
    assert.doesNotMatch(html, /foundingLocation/, f);                 // la marca no se ata a Colombia (Mario, 28-oct-2026)
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

// Ley 1480 de 2011 (art. 50) y Decreto 1377 de 2013 (art. 13): quién vende y quién es el responsable. Los datos de la persona
// que vende no van en el repositorio (es público): deploy/llenar-vendedor.js los pone al publicar (decisión de Mario, 5-nov-2026).
const TERMINOS = ['terminos.html', 'es-mx/terminos.html', 'es-us/terminos.html', 'en/terms.html'];
const POLITICAS = ['privacidad.html', 'es-mx/privacidad.html', 'es-us/privacidad.html', 'en/privacy.html'];
const MARCAS = ['{{VENDEDOR_NOMBRE}}', '{{VENDEDOR_ID}}', '{{VENDEDOR_DIRECCION}}'];
const archivosDe = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
  const f = path.join(dir, d.name);
  if (d.isDirectory()) return archivosDe(f);
  return /\.(html|txt|xml|md)$/.test(d.name) ? [f] : [];
});

test('los 4 términos tienen «Quién vende» con nombre, cédula y dirección de los marcadores, ciudad, correo y WhatsApp', () => {
  for (const f of TERMINOS) {
    const html = leer(f);
    assert.match(html, /<h2>(Quién vende|Seller information)<\/h2>/, f);
    for (const m of MARCAS) assert.ok(html.includes(m), `${f} sin ${m}`);
    assert.match(html, /Cúcuta, Norte de Santander, Colombia/, f);
    assert.match(html, /href="mailto:contacto@novaworkorder\.com"/, f);
    assert.match(html, /\+57 321 392 7697/, f);
  }
});

test('las 4 políticas de privacidad ponen el responsable con el nombre y la dirección de los marcadores, sin la cédula', () => {
  for (const f of POLITICAS) {
    const responsable = leer(f).match(/<h2>1\. (?:Responsable|Contacto|Contact)<\/h2>\s*<p>([\s\S]*?)<\/p>/);
    assert.ok(responsable, f);
    assert.ok(responsable[1].includes('{{VENDEDOR_NOMBRE}}') && responsable[1].includes('{{VENDEDOR_DIRECCION}}'), f);
    assert.doesNotMatch(responsable[1], /VENDEDOR_ID|NOVA Desarrollos/, f);
  }
});

test('ninguna página del repositorio trae la cédula ni la dirección reales de quien vende', () => {
  for (const f of [...archivosDe(path.join(RAIZ, 'landing')), ...archivosDe(path.join(RAIZ, 'docs'))]) {
    const texto = fs.readFileSync(f, 'utf8');
    assert.doesNotMatch(texto, /C\.\s?C\.\s*[\d.]{6,}/, path.relative(RAIZ, f));
    assert.doesNotMatch(texto, /Calle 7/, path.relative(RAIZ, f));
  }
});

test('llenar-vendedor.js llena los marcadores de los 4 términos y las 4 políticas con un archivo de prueba', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vendedor-pagina-'));
  const paginas = [...TERMINOS, ...POLITICAS];
  try {
    for (const f of paginas) {
      fs.mkdirSync(path.dirname(path.join(tmp, 'landing', f)), { recursive: true });
      fs.copyFileSync(path.join(RAIZ, 'landing', f), path.join(tmp, 'landing', f));
    }
    const archivo = path.join(tmp, 'vendedor-kit');
    fs.writeFileSync(archivo, 'VENDEDOR_NOMBRE=Persona de Prueba\nVENDEDOR_ID=C.C. 000\nVENDEDOR_DIRECCION=Calle de Prueba 1\n');
    fs.chmodSync(archivo, 0o600);
    assert.deepEqual(llenar(path.join(tmp, 'landing'), archivo).sort(), [...paginas].sort());
    for (const f of paginas) {
      const html = fs.readFileSync(path.join(tmp, 'landing', f), 'utf8');
      assert.doesNotMatch(html, /\{\{VENDEDOR_/, f);
      assert.match(html, /Persona de Prueba/, f);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('llenar-vendedor.js pone los datos de quien vende desde el archivo del servidor, o no deja publicar', () => {
  const script = path.join(RAIZ, 'deploy', 'llenar-vendedor.js');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vendedor-'));
  const PAGINA = '<!-- sin datos en el repositorio -->\n<dl><dt>Nombre</dt><dd>{{VENDEDOR_NOMBRE}}</dd><dt>Cédula</dt>' +
    '<dd>{{VENDEDOR_ID}}</dd><dt>Dirección</dt><dd>{{VENDEDOR_DIRECCION}}</dd></dl>';
  const pagina = () => {
    fs.rmSync(path.join(tmp, 'landing'), { recursive: true, force: true });
    fs.mkdirSync(path.join(tmp, 'landing', 'es'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'landing', 'terminos.html'), PAGINA);
    fs.writeFileSync(path.join(tmp, 'landing', 'es', 'index.html'), '<p>Hola</p>');
  };
  const archivo = path.join(tmp, 'vendedor-kit');
  const datos = (texto, modo = 0o600) => { fs.writeFileSync(archivo, texto); fs.chmodSync(archivo, modo); };
  const corre = (dir = path.join(tmp, 'landing'), a = archivo) => spawnSync(process.execPath, [script, dir, a], { encoding: 'utf8' });
  const termino = () => fs.readFileSync(path.join(tmp, 'landing', 'terminos.html'), 'utf8');
  try {
    pagina();
    datos('# datos de prueba\nVENDEDOR_NOMBRE="Persona de Prueba"\r\nVENDEDOR_ID = C.C. 000\nVENDEDOR_DIRECCION=Calle de Prueba 1 & <b>2</b>\n');
    let r = corre();
    assert.equal(r.status, 0, r.stdout);
    assert.match(termino(), /<dd>Persona de Prueba<\/dd>.*<dd>C\.C\. 000<\/dd>.*<dd>Calle de Prueba 1 &amp; &lt;b&gt;2&lt;\/b&gt;<\/dd>/s);
    assert.doesNotMatch(termino(), /\{\{VENDEDOR_/);
    assert.match(r.stdout, /Datos de quien vende puestos en: terminos\.html/);
    assert.doesNotMatch(r.stdout + r.stderr, /Persona de Prueba|C\.C\. 000|Calle de Prueba/);
    assert.equal(fs.readFileSync(path.join(tmp, 'landing', 'es', 'index.html'), 'utf8'), '<p>Hola</p>');
    // sin marcadores no hace falta el archivo
    assert.equal(corre(path.join(tmp, 'landing'), path.join(tmp, 'no-existe')).status, 0);
    assert.equal(corre(path.join(tmp, 'otra-carpeta'), path.join(tmp, 'no-existe')).status, 0);
    // mal: no hay archivo, lo pueden leer otros, falta un dato, uno vacío, una línea rara, uno repetido o con un marcador
    // sale con 1 y la página queda como estaba
    const malos = [
      [() => fs.rmSync(archivo, { force: true }), /no está/],
      [() => datos('VENDEDOR_NOMBRE=A\nVENDEDOR_ID=B\nVENDEDOR_DIRECCION=C\n', 0o644), /600/],
      [() => datos('VENDEDOR_NOMBRE=A\nVENDEDOR_ID=B\n'), /le falta VENDEDOR_DIRECCION/],
      [() => datos('VENDEDOR_NOMBRE=A\nVENDEDOR_ID=\nVENDEDOR_DIRECCION=C\n'), /le falta VENDEDOR_ID/],
      [() => datos('VENDEDOR_NOMBRE=A\nVENDEDOR_ID=B\nVENDEDOR_DIRECCION=C\nOTRA=D\n'), /línea 4/],
      [() => datos('VENDEDOR_NOMBRE=A\nVENDEDOR_NOMBRE=B\nVENDEDOR_ID=B\nVENDEDOR_DIRECCION=C\n'), /dos veces/],
      [() => datos('VENDEDOR_NOMBRE=[FALTA DATO: nombre]\nVENDEDOR_ID=B\nVENDEDOR_DIRECCION=C\n'), /algo raro/],
    ];
    for (const [prepara, dice] of malos) {
      pagina();
      prepara();
      r = corre();
      assert.equal(r.status, 1, String(dice));
      assert.match(r.stdout, dice);
      assert.equal(termino(), PAGINA);
    }
    pagina();
    fs.writeFileSync(path.join(tmp, 'landing', 'terminos.html'), `${PAGINA}<dd>{{VENDEDOR_CORREO}}</dd>`);
    datos('VENDEDOR_NOMBRE=A\nVENDEDOR_ID=B\nVENDEDOR_DIRECCION=C\n');
    r = corre();
    assert.equal(r.status, 1);
    assert.match(r.stdout, /VENDEDOR_CORREO/);
    assert.match(termino(), /\{\{VENDEDOR_NOMBRE\}\}/);
    assert.equal(spawnSync(process.execPath, [script], { encoding: 'utf8' }).status, 2);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('sin-falta-dato.sh: un [FALTA DATO] o un marcador de quien vende frena; publicar-web.sh y actualizar.sh lo llaman antes de tocar nada', () => {
  const guardia = path.join(RAIZ, 'deploy', 'sin-falta-dato.sh');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'falta-dato-'));
  try {
    fs.mkdirSync(path.join(tmp, 'limpia', 'blog'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'limpia', 'blog', 'index.html'), '<p>Hola</p>');
    fs.mkdirSync(path.join(tmp, 'sucia'));
    fs.writeFileSync(path.join(tmp, 'sucia', 'terminos.html'), '<dd>[FALTA DATO: cédula]</dd>');
    const corre = (...dirs) => spawnSync('bash', [guardia, ...dirs], { encoding: 'utf8' });
    assert.equal(corre(path.join(tmp, 'limpia')).status, 0);
    assert.equal(corre(path.join(tmp, 'no-existe')).status, 0);
    const sucia = corre(path.join(tmp, 'limpia'), path.join(tmp, 'sucia'));
    assert.equal(sucia.status, 1);
    assert.match(sucia.stdout, /sucia[\\/]terminos\.html/);
    assert.equal(corre().status, 2);
    // un dato de quien vende sin poner también frena
    fs.mkdirSync(path.join(tmp, 'sin-vendedor'));
    fs.writeFileSync(path.join(tmp, 'sin-vendedor', 'terminos.html'), '<dd>{{VENDEDOR_NOMBRE}}</dd>');
    const sinVendedor = corre(path.join(tmp, 'limpia'), path.join(tmp, 'sin-vendedor'));
    assert.equal(sinVendedor.status, 1);
    assert.match(sinVendedor.stdout, /sin-vendedor[\\/]terminos\.html/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  const web = fs.readFileSync(path.join(RAIZ, 'deploy', 'publicar-web.sh'), 'utf8');
  const g1 = web.indexOf('bash "$(dirname "$0")/sin-falta-dato.sh" "$TMP/landing" || {');
  assert.ok(g1 > web.indexOf('tar -xf "$TAR" -C "$TMP" landing docs/blog') && g1 < web.indexOf('cp -r'), 'publicar-web.sh: el freno va antes de copiar');
  const l1 = web.indexOf('node "$(dirname "$0")/llenar-vendedor.js" "$TMP/landing" || {');
  assert.ok(l1 > web.indexOf('tar -xf "$TAR" -C "$TMP" landing docs/blog') && l1 < g1, 'publicar-web.sh: los datos de quien vende se ponen antes del freno');
  const act = fs.readFileSync(path.join(RAIZ, 'deploy', 'actualizar.sh'), 'utf8');
  const g2 = act.indexOf('bash "$(dirname "$0")/sin-falta-dato.sh" "$REVISA/landing" || {');
  assert.ok(g2 > 0 && g2 < act.indexOf('respaldo.sh') && g2 < act.indexOf('tar -xf "$TAR" -C "$DEST"'), 'actualizar.sh: el freno va antes de todo');
  const l2 = act.indexOf('node "$(dirname "$0")/llenar-vendedor.js" "$REVISA/landing" || {');
  assert.ok(l2 > act.indexOf('tar -xf "$TAR" -C "$REVISA" landing') && l2 < g2, 'actualizar.sh: los datos de quien vende se ponen antes del freno');
  const pone = act.indexOf('rm -rf "$DEST/landing" && cp -r "$REVISA/landing" "$DEST/landing"');
  assert.ok(pone > act.indexOf('tar -xf "$TAR" -C "$DEST"') && pone < act.indexOf('cp -r "$DEST/landing" /var/www/novaworkorder'), 'actualizar.sh: publica la copia revisada');
  assert.match(act, /trap 'rm -rf "\$REVISA"' EXIT/);
});
