// Arma el blog estático de novaworkorder.com desde docs/blog/ (no se publica): cada artículo es un .html con sus datos
// en un comentario JSON al principio y el cuerpo después. Escribe:
//   landing/blog/index.html y landing/blog/<slug>/index.html          (español: Colombia, México e hispanos de EE. UU.)
//   landing/en/blog/index.html y landing/en/blog/<slug>/index.html    (inglés, EE. UU.)
//   landing/es-mx/blog/ y landing/es-us/blog/ (P-034 A8): los artículos de docs/blog/es-mx|es-us/ y la lista de los de
//     español general; el texto propio de cada mercado lo pone Ada.
//   Comparaciones (P-034 A8): un artículo con "seccion": "comparar" va a <inicio>comparar/<slug>/ (/comparar/,
//     /es-mx/comparar/…) con su índice, en vez del blog. Llevan dateModified desde "actualizado".
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
    lectura: (n) => `${n} min de lectura`, por: 'Por el equipo de NOVAWORKORDER', actualizado: 'actualizado el',
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
    lectura: (n) => `${n} min read`, por: 'By the NOVAWORKORDER team', actualizado: 'updated',
    fecha: (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }),
    ctaTitulo: 'Try it with your business', ctaTexto: '7 days free, no credit card and nothing to install. Then you decide.',
    ctaBoton: ['/en/#start', 'Start free'],
    ctaPaises: '',
    sigue: 'Keep reading', leer: 'Read',
    pieLinks: [['/en/blog/', 'Blog'], ['/en/', 'Home'], ['/en/compare/', 'Compare'], ['/en/privacy', 'Privacy'], ['/en/terms', 'Terms'], ['mailto:contacto@novaworkorder.com', 'contacto@novaworkorder.com'], ['/blog/', 'Español']],
  },
};

// P-034 A8: los mercados en español con su propio blog. Heredan todo del español y cambian rutas, idioma y llamado.
const mercado = (codigo, html, og, pais, notas) => ({
  ...IDIOMAS.es, html, og, base: `/${codigo}/blog/`, inicio: `/${codigo}/`, mercado: true,
  tituloBlog: `Blog de NOVAWORKORDER en ${pais}: órdenes de trabajo, cotizaciones y ventas por WhatsApp`,
  nav: [[`/${codigo}/#servicios`, 'Servicios'], [`/${codigo}/#pedidos`, 'Pedidos']],
  ctaBoton: [`/${codigo}/#demo`, 'Empieza gratis'], ctaPaises: notas,
  pieLinks: [[`/${codigo}/blog/`, 'Blog'], [`/${codigo}/`, `NOVAWORKORDER en ${pais}`], ['/blog/', 'Blog en Colombia'],
    [`/${codigo}/privacidad`, 'Privacidad'], ['mailto:contacto@novaworkorder.com', 'contacto@novaworkorder.com'], ['/en/blog/', 'English']],
});
IDIOMAS['es-mx'] = mercado('es-mx', 'es-MX', 'es_MX', 'México', 'Precios en pesos mexicanos en la página de <a href="/es-mx/#precios">México</a>.');
IDIOMAS['es-us'] = mercado('es-us', 'es-US', 'es_US', 'Estados Unidos', 'Precios en dólares en la página de <a href="/es-us/#precios">Estados Unidos</a>.');
const hreflang = (lang) => IDIOMAS[lang].html === 'en-US' ? 'en-US' : IDIOMAS[lang].html;
const esEspanol = (lang) => lang !== 'en';
const SECCION = { es: 'comparar', en: 'compare' };

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ld = (obj) => JSON.stringify(obj).replace(/</g, '\\u003c');
// Párrafos y elementos de lista de un cuerpo (para revisar que cada cifra lleve su fuente en el mismo párrafo).
const parrafos = (html) => (html.match(/<(p|li|td|blockquote)\b[^>]*>[\s\S]*?<\/\1>/g) || []);
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

const urlDe = (a) => (a.seccion === 'comparar'
  ? `${IDIOMAS[a.lang].inicio}${esEspanol(a.lang) ? SECCION.es : SECCION.en}/${a.slug}/`
  : `${IDIOMAS[a.lang].base}${a.slug}/`);
const imgDe = (a) => `/img/blog/${a.slug}.jpg`;

