// P-034 A6, A7 y A11: páginas estáticas que salen de las portadas, para que no se escriban dos veces.
//   landing/precios.html, landing/es-mx/precios.html, landing/es-us/precios.html y landing/en/pricing.html (A7):
//     la sección de precios de cada portada, tal cual (los mismos precios de knowledge/copys.md), con su URL propia.
//   landing/404.html (A6): la página que Caddy muestra con código 404 cuando una ruta no existe.
//   landing/llms.txt (A11): un resumen corto para los asistentes de IA, con los enlaces que valen la pena.
// Uso: node src/scripts/paginas.js   (después de cambiar los precios o los textos de una portada). Lo revisa test/paginas.test.js.
const fs = require('node:fs');
const path = require('node:path');
const blog = require('./blog');

const LANDING = path.join(__dirname, '..', '..', 'landing');
const SITIO = 'https://novaworkorder.com';

// Una portada por mercado y la URL de su página de precios.
const PRECIOS = [
  { portada: 'index.html', inicio: '/', ruta: '/precios', archivo: 'precios.html', lang: 'es-CO', og: 'es_CO', seccion: 'precios',
    titulo: 'Precios de NOVAWORKORDER en Colombia', desc: 'Cuánto cuesta NOVAWORKORDER en Colombia: Servicios $49.000 COP por técnico al mes y Pedidos $39.000 COP por tienda al mes, precio final, mes a mes y con 7 días gratis.',
    h1: 'Precios de NOVAWORKORDER en Colombia', inicioNombre: 'Inicio' },
  { portada: 'es-mx/index.html', inicio: '/es-mx/', ruta: '/es-mx/precios', archivo: 'es-mx/precios.html', lang: 'es-MX', og: 'es_MX', seccion: 'precios',
    titulo: 'Precios de NOVAWORKORDER en México', desc: 'Cuánto cuesta NOVAWORKORDER en México, en pesos mexicanos, mes a mes y con 7 días gratis, sin tarjeta.',
    h1: 'Precios de NOVAWORKORDER en México', inicioNombre: 'Inicio' },
  { portada: 'es-us/index.html', inicio: '/es-us/', ruta: '/es-us/precios', archivo: 'es-us/precios.html', lang: 'es-US', og: 'es_US', seccion: 'precios',
    titulo: 'Precios de NOVAWORKORDER en Estados Unidos', desc: 'Cuánto cuesta NOVAWORKORDER en Estados Unidos, en dólares, mes a mes y con 7 días gratis, sin tarjeta.',
    h1: 'Precios de NOVAWORKORDER en Estados Unidos', inicioNombre: 'Inicio' },
  { portada: 'en/index.html', inicio: '/en/', ruta: '/en/pricing', archivo: 'en/pricing.html', lang: 'en-US', og: 'en_US', seccion: 'pricing',
    titulo: 'NOVAWORKORDER pricing', desc: 'What NOVAWORKORDER costs in the US, in dollars, month to month, with a 7-day free trial and no credit card.',
    h1: 'NOVAWORKORDER pricing', inicioNombre: 'Home' },
];

const leer = (rel) => fs.readFileSync(path.join(LANDING, rel), 'utf8');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const trozo = (html, desde, hasta, cual) => {
  const i = html.indexOf(desde);
  const j = html.indexOf(hasta, i);
  if (i < 0 || j < 0) throw new Error(`no encontré ${cual}`);
  return html.slice(i, j + hasta.length);
};

// En otra URL, «#demo» ya no existe: va a la portada. Los botones del chat de GABY necesitan el JS de la portada, así
// que se quitan (el pie y la cabecera siguen llevando a ella).
const adaptar = (html, inicio) => html
  .replace(/(<a\b[^>]*?\shref=)"#/g, `$1"${inicio}#`)                    // los íconos (<use href="#i-…">) se quedan
  .replace(/<p class="small">[^<]*<button[^>]*data-chat[\s\S]*?<\/button><\/p>\n?/g, '')
  .replace(/\s*<button type="button"[^>]*data-chat[^>]*>[\s\S]*?<\/button>/g, '')
  .replace(/<div class="calc" id="calc">[\s\S]*?<p class="small" id="calc-error"[^>]*>[^<]*<\/p>\s*<\/div>\s*/, '');

const paginaPrecios = (p) => {
  const portada = leer(p.portada);
  const seccion = adaptar(trozo(portada, `<section id="${p.seccion}">`, '</section>', `#${p.seccion} en ${p.portada}`), p.inicio);
  const cabecera = adaptar(trozo(portada, '<header class="top">', '</header>', 'la cabecera'), p.inicio);
  const pie = adaptar(trozo(portada, '<footer>', '</footer>', 'el pie'), p.inicio);
  const iconos = trozo(portada, '<svg style="display:none" aria-hidden="true">', '</svg>', 'los íconos');
  const alternos = PRECIOS.map((x) => `  <link rel="alternate" hreflang="${x.lang}" href="${SITIO}${x.ruta}" />`).join('\n');
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebPage', '@id': `${SITIO}${p.ruta}#pagina`, url: `${SITIO}${p.ruta}`, name: p.titulo, description: p.desc,
        inLanguage: p.lang, publisher: { '@id': `${SITIO}/#org` } },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: p.inicioNombre, item: `${SITIO}${p.inicio}` },
        { '@type': 'ListItem', position: 2, name: p.h1, item: `${SITIO}${p.ruta}` }] },
    ],
  };
  return `<!doctype html>
<html lang="${p.lang}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(p.titulo)} | NOVAWORKORDER</title>
  <meta name="description" content="${esc(p.desc)}" />
  <meta name="color-scheme" content="dark" />
  <meta name="theme-color" content="#07111d" />
  <link rel="canonical" href="${SITIO}${p.ruta}" />
${alternos}
  <link rel="alternate" hreflang="x-default" href="${SITIO}/precios" />
  <meta property="og:type" content="website" />
  <meta property="og:locale" content="${p.og}" />
  <meta property="og:site_name" content="NOVAWORKORDER" />
  <meta property="og:title" content="${esc(p.titulo)}" />
  <meta property="og:description" content="${esc(p.desc)}" />
  <meta property="og:image" content="${SITIO}/img/og-novaworkorder.jpg?v=2" />
  <meta property="og:url" content="${SITIO}${p.ruta}" />
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <link rel="apple-touch-icon" href="/img/icono-180.png" />
  <link rel="stylesheet" href="/estilos.css" />
  <link rel="stylesheet" href="/inicio.css" />
  <script type="application/ld+json">
${JSON.stringify(ld).replace(/</g, '\\u003c')}
  </script>
</head>
<body>
  <!-- Lo escribe src/scripts/paginas.js desde ${p.portada}: no se edita a mano. -->
  ${iconos}
  ${cabecera}

  <main id="contenido" tabindex="-1">
    <div class="wrap center"><h1>${esc(p.h1)}</h1></div>
    ${seccion}
  </main>

  ${pie}
</body>
</html>
`;
};

