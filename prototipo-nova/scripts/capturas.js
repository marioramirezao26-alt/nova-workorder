// Capturas del prototipo en escritorio (1440 de ancho) y celular (390), a doble densidad, y revisión de que no sale
// nada a la red, de que no hay errores de JavaScript ni bloqueos de la política de seguridad y de que ninguna página
// se mueve de lado. Necesita Playwright con Chromium (no viene en el proyecto a propósito: el prototipo no tiene
// dependencias).
//   1) python3 -m http.server 8707 --bind 127.0.0.1 --directory prototipo-nova
//   2) node prototipo-nova/scripts/capturas.js http://127.0.0.1:8707 <carpeta de salida>
// Los nombres salen como despues-<página>-<escritorio|celular>.png.
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const BASE = (process.argv[2] || 'http://127.0.0.1:8707').replace(/\/$/, '');
const SALIDA = path.resolve(process.argv[3] || path.join(__dirname, '..', 'docs', 'capturas-m07'));
const TAMANOS = [['escritorio', { width: 1440, height: 900 }], ['celular', { width: 390, height: 844 }]];

(async () => {
  fs.mkdirSync(SALIDA, { recursive: true });
  const navegador = await chromium.launch();
  const problemas = [];
  try {
    for (const [nombreTam, viewport] of TAMANOS) {
      const contexto = await navegador.newContext({ viewport, deviceScaleFactor: 2, reducedMotion: 'reduce', locale: 'es-CO' });
      const hoja = await contexto.newPage();
      hoja.on('request', (r) => {
        const u = new URL(r.url());
        if (!['127.0.0.1', 'localhost'].includes(u.hostname) && u.protocol !== 'data:') problemas.push(`red: ${r.url()}`);
      });
      hoja.on('pageerror', (e) => problemas.push(`js: ${e.message}`));
      hoja.on('console', (m) => { if (m.type() === 'error') problemas.push(`consola: ${m.text()}`); });
      const listo = () => hoja.evaluate(() => window.NOVA_APP.listo());
      const tomar = async (nombre) => {
        const ancho = await hoja.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        if (ancho > 1) problemas.push(`${nombre}-${nombreTam}: la página se mueve de lado ${ancho}px`);
        await hoja.screenshot({ path: path.join(SALIDA, `despues-${nombre}-${nombreTam}.png`), fullPage: true });
        console.log(`ok despues-${nombre}-${nombreTam}.png`);
      };

      await hoja.goto(`${BASE}/index.html`, { waitUntil: 'load' }); await listo();
      await tomar('inicio');

      await hoja.goto(`${BASE}/tienda.html`, { waitUntil: 'load' }); await listo();
      await tomar('tienda');
      // dos productos al carrito simulado, los dos primeros que se dejan agregar
      const botones = hoja.locator('[data-agregar]');
      const primera = await botones.nth(0).getAttribute('data-agregar');
      await botones.nth(0).click();
      await botones.nth(2).click();

      await hoja.goto(`${BASE}/producto.html?oferta=${encodeURIComponent(primera)}`, { waitUntil: 'load' }); await listo();
      await tomar('ficha');

      await hoja.goto(`${BASE}/carrito.html`, { waitUntil: 'load' }); await listo();
      await hoja.click('#carrito-pagar');
      const dicho = await hoja.textContent('#carrito-resultado');
      if (!/Pago en pruebas, apagado/.test(dicho)) problemas.push('carrito: el botón Pagar no dijo «Pago en pruebas, apagado»');
      await tomar('carrito');

      // las demás páginas: se revisan igual (red, errores, desborde) y se guardan aparte
      for (const [nombre, ruta] of [['categorias', 'categorias.html'], ['gaby', 'gaby.html'], ['pedidos', 'pedidos.html'], ['workorder', 'workorder.html']]) {
        await hoja.goto(`${BASE}/${ruta}`, { waitUntil: 'load' });
        await hoja.evaluate(() => (window.NOVA_APP ? window.NOVA_APP.listo() : null));
        await tomar(nombre);
      }
      await contexto.close();
    }
  } finally {
    await navegador.close();
  }
  if (problemas.length) { console.error(problemas.join('\n')); process.exit(1); }
  console.log('Sin llamadas de red, sin errores y sin desbordes.');
})();
