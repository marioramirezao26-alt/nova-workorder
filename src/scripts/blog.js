// Arma el blog estático de novaworkorder.com desde docs/blog/ (no se publica): cada artículo es un .html con sus datos
// en un comentario JSON al principio y el cuerpo después. Escribe:
//   landing/blog/index.html y landing/blog/<slug>/index.html          (español: Colombia, México e hispanos de EE. UU.)
//   landing/en/blog/index.html y landing/en/blog/<slug>/index.html    (inglés, EE. UU.)
//   la parte del blog en landing/sitemap.xml (entre <!-- blog --> y <!-- /blog -->)
// Las portadas (landing/img/blog/<slug>.jpg, 1200×630) las hace docs/blog/portadas.py.
// Uso: node src/scripts/blog.js   (después de cambiar un artículo). test/en-blog.test.js revisa el resultado.
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..', '..');
const FUENTE = path.join(RAIZ, 'docs', 'blog');
const LANDING = path.join(RAIZ, 'landing');
const SITIO = 'https://novaworkorder.com';

// Lo que cambia por idioma: rutas, textos fijos y a qué portada lleva «Empieza gratis».
const IDIOMAS = {
  es: {
    html: 'es', og: 'es_LA', base: '/blog/', inicio: '/', nombreInicio: 'Inicio',
    blog: 'Blog', tituloBlog: 'Blog de NOVAWORKORDER: órdenes de trabajo, cotizaciones y ventas por WhatsApp',
    descBlog: 'Consejos prácticos y sin rodeos para dueños de negocios de servicio técnico y de tiendas: órdenes de trabajo, cotizaciones, mantenimiento, pedidos por WhatsApp y cobros.',
    h1Blog: 'Consejos para organizar tu negocio',
    leadBlog: 'Guías cortas y prácticas para dueños de negocios de servicio técnico y de tiendas. Sirven aunque no uses NOVAWORKORDER.',
    saltar: 'Saltar al contenido', menu: 'Principal', migas: 'Estás aquí', pie: 'Pie de página',
    nav: [['/#servicios', 'Servicios'], ['/#pedidos', 'Pedidos']],
    ctaTop: ['#empieza', 'Empieza gratis'],
    lectura: (n) => `${n} min de lectura`, por: 'Por el equipo de NOVAWORKORDER',
    fecha: (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }),
    ctaTitulo: 'Pruébalo con tu negocio', ctaTexto: '7 días gratis, sin tarjeta y sin instalar nada. Al final decides si sigues.',
    ctaBoton: ['/#demo', 'Empieza gratis'],
    ctaPaises: '¿Tu negocio está en otro país? Empieza en la página de <a href="/es-us/#demo" hreflang="es-US">Estados Unidos</a> o de <a href="/es-mx/#demo" hreflang="es-MX">México</a>, con los precios en tu moneda.',
    sigue: 'Sigue leyendo', leer: 'Leer',
    pieLinks: [['/blog/', 'Blog'], ['/', 'NOVAWORKORDER en Colombia'], ['/es-us/', 'En Estados Unidos'], ['/es-mx/', 'En México'], ['/privacidad', 'Privacidad'], ['mailto:contacto@novaworkorder.com', 'contacto@novaworkorder.com'], ['/en/blog/', 'English']],
  },
  en: {
    html: 'en-US', og: 'en_US', base: '/en/blog/', inicio: '/en/', nombreInicio: 'Home',
    blog: 'Blog', tituloBlog: 'NOVAWORKORDER blog: work orders, quotes and running a small service business',
    descBlog: 'Practical, plain-English tips for owners of small service businesses and shops: work orders, quotes and getting organized.',
    h1Blog: 'Tips to get your business organized',
    leadBlog: 'Short, practical guides for owners of service businesses and shops. They help even if you never use NOVAWORKORDER.',
    saltar: 'Skip to content', menu: 'Main', migas: 'You are here', pie: 'Footer',
    nav: [['/en/#features', 'Services'], ['/en/#stores', 'Store']],
    ctaTop: ['#empieza', 'Start free'],
    lectura: (n) => `${n} min read`, por: 'By the NOVAWORKORDER team',
    fecha: (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }),
    ctaTitulo: 'Try it with your business', ctaTexto: '7 days free, no credit card and nothing to install. Then you decide.',
    ctaBoton: ['/en/#start', 'Start free'],
    ctaPaises: '',
    sigue: 'Keep reading', leer: 'Read',
    pieLinks: [['/en/blog/', 'Blog'], ['/en/', 'Home'], ['/en/compare/', 'Compare'], ['/en/privacy', 'Privacy'], ['/en/terms', 'Terms'], ['mailto:contacto@novaworkorder.com', 'contacto@novaworkorder.com'], ['/blog/', 'Español']],
  },
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ld = (obj) => JSON.stringify(obj).replace(/</g, '\\u003c');
const palabras = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/g, ' ').split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

