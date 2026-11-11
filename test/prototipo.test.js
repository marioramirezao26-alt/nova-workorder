// Prototipo NOVA Premium Futurista (prototipo-nova/): que quede aislado y que no cambie nada de lo que ya funciona.
// 1) El backend no sirve la carpeta (ni con la interfaz compilada ni sin ella) y sus rutas siguen iguales.
// 2) La página actual (landing/) conserva sus accesos y no enlaza el prototipo.
// 3) El prototipo no hace llamadas de red, no tiene formularios con action ni scripts de afuera.
// 4) La lógica del prototipo corre (con un DOM mínimo de mentira): filtros, carrito y pedidos simulados, y Gaby demo.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');

const RAIZ = path.join(__dirname, '..');
const PROTO = path.join(RAIZ, 'prototipo-nova');
const leer = (...p) => fs.readFileSync(path.join(RAIZ, ...p), 'utf8');
const archivos = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
  const p = path.join(dir, d.name);
  return d.isDirectory() ? archivos(p) : [p];
});
const PAGINAS = ['index.html', 'tienda.html', 'categorias.html', 'ofertas.html', 'gaby.html', 'pedidos.html', 'workorder.html', 'producto.html', 'carrito.html'];
const FRANJA = 'Prototipo de demostración · productos, precios y fotos ilustrativos · no es una tienda real';

// ---------- 1. backend ----------

// Igual que en producción: con frontend/dist, el backend sirve la interfaz y manda toda ruta que no es /api a su index.
const dist = path.join(RAIZ, 'frontend', 'dist');
const creada = !fs.existsSync(path.join(dist, 'index.html'));
if (creada) {
  fs.mkdirSync(dist, { recursive: true });
  fs.writeFileSync(path.join(dist, 'index.html'), '<!doctype html><title>NOVA</title><div id="root"></div>');
}
process.env.JWT_SECRET = process.env.JWT_SECRET || 'prueba-secreto-solo-para-tests-0123456789abcdef';
process.env.NODE_ENV = 'test';
const app = require('../src/app');

const RUTAS_PROTO = ['/prototipo-nova/', '/prototipo-nova/index.html', '/prototipo-nova/assets/app.js', '/prototipo-nova/assets/datos.js',
  '/prototipo-nova/docs/AUDITORIA.md', '/index.html', '/tienda.html', '/assets/datos.js', '/assets/gaby.js'];
const noEsPrototipo = (texto) => !texto.includes('Prototipo de demostración') && !texto.includes('NOVA_DEMO') && !texto.includes('Gaby Spark (demo)');

test('el backend no sirve prototipo-nova/ (con la interfaz compilada, como en producción)', async (t) => {
  const server = app.listen(0);
  t.after(() => { server.close(); if (creada) fs.rmSync(dist, { recursive: true, force: true }); });
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const ruta of RUTAS_PROTO) {
    const res = await fetch(base + ruta);
    const texto = await res.text();
    assert.ok(noEsPrototipo(texto), `${ruta} no debe devolver el prototipo`);
  }
});

test('el backend no sirve prototipo-nova/ (sin la interfaz compilada)', () => {
  // Proceso aparte: app.js decide al cargarse si sirve frontend/dist; aquí lo engañamos con una carpeta que no existe.
  const guion = `
    process.env.JWT_SECRET = 'x'.repeat(40); process.env.NODE_ENV = 'test';
    const fs = require('fs'); const real = fs.existsSync;
    fs.existsSync = (p) => (String(p).includes('frontend') ? false : real(p));
    const app = require(${JSON.stringify(path.join(RAIZ, 'src', 'app.js'))});
    const s = app.listen(0, async () => {
      const base = 'http://127.0.0.1:' + s.address().port;
      const out = [];
      for (const r of ${JSON.stringify(RUTAS_PROTO)}) { const res = await fetch(base + r); out.push([r, res.status, await res.text()]); }
      console.log(JSON.stringify(out)); s.close(); process.exit(0);
    });`;
  const r = spawnSync(process.execPath, ['-e', guion], { encoding: 'utf8', timeout: 30000 });
  assert.equal(r.status, 0, r.stderr);
  for (const [ruta, estado, texto] of JSON.parse(r.stdout.trim().split('\n').pop())) {
    assert.equal(estado, 404, ruta);
    assert.ok(noEsPrototipo(texto), ruta);
  }
});

