/* Lógica del prototipo NOVA Premium Futurista. Todo pasa en el navegador: el carrito y los pedidos simulados se
   guardan en localStorage de quien lo abre. No hay llamadas de red, ni pagos, ni pedidos reales, ni formularios que
   envíen datos, ni cuentas ni inicio de sesión. */
(function () {
  'use strict';

  var DEMO = window.NOVA_DEMO;
  var ILUS = window.NOVA_ILUS;
  var CLAVE_CARRITO = 'nova-demo-carrito';
  var CLAVE_PEDIDOS = 'nova-demo-pedidos';

  // ---------- utilidades ----------
  var pesos = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
  function plata(n) { return pesos.format(n); }
  function $(sel, raiz) { return (raiz || document).querySelector(sel); }
  function todos(sel) { return document.querySelectorAll ? Array.prototype.slice.call(document.querySelectorAll(sel)) : []; }
  function esc(texto) {
    return String(texto).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }
  function parametro(nombre) { return new URLSearchParams(window.location.search).get(nombre); }
  function producto(id) { return DEMO.PRODUCTOS.filter(function (p) { return p.id === id; })[0] || null; }
  function categoria(id) { return DEMO.CATEGORIAS.filter(function (c) { return c.id === id; })[0] || null; }
  function descuento(p) { return p.precioAntes ? Math.round((1 - p.precio / p.precioAntes) * 100) : 0; }
  function quieto() { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }

  // localStorage puede fallar (ventana privada, almacenamiento bloqueado): el prototipo sigue andando sin guardar.
  function leer(clave, porDefecto) {
    try { var v = JSON.parse(window.localStorage.getItem(clave)); return v == null ? porDefecto : v; } catch (e) { return porDefecto; }
  }
  function guardar(clave, valor) {
    try { window.localStorage.setItem(clave, JSON.stringify(valor)); } catch (e) { /* sin almacenamiento: no se guarda */ }
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
  function carrito() {
    var lineas = leer(CLAVE_CARRITO, []);
    if (!Array.isArray(lineas)) return [];
    return lineas.filter(function (l) { return l && producto(l.id); })
      .map(function (l) { return { id: l.id, cantidad: Math.max(1, Math.min(10, parseInt(l.cantidad, 10) || 1)) }; });
  }
  function guardarCarrito(lineas) { guardar(CLAVE_CARRITO, lineas); pintarCuenta(); }
  function agregar(id, cantidad) {
    var lineas = carrito();
    var linea = lineas.filter(function (l) { return l.id === id; })[0];
    if (linea) linea.cantidad = Math.min(linea.cantidad + cantidad, 10);
    else lineas.push({ id: id, cantidad: Math.min(cantidad, 10) });
    guardarCarrito(lineas);
    avisar('Agregado al carrito de demostración: ' + producto(id).nombre);
  }
  function pintarCuenta() {
    var n = carrito().reduce(function (s, l) { return s + l.cantidad; }, 0);
    var cuenta = $('#carrito-cuenta');
    if (cuenta) cuenta.textContent = n;
    var etiqueta = $('#carrito-enlace');
    if (etiqueta) etiqueta.setAttribute('aria-label', 'Carrito simulado: ' + n + (n === 1 ? ' producto' : ' productos'));
  }

  // ---------- íconos (SVG de línea propios) ----------
  var ICONOS = {
    todas: '<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>',
    hogar: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h5v-6h4v6h5V9.5"/>',
    tecnologia: '<rect x="4" y="5" width="16" height="11" rx="1.5"/><path d="M2 19h20"/>',
    bienestar: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/><path d="M7 12h3l1-2 2 4 1-2h3"/>',
    deportes: '<path d="M3 10v4M21 10v4M6 7v10M18 7v10M6 12h12"/>',
    cafe: '<path d="M4 10h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M17 11h1.5a2.5 2.5 0 0 1 0 5H17"/><path d="M8 3.5c.8.8.8 2 0 2.8M11.5 3.5c.8.8.8 2 0 2.8"/>',
    oficina: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 12h18"/>',
    accesorios: '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/>',
    carrito: '<path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6"/><circle cx="10" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/>',
    mas: '<path d="M12 5v14M5 12h14"/>',
    menos: '<path d="M5 12h14"/>'
  };
  function icono(id) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (ICONOS[id] || '') + '</svg>';
  }

  // ---------- piezas de interfaz ----------
  function precioHtml(p) {
    return '<div class="precio"><strong>' + plata(p.precio) + '</strong>' +
      (p.precioAntes ? '<s><span class="visual-oculto">Antes </span>' + plata(p.precioAntes) + '</s>' : '') +
      '<span class="aviso">Precio ilustrativo</span></div>';
  }
  function botonAgregar(p) {
    return '<button type="button" class="boton-icono" data-agregar="' + p.id + '" aria-label="Agregar ' + esc(p.nombre) + ' al carrito">' + icono('carrito') + '</button>';
  }

  // Tarjeta vertical (tienda, ofertas, ficha). Toda la tarjeta lleva a la ficha; el botón queda encima.
  function tarjeta(p) {
    var etiquetas = '';
    if (p.precioAntes) etiquetas += '<span class="etiqueta etiqueta-oferta">−' + descuento(p) + ' % ilustrativo</span>';
    if (p.nuevo) etiquetas += '<span class="etiqueta etiqueta-nuevo">Nuevo</span>';
    return '<article class="producto">' +
      '<div class="lienzo">' + ILUS.ilustracion(p) + (etiquetas ? '<div class="etiquetas">' + etiquetas + '</div>' : '') + '</div>' +
      '<div class="cuerpo">' +
        '<span class="marca-producto">' + esc(p.marca) + ' · marca ficticia</span>' +
        '<h3><a href="producto.html?id=' + p.id + '">' + esc(p.nombre) + '</a></h3>' +
        '<p class="corta">' + esc(p.corta) + '</p>' +
        '<div class="pie-tarjeta">' + precioHtml(p) + botonAgregar(p) + '</div>' +
      '</div></article>';
  }

  // Tarjeta horizontal del carrusel del Inicio: imagen grande a la izquierda, como en el mockup.
  function tarjetaHorizontal(p) {
    return '<article class="producto-h">' +
      '<div class="lienzo">' + ILUS.ilustracion(p) + '</div>' +
      '<div class="cuerpo">' +
        '<h3><a href="producto.html?id=' + p.id + '">' + esc(p.nombre) + '</a></h3>' +
        '<span class="marca-producto">' + esc(p.marca) + ' · marca ficticia</span>' +
        '<p class="corta">' + esc(p.corta) + '</p>' +
        '<div class="pie-tarjeta">' + precioHtml(p) + botonAgregar(p) + '</div>' +
      '</div></article>';
  }

  // Fila de categorías del Inicio: «Todas» y las 7 del mockup, con ícono.
  // activa: el id de la categoría marcada (vacío = «Todas»). La marcada lleva aria-current.
  function filaCategorias(activa) {
    function chip(href, id, nombre, marcada) {
      return '<a class="chip-categoria' + (marcada ? ' activa" aria-current="true' : '') + '" href="' + href + '">' + icono(id) + '<span>' + esc(nombre) + '</span></a>';
    }
    return chip('tienda.html', 'todas', 'Todas', !activa) +
      DEMO.CATEGORIAS.map(function (c) { return chip('tienda.html?categoria=' + c.id, c.id, c.nombre, activa === c.id); }).join('');
  }

  // Página Categorías: tarjetas con la ilustración de un producto de la categoría.
  function cuadriculaCategorias() {
    return DEMO.CATEGORIAS.map(function (c) {
      var n = DEMO.PRODUCTOS.filter(function (p) { return p.categoria === c.id; }).length;
      var muestra = producto(c.muestra) || DEMO.PRODUCTOS.filter(function (p) { return p.categoria === c.id; })[0];
      return '<a class="categoria" href="tienda.html?categoria=' + c.id + '">' +
        '<span class="texto"><span class="icono">' + icono(c.id) + '</span><strong>' + esc(c.nombre) + '</strong>' +
        '<span>' + esc(c.descripcion) + '</span><span>' + n + ' productos de demostración</span></span>' +
        (muestra ? '<span class="lienzo">' + ILUS.ilustracion(muestra) + '</span>' : '') + '</a>';
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

  // ---------- páginas ----------
  var PAGINAS = {
    inicio: function () {
      $('#inicio-categorias').innerHTML = filaCategorias('');
      var destacados = DEMO.PRODUCTOS.filter(function (p) { return p.destacado; })
        .sort(function (a, b) { return a.destacado - b.destacado; }).slice(0, 8);
      $('#inicio-destacados').innerHTML = destacados.map(tarjetaHorizontal).join('');
      carrusel($('#inicio-destacados'), $('#carrusel-anterior'), $('#carrusel-siguiente'));
    },

    tienda: function () {
      var buscar = $('#filtro-buscar');
      var cat = $('#filtro-categoria');
      var maximo = $('#filtro-precio');
      var maximoTexto = $('#filtro-precio-valor');
      var soloOfertas = $('#filtro-ofertas');
      var orden = $('#filtro-orden');
      var marcas = $('#filtro-marcas');
      var botonFiltros = $('#filtros-boton');
      var anuncio = $('#tienda-anuncio');

      cat.innerHTML = '<option value="">Todas</option>' + DEMO.CATEGORIAS.map(function (c) {
        return '<option value="' + c.id + '">' + esc(c.nombre) + '</option>';
      }).join('');
      marcas.innerHTML = '<legend>Marca (ficticia)</legend>' + DEMO.MARCAS.map(function (m) {
        return '<label><input type="checkbox" name="marca" value="' + esc(m) + '"> ' + esc(m) + '</label>';
      }).join('');
      // El control va de 20.000 en pasos de 10.000: el tope se redondea hacia arriba para que el producto más caro
      // quepa (si no, el navegador lo baja al paso anterior y lo deja por fuera sin que nadie haya filtrado).
      var tope = Math.max.apply(null, DEMO.PRODUCTOS.map(function (p) { return p.precio; }));
      tope = 20000 + Math.ceil((tope - 20000) / 10000) * 10000;
      maximo.max = String(tope);
      maximo.value = String(tope);
      var pedida = parametro('categoria');
      if (pedida && categoria(pedida)) cat.value = pedida;
      var chips = $('#tienda-categorias');
      if (chips) chips.innerHTML = filaCategorias(categoria(pedida) ? pedida : '');
      if (parametro('ofertas') === '1') soloOfertas.checked = true;

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
      function pintar() {
        var texto = buscar.value.trim().toLowerCase();
        var elegidas = Array.prototype.slice.call(marcas.querySelectorAll('input:checked')).map(function (i) { return i.value; });
        var lim = Number(maximo.value);
        maximoTexto.textContent = plata(lim);
        maximo.setAttribute('aria-valuetext', plata(lim));
        var lista = DEMO.PRODUCTOS.filter(function (p) {
          return (!texto || (p.nombre + ' ' + p.marca).toLowerCase().indexOf(texto) !== -1) &&
            (!cat.value || p.categoria === cat.value) &&
            (!elegidas.length || elegidas.indexOf(p.marca) !== -1) &&
            p.precio <= lim && (!soloOfertas.checked || p.precioAntes);
        });
        var o = orden.value;
        lista.sort(function (a, b) {
          if (o === 'menor') return a.precio - b.precio;
          if (o === 'mayor') return b.precio - a.precio;
          if (o === 'nombre') return a.nombre.localeCompare(b.nombre, 'es');
          return 0;
        });
        var conteo = lista.length + (lista.length === 1 ? ' producto de demostración' : ' productos de demostración');
        $('#tienda-cuenta').textContent = conteo;
        // El lector de pantalla oye el conteo una vez, cuando la persona deja de mover los filtros.
        clearTimeout(esperaAnuncio);
        esperaAnuncio = setTimeout(function () { if (anuncio) anuncio.textContent = conteo; }, 400);
        var activos = (cat.value ? 1 : 0) + elegidas.length + (lim < tope ? 1 : 0) + (soloOfertas.checked ? 1 : 0);
        if (botonFiltros) botonFiltros.textContent = activos ? 'Filtros (' + activos + ')' : 'Filtros';
        $('#tienda-resultados').innerHTML = lista.length ? lista.map(tarjeta).join('') :
          '<p class="vacio">No hay productos de demostración con esos filtros.</p>';
      }
      [buscar, cat, maximo, soloOfertas, orden].forEach(function (el) { el.addEventListener('input', pintar); });
      marcas.addEventListener('change', pintar);
      $('#filtro-limpiar').addEventListener('click', function () {
        buscar.value = ''; cat.value = ''; maximo.value = String(tope); soloOfertas.checked = false; orden.value = 'destacados';
        Array.prototype.forEach.call(marcas.querySelectorAll('input'), function (i) { i.checked = false; });
        pintar();
        buscar.focus();
      });
      pintar();
    },

    categorias: function () {
      $('#categorias-lista').innerHTML = cuadriculaCategorias();
    },

    ofertas: function () {
      var lista = DEMO.PRODUCTOS.filter(function (p) { return p.precioAntes; })
        .sort(function (a, b) { return descuento(b) - descuento(a); });
      $('#ofertas-lista').innerHTML = lista.map(tarjeta).join('');
    },

    producto: function () {
      var p = producto(parametro('id')) || DEMO.PRODUCTOS[0];
      var c = categoria(p.categoria);
      document.title = p.nombre + ' · NOVA (prototipo)';
      $('#ficha').innerHTML =
        '<div class="lienzo" role="img" aria-label="Ilustración de demostración: ' + esc(p.nombre) + '">' + ILUS.ilustracion(p) + '</div>' +
        '<div>' +
          '<span class="marca-producto nota">' + esc(p.marca) + ' · marca ficticia</span>' +
          '<h1>' + esc(p.nombre) + '</h1>' +
          '<p>' + esc(p.descripcion) + '</p>' +
          '<div class="precio"><strong>' + plata(p.precio) + '</strong>' + (p.precioAntes ? '<s><span class="visual-oculto">Antes </span>' + plata(p.precioAntes) + '</s> <span class="etiqueta etiqueta-oferta">−' + descuento(p) + ' % ilustrativo</span>' : '') +
            '<span class="aviso">Precio ilustrativo: no es un precio de venta aprobado.</span></div>' +
          '<dl>' +
            '<dt>Categoría</dt><dd><a href="tienda.html?categoria=' + c.id + '">' + esc(c.nombre) + '</a></dd>' +
            '<dt>Disponibilidad</dt><dd><span class="etiqueta sin-validar">Sin validar</span> No hay inventario: es un producto de demostración.</dd>' +
            '<dt>Envío</dt><dd><span class="etiqueta sin-validar">Sin validar</span> Las condiciones de envío no están definidas.</dd>' +
            '<dt>Garantía</dt><dd><span class="etiqueta sin-validar">Sin validar</span> Dependerá de cada proveedor real; aquí no aplica.</dd>' +
          '</dl>' +
          '<div class="cantidad"><label for="ficha-cantidad">Cantidad</label>' +
            '<input class="campo" id="ficha-cantidad" type="number" min="1" max="10" value="1" inputmode="numeric"></div>' +
          '<div class="acciones">' +
            '<button type="button" class="boton boton-principal" id="ficha-agregar">' + icono('carrito') + 'Agregar al carrito simulado</button>' +
            '<a class="boton boton-secundario" href="gaby.html?producto=' + p.id + '">Preguntarle a Gaby IA (demo)</a>' +
          '</div>' +
        '</div>';
      $('#migas-actual').textContent = p.nombre;
      $('#ficha-agregar').addEventListener('click', function () {
        var n = Math.max(1, Math.min(10, parseInt($('#ficha-cantidad').value, 10) || 1));
        agregar(p.id, n);
      });
      var parecidos = DEMO.PRODUCTOS.filter(function (x) { return x.categoria === p.categoria && x.id !== p.id; }).slice(0, 4);
      $('#ficha-parecidos').innerHTML = parecidos.map(tarjeta).join('');
    },

    carrito: function () {
      function cambiar(id, n) {
        n = Math.max(1, Math.min(10, n));
        guardarCarrito(carrito().map(function (l) { return l.id === id ? { id: id, cantidad: n } : l; }));
        pintar();
      }
      function pintar() {
        var lineas = carrito();
        var lista = $('#carrito-lista');
        var total = lineas.reduce(function (s, l) { return s + producto(l.id).precio * l.cantidad; }, 0);
        $('#carrito-total').textContent = plata(total);
        $('#carrito-simular').disabled = !lineas.length;
        var falta = $('#carrito-falta');
        if (falta) falta.hidden = !!lineas.length;
        if (!lineas.length) {
          lista.innerHTML = '<p class="vacio">El carrito de demostración está vacío. <a href="tienda.html">Ver la tienda</a>.</p>';
          return;
        }
        lista.innerHTML = lineas.map(function (l) {
          var p = producto(l.id);
          return '<div class="fila">' +
            '<div class="miniatura">' + ILUS.ilustracion(p) + '</div>' +
            '<div><a href="producto.html?id=' + p.id + '"><strong>' + esc(p.nombre) + '</strong></a><br><span class="nota">' + esc(p.marca) + ' · ' + plata(p.precio) + ' c/u (ilustrativo)</span></div>' +
            '<div class="controles">' +
              '<div class="cantidad-control">' +
                '<button type="button" class="boton-icono boton-icono-suave" data-menos="' + p.id + '" aria-label="Uno menos de ' + esc(p.nombre) + '"' + (l.cantidad <= 1 ? ' disabled' : '') + '>' + icono('menos') + '</button>' +
                '<label class="cant-rotulo" for="cant-' + p.id + '">Cant.<span class="visual-oculto"> de ' + esc(p.nombre) + '</span></label>' +
                '<input class="campo" id="cant-' + p.id + '" type="number" min="1" max="10" value="' + l.cantidad + '" data-cantidad="' + p.id + '">' +
                '<button type="button" class="boton-icono boton-icono-suave" data-mas="' + p.id + '" aria-label="Uno más de ' + esc(p.nombre) + '"' + (l.cantidad >= 10 ? ' disabled' : '') + '>' + icono('mas') + '</button>' +
              '</div>' +
              '<button type="button" class="boton boton-secundario boton-chico" data-quitar="' + p.id + '">Quitar<span class="visual-oculto"> ' + esc(p.nombre) + '</span></button></div>' +
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
          var linea = carrito().filter(function (l) { return l.id === idc; })[0];
          if (linea) cambiar(idc, linea.cantidad + (mas ? 1 : -1));
          var campo = $('#cant-' + idc);
          if (campo) campo.focus();
          return;
        }
        var boton = e.target.closest('[data-quitar]');
        if (!boton) return;
        var id = boton.getAttribute('data-quitar');
        guardarCarrito(carrito().filter(function (l) { return l.id !== id; }));
        avisar('Producto quitado del carrito de demostración');
        pintar();
        $('#carrito-titulo').focus();
      });
      $('#carrito-simular').addEventListener('click', function () {
        var lineas = carrito();
        if (!lineas.length) return;
        var pedidos = leer(CLAVE_PEDIDOS, []);
        if (!Array.isArray(pedidos)) pedidos = [];
        var numero = 'DEMO-' + String(pedidos.length + 1).padStart(4, '0');
        pedidos.unshift({ numero: numero, fecha: new Date().toISOString(), lineas: lineas,
          total: lineas.reduce(function (s, l) { return s + producto(l.id).precio * l.cantidad; }, 0) });
        guardar(CLAVE_PEDIDOS, pedidos.slice(0, 20));
        guardarCarrito([]);
        pintar();
        var r = $('#carrito-resultado');
        r.innerHTML = 'Se creó el pedido <strong>simulado</strong> ' + numero + '. No se cobró nada, no se envió nada y nadie lo recibe. ' +
          '<a href="pedidos.html">Verlo en Mis pedidos</a>.';
        r.focus();
      });
      pintar();
    },

    pedidos: function () {
      function articulo(o) {
        var lineas = (Array.isArray(o.lineas) ? o.lineas : []).filter(function (l) { return producto(l.id); });
        var fecha = o.fecha ? new Date(o.fecha).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : 'Pedido de ejemplo';
        return '<article class="pedido"><header><div><h3 class="visual-oculto">Pedido ' + esc(o.numero) + '</h3><strong>' + esc(o.numero) + '</strong> <span class="etiqueta sin-validar">Simulado</span><br>' +
          '<span class="nota">' + esc(fecha) + '</span></div><strong>' + plata(Number(o.total) || 0) + '</strong></header>' +
          '<ul>' + lineas.map(function (l) { return '<li>' + (parseInt(l.cantidad, 10) || 1) + ' × ' + esc(producto(l.id).nombre) + '</li>'; }).join('') + '</ul>' +
          '<ol class="pasos" aria-label="Estado simulado"><li class="hecho">Recibido (simulado)</li><li>Preparando</li><li>En camino</li><li>Entregado</li></ol>' +
          '<p class="nota">Este pedido no existe en ningún sistema: no se cobró ni se va a enviar.</p></article>';
      }
      function pintar() {
        var pedidos = leer(CLAVE_PEDIDOS, []);
        if (!Array.isArray(pedidos)) pedidos = [];
        var ejemplo = { numero: 'EJEMPLO-0001', fecha: null, ejemplo: true, total: 229800,
          lineas: [{ id: 'p03', cantidad: 1 }, { id: 'p17', cantidad: 1 }] };
        var propios = pedidos.length ? pedidos.map(articulo).join('') :
          '<p class="vacio">Aún no tienes pedidos simulados. <a href="tienda.html">Ver la tienda</a> y simula una compra desde el carrito.</p>';
        $('#pedidos-lista').innerHTML = '<h2 class="subtitulo">Tus pedidos simulados</h2>' + propios +
          '<h2 class="subtitulo">Así se vería un pedido</h2>' + articulo(ejemplo);
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

    // Cuenta: la demostración no tiene cuentas ni inicio de sesión (no hay formulario ni campos).
    var cuenta = $('#cuenta-boton');
    if (cuenta) cuenta.addEventListener('click', function () { avisar('La demostración no tiene cuentas ni inicio de sesión.'); });

    // cualquier botón «Agregar al carrito» de cualquier página
    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-agregar]');
      if (b) agregar(b.getAttribute('data-agregar'), 1);
    });

    // dibujos grandes que van en el HTML como contenedores vacíos
    todos('[data-ilus="gaby"]').forEach(function (el, i) { el.innerHTML = ILUS.gaby('gb' + i); });
    todos('[data-ilus="portatil"]').forEach(function (el) { el.innerHTML = ILUS.portatil(); });

    pintarCuenta();
    var pagina = document.body.getAttribute('data-pagina');
    if (PAGINAS[pagina]) PAGINAS[pagina]();
    entradas();
  });

  window.NOVA_APP = { plata: plata, producto: producto, esc: esc, parametro: parametro, quieto: quieto };
})();