// { datos, cuerpo } de un archivo de docs/blog/<idioma>/.
const leerArticulo = (archivo, lang) => {
  const txt = fs.readFileSync(archivo, 'utf8');
  const m = /^<!--\s*(\{[\s\S]*?\})\s*-->\s*/.exec(txt);
  if (!m) throw new Error(`${archivo}: falta el comentario JSON del principio`);
  const datos = JSON.parse(m[1]);
  for (const k of ['slug', 'titulo', 'descripcion', 'fecha', 'categoria', 'portada']) if (!datos[k]) throw new Error(`${archivo}: falta ${k}`);
  return { ...datos, lang, cuerpo: txt.slice(m[0].length).trim() };
};

const articulos = () => Object.keys(IDIOMAS).flatMap((lang) => {
  const dir = path.join(FUENTE, lang);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.html')).sort().map((f) => leerArticulo(path.join(dir, f), lang))
    .sort((a, b) => (a.orden || 99) - (b.orden || 99));
});

const urlDe = (a) => `${IDIOMAS[a.lang].base}${a.slug}/`;
const imgDe = (a) => `/img/blog/${a.slug}.jpg`;

const ORG = { '@type': 'Organization', '@id': `${SITIO}/#org`, name: 'NOVA Desarrollos', brand: { '@type': 'Brand', name: 'NOVAWORKORDER' },
  url: `${SITIO}/`, logo: `${SITIO}/img/icono-180.png` };

const cabeza = ({ t, titulo, desc, url, img, imgAlt, tipo, alternos, extraLd, publicado }) => `<!doctype html>
<html lang="${t.html}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(titulo)}</title>
  <meta name="description" content="${esc(desc)}" />
  <meta name="color-scheme" content="dark" />
  <meta name="theme-color" content="#07111d" />
  <link rel="canonical" href="${SITIO}${url}" />
${alternos.map(([h, u]) => `  <link rel="alternate" hreflang="${h}" href="${SITIO}${u}" />`).join('\n')}
  <meta property="og:type" content="${tipo}" />
  <meta property="og:locale" content="${t.og}" />
  <meta property="og:site_name" content="NOVAWORKORDER" />
  <meta property="og:title" content="${esc(titulo)}" />
  <meta property="og:description" content="${esc(desc)}" />
  <meta property="og:image" content="${SITIO}${img}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="${esc(imgAlt)}" />
  <meta property="og:url" content="${SITIO}${url}" />
${publicado ? `  <meta property="article:published_time" content="${publicado}" />\n` : ''}  <meta name="twitter:card" content="summary_large_image" />
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <link rel="apple-touch-icon" href="/img/icono-180.png" />
  <link rel="stylesheet" href="/estilos.css" />
  <link rel="stylesheet" href="/blog.css" />
  <script type="application/ld+json">
${ld({ '@context': 'https://schema.org', '@graph': [ORG, ...extraLd] })}
  </script>
</head>
<body>
  <a class="sr" href="#contenido">${t.saltar}</a>
  <header class="top">
    <div class="wrap">
      <a class="brand" href="${t.inicio}"><img src="/favicon.svg" alt="" /><span>NOVA<small>WORKORDER</small></span></a>
      <nav aria-label="${t.menu}">
        <a href="${t.base}">${t.blog}</a>
${t.nav.map(([h, x]) => `        <a href="${h}">${x}</a>`).join('\n')}
        <a class="btn small" href="${t.ctaTop[0]}">${t.ctaTop[1]}</a>
      </nav>
    </div>
  </header>
`;

const pie = (t) => `
  <footer>
    <div class="wrap">
      <span>© 2026 NOVAWORKORDER · NOVA Desarrollos</span>
      <nav aria-label="${t.pie}">
${t.pieLinks.map(([h, x]) => `        <a href="${h}"${h === '/en/blog/' ? ' hreflang="en-US" lang="en"' : h === '/blog/' && t.html !== 'es' ? ' hreflang="es" lang="es"' : ''}>${x}</a>`).join('\n')}
      </nav>
    </div>
  </footer>
</body>
</html>
`;