test('las rutas del backend siguen iguales y lo único estático es frontend/dist', () => {
  const codigo = leer('src', 'app.js');
  const montadas = [...codigo.matchAll(/app\.use\('([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(montadas, ['/api/company/branding', '/api/auth', '/api/workorders', '/api/clients', '/api/dashboard', '/api/users',
    '/api/platform', '/api/public', '/api/company', '/api/audit', '/api/reports', '/api/integrations', '/api/checklists', '/api/quotes',
    '/api/wompi', '/api/cotizaciones', '/api/informes', '/api/v1']);
  const estaticos = [...codigo.matchAll(/express\.static\(([^,)]+)/g)].map((m) => m[1].trim());
  assert.deepEqual(estaticos, ['dist']);
  assert.match(codigo, /path\.join\(__dirname, '\.\.', 'frontend', 'dist'\)/);
});

test('nada del código, del despliegue ni de la página nombra el prototipo', () => {
  for (const dir of ['src', 'deploy', 'landing', path.join('frontend', 'src')]) {
    for (const f of archivos(path.join(RAIZ, dir))) {
      if (!/\.(js|jsx|html|css|sh|ps1|md|txt|xml|json|caddy)$|Caddyfile$/.test(f)) continue;
      assert.doesNotMatch(fs.readFileSync(f, 'utf8'), /prototipo-nova/, path.relative(RAIZ, f));
    }
  }
});

test('Caddy y los guiones de publicación solo llevan landing/ a novaworkorder.com', () => {
  const caddy = leer('deploy', 'Caddyfile');
  assert.deepEqual([...caddy.matchAll(/root \* (\S+)/g)].map((m) => m[1]), ['/var/www/novaworkorder', '/var/www/novaworkorder']);
  assert.match(leer('deploy', 'publicar-web.sh'), /tar -xf "\$TAR" -C "\$TMP" landing docs\/blog/);
  assert.match(leer('deploy', 'actualizar.sh'), /cp -r "\$DEST\/landing" \/var\/www\/novaworkorder/);
});

test('el paquete de despliegue (git archive) deja por fuera prototipo-nova/', () => {
  const r = spawnSync('git', ['check-attr', 'export-ignore', '--', 'prototipo-nova/index.html', 'prototipo-nova/assets/app.js', 'landing/index.html'],
    { cwd: RAIZ, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /prototipo-nova\/index\.html: export-ignore: set/);
  assert.match(r.stdout, /prototipo-nova\/assets\/app\.js: export-ignore: set/);
  assert.match(r.stdout, /landing\/index\.html: export-ignore: unspecified/);
});

// ---------- 2. la página actual ----------

test('la página actual conserva los accesos a Servicios y Pedidos y el «Empieza gratis»', () => {
  const html = leer('landing', 'index.html');
  assert.match(html, /<a href="https:\/\/app\.novaworkorder\.com\/">/);
  assert.match(html, /<a href="https:\/\/pedidos\.novaworkorder\.com\/admin">/);
  assert.match(html, /id="top-cta" href="#demo"[^>]*>Empieza gratis</);
  assert.match(html, /<form class="card" id="demo-form" novalidate>/);
  assert.match(html, /fetch\('\/api\/public\/demo'/);
  assert.match(html, /fetch\('\/api\/public\/chat'/);
});

// ---------- 3. el prototipo, archivo por archivo ----------

test('el prototipo tiene todas sus páginas, cada una con la franja de demostración y el menú completo', () => {
  for (const p of PAGINAS) {
    const html = fs.readFileSync(path.join(PROTO, p), 'utf8');
    assert.ok(html.includes(FRANJA), `${p}: falta la franja`);
    assert.match(html, /<html lang="es-CO">/, p);
    assert.match(html, /<meta name="robots" content="noindex, nofollow">/, p);
    for (const [href, nombre] of [['index.html', 'Inicio'], ['tienda.html', 'Tienda'], ['categorias.html', 'Categorías'], ['ofertas.html', 'Ofertas'],
      ['gaby.html', 'Gaby Spark'], ['pedidos.html', 'Mis pedidos'], ['workorder.html', 'WORKORDER']]) {
      assert.match(html, new RegExp(`<a href="${href}"[^>]*>${nombre}</a>`), `${p}: falta ${nombre} en el menú`);
    }
    assert.match(html, /class="saltar" href="#contenido"/, p);
  }
  assert.match(fs.readFileSync(path.join(PROTO, 'index.html'), 'utf8'), /Descubre una nueva forma de <span>comprar<\/span>/);
});

test('el prototipo no hace llamadas de red, no tiene formularios ni scripts o estilos de afuera', () => {
  const CSP = /<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'none';[^"]*form-action 'none'/;
  for (const f of archivos(PROTO)) {
    const rel = path.relative(PROTO, f);
    if (rel.startsWith('docs') || rel.startsWith('scripts')) continue;      // documentos y la herramienta de capturas
    const texto = fs.readFileSync(f, 'utf8');
    for (const malo of [/\bfetch\s*\(/, /XMLHttpRequest/, /sendBeacon/, /WebSocket/, /EventSource/, /serviceWorker/, /\bimport\s*\(/, /@import/,
      /<form\b/i, /\baction\s*=/i, /method\s*=\s*["']?post/i, /<iframe/i, /url\(\s*['"]?https?:/i, /<script[^>]+src\s*=\s*["']?(https?:)?\/\//i,
      /<link[^>]+href\s*=\s*["']?(https?:)?\/\//i, /<img[^>]+src\s*=\s*["']?(https?:)?\/\//i, /fonts\.googleapis|cdn\.|unpkg|jsdelivr/i,
      /\beval\s*\(/, /new Function/, /wa\.me|api\.whatsapp/i]) {
      assert.doesNotMatch(texto, malo, `${rel}: ${malo}`);
    }
    if (rel.endsWith('.html')) {
      assert.match(texto, CSP, `${rel}: falta la política que bloquea la red`);
      assert.doesNotMatch(texto, /<script(?![^>]*\bsrc=)[^>]*>/, `${rel}: no lleva scripts en línea`);
      assert.doesNotMatch(texto, /\sstyle=/, `${rel}: no lleva estilos en línea`);
      // los únicos enlaces de afuera son los accesos reales de WORKORDER y la página actual
      const externos = [...texto.matchAll(/href="(https?:[^"]+)"/g)].map((m) => m[1]);
      for (const e of externos) assert.ok(['https://app.novaworkorder.com/', 'https://pedidos.novaworkorder.com/admin', 'https://novaworkorder.com/'].includes(e), `${rel}: ${e}`);
    }
  }
});

test('el acceso WORKORDER lleva a los mismos inicios de sesión que la página actual', () => {
  const html = fs.readFileSync(path.join(PROTO, 'workorder.html'), 'utf8');
  const landing = leer('landing', 'index.html');
  for (const url of ['https://app.novaworkorder.com/', 'https://pedidos.novaworkorder.com/admin']) {
    assert.ok(html.includes(`href="${url}"`), url);
    assert.ok(landing.includes(`href="${url}"`), `${url} debe existir hoy en la página actual`);
  }
  assert.doesNotMatch(html, /type="password"/);
});

test('datos de prueba inequívocos: sin el 310, sin fotos y con avisos de demostración', () => {
  for (const f of archivos(PROTO)) {
    const rel = path.relative(PROTO, f);
    if (/\.(png|jpe?g|webp|gif|avif)$/i.test(f)) {
      assert.ok(rel.startsWith(path.join('docs', 'capturas')), `${rel}: el prototipo no usa fotos (solo dibujos SVG)`);
      continue;
    }
    const texto = fs.readFileSync(f, 'utf8');
    assert.doesNotMatch(texto, /(\+?57[\s-]?)?\b310[\s-]?\d{3}[\s-]?\d{4}\b/, `${rel}: el número retirado 310`);
    for (const m of texto.matchAll(/\b3\d{2}[\s-]?\d{3}[\s-]?\d{4}\b/g)) assert.equal(m[0].replace(/\D/g, ''), '3213927697', `${rel}: ${m[0]}`);
  }
  const app = fs.readFileSync(path.join(PROTO, 'assets', 'app.js'), 'utf8');
  assert.match(app, /Precio ilustrativo/);
  assert.match(app, /marca ficticia/);
  for (const p of PAGINAS) {
    const html = fs.readFileSync(path.join(PROTO, p), 'utf8');
    for (const m of html.matchAll(/24\/7/g)) {
      assert.match(html.slice(Math.max(0, m.index - 40), m.index), /no se promete atención $/, `${p}: «24/7» solo puede salir negado`);
    }
  }
});

// ---------- 4. la lógica, con un DOM mínimo ----------

// Un DOM de mentira con lo justo que usan los scripts del prototipo.
function navegador(pagina, { search = '', almacen = {} } = {}) {
  const ids = {};
  const oyentes = {};
  const elemento = (id) => {
    const el = {
      id, innerHTML: '', textContent: '', value: '', checked: false, disabled: false, max: '', className: '', hijos: [], scrollTop: 0, scrollHeight: 0,
      atributos: {}, oyentes: {},
      classList: { lista: new Set(), add(c) { this.lista.add(c); }, remove(c) { this.lista.delete(c); }, contains(c) { return this.lista.has(c); },
        toggle(c) { if (this.lista.has(c)) { this.lista.delete(c); return false; } this.lista.add(c); return true; } },
      setAttribute(k, v) { this.atributos[k] = String(v); }, getAttribute(k) { return this.atributos[k] ?? null; },
      addEventListener(tipo, fn) { (this.oyentes[tipo] ||= []).push(fn); },
      querySelectorAll() { return []; }, focus() {}, closest() { return null; },
      appendChild(h) { this.hijos.push(h); return h; },
    };
    return el;
  };
  const $id = (id) => (ids[id] ||= elemento(id));
  const document = {
    title: '',
    body: { getAttribute: (k) => (k === 'data-pagina' ? pagina : null) },
    querySelector: (sel) => (sel.startsWith('#') ? $id(sel.slice(1)) : null),
    getElementById: $id,
    createElement: () => elemento(null),
    createTextNode: (t) => ({ textContent: t }),
    addEventListener: (tipo, fn) => { (oyentes[tipo] ||= []).push(fn); },
  };
  const localStorage = { getItem: (k) => (k in almacen ? almacen[k] : null), setItem: (k, v) => { almacen[k] = String(v); } };
  const ctx = { document, localStorage, location: { search }, Intl, URLSearchParams, JSON, Math, Date, String, Number, Array, setTimeout: (fn) => fn(), clearTimeout() {},
    matchMedia: () => ({ matches: true }) };
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const s of ['datos.js', 'ilustraciones.js', 'app.js', 'gaby.js']) {
    vm.runInContext(fs.readFileSync(path.join(PROTO, 'assets', s), 'utf8'), ctx, { filename: s });
  }
  (oyentes.DOMContentLoaded || []).forEach((fn) => fn());
  const clic = (atributo, valor) => (oyentes.click || []).forEach((fn) => fn({ target: { closest: (sel) => (sel === `[${atributo}]` ? { getAttribute: () => valor } : null) } }));
  return { $: $id, almacen, ctx, clic, oyentes };
}
const cuantos = (html, re) => (html.match(re) || []).length;

test('la tienda pinta el catálogo multimarca y multicategoría, y filtra por categoría desde la dirección', () => {
  const todos = navegador('tienda');
  const n = cuantos(todos.$('tienda-resultados').innerHTML, /<article class="producto">/g);
  assert.equal(n, todos.ctx.NOVA_DEMO.PRODUCTOS.length);
  assert.ok(new Set(todos.ctx.NOVA_DEMO.PRODUCTOS.map((p) => p.marca)).size >= 5);
  assert.ok(new Set(todos.ctx.NOVA_DEMO.PRODUCTOS.map((p) => p.categoria)).size >= 5);
  assert.match(todos.$('tienda-cuenta').textContent, /productos de demostración/);
  const hogar = navegador('tienda', { search: '?categoria=hogar' });
  const esperados = hogar.ctx.NOVA_DEMO.PRODUCTOS.filter((p) => p.categoria === 'hogar').length;
  assert.equal(cuantos(hogar.$('tienda-resultados').innerHTML, /<article class="producto">/g), esperados);
  const ofertas = navegador('ofertas');
  assert.equal(cuantos(ofertas.$('ofertas-lista').innerHTML, /<article/g), ofertas.ctx.NOVA_DEMO.PRODUCTOS.filter((p) => p.precioAntes).length);
  assert.match(ofertas.$('ofertas-lista').innerHTML, /% ilustrativo/);
});

test('carrito simulado: agrega, simula la compra y el pedido queda solo en el navegador como «Simulado»', () => {
  const almacen = {};
  const tienda = navegador('tienda', { almacen });
  tienda.clic('data-agregar', 'p01');
  tienda.clic('data-agregar', 'p01');
  assert.deepEqual(JSON.parse(almacen['nova-demo-carrito']), [{ id: 'p01', cantidad: 2 }]);
  assert.equal(tienda.$('carrito-cuenta').textContent, 2);

  const carrito = navegador('carrito', { almacen });
  assert.match(carrito.$('carrito-lista').innerHTML, /Audífonos inalámbricos Pulse/);
  assert.equal(carrito.$('carrito-simular').disabled, false);
  carrito.$('carrito-simular').oyentes.click[0]();
  assert.deepEqual(JSON.parse(almacen['nova-demo-carrito']), []);
  const pedidos = JSON.parse(almacen['nova-demo-pedidos']);
  assert.equal(pedidos[0].numero, 'DEMO-0001');
  assert.match(carrito.$('carrito-resultado').innerHTML, /simulado.*No se cobró nada/);

  const mis = navegador('pedidos', { almacen });
  assert.match(mis.$('pedidos-lista').innerHTML, /DEMO-0001/);
  assert.match(mis.$('pedidos-lista').innerHTML, /Simulado/);
});

test('un almacenamiento dañado o manipulado no rompe el carrito ni mete HTML', () => {
  const almacen = { 'nova-demo-carrito': '[{"id":"p02","cantidad":"<img src=x onerror=alert(1)>"},{"id":"nada","cantidad":3}]',
    'nova-demo-pedidos': '{"no":"es una lista"}' };
  const carrito = navegador('carrito', { almacen });
  assert.match(carrito.$('carrito-lista').innerHTML, /Reloj inteligente Orbit/);
  assert.doesNotMatch(carrito.$('carrito-lista').innerHTML, /onerror/);
  const mis = navegador('pedidos', { almacen: { 'nova-demo-pedidos': '[{"numero":"<b>x</b>","lineas":[{"id":"p01","cantidad":"<i>"}],"total":"no"}]' } });
  assert.doesNotMatch(mis.$('pedidos-lista').innerHTML, /<b>x<\/b>|<i>/);
});

test('Gaby demo contesta con frases fijas, admite que es IA y no promete envíos ni pagos', () => {
  const g = navegador('gaby');
  const preguntar = (texto) => {
    g.$('gaby-entrada').value = texto;
    g.$('gaby-enviar').oyentes.click[0]();
    const burbujas = g.$('gaby-registro').hijos;
    return burbujas[burbujas.length - 1].hijos.map((h) => h.textContent).join(' ');
  };
  assert.match(preguntar('¿Eres una IA?'), /inteligencia artificial/);
  assert.match(preguntar('¿Cómo funcionan los envíos?'), /no están definidas/);
  assert.match(preguntar('¿Cómo pago?'), /no hay pagos/);
  assert.match(preguntar('Busco una botella'), /escritas a mano|catálogo de demostración/);
  assert.doesNotMatch(preguntar('Busco una botella'), /inteligencia artificial/);       // «botella» no es «bot»
  assert.match(preguntar('Algo de deportes'), /Deportes/);
  assert.equal(g.$('gaby-sugerencias').hijos.length, 5);
});

// Gaby Spark (mascota aprobada por Mario el 11-nov-2026; nova-cerebro PR #15): reemplaza a la figura humana del prototipo.
test('Gaby Spark: componente propio, cinco estados, sin fotos y sin estilos en línea', () => {
  const js = fs.readFileSync(path.join(PROTO, 'assets', 'gaby-spark.js'), 'utf8');
  for (const e of ['feliz', 'escuchando', 'pensando', 'hablando', 'sorprendida']) {
    assert.match(js, new RegExp(`class="cara ${e}"`), `falta la cara «${e}»`);
    assert.match(js, new RegExp(`\\[estado=${e}\\]`), `falta el estado «${e}» en los estilos`);
  }
  assert.match(js, /customElements\.define\('gaby-spark'/);
  assert.match(js, /prefers-reduced-motion:no-preference/, 'las animaciones solo corren si no se pidió reducir el movimiento');
  assert.match(js, /adoptedStyleSheets/, 'los estilos entran por hoja construida: la política de la página prohíbe los estilos en línea');
  assert.match(js, /asistente de inteligencia artificial/, 'se anuncia como inteligencia artificial');
  for (const p of ['index.html', 'gaby.html']) {
    const html = fs.readFileSync(path.join(PROTO, p), 'utf8');
    assert.match(html, /<gaby-spark [^>]*id="gaby-figura"[^>]*estado="feliz"/, `${p}: la figura es Gaby Spark`);
    assert.match(html, /<script src="assets\/gaby-spark\.js"><\/script>/, `${p}: carga el componente`);
    assert.doesNotMatch(html, /data-ilus="gaby"/, `${p}: ya no se pinta la figura humana`);
    assert.doesNotMatch(html, /<gaby-spark[^>]*\bpiel=/, `${p}: el prototipo no usa la piel 3D (es una foto) hasta que Mario lo autorice`);
  }
});

test('Gaby Spark cambia de estado con la conversación de muestra y vuelve a «feliz»', () => {
  const g = navegador('gaby');
  const figura = g.$('gaby-figura');
  const vistos = [];
  const poner = figura.setAttribute.bind(figura);
  figura.setAttribute = (k, v) => { if (k === 'estado') vistos.push(v); poner(k, v); };
  g.$('gaby-entrada').value = 'hola';
  g.$('gaby-entrada').oyentes.input[0]();
  g.$('gaby-enviar').oyentes.click[0]();
  assert.deepEqual(vistos, ['escuchando', 'pensando', 'hablando', 'feliz']);
  assert.equal(g.$('gaby-avatar').getAttribute('estado'), 'feliz');
});
