/* NOVA Store — tienda en preparación (13-nov-2026).
   No hace NINGUNA llamada de red propia, no guarda datos y no vende. Todo producto sale de la fuente del catálogo, que
   hoy no tiene datos: el buscador y Gaby lo dicen tal cual. Gaby contesta con respuestas fijas escritas a mano, admite
   que es una IA y no promete productos, precios, disponibilidad, envíos ni fechas. */
(function () {
  'use strict';
  document.body.classList.remove('sin-js');

  // Aparecer al bajar (sin movimiento si la persona lo pidió así)
  var quieto = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var bloques = document.querySelectorAll('.seccion .envoltura > *');
  if (!quieto && 'IntersectionObserver' in window) {
    var mirador = new IntersectionObserver(function (vistas) {
      vistas.forEach(function (v) { if (v.isIntersecting) { v.target.classList.add('visto'); mirador.unobserve(v.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    bloques.forEach(function (b) { b.classList.add('aparece'); mirador.observe(b); });
  }

  var gaby = document.getElementById('gaby');
  var gabyPanel = document.getElementById('gaby-panel');
  function reaccionar(el, estado, ms) { if (el && typeof el.reaccionar === 'function') el.reaccionar(estado, ms); }

  // Catálogo: lo único que entra viene de la fuente del catálogo (fuente-catalogo.js, la misma del prototipo
  // nova/m07-prototipo-web, con la forma de catalog.search del contrato de comerce-ai por el canal web_store). Esta
  // página NO carga los datos ficticios del prototipo: mientras no exista la lectura del catálogo autorizado, la fuente
  // contesta vacío y se quedan los espacios «Por anunciar». Solo se muestran nombre, variante, categoría y marca: ni
  // precio, ni disponibilidad, ni carrito.
  var FUENTE = window.NOVA_FUENTE_CATALOGO;
  var CANAL = 'web_store';
  var catalogo = [];
  function elemento(etiqueta, clase, texto) {
    var el = document.createElement(etiqueta);
    if (clase) el.className = clase;
    if (texto) el.textContent = texto;
    return el;
  }
  function tarjeta(o) {
    var li = elemento('li', 'producto');
    li.appendChild(elemento('span', 'foto'));
    li.appendChild(elemento('span', 'producto-marca', o.brand && o.brand.displayName));
    li.appendChild(elemento('h3', 'producto-nombre', o.title + (o.variantName && o.variantName !== 'Única' ? ' · ' + o.variantName : '')));
    li.appendChild(elemento('span', 'producto-categoria', o.category));
    return li;
  }
  function pintarProductos(lista) {
    var ul = document.getElementById('lista-productos');
    ul.textContent = '';
    ul.removeAttribute('aria-hidden');
    lista.slice(0, 8).forEach(function (o) { ul.appendChild(tarjeta(o)); });
    document.getElementById('vitrina-aviso').hidden = true;
  }
  function pintarUnicos(id, clase, valores) {
    var ul = document.getElementById(id);
    ul.textContent = '';
    ul.setAttribute('aria-label', ul.getAttribute('aria-label').replace(' por anunciar', ''));
    valores.forEach(function (v) {
      var li = elemento('li', clase);
      li.appendChild(elemento('span', null, v));
      ul.appendChild(li);
    });
  }
  function unicos(lista, campo) {
    var vistos = {};
    return lista.map(campo).filter(function (v) { if (!v || vistos[v]) return false; vistos[v] = true; return true; })
      .sort(function (a, b) { return a.localeCompare(b, 'es'); });
  }
  if (FUENTE && !FUENTE.deEjemplo) {
    FUENTE.search({ q: 'catalogo', channel: CANAL, limit: 50 }).then(function (r) {
      catalogo = r.results || [];
      if (!catalogo.length) return;
      pintarProductos(catalogo);
      pintarUnicos('lista-categorias', 'categoria', unicos(catalogo, function (o) { return o.category; }).slice(0, 6));
      pintarUnicos('lista-marcas', 'logo', unicos(catalogo, function (o) { return o.brand && o.brand.displayName; }).slice(0, 10));
    }).catch(function () { catalogo = []; });
  }

  // Buscador: busca en el catálogo autorizado. Si está vacío, lo dice: no se inventa ningún resultado.
  var buscador = document.getElementById('buscador');
  var aviso = document.getElementById('aviso-busqueda');
  buscador.addEventListener('submit', function (e) {
    e.preventDefault();
    var q = buscador.q.value.trim().slice(0, 80);
    reaccionar(gaby, 'pensando', 1400);
    if (!q) { aviso.textContent = 'Escribe qué buscas.'; return; }
    if (!catalogo.length) {
      aviso.textContent = 'Todavía no hay productos publicados, así que no puedo buscar «' + q + '». El catálogo se está preparando.';
      return;
    }
    FUENTE.search({ q: q, channel: CANAL, limit: 8 }).then(function (r) {
      if (!r.results.length) { aviso.textContent = 'No encontré productos para «' + q + '».'; return; }
      aviso.textContent = r.results.length === 1 ? 'Encontré 1 producto.' : 'Encontré ' + r.results.length + ' productos.';
      pintarProductos(r.results);
      document.getElementById('productos').scrollIntoView({ behavior: quieto ? 'auto' : 'smooth' });
    }).catch(function () { aviso.textContent = 'No pude buscar «' + q + '». Inténtalo de nuevo.'; });
  });
  buscador.q.addEventListener('focus', function () { if (gaby) gaby.estado = 'escuchando'; });
  buscador.q.addEventListener('blur', function () { if (gaby) gaby.estado = 'feliz'; });

  // Panel de Gaby
  var RESPUESTAS = {
    comprar: 'Todavía no. NOVA Store se está preparando: por ahora no vendemos productos ni recibimos pagos.',
    productos: 'Los vamos a anunciar cuando cada producto y su información estén verificados. Antes de eso no te muestro productos, precios ni promociones.',
    cuando: 'Todavía no tenemos fecha. Cuando abramos, lo anunciamos en esta página.',
    persona: 'No, soy una inteligencia artificial. Te ayudo a buscar y comparar, y te digo cuándo algo lo tiene que confirmar una persona.'
  };
  var panel = document.getElementById('panel-gaby');
  var conversacion = document.getElementById('conversacion');
  var abridor = null;
  if (gabyPanel) gabyPanel.setAttribute('aria-hidden', 'true');

  function abrir(e) {
    abridor = e && e.currentTarget;
    panel.hidden = false;
    var primera = panel.querySelector('[data-pregunta]');
    if (primera) primera.focus();
    reaccionar(gabyPanel, 'sorprendida', 900);
  }
  function cerrar() {
    panel.hidden = true;
    if (abridor) abridor.focus();
  }
  function decir(clase, texto) {
    var p = document.createElement('p');
    p.className = clase;
    p.textContent = texto;
    conversacion.appendChild(p);
    conversacion.scrollTop = conversacion.scrollHeight;
  }

  document.querySelectorAll('.abre-gaby').forEach(function (b) { b.addEventListener('click', abrir); });
  panel.querySelector('.cerrar').addEventListener('click', cerrar);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) cerrar(); });
  panel.querySelectorAll('[data-pregunta]').forEach(function (b) {
    b.addEventListener('click', function () {
      decir('dice-visitante', b.textContent);
      if (gabyPanel) gabyPanel.estado = 'pensando';
      setTimeout(function () {
        decir('dice-gaby', RESPUESTAS[b.getAttribute('data-pregunta')]);
        if (gabyPanel) gabyPanel.estado = 'feliz';
      }, quieto ? 0 : 450);
    });
  });
})();