const cta = (t) => `
      <aside class="cta-blog" id="empieza" aria-labelledby="empieza-titulo">
        <h2 id="empieza-titulo">${t.ctaTitulo}</h2>
        <p>${t.ctaTexto}</p>
        <a class="btn" href="${t.ctaBoton[0]}" data-kind="prueba">${t.ctaBoton[1]}</a>
${t.ctaPaises ? `        <p class="small">${t.ctaPaises}</p>\n` : ''}      </aside>`;

const tarjeta = (a, t) => `
          <li class="tarjeta">
            <a href="${urlDe(a)}">
              <img src="${imgDe(a)}" width="1200" height="630" loading="lazy" alt="" />
              <span class="tarjeta-cat">${esc(a.categoria)}</span>
              <span class="tarjeta-titulo">${esc(a.titulo)}</span>
              <span class="tarjeta-desc">${esc(a.descripcion)}</span>
              <span class="tarjeta-leer">${t.leer} <span aria-hidden="true">→</span></span>
            </a>
          </li>`;

const paginaArticulo = (a, todos) => {
  const t = IDIOMAS[a.lang];
  const url = urlDe(a);
  const par = a.alterno ? todos.find((x) => x.slug === a.alterno && x.lang !== a.lang) : null;
  if (a.alterno && !par) throw new Error(`${a.slug}: no existe el alterno ${a.alterno}`);
  const alternos = [[a.lang === 'es' ? 'es' : 'en-US', url]];
  if (par) alternos.push([par.lang === 'es' ? 'es' : 'en-US', urlDe(par)], ['x-default', a.lang === 'es' ? url : urlDe(par)]);
  const rel = (a.relacionados || []).map((s) => {
    const r = todos.find((x) => x.slug === s && x.lang === a.lang);
    if (!r) throw new Error(`${a.slug}: no existe el relacionado ${s}`);
    return r;
  });
  const n = palabras(a.cuerpo);
  const min = Math.max(1, Math.round(n / 200));
  const titulo = `${a.titulo} | ${a.lang === 'es' ? 'Blog de NOVAWORKORDER' : 'NOVAWORKORDER blog'}`;
  const extraLd = [
    { '@type': 'Article', '@id': `${SITIO}${url}#articulo`, headline: a.titulo, description: a.descripcion, image: `${SITIO}${imgDe(a)}`,
      datePublished: a.fecha, dateModified: a.actualizado || a.fecha, inLanguage: t.html, wordCount: n, articleSection: a.categoria,
      author: { '@id': `${SITIO}/#org` }, publisher: { '@id': `${SITIO}/#org` }, mainEntityOfPage: `${SITIO}${url}` },
    { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: t.nombreInicio, item: `${SITIO}${t.inicio}` },
      { '@type': 'ListItem', position: 2, name: t.blog, item: `${SITIO}${t.base}` },
      { '@type': 'ListItem', position: 3, name: a.titulo, item: `${SITIO}${url}` }] },
  ];
  return cabeza({ t, titulo, desc: a.descripcion, url, img: imgDe(a), imgAlt: a.portada.alt || a.titulo, tipo: 'article', alternos, extraLd,
    publicado: a.fecha }) + `
  <main id="contenido" tabindex="-1" class="blog-articulo">
    <article class="wrap">
      <nav class="migas" aria-label="${t.migas}">
        <a href="${t.inicio}">${t.nombreInicio}</a> <span aria-hidden="true">›</span> <a href="${t.base}">${t.blog}</a> <span aria-hidden="true">›</span> <span aria-current="page">${esc(a.categoria)}</span>
      </nav>
      <p class="eyebrow">${esc(a.categoria)}</p>
      <h1>${esc(a.titulo)}</h1>
      <p class="meta"><time datetime="${a.fecha}">${t.fecha(a.fecha)}</time> · ${t.lectura(min)} · ${t.por}</p>
      <img class="portada-blog" src="${imgDe(a)}" width="1200" height="630" alt="${esc(a.portada.alt || a.titulo)}" />
      <div class="articulo-cuerpo">
${a.cuerpo.split('\n').map((l) => (l ? `        ${l}` : '')).join('\n')}
      </div>
${cta(t)}
${rel.length ? `
      <section class="relacionados" aria-labelledby="sigue-titulo">
        <h2 id="sigue-titulo">${t.sigue}</h2>
        <ul class="tarjetas">${rel.map((r) => tarjeta(r, t)).join('')}
        </ul>
      </section>` : ''}
    </article>
  </main>
` + pie(t);
};

