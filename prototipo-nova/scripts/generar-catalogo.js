// Genera assets/datos/catalogo-ejemplo.js a partir del conjunto de ejemplo del contrato commerce v1 de comerce-ai.
// Todo lo que sale de aquí es FICTICIO: el conjunto del contrato es inventado y sirve solo para pruebas.
//
//   node prototipo-nova/scripts/generar-catalogo.js <ruta a contracts/commerce-v1 de comerce-ai>
//
// Qué hace:
//   1) Carga examples/dataset--una-instalacion.json y hace la lectura de canal del contrato (catalog.search y
//      catalog.item, canal web_store) con el código de referencia del propio contrato. No abre red ni base de datos.
//   2) Revisa cada respuesta contra el esquema del contrato (api.search-response y api.catalog-item).
//   3) Deja pasar SOLO los campos públicos de la oferta (lista blanca de abajo). Como este repositorio es público,
//      aquí no entra nada interno: ni costos, ni márgenes, ni proveedores, ni cantidades, ni llaves, ni
//      identificadores de instalación, marca, catálogo, producto, variante o precio, ni el SKU.
//   4) La disponibilidad pasa solo como lo que el canal le puede decir al cliente (claim), sin estado ni cantidades.
//   5) El precio pasa solo si está autorizado (priceClaim «authorized»); si no, va vacío y la página dice «por confirmar».
// Si el contrato cambia, se vuelve a correr y se revisa el archivo generado antes de guardarlo.
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const CONTRATO = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (!CONTRATO || !fs.existsSync(path.join(CONTRATO, 'examples', 'dataset--una-instalacion.json'))) {
  console.error('Falta la ruta a contracts/commerce-v1 de comerce-ai (con examples/dataset--una-instalacion.json).');
  process.exit(2);
}
const SALIDA = path.join(__dirname, '..', 'assets', 'datos', 'catalogo-ejemplo.js');
const CANAL = 'web_store';
const LLAVE_DE_PRUEBA = 'key_tienda_web_tienda_uno_prueba'; // nombre de la credencial inventada del conjunto; no es un secreto

const dataset = JSON.parse(fs.readFileSync(path.join(CONTRATO, 'examples', 'dataset--una-instalacion.json'), 'utf8'));
const { searchCatalog } = require(path.join(CONTRATO, 'reference', 'search.js'));
const { getCatalogItem } = require(path.join(CONTRATO, 'reference', 'catalog.js'));
const { validateAgainst } = require(path.join(CONTRATO, 'reference', 'schemas.js'));

function exigirEsquema(nombre, valor) {
  const r = validateAgainst(nombre, valor);
  const fallas = Array.isArray(r) ? r : (r && r.errors) || [];
  if ((r && r.valid === false) || fallas.length) throw new Error(`${nombre}: no cumple el esquema del contrato: ${JSON.stringify(fallas).slice(0, 400)}`);
}

const principal = dataset.principals.find((p) => p.keyId === LLAVE_DE_PRUEBA);
if (!principal) throw new Error('El conjunto de ejemplo ya no trae la credencial de la tienda web.');
const ahora = dataset.now;

// Lectura de canal: una búsqueda general (sin palabras útiles, el contrato la trata como «ver todo») con el tope del contrato.
const busqueda = searchCatalog({ dataset, principal, request: { q: 'catálogo', channel: CANAL, limit: 50 }, now: ahora });
exigirEsquema('api.search-response', busqueda);
if (busqueda.count >= 50) throw new Error('El catálogo de ejemplo llenó el tope de la búsqueda: habría que paginar.');

// Lista blanca: lo único que puede salir a un repositorio público.
function ofertaPublica(item) {
  const autorizado = item.priceClaim === 'authorized' && item.price !== null;
  return {
    offerId: item.offerId,
    title: item.title,
    variantName: item.variantName,
    category: item.category,
    description: item.description,
    price: autorizado ? {
      amount: { amountMinor: item.price.amount.amountMinor, currency: item.price.amount.currency },
      taxIncluded: item.price.taxIncluded,
      validUntil: item.price.validUntil,
    } : null,
    priceClaim: autorizado ? 'authorized' : 'must_verify',
    availability: { claim: item.availability.claim },
  };
}

const items = busqueda.results.map((resumen) => {
  // La ficha se lee con catalog.item, como lo haría la página, y debe decir lo mismo que la búsqueda.
  const ficha = getCatalogItem({ dataset, principal, offerId: resumen.offerId, channel: CANAL, now: ahora });
  const sobre = { contractVersion: busqueda.contractVersion, servedAt: ahora, item: ficha.item || ficha };
  exigirEsquema('api.catalog-item', sobre);
  return ofertaPublica(sobre.item);
});

const salida = {
  aviso: 'Datos de ejemplo. No es una oferta',
  origen: 'Conjunto de ejemplo del contrato commerce v1 de comerce-ai (examples/dataset--una-instalacion.json), leído con catalog.search y catalog.item por el canal web_store. Todo es inventado.',
  contractVersion: busqueda.contractVersion,
  channel: CANAL,
  servedAt: busqueda.servedAt,
  brand: { displayName: busqueda.brand.displayName },
  items,
};

// Candado: ninguna llave fuera de la lista blanca y ninguna palabra interna en todo el archivo.
const PERMITIDAS = new Set(['aviso', 'origen', 'contractVersion', 'channel', 'servedAt', 'brand', 'displayName', 'items', 'offerId', 'title',
  'variantName', 'category', 'description', 'price', 'amount', 'amountMinor', 'currency', 'taxIncluded', 'validUntil', 'priceClaim',
  'availability', 'claim']);
(function revisar(valor) {
  if (Array.isArray(valor)) return valor.forEach(revisar);
  if (valor && typeof valor === 'object') {
    for (const [k, v] of Object.entries(valor)) {
      if (!PERMITIDAS.has(k)) throw new Error(`Campo fuera de la lista blanca: ${k}`);
      revisar(v);
    }
  }
})(salida);
const texto = JSON.stringify(salida, null, 2);
for (const interno of [/cost/i, /margin/i, /margen/i, /supplier/i, /proveedor/i, /dropi/i, /tenant/i, /\bsku\b/i, /quantity/i, /onHand/i,
  /secret/i, /keyId/i, /key_/i, /\b(ten|bu|cat|prd|var|prc|usr|apr|ivf)_[0-9A-Z]{20,}/, /in_stock|low_stock|out_of_stock/]) {
  if (interno.test(texto)) throw new Error(`El archivo generado trae algo interno: ${interno}`);
}

const cabeza = `/* ARCHIVO GENERADO. No se edita a mano: se vuelve a generar con scripts/generar-catalogo.js.
   DATOS DE EJEMPLO, FICTICIOS. No es una oferta: ningún producto, precio ni disponibilidad de aquí es real.
   Salen del conjunto de ejemplo del contrato commerce v1 de comerce-ai y solo traen los campos públicos de la oferta
   (nombre, variante, categoría, descripción, precio autorizado y lo que se puede decir de la disponibilidad).
   La única pieza que puede leer este archivo es assets/fuente-catalogo.js. */
`;
fs.mkdirSync(path.dirname(SALIDA), { recursive: true });
fs.writeFileSync(SALIDA, `${cabeza}window.NOVA_CATALOGO_EJEMPLO = ${texto};\n`);
console.log(`Listo: ${items.length} ofertas de ejemplo en ${path.relative(process.cwd(), SALIDA)}`);
