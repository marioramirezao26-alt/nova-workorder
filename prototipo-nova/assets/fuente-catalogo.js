/* Fuente de catálogo: el ÚNICO lugar por donde entran productos, precios y disponibilidad a la página.
   Ninguna otra pieza del prototipo conoce un producto ni un precio: todas le preguntan a esta.

   Tiene la forma de la lectura de canal del contrato commerce v1 de comerce-ai:
     - search(pedido)        → catalog.search  (GET /v1/catalog/search),          pedido: { q, channel, category?, limit? }
     - item(offerId, pedido) → catalog.item    (GET /v1/catalog/items/{offerId}), pedido: { channel }
   y contesta con el mismo sobre (contractVersion, brand, query, match, count, results, servedAt / item), pero solo
   con los campos públicos de cada oferta.

   HOY esa ruta todavía no existe en el servidor de comerce-ai (faltan B10, B11, B12 y C01). Por eso esta fuente lee
   un archivo de DATOS DE EJEMPLO, ficticios (assets/datos/catalogo-ejemplo.js, generado con
   scripts/generar-catalogo.js desde el conjunto de ejemplo del contrato). No hace ninguna llamada de red.

   El día que exista la lectura del canal, lo único que cambia es el cuerpo de search() e item(): pasan a pedirle los
   datos al intermediario de lectura (nunca directo a comerce-ai desde el navegador, y sin llaves en la página).
   Las dos devuelven promesas desde ya, para que el resto de la página no tenga que cambiar.

   La búsqueda de aquí es sencilla (palabras completas o su comienzo, sin tildes ni mayúsculas). La de verdad, con
   sinónimos y errores de escritura, la hace comerce-ai. */
(function () {
  'use strict';

  var CANAL = 'web_store';
  var LIMITES = { maxLetras: 80, porDefecto: 10, maximo: 50 }; // los mismos topes del contrato
  // Palabras que no ayudan a buscar: una consulta que solo trae de estas se toma como «ver todo».
  var VACIAS = ['a', 'al', 'algo', 'catalogo', 'con', 'cual', 'de', 'del', 'el', 'en', 'hay', 'la', 'las', 'lo', 'los', 'me', 'para',
    'por', 'producto', 'productos', 'que', 'quiero', 'se', 'tiene', 'tienen', 'todo', 'todos', 'un', 'una', 'unas', 'unos', 'ver', 'y'];

  function datos() {
    var d = window.NOVA_CATALOGO_EJEMPLO;
    return d && Array.isArray(d.items) ? d : { aviso: 'Datos de ejemplo. No es una oferta', contractVersion: '1.0', servedAt: null, brand: { displayName: '' }, items: [] };
  }

  function normalizar(texto) {
    return String(texto == null ? '' : texto).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ').trim();
  }
  // Igual que en el contrato: minúsculas, sin tildes, y cada grupo de espacios o signos se vuelve un guion.
  function llaveCategoria(texto) { return normalizar(texto).replace(/ /g, '-').slice(0, 100); }
  function singular(palabra) {
    if (palabra.length > 4 && /es$/.test(palabra) && !/[aeiou]es$/.test(palabra)) return palabra.slice(0, -2);
    if (palabra.length > 3 && /s$/.test(palabra)) return palabra.slice(0, -1);
    return palabra;
  }

  function fallo(codigo, ruta, detalle) {
    return { contractVersion: datos().contractVersion, error: { code: codigo, retryable: false, details: [{ path: ruta, issue: detalle }] } };
  }
  function copia(valor) { return JSON.parse(JSON.stringify(valor)); }

  function revisarCanal(pedido) {
    if (!pedido || pedido.channel !== CANAL) throw fallo('VALIDATION_FAILED', '/channel', 'esta página solo lee por el canal web_store');
  }

  function buscar(pedido) {
    revisarCanal(pedido);
    var q = pedido.q;
    if (typeof q !== 'string' || !q.length || q.length > LIMITES.maxLetras) throw fallo('VALIDATION_FAILED', '/q', 'texto de 1 a 80 letras');
    var limite = pedido.limit === undefined ? LIMITES.porDefecto : pedido.limit;
    if (Math.floor(limite) !== limite || limite < 1 || limite > LIMITES.maximo) throw fallo('VALIDATION_FAILED', '/limit', 'entero entre 1 y 50');
    var categoria = null;
    if (pedido.category !== undefined) {
      categoria = llaveCategoria(pedido.category);
      if (!categoria) throw fallo('VALIDATION_FAILED', '/category', 'la categoría quedó vacía');
    }

    var normalizada = normalizar(q);
    var palabras = normalizada.split(' ').filter(function (p) { return p && VACIAS.indexOf(p) === -1; }).map(singular);
    var general = palabras.length === 0;
    var d = datos();
    var hallados = [];
    d.items.forEach(function (oferta) {
      if (categoria !== null && llaveCategoria(oferta.category) !== categoria) return;
      if (general) { hallados.push({ oferta: oferta, puntos: 0, por: ['browse'] }); return; }
      var propias = normalizar(oferta.title + ' ' + oferta.variantName + ' ' + oferta.category).split(' ').map(singular);
      var puntos = 0;
      var exacta = false;
      var todas = palabras.every(function (p) {
        if (propias.indexOf(p) !== -1) { puntos += 10; exacta = true; return true; }
        if (p.length >= 3 && propias.some(function (x) { return x.indexOf(p) === 0; })) { puntos += 5; return true; }
        return false;
      });
      if (todas) hallados.push({ oferta: oferta, puntos: puntos, por: [exacta ? 'exact' : 'prefix'] });
    });
    hallados.sort(function (a, b) {
      return b.puntos - a.puntos || a.oferta.title.localeCompare(b.oferta.title, 'es') ||
        a.oferta.variantName.localeCompare(b.oferta.variantName, 'es') || (a.oferta.offerId < b.oferta.offerId ? -1 : 1);
    });
    var resultados = hallados.slice(0, limite).map(function (h) {
      var vista = copia(h.oferta);
      vista.brand = copia(d.brand);
      vista.score = h.puntos;
      vista.matchedBy = h.por;
      return vista;
    });
    return {
      contractVersion: d.contractVersion,
      brand: copia(d.brand),
      query: { normalized: normalizada || q.slice(0, 80), tokens: palabras.slice(0, 8), generic: general, truncated: palabras.length > 8, categoryKey: categoria },
      match: resultados.length ? 'results' : 'none',
      count: resultados.length,
      results: resultados,
      servedAt: d.servedAt
    };
  }

  function leer(offerId, pedido) {
    revisarCanal(pedido);
    var d = datos();
    var oferta = d.items.filter(function (o) { return o.offerId === offerId; })[0];
    if (!oferta) throw fallo('NOT_FOUND', '/offerId', 'no encontrado');
    var vista = copia(oferta);
    vista.brand = copia(d.brand);
    return { contractVersion: d.contractVersion, servedAt: d.servedAt, item: vista };
  }

  function promesa(fn) {
    return function () {
      var argumentos = arguments;
      return new Promise(function (resolver) { resolver(fn.apply(null, argumentos)); });
    };
  }

  window.NOVA_FUENTE_CATALOGO = {
    CANAL: CANAL,
    aviso: datos().aviso,          // «Datos de ejemplo. No es una oferta»
    deEjemplo: true,               // pasa a false el día que lea la lectura del canal de verdad
    search: promesa(buscar),       // catalog.search
    item: promesa(leer),           // catalog.item
    llaveCategoria: llaveCategoria
  };
})();