const paginaIndice = (lang, todos) => {
  const t = IDIOMAS[lang];
  const lista = todos.filter((a) => a.lang === lang);
  const otro = lang === 'es' ? 'en' : 'es';
  const alternos = [[lang === 'es' ? 'es' : 'en-US', t.base], [otro === 'es' ? 'es' : 'en-US', IDIOMAS[otro].base], ['x-default', IDIOMAS.es.base]];
  const extraLd = [
    { '@type': 'Blog', '@id': `${SITIO}${t.base}#blog`, name: t.tituloBlog, description: t.descBlog, url: `${SITIO}${t.base}`, inLanguage: t.html,
      publisher: { '@id': `${SITIO}/#org` },
      blogPost: lista.map((a) => ({ '@type': 'BlogPosting', headline: a.titulo, url: `${SITIO}${urlDe(a)}`, datePublished: a.fecha, image: `${SITIO}${imgDe(a)}` })) },
    { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: t.nombreInicio, item: `${SITIO}${t.inicio}` },
      { '@type': 'ListItem', position: 2, name: t.blog, item: `${SITIO}${t.base}` }] },
  ];
  return cabeza({ t, titulo: t.tituloBlog, desc: t.descBlog, url: t.base, img: imgDe(lista[0]), imgAlt: lista[0].portada.alt || lista[0].titulo,
    tipo: 'website', alternos, extraLd }) + `
  <main id="contenido" tabindex="-1" class="blog-indice">
    <div class="wrap">
      <nav class="migas" aria-label="${t.migas}">
        <a href="${t.inicio}">${t.nombreInicio}</a> <span aria-hidden="true">›</span> <span aria-current="page">${t.blog}</span>
      </nav>
      <div class="center">
        <p class="eyebrow">${t.blog}</p>
        <h1>${t.h1Blog}</h1>
        <p class="lead">${t.leadBlog}</p>
      </div>
      <ul class="tarjetas">${lista.map((a) => tarjeta(a, t)).join('')}
      </ul>
${cta(t)}
    </div>
  </main>
` + pie(t);
};

const escribir = (rel, html) => {
  const f = path.join(LANDING, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, html);
};

const sitemap = (todos) => {
  const f = path.join(LANDING, 'sitemap.xml');
  const xml = fs.readFileSync(f, 'utf8');
  const ultima = (lang) => todos.filter((a) => a.lang === lang).map((a) => a.actualizado || a.fecha).sort().pop();
  const urls = [];
  for (const lang of Object.keys(IDIOMAS)) {
    if (!todos.some((a) => a.lang === lang)) continue;
    urls.push(`  <url><loc>${SITIO}${IDIOMAS[lang].base}</loc><lastmod>${ultima(lang)}</lastmod></url>`);
    for (const a of todos.filter((x) => x.lang === lang)) urls.push(`  <url><loc>${SITIO}${urlDe(a)}</loc><lastmod>${a.actualizado || a.fecha}</lastmod></url>`);
  }
  const bloque = `  <!-- blog: lo escribe src/scripts/blog.js -->\n${urls.join('\n')}\n  <!-- /blog -->\n`;
  const limpio = xml.replace(/  <!-- blog[^>]*-->\n[\s\S]*?  <!-- \/blog -->\n/, '');
  fs.writeFileSync(f, limpio.replace('</urlset>', `${bloque}</urlset>`));
};

const construir = () => {
  const todos = articulos();
  for (const a of todos) escribir(path.join(urlDe(a), 'index.html'), paginaArticulo(a, todos));
  for (const lang of Object.keys(IDIOMAS)) if (todos.some((a) => a.lang === lang)) escribir(path.join(IDIOMAS[lang].base, 'index.html'), paginaIndice(lang, todos));
  sitemap(todos);
  return todos;
};

if (require.main === module) {
  for (const a of construir()) console.log(`${urlDe(a)}  ${palabras(a.cuerpo)} palabras`);
}

module.exports = { articulos, palabras, urlDe, imgDe, construir };