// P-034 A9: el nombre legal se queda (sale en términos y privacidad); la marca va en alternateName y brand
const ORG = { '@type': 'Organization', '@id': `${SITIO}/#org`, name: 'NOVA Desarrollos', alternateName: 'NOVAWORKORDER',
  brand: { '@type': 'Brand', name: 'NOVAWORKORDER' }, foundingDate: '2026',
  foundingLocation: { '@type': 'Place', name: 'Cúcuta, Norte de Santander, Colombia' },
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

// El mismo contador anónimo de las portadas (sin cookies): una visita al abrir y un clic al tocar «Empieza gratis».
// El servidor saca el mercado de la ruta: /blog/ → co y /en/blog/ → us-en.
const BALIZA = `  <script>
    (function () {
      var store = { get: function (k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
                    set: function (k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* modo privado */ } } };
      var utm = (location.search.match(/[?&]utm_source=([^&#]*)/) || [])[1];
      if (utm) store.set('nova-utm', decodeURIComponent(utm).slice(0, 60));
      if (!store.get('nova-ref') && document.referrer) store.set('nova-ref', document.referrer.slice(0, 500));
      var referral = (location.search.match(/[?&]ref=([a-z0-9-]{3,20})/i) || [])[1];
      if (referral) store.set('nova-referral', referral.toLowerCase());
      function track(event) {
        try {
          fetch('/api/public/visit', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event: event, path: location.pathname, utm: store.get('nova-utm'), ref: store.get('nova-ref'),
              referral: store.get('nova-referral') }) })
            .catch(function () {});
        } catch (e) { /* sin red */ }
      }
      track('visita');
      var clicked = false;
      document.addEventListener('click', function (ev) {
        var a = ev.target.closest && ev.target.closest('.cta-blog .btn, .top .btn');
        if (a && !clicked) { clicked = true; track('clic'); }
      });
    })();
  </script>`;

const pie = (t) => `
  <footer>
    <div class="wrap">
      <span>© 2026 NOVAWORKORDER · NOVA Desarrollos</span>
      <nav aria-label="${t.pie}">
${t.pieLinks.map(([h, x]) => `        <a href="${h}"${h === '/en/blog/' ? ' hreflang="en-US" lang="en"' : h === '/blog/' && t.html !== 'es' ? ' hreflang="es" lang="es"' : ''}>${x}</a>`).join('\n')}
      </nav>
    </div>
  </footer>
${BALIZA}
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
  const alternos = [[hreflang(a.lang), url]];
  if (par) alternos.push([hreflang(par.lang), urlDe(par)], ['x-default', esEspanol(a.lang) ? url : urlDe(par)]);
  const rel = (a.relacionados || []).map((s) => {
    const r = todos.find((x) => x.slug === s && x.lang === a.lang);
    if (!r) throw new Error(`${a.slug}: no existe el relacionado ${s}`);
    return r;
  });
  const n = palabras(a.cuerpo);
  const min = Math.max(1, Math.round(n / 200));
  const comparar = a.seccion === 'comparar';
  const titulo = `${a.titulo} | ${esEspanol(a.lang) ? (comparar ? 'Comparaciones de NOVAWORKORDER' : 'Blog de NOVAWORKORDER') : 'NOVAWORKORDER blog'}`;
  const extraLd = [
    { '@type': 'Article', '@id': `${SITIO}${url}#articulo`, headline: a.titulo, description: a.descripcion, image: `${SITIO}${imgDe(a)}`,
      datePublished: a.fecha, dateModified: a.actualizado || a.fecha, inLanguage: t.html, wordCount: n, articleSection: a.categoria,
      author: { '@id': `${SITIO}/#org` }, publisher: { '@id': `${SITIO}/#org` }, mainEntityOfPage: `${SITIO}${url}` },
    { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: t.nombreInicio, item: `${SITIO}${t.inicio}` },
      { '@type': 'ListItem', position: 2, name: comparar ? 'Comparar' : t.blog, item: `${SITIO}${comparar ? indiceComparar(a.lang) : t.base}` },
      { '@type': 'ListItem', position: 3, name: a.titulo, item: `${SITIO}${url}` }] },
  ];
  // Preguntas frecuentes del artículo (opcional, "faq": [[pregunta, respuesta], …]): las mismas que se ven en la página,
  // para que Google y los asistentes de IA citen la respuesta directa.
  if (a.faq && a.faq.length) extraLd.push({ '@type': 'FAQPage', mainEntity: a.faq.map(([q, r]) => ({ '@type': 'Question', name: q,
    acceptedAnswer: { '@type': 'Answer', text: r } })) });
  return cabeza({ t, titulo, desc: a.descripcion, url, img: imgDe(a), imgAlt: a.portada.alt || a.titulo, tipo: 'article', alternos, extraLd,
    publicado: a.fecha }) + `
  <main id="contenido" tabindex="-1" class="blog-articulo">
    <article class="wrap">
      <nav class="migas" aria-label="${t.migas}">
        <a href="${t.inicio}">${t.nombreInicio}</a> <span aria-hidden="true">›</span> <a href="${comparar ? indiceComparar(a.lang) : t.base}">${comparar ? 'Comparar' : t.blog}</a> <span aria-hidden="true">›</span> <span aria-current="page">${esc(a.categoria)}</span>
      </nav>
      <p class="eyebrow">${esc(a.categoria)}</p>
      <h1>${esc(a.titulo)}</h1>
      <p class="meta"><time datetime="${a.fecha}">${t.fecha(a.fecha)}</time>${a.actualizado && a.actualizado !== a.fecha ? ` · ${t.actualizado} <time datetime="${a.actualizado}">${t.fecha(a.actualizado)}</time>` : ''} · ${t.lectura(min)} · ${t.por}</p>
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

const indiceComparar = (lang) => `${IDIOMAS[lang].inicio}${esEspanol(lang) ? SECCION.es : SECCION.en}/`;
const delBlog = (todos) => todos.filter((a) => a.seccion !== 'comparar');

// Lo que sale en el índice de un idioma o mercado: los suyos y, en México y EE. UU., también los de español general.
const listaDe = (lang, todos) => {
  const propios = delBlog(todos).filter((a) => a.lang === lang);
  return IDIOMAS[lang].mercado ? [...propios, ...delBlog(todos).filter((a) => a.lang === 'es')] : propios;
};

const paginaIndice = (lang, todos) => {
  const t = IDIOMAS[lang];
  const lista = listaDe(lang, todos);
  const alternos = t.mercado
    ? [[t.html, t.base], ['es', IDIOMAS.es.base], ['x-default', IDIOMAS.es.base]]
    : [[hreflang(lang), t.base], [hreflang(lang === 'es' ? 'en' : 'es'), IDIOMAS[lang === 'es' ? 'en' : 'es'].base],
      ...(lang === 'es' ? Object.keys(IDIOMAS).filter((k) => IDIOMAS[k].mercado).map((k) => [IDIOMAS[k].html, IDIOMAS[k].base]) : []),
      ['x-default', IDIOMAS.es.base]];
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

// P-034 A9: el archivo de cada URL fija del mapa (/es-us/ → es-us/index.html, /privacidad → privacidad.html).
const archivoDeRuta = (ruta) => {
  const rel = ruta.replace(/^\//, '');
  for (const c of [path.join(rel, 'index.html'), `${rel}.html`, rel]) {
    const f = path.join(LANDING, c);
    if (c && fs.existsSync(f) && fs.statSync(f).isFile()) return f;
  }
  return null;
};

// Fecha del último cambio de un archivo según git (AAAA-MM-DD); null sin git (en el servidor el mapa ya viene hecho).
const ultimoCambio = (archivo) => {
  try {
    const out = require('node:child_process').execFileSync('git', ['log', '-1', '--format=%cs', '--', archivo],
      { cwd: RAIZ, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(out) ? out : null;
  } catch (e) {
    return null;
  }
};

// Las URL que no son del blog llevan <lastmod> con la fecha de su archivo (si git la sabe; si no, se deja la que tenía).
const lastmodFijos = (xml) => xml.replace(/  <url><loc>(https:\/\/novaworkorder\.com)([^<]*)<\/loc>(?:<lastmod>([^<]*)<\/lastmod>)?<\/url>/g,
  (todo, sitio, ruta, antes) => {
    const archivo = archivoDeRuta(ruta || '/');
    const fecha = (archivo && ultimoCambio(archivo)) || antes;
    return fecha ? `  <url><loc>${sitio}${ruta}</loc><lastmod>${fecha}</lastmod></url>` : todo;
  });

// P-034 A8: índice de comparaciones de un idioma o mercado (solo si tiene alguna)
const paginaComparar = (lang, todos) => {
  const t = IDIOMAS[lang];
  const lista = todos.filter((a) => a.seccion === 'comparar' && a.lang === lang);
  const url = indiceComparar(lang);
  const titulo = esEspanol(lang) ? 'Compara NOVAWORKORDER con otros programas' : 'Compare NOVAWORKORDER';
  const desc = esEspanol(lang) ? 'Comparaciones honestas de NOVAWORKORDER con otros programas de órdenes de servicio: precios, qué incluye cada uno y para quién es mejor.'
    : 'Honest comparisons of NOVAWORKORDER with other field service tools.';
  const extraLd = [{ '@type': 'CollectionPage', '@id': `${SITIO}${url}#pagina`, name: titulo, url: `${SITIO}${url}`, inLanguage: t.html,
    dateModified: lista.map((a) => a.actualizado || a.fecha).sort().pop(), publisher: { '@id': `${SITIO}/#org` } }];
  return cabeza({ t, titulo: `${titulo} | NOVAWORKORDER`, desc, url, img: imgDe(lista[0]), imgAlt: lista[0].portada.alt || lista[0].titulo,
    tipo: 'website', alternos: [[hreflang(lang), url]], extraLd }) + `
  <main id="contenido" tabindex="-1" class="blog-indice">
    <div class="wrap">
      <div class="center">
        <p class="eyebrow">${esEspanol(lang) ? 'Comparar' : 'Compare'}</p>
        <h1>${esc(titulo)}</h1>
        <p class="lead">${esc(desc)}</p>
      </div>
      <ul class="tarjetas">${lista.map((a) => tarjeta(a, t)).join('')}
      </ul>
${cta(t)}
    </div>
  </main>
` + pie(t);
};

