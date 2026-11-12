/* Lógica del prototipo de la página de NOVA. Todo pasa en el navegador: el carrito y los pedidos simulados se guardan
   en localStorage de quien lo abre. No hay llamadas de red, ni pagos, ni pedidos reales, ni formularios que envíen
   datos, ni cuentas ni inicio de sesión.
   Aquí NO hay productos ni precios escritos a mano: todo se le pide a la fuente de catálogo (assets/fuente-catalogo.js),
   que hoy lee datos de ejemplo. El carrito guarda solo la referencia de la oferta y la cantidad; el precio se vuelve a
   leer de la fuente cada vez. */
(function () {
  'use strict';

  var FUENTE = window.NOVA_FUENTE_CATALOGO;
  var ILUS = window.NOVA_ILUS;
  var CANAL = FUENTE.CANAL;
  var CLAVE_CARRITO = 'nova-prototipo-carrito';
  var CLAVE_PEDIDOS = 'nova-prototipo-pedidos';
  var TOPE_LINEA = 10;

  // ---------- utilidades ----------
  var formatos = {};
  // dinero: { amountMinor, currency } como en el contrato (unidades menores: centavos).
  function plata(dinero) {
    if (!dinero) return '';
    var f = formatos[dinero.currency] || (formatos[dinero.currency] = new Intl.NumberFormat('es-CO', { style: 'currency', currency: dinero.currency, maximumFractionDigits: 0 }));
    return f.format(dinero.amountMinor / 100);
  }
  function $(sel, raiz) { return (raiz || document).querySelector(sel); }
  function todos(sel) { return document.querySelectorAll ? Array.prototype.slice.call(document.querySelectorAll(sel)) : []; }
  function esc(texto) {
    return String(texto).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }
  function parametro(nombre) { return new URLSearchParams(window.location.search).get(nombre); }
  function quieto() { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
  function fecha(iso) {
    if (!iso) return '';
    try { return new Date(iso).toLocaleDateString('es-CO', { dateStyle: 'long', timeZone: 'America/Bogota' }); } catch (e) { return ''; }
  }

  // localStorage puede fallar (ventana privada, almacenamiento bloqueado): el prototipo sigue andando sin guardar.
  function leer(clave, porDefecto) {
    try { var v = JSON.parse(window.localStorage.getItem(clave)); return v == null ? porDefecto : v; } catch (e) { return porDefecto; }
  }
  function guardar(clave, valor) {
    try { window.localStorage.setItem(clave, JSON.stringify(valor)); } catch (e) { /* sin almacenamiento: no se guarda */ }
  }

  // ---------- catálogo: siempre por la fuente ----------
  // Una lectura general del catálogo (catalog.search) para armar la página. Devuelve una promesa.
  var lectura = null;
  function cargar() {
    if (!lectura) {
      lectura = FUENTE.search({ q: 'catálogo', channel: CANAL, limit: 50 }).then(function (r) {
        var porId = {};
        r.results.forEach(function (o) { porId[o.offerId] = o; });
        return { lista: r.results, porId: porId, marca: r.brand.displayName, servidoEl: r.servedAt };
      });
    }
    return lectura;
  }
  // Las categorías salen de lo que trae el catálogo; no hay una lista aparte.
  function categorias(cat) {
    var vistas = {};
    var lista = [];
    cat.lista.forEach(function (o) {
      var llave = FUENTE.llaveCategoria(o.category);
      if (!llave) return;
      if (!vistas[llave]) { vistas[llave] = { llave: llave, nombre: o.category, cuantos: 0, muestra: o }; lista.push(vistas[llave]); }
      vistas[llave].cuantos += 1;
    });
    return lista.sort(function (a, b) { return a.nombre.localeCompare(b.nombre, 'es'); });
  }

  // Lo que la página puede decir de cada oferta. Nunca cantidades.
  var DISPONIBILIDAD = {
    can_say_available: { texto: 'Disponible', clase: 'estado-si' },
    can_say_unavailable: { texto: 'No disponible en este momento', clase: 'estado-no' },
    must_verify: { texto: 'Por confirmar', clase: 'estado-duda' }
  };
  function disponibilidad(o) { return DISPONIBILIDAD[o.availability && o.availability.claim] || DISPONIBILIDAD.must_verify; }
  function conPrecio(o) { return o.priceClaim === 'authorized' && !!o.price; }
  function sePuedeAgregar(o) { return conPrecio(o) && o.availability.claim === 'can_say_available'; }
  function nombre(o) { return o.title + (o.variantName && o.variantName !== 'Única' ? ' · ' + o.variantName : ''); }
  function enlaceFicha(o) { return 'producto.html?oferta=' + encodeURIComponent(o.offerId); }

  // El contrato todavía no trae imagen en la oferta. Mientras tanto la página pone un dibujo propio, genérico, escogido
  // por el nombre o la categoría. Es presentación: no es una foto del producto ni un dato del catálogo.
  var DIBUJOS = [['camiseta', 'camiseta'], ['chaqueta', 'chaqueta'], ['pantalon', 'pantalon'], ['media', 'medias'], ['tarjeta', 'tarjeta'],
    ['regalo', 'tarjeta'], ['termo', 'botella'], ['botella', 'botella'], ['vaso', 'vaso'], ['hilo', 'hilo'], ['cera', 'frasco']];
  function dibujo(o) {
    var texto = FUENTE.llaveCategoria(o.title + ' ' + o.category);
    var tipo = 'caja';
    for (var i = 0; i < DIBUJOS.length; i++) { if (texto.indexOf(DIBUJOS[i][0]) !== -1) { tipo = DIBUJOS[i][1]; break; } }
    var llave = FUENTE.llaveCategoria(o.category);
    var tono = 200;
    for (var j = 0; j < llave.length; j++) tono = (tono + llave.charCodeAt(j) * 23) % 360;
    return ILUS.ilustracion({ dibujo: tipo, tono: 170 + (tono % 150) });
  }

  // ---------- aviso flotante (anunciado por el lector de pantalla) ----------
  var temporizador;
  function avisar(texto) {
    var caja = $('#aviso');
    if (!caja) return;
    caja.textContent = texto;
    caja.classList.add('visible');
    clearTimeout(temporizador);
    temporizador = setTimeout(function () { caja.classList.remove('visible'); }, 2600);
  }

  // ---------- carrito simulado ----------
  // Guarda solo { id: referencia de la oferta, cantidad }. Lo que ya no está en el catálogo o no se puede pedir, se cae.
  function carrito(cat) {
    var lineas = leer(CLAVE_CARRITO, []);
    if (!Array.isArray(lineas)) return [];
    return lineas.filter(function (l) { return l && typeof l.id === 'string' && cat.porId[l.id] && sePuedeAgregar(cat.porId[l.id]); })
      .map(function (l) { return { id: l.id, cantidad: Math.max(1, Math.min(TOPE_LINEA, parseInt(l.cantidad, 10) || 1)) }; });
  }
  function totalDe(cat, lineas) {
    return lineas.reduce(function (s, l) { return s + cat.porId[l.id].price.amount.amountMinor * l.cantidad; }, 0);
  }
  function monedaDe(cat, lineas) { return lineas.length ? cat.porId[lineas[0].id].price.amount.currency : 'COP'; }
  function guardarCarrito(cat, lineas) { guardar(CLAVE_CARRITO, lineas); pintarCuenta(cat); }
  function agregar(cat, id, cantidad) {
    var o = cat.porId[id];
    if (!o || !sePuedeAgregar(o)) { avisar('Ese producto no se puede agregar ahora.'); return; }
    var lineas = carrito(cat);
    var linea = lineas.filter(function (l) { return l.id === id; })[0];
    if (linea) linea.cantidad = Math.min(linea.cantidad + cantidad, TOPE_LINEA);
    else lineas.push({ id: id, cantidad: Math.min(cantidad, TOPE_LINEA) });
    guardarCarrito(cat, lineas);
    avisar('Agregado al carrito simulado: ' + nombre(o));
  }
  function pintarCuenta(cat) {
    var n = carrito(cat).reduce(function (s, l) { return s + l.cantidad; }, 0);
    var cuenta = $('#carrito-cuenta');
    if (cuenta) cuenta.textContent = n;
    var etiqueta = $('#carrito-enlace');
    if (etiqueta) etiqueta.setAttribute('aria-label', 'Carrito simulado: ' + n + (n === 1 ? ' producto' : ' productos'));
  }

  // ---------- íconos (SVG de línea propios) ----------
  var ICONOS = {
    todas: '<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>',
    categoria: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.4"/>',
    carrito: '<path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6"/><circle cx="10" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/>',
    mas: '<path d="M12 5v14M5 12h14"/>',
    menos: '<path d="M5 12h14"/>'
  };
  function icono(id) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (ICONOS[id] || '') + '</svg>';
  }

  // ---------- piezas de interfaz ----------
  function estadoHtml(o) {
    var d = disponibilidad(o);
    return '<span class="estado ' + d.clase + '">' + d.texto + '</span>';
  }
  function precioHtml(o) {
    if (!conPrecio(o)) return '<div class="precio"><strong class="precio-pendiente">Precio por confirmar</strong></div>';
    return '<div class="precio"><strong>' + plata(o.price.amount) + '</strong>' +
      (o.price.taxIncluded === true ? '<span class="aviso">IVA incluido</span>' : '') + '</div>';
  }
  function botonAgregar(o) {
    if (!sePuedeAgregar(o)) return '';
    return '<button type="button" class="boton-icono" data-agregar="' + esc(o.offerId) + '" aria-label="Agregar ' + esc(nombre(o)) + ' al carrito simulado">' + icono('carrito') + '</button>';
  }

  // Tarjeta vertical (tienda, ficha). El título lleva a la ficha; el botón queda aparte.
  function tarjeta(o) {
    return '<article class="producto">' +
      '<div class="lienzo">' + dibujo(o) + '</div>' +
      '<div class="cuerpo">' +
        '<span class="marca-producto">' + esc(o.brand.displayName) + ' · ' + esc(o.category) + '</span>' +
        '<h3><a href="' + enlaceFicha(o) + '">' + esc(nombre(o)) + '</a></h3>' +
        '<p class="corta">' + esc(o.description) + '</p>' +
        '<p class="estado-fila">' + estadoHtml(o) + '</p>' +
        '<div class="pie-tarjeta">' + precioHtml(o) + botonAgregar(o) + '</div>' +
      '</div></article>';
  }

  // Tarjeta horizontal del carrusel del Inicio: imagen grande a la izquierda.
  function tarjetaHorizontal(o) {
    return '<article class="producto-h">' +
      '<div class="lienzo">' + dibujo(o) + '</div>' +
      '<div class="cuerpo">' +
        '<h3><a href="' + enlaceFicha(o) + '">' + esc(nombre(o)) + '</a></h3>' +
        '<span class="marca-producto">' + esc(o.brand.displayName) + ' · ' + esc(o.category) + '</span>' +
        '<p class="estado-fila">' + estadoHtml(o) + '</p>' +
        '<div class="pie-tarjeta">' + precioHtml(o) + botonAgregar(o) + '</div>' +
      '</div></article>';
  }

  // Fila de categorías: «Todas» y las que traiga el catálogo. La marcada lleva aria-current.
  function filaCategorias(cat, activa) {
    function chip(href, id, texto, marcada) {
      return '<a class="chip-categoria' + (marcada ? ' activa" aria-current="true' : '') + '" href="' + href + '">' + icono(id) + '<span>' + esc(texto) + '</span></a>';
    }
    return chip('tienda.html', 'todas', 'Todas', !activa) +
      categorias(cat).map(function (c) { return chip('tienda.html?categoria=' + encodeURIComponent(c.llave), 'categoria', c.nombre, activa === c.llave); }).join('');
  }

  // Página Categorías: una tarjeta por categoría del catálogo, con el dibujo de uno de sus productos.
  function cuadriculaCategorias(cat) {
    return categorias(cat).map(function (c) {
      return '<a class="categoria" href="tienda.html?categoria=' + encodeURIComponent(c.llave) + '">' +
        '<span class="texto"><span class="icono">' + icono('categoria') + '</span><strong>' + esc(c.nombre) + '</strong>' +
        '<span>' + c.cuantos + (c.cuantos === 1 ? ' producto de ejemplo' : ' productos de ejemplo') + '</span></span>' +
        '<span class="lienzo">' + dibujo(c.muestra) + '</span></a>';
    }).join('');
  }

  // ---------- carrusel (sin librerías, se maneja con las flechas, el teclado o deslizando) ----------
  function carrusel(pista, anterior, siguiente) {
    if (!pista || !anterior || !siguiente || typeof pista.scrollBy !== 'function') return;
    function estado() {
      var max = pista.scrollWidth - pista.clientWidth - 2;
      anterior.disabled = pista.scrollLeft <= 2;
      siguiente.disabled = pista.scrollLeft >= max;
    }
    function mover(dir) { pista.scrollBy({ left: dir * pista.clientWidth * 0.9, behavior: quieto() ? 'auto' : 'smooth' }); }
    anterior.addEventListener('click', function () { mover(-1); });
    siguiente.addEventListener('click', function () { mover(1); });
    pista.addEventListener('scroll', estado, { passive: true });
    pista.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); mover(1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); mover(-1); }
    });
    window.addEventListener('resize', estado);
    estado();
  }

  // ---------- páginas (cada una recibe la lectura general del catálogo) ----------
  var PAGINAS = {
    inicio: function (cat) {
      $('#inicio-categorias').innerHTML = filaCategorias(cat, '');
      $('#inicio-productos').innerHTML = cat.lista.filter(conPrecio).slice(0, 8).map(tarjetaHorizontal).join('');
      carrusel($('#inicio-productos'), $('#carrusel-anterior'), $('#carrusel-siguiente'));
    },

    tienda: function (cat) {
      var buscar = $('#filtro-buscar');
      var selCat = $('#filtro-categoria');
      var maximo = $('#filtro-precio');
      var maximoTexto = $('#filtro-precio-valor');
      var soloDisponibles = $('#filtro-disponibles');
      var orden = $('#filtro-orden');
      var botonFiltros = $('#filtros-boton');
      var anuncio = $('#tienda-anuncio');
      var lasCategorias = categorias(cat);
      function existe(llave) { return lasCategorias.some(function (c) { return c.llave === llave; }); }

      selCat.innerHTML = '<option value="">Todas</option>' + lasCategorias.map(function (c) {
        return '<option value="' + esc(c.llave) + '">' + esc(c.nombre) + '</option>';
      }).join('');
      // El tope del control sale del precio más alto que trae el catálogo, redondeado hacia arriba al paso.
      var moneda = 'COP';
      var paso = 500000; // en unidades menores: pasos de $5.000
      var tope = paso;
      cat.lista.filter(conPrecio).forEach(function (o) { tope = Math.max(tope, o.price.amount.amountMinor); moneda = o.price.amount.currency; });
      tope = Math.ceil(tope / paso) * paso;
      maximo.min = String(paso);
      maximo.step = String(paso);
      maximo.max = String(tope);
      maximo.value = String(tope);
      var pedida = parametro('categoria');
      if (pedida && existe(pedida)) selCat.value = pedida;
      var chips = $('#tienda-categorias');
      if (chips) chips.innerHTML = filaCategorias(cat, existe(pedida) ? pedida : '');
      var origen = $('#tienda-origen');
      if (origen) origen.textContent = 'Datos de ejemplo del ' + fecha(cat.servidoEl) + '.';

      // En el celular los filtros van plegados detrás del botón «Filtros (n)».
      if (botonFiltros) {
        botonFiltros.addEventListener('click', function () {
          var abierto = botonFiltros.getAttribute('aria-expanded') !== 'true';
          botonFiltros.setAttribute('aria-expanded', abierto ? 'true' : 'false');
          var caja = $('#filtros');
          if (caja) caja.classList.toggle('abierto');
        });
      }

      var esperaAnuncio;
      var turno = 0;
      function pintar() {
        var texto = buscar.value.trim().slice(0, 80);
        var lim = Number(maximo.value);
        maximoTexto.textContent = plata({ amountMinor: lim, currency: moneda });
        maximo.setAttribute('aria-valuetext', maximoTexto.textContent);
        // La búsqueda y el filtro de categoría los resuelve la fuente (catalog.search); aquí solo se ordena y se recorta por precio.
        var pedido = { q: texto || 'catálogo', channel: CANAL, limit: 50 };
        if (selCat.value) pedido.category = selCat.value;
        var mio = ++turno;
        return FUENTE.search(pedido).then(function (r) {
          if (mio !== turno) return;
          var lista = r.results.filter(function (o) {
            return (conPrecio(o) ? o.price.amount.amountMinor <= lim : lim >= tope) &&
              (!soloDisponibles.checked || o.availability.claim === 'can_say_available');
          });
          var como = orden.value;
          if (como !== 'catalogo') {
            lista.sort(function (a, b) {
              if (como === 'nombre') return nombre(a).localeCompare(nombre(b), 'es');
              if (conPrecio(a) !== conPrecio(b)) return conPrecio(a) ? -1 : 1; // sin precio, al final
              if (!conPrecio(a)) return 0;
              return (como === 'menor' ? 1 : -1) * (a.price.amount.amountMinor - b.price.amount.amountMinor);
            });
          }
          var conteo = lista.length + (lista.length === 1 ? ' producto de ejemplo' : ' productos de ejemplo');
          $('#tienda-cuenta').textContent = conteo;
          // El lector de pantalla oye el conteo una vez, cuando la persona deja de mover los filtros.
          clearTimeout(esperaAnuncio);
          esperaAnuncio = setTimeout(function () { if (anuncio) anuncio.textContent = conteo; }, 400);
          var activos = (selCat.value ? 1 : 0) + (lim < tope ? 1 : 0) + (soloDisponibles.checked ? 1 : 0);
          if (botonFiltros) botonFiltros.textContent = activos ? 'Filtros (' + activos + ')' : 'Filtros';
          $('#tienda-resultados').innerHTML = lista.length ? lista.map(tarjeta).join('') :
            '<p class="vacio">No hay productos de ejemplo con esa búsqueda o esos filtros.</p>';
        });
      }
      [buscar, selCat, maximo, soloDisponibles, orden].forEach(function (el) { el.addEventListener('input', pintar); });
      $('#filtro-limpiar').addEventListener('click', function () {
        buscar.value = ''; selCat.value = ''; maximo.value = String(tope); soloDisponibles.checked = false; orden.value = 'catalogo';
        pintar();
        buscar.focus();
      });
      return pintar();
    },

    categorias: function (cat) {
      $('#categorias-lista').innerHTML = cuadriculaCategorias(cat);
    },

    // La ficha se lee con catalog.item, por la referencia de la oferta que viene en la dirección.
    producto: function (cat) {
      return FUENTE.item(parametro('oferta') || '', { channel: CANAL }).then(function (r) {
        var o = r.item;
        var d = disponibilidad(o);
        var llave = FUENTE.llaveCategoria(o.category);
        document.title = nombre(o) + ' · NOVA (prototipo)';
        var precio = conPrecio(o) ?
          '<div class="precio"><strong>' + plata(o.price.amount) + '</strong>' +
            (o.price.taxIncluded === true ? '<span class="aviso">IVA incluido</span>' : '') +
            '<span class="aviso">Precio de ejemplo. No es una oferta.</span></div>' :
          '<div class="precio"><strong class="precio-pendiente">Precio por confirmar</strong><span class="aviso">Este producto todavía no tiene un precio autorizado.</span></div>';
        var compra = sePuedeAgregar(o) ?
          '<div class="cantidad"><label for="ficha-cantidad">Cantidad</label>' +
            '<input class="campo" id="ficha-cantidad" type="number" min="1" max="' + TOPE_LINEA + '" value="1" inputmode="numeric"></div>' +
          '<div class="acciones">' +
            '<button type="button" class="boton boton-principal" id="ficha-agregar">' + icono('carrito') + 'Agregar al carrito simulado</button>' +
            '<a class="boton boton-secundario" href="gaby.html?oferta=' + encodeURIComponent(o.offerId) + '">Preguntarle a Gaby Spark</a>' +
          '</div>' :
          '<p class="nota no-se-agrega">' + (conPrecio(o) ? 'Por ahora no se puede agregar al carrito: su disponibilidad es «' + d.texto.toLowerCase() + '».' :
            'Por ahora no se puede agregar al carrito: falta su precio autorizado.') + '</p>' +
          '<div class="acciones"><a class="boton boton-secundario" href="tienda.html">Ver otros productos</a></div>';
        $('#ficha').innerHTML =
          '<div class="lienzo" role="img" aria-label="Dibujo genérico de ejemplo, no es una foto del producto: ' + esc(nombre(o)) + '">' + dibujo(o) + '</div>' +
          '<div>' +
            '<span class="marca-producto nota">' + esc(o.brand.displayName) + '</span>' +
            '<h1>' + esc(nombre(o)) + '</h1>' +
            '<p>' + esc(o.description) + '</p>' +
            precio +
            '<dl>' +
              '<dt>Categoría</dt><dd><a href="tienda.html?categoria=' + encodeURIComponent(llave) + '">' + esc(o.category) + '</a></dd>' +
              '<dt>Disponibilidad</dt><dd>' + estadoHtml(o) + '</dd>' +
              (conPrecio(o) && o.price.validUntil ? '<dt>Precio vigente hasta</dt><dd>' + esc(fecha(o.price.validUntil)) + '</dd>' : '') +
              '<dt>Envío</dt><dd><span class="etiqueta sin-validar">Por definir</span> Las condiciones de envío no están definidas.</dd>' +
              '<dt>Garantía</dt><dd><span class="etiqueta sin-validar">Por definir</span> Todavía no hay una política aprobada.</dd>' +
            '</dl>' +
            compra +
          '</div>';
        $('#migas-actual').textContent = nombre(o);
        var boton = $('#ficha-agregar');
        if (boton && sePuedeAgregar(o)) {
          boton.addEventListener('click', function () {
            agregar(cat, o.offerId, Math.max(1, Math.min(TOPE_LINEA, parseInt($('#ficha-cantidad').value, 10) || 1)));
          });
        }
        return FUENTE.search({ q: 'catálogo', channel: CANAL, category: o.category, limit: 5 }).then(function (parecidos) {
          var otros = parecidos.results.filter(function (x) { return x.offerId !== o.offerId; }).slice(0, 4);
          $('#ficha-parecidos').innerHTML = otros.length ? otros.map(tarjeta).join('') :
            '<p class="vacio">No hay más productos de ejemplo en esta categoría.</p>';
        });
      }, function () {
        document.title = 'Producto no encontrado · NOVA (prototipo)';
        $('#ficha').innerHTML = '<div class="vacio"><h1>No encontramos ese producto</h1><p>Puede que ya no esté en el catálogo de ejemplo. <a href="tienda.html">Ver la tienda</a>.</p></div>';
        $('#ficha-parecidos').innerHTML = '';
      });
    },

    carrito: function (cat) {
      function cambiar(id, n) {
        n = Math.max(1, Math.min(TOPE_LINEA, n));
        guardarCarrito(cat, carrito(cat).map(function (l) { return l.id === id ? { id: id, cantidad: n } : l; }));
        pintar();
      }
      function pintar() {
        var lineas = carrito(cat);
        var lista = $('#carrito-lista');
        $('#carrito-total').textContent = plata({ amountMinor: totalDe(cat, lineas), currency: monedaDe(cat, lineas) });
        $('#carrito-simular').disabled = !lineas.length;
        $('#carrito-pagar').disabled = !lineas.length;
        var falta = $('#carrito-falta');
        if (falta) falta.hidden = !!lineas.length;
        if (!lineas.length) {
          lista.innerHTML = '<p class="vacio">El carrito simulado está vacío. <a href="tienda.html">Ver la tienda</a>.</p>';
          return;
        }
        lista.innerHTML = lineas.map(function (l, i) {
          var o = cat.porId[l.id];
          var n = esc(nombre(o));
          return '<div class="fila">' +
            '<div class="miniatura">' + dibujo(o) + '</div>' +
            '<div><a href="' + enlaceFicha(o) + '"><strong>' + n + '</strong></a><br><span class="nota">' + plata(o.price.amount) + ' c/u · precio de ejemplo</span></div>' +
            '<div class="controles">' +
              '<div class="cantidad-control">' +
                '<button type="button" class="boton-icono boton-icono-suave" data-menos="' + esc(o.offerId) + '" aria-label="Uno menos de ' + n + '"' + (l.cantidad <= 1 ? ' disabled' : '') + '>' + icono('menos') + '</button>' +
                '<label class="cant-rotulo" for="cant-' + i + '">Cant.<span class="visual-oculto"> de ' + n + '</span></label>' +
                '<input class="campo" id="cant-' + i + '" type="number" min="1" max="' + TOPE_LINEA + '" value="' + l.cantidad + '" data-cantidad="' + esc(o.offerId) + '">' +
                '<button type="button" class="boton-icono boton-icono-suave" data-mas="' + esc(o.offerId) + '" aria-label="Uno más de ' + n + '"' + (l.cantidad >= TOPE_LINEA ? ' disabled' : '') + '>' + icono('mas') + '</button>' +
              '</div>' +
              '<button type="button" class="boton boton-secundario boton-chico" data-quitar="' + esc(o.offerId) + '">Quitar<span class="visual-oculto"> ' + n + '</span></button></div>' +
          '</div>';
        }).join('');
      }
      $('#carrito-lista').addEventListener('change', function (e) {
        var id = e.target.getAttribute('data-cantidad');
        if (!id) return;
        cambiar(id, parseInt(e.target.value, 10) || 1);
      });
      $('#carrito-lista').addEventListener('click', function (e) {
        var menos = e.target.closest('[data-menos]');
        var mas = e.target.closest('[data-mas]');
        if (menos || mas) {
          var idc = (menos || mas).getAttribute(menos ? 'data-menos' : 'data-mas');
          var linea = carrito(cat).filter(function (l) { return l.id === idc; })[0];
          if (linea) cambiar(idc, linea.cantidad + (mas ? 1 : -1));
          var campo = $('[data-cantidad="' + idc + '"]');
          if (campo) campo.focus();
          return;
        }
        var boton = e.target.closest('[data-quitar]');
        if (!boton) return;
        var id = boton.getAttribute('data-quitar');
        guardarCarrito(cat, carrito(cat).filter(function (l) { return l.id !== id; }));
        avisar('Producto quitado del carrito simulado');
        pintar();
        $('#carrito-titulo').focus();
      });
      // Pagar no cobra ni llama a ninguna pasarela: solo dice que el pago está apagado.
      $('#carrito-pagar').addEventListener('click', function () {
        var r = $('#carrito-resultado');
        r.innerHTML = '<strong>Pago en pruebas, apagado.</strong> No se cobró nada y no se pidió ningún dato de pago.';
        r.focus();
      });
      $('#carrito-simular').addEventListener('click', function () {
        var lineas = carrito(cat);
        if (!lineas.length) return;
        var pedidos = leer(CLAVE_PEDIDOS, []);
        if (!Array.isArray(pedidos)) pedidos = [];
        var numero = 'SIMULADO-' + String(pedidos.length + 1).padStart(4, '0');
        // El pedido simulado guarda lo que la fuente decía en ese momento, como haría una cotización.
        pedidos.unshift({ numero: numero, fecha: new Date().toISOString(), moneda: monedaDe(cat, lineas), total: totalDe(cat, lineas),
          lineas: lineas.map(function (l) { return { id: l.id, nombre: nombre(cat.porId[l.id]), cantidad: l.cantidad }; }) });
        guardar(CLAVE_PEDIDOS, pedidos.slice(0, 20));
        guardarCarrito(cat, []);
        pintar();
        var r = $('#carrito-resultado');
        r.innerHTML = 'Se creó el pedido <strong>simulado</strong> ' + numero + '. No se cobró nada, no se envió nada y nadie lo recibe. ' +
          '<a href="pedidos.html">Verlo en Mis pedidos</a>.';
        r.focus();
      });
      pintar();
    },

    pedidos: function (cat) {
      function articulo(o) {
        var lineas = (Array.isArray(o.lineas) ? o.lineas : []).filter(function (l) { return l && typeof l.nombre === 'string'; });
        var cuando = o.fecha ? new Date(o.fecha).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : 'Pedido de ejemplo';
        var total = { amountMinor: Number(o.total) || 0, currency: /^[A-Z]{3}$/.test(o.moneda) ? o.moneda : 'COP' };
        return '<article class="pedido"><header><div><h3 class="visual-oculto">Pedido ' + esc(o.numero) + '</h3><strong>' + esc(o.numero) + '</strong> <span class="etiqueta sin-validar">Simulado</span><br>' +
          '<span class="nota">' + esc(cuando) + '</span></div><strong>' + plata(total) + '</strong></header>' +
          '<ul>' + lineas.map(function (l) { return '<li>' + (parseInt(l.cantidad, 10) || 1) + ' × ' + esc(l.nombre) + '</li>'; }).join('') + '</ul>' +
          '<ol class="pasos" aria-label="Estado simulado"><li class="hecho">Recibido (simulado)</li><li>Preparando</li><li>En camino</li><li>Entregado</li></ol>' +
          '<p class="nota">Este pedido no existe en ningún sistema: no se cobró ni se va a enviar.</p></article>';
      }
      // «Así se vería un pedido»: se arma con las dos primeras ofertas que se pueden pedir, con el precio que da la fuente.
      function ejemplo() {
        var lineas = cat.lista.filter(sePuedeAgregar).slice(0, 2).map(function (o) { return { id: o.offerId, cantidad: 1 }; });
        if (!lineas.length) return '';
        return '<h2 class="subtitulo">Así se vería un pedido</h2>' + articulo({ numero: 'EJEMPLO-0001', fecha: null, moneda: monedaDe(cat, lineas), total: totalDe(cat, lineas),
          lineas: lineas.map(function (l) { return { nombre: nombre(cat.porId[l.id]), cantidad: 1 }; }) });
      }
      function pintar() {
        var pedidos = leer(CLAVE_PEDIDOS, []);
        if (!Array.isArray(pedidos)) pedidos = [];
        pedidos = pedidos.filter(function (p) { return p && typeof p === 'object'; });
        var propios = pedidos.length ? pedidos.map(articulo).join('') :
          '<p class="vacio">Aún no tienes pedidos simulados. <a href="tienda.html">Ver la tienda</a> y crea uno desde el carrito.</p>';
        $('#pedidos-lista').innerHTML = '<h2 class="subtitulo">Tus pedidos simulados</h2>' + propios + ejemplo();
        $('#pedidos-borrar').hidden = !pedidos.length;
      }
      $('#pedidos-borrar').addEventListener('click', function () {
        guardar(CLAVE_PEDIDOS, []);
        pintar();
        avisar('Se borraron los pedidos simulados de este navegador');
        $('#pedidos-titulo').focus();
      });
      pintar();
    }
  };

  // ---------- menú del celular ----------
  function menuMovil() {
    var boton = $('#menu-boton');
    var menu = $('#menu');
    if (!boton || !menu) return;
    function poner(abierto) {
      menu.classList[abierto ? 'add' : 'remove']('abierto');
      boton.setAttribute('aria-expanded', abierto ? 'true' : 'false');
      boton.setAttribute('aria-label', abierto ? 'Cerrar el menú' : 'Abrir el menú');
    }
    boton.addEventListener('click', function () { poner(!menu.classList.contains('abierto')); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.classList.contains('abierto')) { poner(false); boton.focus(); }
    });
    // Se cierra al tocar afuera y cuando el foco sale del menú (así el Tab no queda en algo tapado).
    document.addEventListener('click', function (e) {
      if (!menu.classList.contains('abierto') || !menu.contains) return;
      if (!menu.contains(e.target) && !boton.contains(e.target)) poner(false);
    });
    menu.addEventListener('focusout', function (e) {
      var destino = e.relatedTarget;
      if (destino && !menu.contains(destino) && destino !== boton) poner(false);
    });
  }

  // ---------- entrada suave de secciones (solo si no se pidió menos movimiento) ----------
  function entradas() {
    if (quieto() || !window.IntersectionObserver || !document.documentElement) return;
    var piezas = todos('.aparece');
    if (!piezas.length) return;
    document.documentElement.classList.add('con-entradas');
    var mirador = new window.IntersectionObserver(function (vistas) {
      vistas.forEach(function (v) { if (v.isIntersecting) { v.target.classList.add('visible'); mirador.unobserve(v.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    piezas.forEach(function (p) { mirador.observe(p); });
  }

  // ---------- arranque ----------
  document.addEventListener('DOMContentLoaded', function () {
    menuMovil();

    // Cuenta: el prototipo no tiene cuentas ni inicio de sesión (no hay formulario ni campos).
    var cuenta = $('#cuenta-boton');
    if (cuenta) cuenta.addEventListener('click', function () { avisar('El prototipo no tiene cuentas ni inicio de sesión.'); });

    // dibujos grandes que van en el HTML como contenedores vacíos
    todos('[data-ilus="portatil"]').forEach(function (el) { el.innerHTML = ILUS.portatil(); });
    entradas();

    listo = cargar().then(function (cat) {
      // cualquier botón «Agregar al carrito» de cualquier página
      document.addEventListener('click', function (e) {
        var b = e.target.closest('[data-agregar]');
        if (b) agregar(cat, b.getAttribute('data-agregar'), 1);
      });
      pintarCuenta(cat);
      var pagina = document.body.getAttribute('data-pagina');
      return PAGINAS[pagina] ? PAGINAS[pagina](cat) : null;
    });
  });

  // listo(): promesa que se cumple cuando la página terminó de pintar lo que viene del catálogo.
  var listo = null;
  window.NOVA_APP = { plata: plata, nombre: nombre, cargar: cargar, categorias: categorias, conPrecio: conPrecio, disponibilidad: disponibilidad,
    esc: esc, parametro: parametro, quieto: quieto, listo: function () { return listo; } };
})();
