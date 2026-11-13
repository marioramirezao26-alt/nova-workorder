// NOVA Store en preparación (13-nov-2026): la página /tienda (landing/tienda/). Tienda pública multiproducto, todavía
// sin catálogo validado: no muestra productos, marcas, categorías, precios ni promociones inventados, no vende, no
// cobra, no promete disponibilidad y no recoge datos. No muestra nada interno de NOVA (agentes, automatización,
// NOVA Enterprise ni Landing Studio). Gaby admite que es una IA.
const { test } = require('node:test');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const DIR = path.join(__dirname, '..', 'landing', 'tienda');
const html = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(DIR, 'tienda.js'), 'utf8');
const css = fs.readFileSync(path.join(DIR, 'tienda.css'), 'utf8');
const texto = (html.replace(/<[^>]+>/g, ' ') + ' ' + js).replace(/\s+/g, ' ');

test('la tienda es pública, en español de Colombia, para celular y sin nada de afuera', () => {
  assert.match(html, /<html lang="es-CO">/);
  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1/);
  assert.match(html, /<link rel="canonical" href="https:\/\/novaworkorder\.com\/tienda" \/>/);
  assert.match(html, /<h1 id="titulo">/);
  for (const [etiqueta, src] of html.matchAll(/<(?:script|link|img)[^>]+(?:src|href)="([^"]+)"/g)) {
    if (/rel="canonical"/.test(etiqueta)) continue; // la dirección de la página, no un recurso que se descarga
    assert.ok(src.startsWith('/'), src);
  }
  for (const archivo of ['index.html', 'tienda.css', 'tienda.js', 'fuente-catalogo.js', 'gaby-spark.js', 'fondo-montanas.svg']) assert.ok(fs.existsSync(path.join(DIR, archivo)), archivo);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /@media \(min-width: 900px\)/);
  // Caddy la sirve sin cambiar nada: try_files {path}/index.html.
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'deploy', 'Caddyfile'), 'utf8'), /try_files \{path\} \{path\}\.html \{path\}\/index\.html/);
});

test('no inventa catálogo: ni productos, ni marcas, ni categorías, ni precios, ni promociones', () => {
  assert.doesNotMatch(html.replace(/<[^>]+>/g, ' '), /\d\s?%/); // porcentajes de descuento (en el JS, el % es de la animación)
  for (const prohibido of [/\$\s?\d/, /\bCOP\b/, /descuento/i, /promoci[oó]n (de|del|especial)/i, /env[ií]o gratis/i, /m[aá]s vendido/i,
    /\[FALTA DATO\]/, /\{\{VENDEDOR_/, /<img/i, /estrellas|reseñas/i]) {
    assert.doesNotMatch(texto, prohibido, String(prohibido));
  }
  // Las categorías, las marcas y los productos son espacios vacíos, a la espera del catálogo autorizado.
  assert.equal((html.match(/class="categoria vacia"/g) || []).length, 6);
  assert.equal((html.match(/class="logo vacio"/g) || []).length, 5);
  assert.equal((html.match(/class="producto vacio"/g) || []).length, 4);
  assert.match(html, /El catálogo se está preparando/);
  assert.match(html, /Todavía no hay productos publicados/);
});

test('no vende, no cobra, no promete disponibilidad y no recoge datos', () => {
  for (const prohibido of [/agregar al carrito|añadir al carrito/i, /comprar ahora/i, /\bpaga(r)? (ahora|aqu[ií]|con)/i, /disponible(s)? (ya|hoy|en stock)/i,
    /\ben stock\b/i, /\bunidades\b/i, /llega (en|hoy|mañana)/i]) {
    assert.doesNotMatch(texto, prohibido, String(prohibido));
  }
  assert.match(html, /no se venden productos ni se reciben pagos/);
  // Ni formularios de datos personales ni llamadas de red: solo el buscador, que no envía nada.
  assert.equal((html.match(/<form/g) || []).length, 1);
  assert.match(html, /<form class="buscador" id="buscador" role="search"/);
  assert.doesNotMatch(html, /type="email"|type="tel"|name="(email|phone|name|company)"/);
  assert.doesNotMatch(js, /fetch\(|XMLHttpRequest|sendBeacon|\/api\/|localStorage|document\.cookie/);
  assert.match(js, /e\.preventDefault\(\)/);
});

test('no muestra nada interno de NOVA: ni agentes, ni automatización, ni NOVA Enterprise, ni Landing Studio', () => {
  for (const prohibido of [/NOVA Enterprise/i, /Landing Studio/i, /organigrama/i, /\bagentes\b/i, /automatizaci[oó]n/i, /\bSupervisor\b/,
    /\b(Max|Leo|Luna|Tom[aá]s|Sofi|Ada)\b/, /GABY-OS/i, /Workorder/i]) {
    assert.doesNotMatch(texto, prohibido, String(prohibido));
  }
});

test('Gaby admite que es una IA y no hace compromisos', () => {
  assert.match(html, /soy una inteligencia artificial/);
  assert.match(js, /persona: 'No, soy una inteligencia artificial\./);
  assert.match(js, /comprar: 'Todavía no\./);
  assert.doesNotMatch(js, /te (lo )?(garantizo|prometo)|24\/7/i);
});

test('NOVA es una tienda propia, no un marketplace: ninguna marca ni tercero se inscribe ni decide qué se muestra', () => {
  for (const prohibido of [/tengo una marca/i, /vende(r)? con nosotros/i, /crea(r)? tu tienda/i, /marketplace/i, /tu propia tienda/i,
    /(cada|su) marca (lo )?(autoriza|decide)/i, /inscrib/i, /llegar las marcas/i]) {
    assert.doesNotMatch(texto, prohibido, String(prohibido));
  }
  assert.match(html, /seleccionados por NOVA/);
  assert.match(html, /Marcas propias y de proveedores seleccionados por NOVA/);
});

test('el catálogo entra solo por la fuente del catálogo, que hoy contesta vacío y nunca carga los datos ficticios', async () => {
  assert.doesNotMatch(html, /catalogo-ejemplo/);
  assert.ok(html.indexOf('/tienda/fuente-catalogo.js') < html.indexOf('/tienda/tienda.js'));
  // La página no pinta nada mientras la fuente sea de ejemplo (doble seguro) y no muestra precio ni disponibilidad.
  assert.match(js, /if \(FUENTE && !FUENTE\.deEjemplo\)/);
  assert.doesNotMatch(js, /\.price\b|\.priceClaim|\.availability|amountMinor/);
  // La fuente, sin datos cargados, no trae nada.
  const ventana = {};
  vm.runInNewContext(fs.readFileSync(path.join(DIR, 'fuente-catalogo.js'), 'utf8'), { window: ventana, Promise, JSON });
  const r = await ventana.NOVA_FUENTE_CATALOGO.search({ q: 'catalogo', channel: 'web_store', limit: 50 });
  assert.deepEqual([r.count, r.results.length, r.match], [0, 0, 'none']);
  assert.equal(ventana.NOVA_FUENTE_CATALOGO.deEjemplo, true);
});
