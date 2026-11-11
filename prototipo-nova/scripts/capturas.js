// Capturas del prototipo en escritorio (1440 × 900) y celular (390 × 844), y revisión de que no sale nada a la red.
// Necesita Playwright con Chromium (no viene en el proyecto a propósito: el prototipo no tiene dependencias).
//   1) python3 -m http.server 8765 --bind 127.0.0.1 --directory prototipo-nova
//   2) node prototipo-nova/scripts/capturas.js http://127.0.0.1:8765
// Guarda los PNG en prototipo-nova/docs/capturas/ y falla si alguna página pide algo fuera de 127.0.0.1,
// si hay errores de JavaScript o si la consola muestra un bloqueo de la política de seguridad.
const path = require('path');
const { chromium } = require('playwright');

const BASE = (process.argv[2] || 'http://127.0.0.1:8765').replace(/\/$/, '');
const SALIDA = path.join(__dirname, '..', 'docs', 'capturas');
const PAGINAS = [
  ['inicio', 'index.html'], ['tienda', 'tienda.html'], ['categorias', 'categorias.html'], ['ofertas', 'ofertas.html'],
  ['gaby', 'gaby.html?producto=p08'], ['pedidos', 'pedidos.html'], ['workorder', 'workorder.html'],
  ['producto', 'producto.html?id=p01'], ['carrito', 'carrito.html'],
];
const TAMANOS = [['escritorio', { width: 1440, height: 900 }], ['movil', { width: 390, height: 844 }]];

(async () => {
  const navegador = await chromium.launch();
  const problemas = [];
  try {
    for (const [nombreTam, viewport] of TAMANOS) {
      const contexto = await navegador.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: 'reduce', locale: 'es-CO' });
      const hoja = await contexto.newPage();
      hoja.on('request', (r) => {
        const u = new URL(r.url());
        if (!['127.0.0.1', 'localhost'].includes(u.hostname) && u.protocol !== 'data:') problemas.push(`red: ${r.url()}`);
      });
      hoja.on('pageerror', (e) => problemas.push(`js: ${e.message}`));
      hoja.on('console', (m) => { if (m.type() === 'error') problemas.push(`consola: ${m.text()}`); });
      // carrito y pedido simulados para que esas páginas no salgan vacías
      await hoja.goto(`${BASE}/tienda.html`);
      await hoja.click('[data-agregar="p01"]');
      await hoja.click('[data-agregar="p12"]');
      await hoja.goto(`${BASE}/carrito.html`);
      await hoja.click('#carrito-simular');
      await hoja.goto(`${BASE}/tienda.html`);
      await hoja.click('[data-agregar="p08"]');
      await hoja.click('[data-agregar="p05"]');
      for (const [nombre, ruta] of PAGINAS) {
        await hoja.goto(`${BASE}/${ruta}`, { waitUntil: 'load' });
        if (nombre === 'gaby') {
          await hoja.fill('#gaby-entrada', '¿Cómo funcionan los envíos?');
          await hoja.press('#gaby-entrada', 'Enter');
          await hoja.click('#gaby-sugerencias button:nth-child(4)');
        }
        await hoja.screenshot({ path: path.join(SALIDA, `${nombre}-${nombreTam}.png`) });
        console.log(`ok ${nombre}-${nombreTam}.png`);
      }
      if (nombreTam === 'movil') {
        await hoja.goto(`${BASE}/index.html`);
        await hoja.click('#menu-boton');
        await hoja.screenshot({ path: path.join(SALIDA, 'menu-movil.png') });
        console.log('ok menu-movil.png');
      }
      await contexto.close();
    }
  } finally {
    await navegador.close();
  }
  if (problemas.length) {
    console.error('Problemas:\n' + problemas.join('\n'));
    process.exit(1);
  }
  console.log('Sin llamadas fuera de 127.0.0.1 y sin errores de JavaScript.');
})();