const pagina404 = () => `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Esta página no existe | NOVAWORKORDER</title>
  <meta name="robots" content="noindex" />
  <meta name="color-scheme" content="dark" />
  <meta name="theme-color" content="#07111d" />
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <link rel="stylesheet" href="/estilos.css" />
</head>
<body>
  <!-- P-034 A6: Caddy la muestra con código 404 (deploy/Caddyfile, handle_errors). La escribe src/scripts/paginas.js. -->
  <header class="top">
    <div class="wrap">
      <a class="brand" href="/"><img src="/favicon.svg" alt="" /><span>NOVA<small>WORKORDER</small></span></a>
    </div>
  </header>
  <main id="contenido" tabindex="-1">
    <section>
      <div class="wrap center">
        <p class="eyebrow">Error 404</p>
        <h1>Esta página no existe</h1>
        <p class="lead">Puede que el enlace esté mal escrito o que la página haya cambiado de lugar.</p>
        <div class="cta-row">
          <a class="btn" href="/">Ir al inicio</a>
          <a class="btn ghost" href="/blog/">Ver el blog</a>
        </div>
        <p>¿Estás en otro país? <a href="/es-mx/" hreflang="es-MX">México</a> · <a href="/es-us/" hreflang="es-US">Estados Unidos (español)</a> · <a href="/en/" hreflang="en-US" lang="en">United States (English)</a></p>
        <p lang="en">This page does not exist. <a href="/en/">Go to the home page</a> or <a href="/en/blog/">read the blog</a>.</p>
        <p class="small">¿Buscabas algo en particular? Escríbenos a contacto@novaworkorder.com.</p>
      </div>
    </section>
  </main>
</body>
</html>
`;

// A11 (prioridad baja): un archivo corto y estático. Solo lo que es verdad y está en la página.
const llms = () => {
  const arts = blog.articulos().filter((a) => a.seccion !== 'comparar');
  const linea = (a) => `- [${a.titulo}](${SITIO}${blog.urlDe(a)}): ${a.descripcion}`;
  return `# NOVAWORKORDER

> NOVAWORKORDER es un programa en línea para negocios pequeños. Servicios: las órdenes de trabajo de los técnicos en su celular, con cotizaciones, informes con fotos y firma del cliente. Pedidos: una tienda en línea con su propio enlace, sin comisión por venta. Se prueba 7 días gratis, sin tarjeta. Es de NOVA Desarrollos.

## Precios

- [Colombia](${SITIO}/precios): Servicios $49.000 COP por técnico al mes; Pedidos $39.000 COP por tienda al mes; precio final, mes a mes.
- [México](${SITIO}/es-mx/precios)
- [Estados Unidos, en español](${SITIO}/es-us/precios)
- [United States, in English](${SITIO}/en/pricing)

## Blog en español

${arts.filter((a) => a.lang === 'es').map(linea).join('\n')}

## Blog in English

${arts.filter((a) => a.lang === 'en').map(linea).join('\n')}

## Comparisons

- [NOVAWORKORDER vs. Jobber](${SITIO}/en/compare/jobber/)
- [NOVAWORKORDER vs. Housecall Pro](${SITIO}/en/compare/housecall-pro/)

## Contacto

- Correo: contacto@novaworkorder.com
`;
};

const construir = () => {
  for (const p of PRECIOS) fs.writeFileSync(path.join(LANDING, p.archivo), paginaPrecios(p));
  fs.writeFileSync(path.join(LANDING, '404.html'), pagina404());
  fs.writeFileSync(path.join(LANDING, 'llms.txt'), llms());
};

if (require.main === module) {
  construir();
  for (const p of PRECIOS) console.log(`${p.ruta}  ← ${p.portada}`);
  console.log('/404.html y /llms.txt');
}

module.exports = { PRECIOS, construir, adaptar };
