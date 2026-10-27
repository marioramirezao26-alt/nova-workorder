// Recomendaciones de clientes reales al final de la página (es y en). Las lee de /api/public/reviews: solo las que NOVA
// aprobó, con nombre, cargo, empresa, ciudad, calificación, texto y mes. Si no hay ninguna (o la API no responde), la
// sección se queda oculta. El texto va tal como lo escribió el cliente (en /en/ también); solo cambian las etiquetas.
// Todo con textContent: lo escribió un cliente, nunca se interpreta como HTML.
(function () {
  var sec = document.getElementById('resenas');
  var list = document.getElementById('resenas-lista');
  if (!sec || !list || !window.fetch) return;
  var en = /^en/i.test(document.documentElement.lang || '');
  var L = en
    ? { stars: function (n) { return n + ' out of 5 stars'; }, locale: 'en-US' }
    : { stars: function (n) { return n + ' de 5 estrellas'; }, locale: 'es-CO' };
  var SVG = 'http://www.w3.org/2000/svg';

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }
  function star(on) {
    var svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('class', 'ico lleno' + (on ? '' : ' vacia'));
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    var use = document.createElementNS(SVG, 'use');
    use.setAttribute('href', '#i-estrella');
    svg.appendChild(use);
    return svg;
  }
  // «2026-10» → «octubre de 2026» / «October 2026» (el día 1 en UTC, para que no se corra de mes).
  function month(value) {
    var m = /^(\d{4})-(\d{2})$/.exec(String(value || ''));
    if (!m) return '';
    try {
      return new Date(Date.UTC(+m[1], +m[2] - 1, 1)).toLocaleDateString(L.locale, { month: 'long', year: 'numeric', timeZone: 'UTC' });
    } catch (e) { return ''; }
  }
  function initials(name) {
    return String(name).trim().split(/\s+/).slice(0, 2).map(function (w) { return w.charAt(0); }).join('').toUpperCase();
  }
  function valid(r) {
    return r && typeof r.name === 'string' && r.name.trim() && typeof r.text === 'string' && r.text.trim()
      && Number(r.rating) >= 1 && Number(r.rating) <= 5;
  }
  function card(r) {
    var rating = Math.round(Number(r.rating));
    var li = el('li');
    var fig = el('figure', 'resena');
    var stars = el('p', 'estrellas');
    stars.setAttribute('role', 'img');
    stars.setAttribute('aria-label', L.stars(rating));
    for (var i = 1; i <= 5; i += 1) stars.appendChild(star(i <= rating));
    var quote = el('blockquote');
    quote.appendChild(el('p', '', r.text.trim()));
    var cap = el('figcaption');
    var ini = el('span', 'inicial', initials(r.name));
    ini.setAttribute('aria-hidden', 'true');
    var who = el('span', 'autor');
    who.appendChild(el('b', '', r.name.trim()));
    var line = [r.role, r.company].filter(function (x) { return x && String(x).trim(); }).join(' · ');
    if (line) who.appendChild(el('span', '', line));
    var where = [r.city, month(r.month)].filter(Boolean).join(' · ');
    if (where) who.appendChild(el('span', '', where));
    cap.appendChild(ini);
    cap.appendChild(who);
    fig.appendChild(stars);
    fig.appendChild(quote);
    fig.appendChild(cap);
    li.appendChild(fig);
    return li;
  }

  fetch('/api/public/reviews', { headers: { Accept: 'application/json' } })
    .then(function (r) { return r.ok ? r.json() : { items: [] }; })
    .then(function (data) {
      var items = (data && Array.isArray(data.items) ? data.items : []).filter(valid).slice(0, 12);
      if (!items.length) return;                       // 0 reseñas aprobadas: la sección no se muestra
      list.textContent = '';
      items.forEach(function (r) { list.appendChild(card(r)); });
      var n = items.length;                             // 1: una columna · 2 y 4: dos · 3, 5 o más: tres
      list.setAttribute('data-n', n === 1 ? '1' : (n === 2 || n === 4) ? '2' : '3');
      sec.hidden = false;
    })
    .catch(function () { /* sin red o sin API: la sección sigue oculta */ });
})();
