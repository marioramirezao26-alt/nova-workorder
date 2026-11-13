// Prelanzamiento de NOVA Enterprise (13-nov-2026): la página /nova (landing/nova/). Solo informa y registra el interés: sin
// precios, sin pagos, sin pruebas gratis ni cuentas. El registro va al MISMO formulario de la página de ventas
// (/api/public/demo) como solicitud de información (kind «demo»), con la campaña «prelanzamiento-nova».
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { start, stop, reset, call, KEY } = require('./helpers');
const { resetLimits } = require('../src/utils/rateStore');

const DIR = path.join(__dirname, '..', 'landing', 'nova');
const html = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(DIR, 'nova.js'), 'utf8');
const css = fs.readFileSync(path.join(DIR, 'nova.css'), 'utf8');

before(start);
after(stop);
beforeEach(async () => { await reset(); await resetLimits(); });

test('la página de prelanzamiento es pública, en español de Colombia, para celular y sin nada de afuera', () => {
  assert.match(html, /<html lang="es-CO">/);
  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1/);
  assert.match(html, /<link rel="canonical" href="https:\/\/novaworkorder\.com\/nova" \/>/);
  assert.match(html, /<h1 id="titulo">/);
  assert.doesNotMatch(html, /noindex/);
  // Solo recursos propios: ningún script, hoja ni imagen de otro dominio (los enlaces normales sí pueden ir afuera).
  for (const [etiqueta, src] of html.matchAll(/<(?:script|link|img)[^>]+(?:src|href)="([^"]+)"/g)) {
    if (/rel="(?:canonical|alternate)"/.test(etiqueta)) continue; // la dirección de la página, no un recurso que se descarga
    assert.ok(src.startsWith('/'), src);
  }
  for (const archivo of ['index.html', 'nova.css', 'nova.js', 'gaby-spark.js', 'fondo-montanas.svg']) assert.ok(fs.existsSync(path.join(DIR, archivo)), archivo);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /@media \(min-width: 900px\)/);
  // Caddy la sirve sin cambiar nada: try_files {path}/index.html.
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'deploy', 'Caddyfile'), 'utf8'), /try_files \{path\} \{path\}\.html \{path\}\/index\.html/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'landing', 'sitemap.xml'), 'utf8'), /<loc>https:\/\/novaworkorder\.com\/nova<\/loc>/);
});

test('solo informa: sin precios, sin pagos, sin pruebas gratis, sin cuentas y sin datos sin llenar', () => {
  const texto = html.replace(/<[^>]+>/g, ' ');
  for (const prohibido of [/\$\s?\d/, /\bCOP\b/, /precio/i, /pag(a|o|ar)\b/i, /tarjeta de cr/i, /prueba gratis/i, /7 días/i, /crea(r)? (tu|mi) cuenta/i, /comprar ahora/i, /\[FALTA DATO\]/, /\{\{VENDEDOR_/]) {
    assert.doesNotMatch(texto, prohibido, String(prohibido));
  }
  // «Pagos» sí aparece, pero solo para decir que necesitan tu aprobación.
  assert.match(html, /Pagos, devoluciones, mensajes a tus clientes y cambios sensibles necesitan tu aprobación/);
  assert.match(html, /No es una compra ni un compromiso/);
  assert.match(html, /href="\/privacidad"/);
  assert.match(html, /href="\/terminos"/);
});

test('el formulario: los campos que exige el servidor, consentimiento, trampa para robots, y envía como solicitud de información', () => {
  for (const nombre of ['company', 'name', 'email', 'phone', 'message', 'website', 'consent']) assert.match(html, new RegExp(`name="${nombre}"`), nombre);
  assert.match(html, /<label class="trampa" aria-hidden="true">/);
  assert.match(js, /fetch\('\/api\/public\/demo'/);
  assert.match(js, /kind: 'demo'/);
  assert.doesNotMatch(js, /kind: 'prueba'|meta_ok|fbq|NovaMedicion/);
  assert.match(js, /campaign: 'prelanzamiento-nova'/);
  assert.match(js, /if \(!f\.consent\.checked\)/);
});

test('lo que envía la página lo acepta el servidor tal cual: queda como solicitud de información, con su campaña, sin crear cuentas', async () => {
  const comoLaPagina = { kind: 'demo', product: 'servicios', company: 'Taller Inventado SAS', name: 'Ana Prueba', email: 'Ana@Ejemplo.com', phone: '',
    message: '[Prelanzamiento NOVA Enterprise] Interés: Agentes de IA (NOVA Enterprise). Quiero que me ayude con los clientes.', website: '', campaign: 'prelanzamiento-nova', source: 'web' };
  assert.equal((await call('POST', '/public/demo', { body: comoLaPagina })).status, 201);
  assert.equal((await call('POST', '/public/demo', { body: { ...comoLaPagina, product: 'pedidos', email: 'b@ejemplo.com' } })).status, 201);
  assert.equal((await call('POST', '/public/demo', { body: { ...comoLaPagina, email: 'c@ejemplo.com', website: 'http://spam' } })).status, 201); // robot: no se guarda
  const { items } = (await call('GET', '/platform/demo-requests', { platformKey: KEY })).data;
  assert.equal(items.length, 2);
  for (const d of items) {
    assert.deepEqual([d.kind, d.campaign, d.consentAt ?? null], ['demo', 'prelanzamiento-nova', null]);
    assert.match(d.message, /^\[Prelanzamiento NOVA Enterprise\]/);
  }
  assert.deepEqual(items.map((d) => d.product).sort(), ['pedidos', 'servicios']);
});