const sitemap = (todos) => {
  const f = path.join(LANDING, 'sitemap.xml');
  const xml = lastmodFijos(fs.readFileSync(f, 'utf8').replace(/  <!-- blog[^>]*-->\n[\s\S]*?  <!-- \/blog -->\n/, ''));
  const ultima = (lista) => lista.map((a) => a.actualizado || a.fecha).sort().pop();
  const urls = [];
  for (const lang of Object.keys(IDIOMAS)) {
    const lista = listaDe(lang, todos);
    if (lista.length) urls.push(`  <url><loc>${SITIO}${IDIOMAS[lang].base}</loc><lastmod>${ultima(lista)}</lastmod></url>`);
    for (const a of delBlog(todos).filter((x) => x.lang === lang)) urls.push(`  <url><loc>${SITIO}${urlDe(a)}</loc><lastmod>${a.actualizado || a.fecha}</lastmod></url>`);
    const comp = todos.filter((a) => a.seccion === 'comparar' && a.lang === lang);
    if (comp.length && esEspanol(lang)) {          // /en/compare/ es a mano y ya está en el mapa
      urls.push(`  <url><loc>${SITIO}${indiceComparar(lang)}</loc><lastmod>${ultima(comp)}</lastmod></url>`);
      for (const a of comp) urls.push(`  <url><loc>${SITIO}${urlDe(a)}</loc><lastmod>${a.actualizado || a.fecha}</lastmod></url>`);
    }
  }
  const bloque = `  <!-- blog: lo escribe src/scripts/blog.js -->\n${urls.join('\n')}\n  <!-- /blog -->\n`;
  fs.writeFileSync(f, xml.replace('</urlset>', `${bloque}</urlset>`));
};

const construir = () => {
  const todos = articulos();
  for (const a of todos) escribir(path.join(urlDe(a), 'index.html'), paginaArticulo(a, todos));
  for (const lang of Object.keys(IDIOMAS)) {
    if (listaDe(lang, todos).length) escribir(path.join(IDIOMAS[lang].base, 'index.html'), paginaIndice(lang, todos));
    if (esEspanol(lang) && todos.some((a) => a.seccion === 'comparar' && a.lang === lang)) {
      escribir(path.join(indiceComparar(lang), 'index.html'), paginaComparar(lang, todos));
    }
  }
  sitemap(todos);
  return todos;
};

if (require.main === module) {
  for (const a of construir()) console.log(`${urlDe(a)}  ${palabras(a.cuerpo)} palabras`);
}

module.exports = { articulos, palabras, parrafos, urlDe, imgDe, construir };
