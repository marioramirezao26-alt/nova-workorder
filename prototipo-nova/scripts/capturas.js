// Capturas del prototipo en escritorio (1440 × 900), celular (390 × 844) y el Inicio a 1628 × 966 (el tamaño del mockup),
// revisión de que no sale nada a la red y de que a 360 px ninguna página se mueve de lado.
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
    // Inicio al tamaño del mockup aprobado (1628 × 966), para ponerlo al lado.
    const grande = await navegador.newContext({ viewport: { width: 1628, height: 966 }, deviceScaleFactor: 1, reducedMotion: 'reduce', locale: 'es-CO' });
    const hojaGrande = await grande.newPage();
    hojaGrande.on('pageerror', (e) => problemas.push(`js: ${e.message}`));
    await hojaGrande.goto(`${BASE}/index.html`, { waitUntil: 'load' });
    await hojaGrande.screenshot({ path: path.join(SALIDA, 'inicio-1628.png') });
    console.log('ok inicio-1628.png');
    await grande.close();
    // A 360 px ninguna página se puede mover de lado (el documento no puede ser más ancho que la pantalla).
    const angosto = await navegador.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 1, reducedMotion: 'reduce', locale: 'es-CO' });
    const hojaAngosta = await angosto.newPage();
    for (const [nombre, ruta] of PAGINAS) {
      await hojaAngosta.goto(`${BASE}/${ruta}`, { waitUntil: 'load' });
      const ancho = await hojaAngosta.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
      if (ancho[0] > ancho[1]) problemas.push(`desborde a 360 px en ${nombre}: ${ancho[0]} > ${ancho[1]}`);
    }
    await angosto.close();
  } finally {
    await navegador.close();
  }
  if (problemas.length) {
    console.error('Problemas:\n' + problemas.join('\n'));
    process.exit(1);
  }
  console.log('Sin llamadas fuera de 127.0.0.1 y sin errores de JavaScript.');
})();
