/* Lógica del prototipo NOVA Premium Futurista. Todo pasa en el navegador: el carrito y los pedidos simulados se
   guardan en localStorage de quien lo abre. No hay llamadas de red, ni pagos, ni pedidos reales, ni formularios que
   envíen datos. */
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
  function esc(texto) {
    return String(texto).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }
  function parametro(nombre) { return new URLSearchParams(window.location.search).get(nombre); }
  function producto(id) { return DEMO.PRODUCTOS.filter(function (p) { return p.id === id; })[0] || null; }
  function categoria(id) { return DEMO.CATEGORIAS.filter(function (c) { return c.id === id; })[0] || null; }
  function descuento(p) { return p.precioAntes ? Math.round((1 - p.precio / p.precioAntes) * 100) : 0; }

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

  // ---------- piezas de interfaz ----------
  var ICONOS = {
    tecnologia: '<rect x="6" y="3" width="12" height="18" rx="2"/><path d="M11 18h2"/>',
    hogar: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>',
    moda: '<path d="M8 4l4 3 4-3 4 4-3 3v9H7v-9L4 8z"/>',
    belleza: '<rect x="8" y="9" width="8" height="12" rx="2"/><path d="M10 9V5h4v4"/>',
    deportes: '<path d="M4 10v4M20 10v4M7 7v10M17 7v10M7 12h10"/>',
    mascotas: '<circle cx="6" cy="10" r="2"/><circle cx="18" cy="10" r="2"/><circle cx="9" cy="5" r="2"/><circle cx="15" cy="5" r="2"/><path d="M8 18c0-3 2-5 4-5s4 2 4 5c0 2-8 2-8 0z"/>'
  };
  function icono(id) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (ICONOS[id] || '') + '</svg>';
  }

  function tarjeta(p) {
    var etiquetas = '';
    if (p.precioAntes) etiquetas += '<span class="etiqueta etiqueta-oferta">−' + descuento(p) + ' % ilustrativo</span>';
    if (p.nuevo) etiquetas += '<span class="etiqueta etiqueta-nuevo">Nuevo</span>';
    return '<article class="producto">' +
      '<div class="lienzo">' + ILUS.ilustracion(p) + (etiquetas ? '<div class="etiquetas">' + etiquetas + '</div>' : '') + '</div>' +
      '<div class="cuerpo">' +
        '<span class="marca-producto">' + esc(p.marca) + ' · marca ficticia</span>' +
        '<h3><a href="producto.html?id=' + p.id + '">' + esc(p.nombre) + '</a></h3>' +
        '<span class="nota">' + esc(categoria(p.categoria).nombre) + '</span>' +
        '<div class="precio"><strong>' + plata(p.precio) + '</strong>' + (p.precioAntes ? '<s aria-label="Antes ' + plata(p.precioAntes) + '">' + plata(p.precioAntes) + '</s>' : '') +
          '<span class="aviso">Precio ilustrativo, no es de venta</span></div>' +
        '<button type="button" class="boton boton-principal boton-chico" data-agregar="' + p.id + '">Agregar al carrito<span class="visual-oculto"> ' + esc(p.nombre) + '</span></button>' +
      '</div></article>';
  }

  function cuadriculaCategorias(grande) {
    return DEMO.CATEGORIAS.map(function (c) {
      var n = DEMO.PRODUCTOS.filter(function (p) { return p.categoria === c.id; }).length;
      return '<a class="categoria" href="tienda.html?categoria=' + c.id + '">' +
        '<span class="icono">' + icono(c.id) + '</span><strong>' + esc(c.nombre) + '</strong>' +
        (grande ? '<span>' + esc(c.descripcion) + '</span>' : '') +
        '<span>' + n + ' productos de demostración</span></a>';
    }).join('');
  }

  // ---------- páginas ----------
  var PAGINAS = {
    inicio: function () {
      $('#inicio-categorias').innerHTML = cuadriculaCategorias(false);
      var destacados = DEMO.PRODUCTOS.filter(function (p) { return p.nuevo; }).slice(0, 8);
      $('#inicio-destacados').innerHTML = destacados.map(tarjeta).join('');
    },

    tienda: function () {
      var buscar = $('#filtro-buscar');
      var cat = $('#filtro-categoria');
      var maximo = $('#filtro-precio');
      var maximoTexto = $('#filtro-precio-valor');
      var soloOfertas = $('#filtro-ofertas');
      var orden = $('#filtro-orden');
      var marcas = $('#filtro-marcas');

      cat.innerHTML = '<option value="">Todas</option>' + DEMO.CATEGORIAS.map(function (c) {
        return '<option value="' + c.id + '">' + esc(c.nombre) + '</option>';
      }).join('');
      marcas.innerHTML = '<legend>Marca (ficticia)</legend>' + DEMO.MARCAS.map(function (m) {
        return '<label><input type="checkbox" name="marca" value="' + esc(m) + '"> ' + esc(m) + '</label>';
      }).join('');
      var tope = Math.max.apply(null, DEMO.PRODUCTOS.map(function (p) { return p.precio; }));
      maximo.max = String(tope);
      maximo.value = String(tope);
      var pedida = parametro('categoria');
      if (pedida && categoria(pedida)) cat.value = pedida;
      if (parametro('ofertas') === '1') soloOfertas.checked = true;

      function pintar() {
        var texto = buscar.value.trim().toLowerCase();
        var elegidas = Array.prototype.slice.call(marcas.querySelectorAll('input:checked')).map(function (i) { return i.value; });
        var lim = Number(maximo.value);
        maximoTexto.textContent = plata(lim);
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
        $('#tienda-cuenta').textContent = lista.length + (lista.length === 1 ? ' producto de demostración' : ' productos de demostración');
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
      $('#categorias-lista').innerHTML = cuadriculaCategorias(true);
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
        '<div class="lienzo">' + ILUS.ilustracion(p) + '</div>' +
        '<div>' +
          '<span class="marca-producto nota">' + esc(p.marca) + ' · marca ficticia</span>' +
          '<h1>' + esc(p.nombre) + '</h1>' +
          '<p>' + esc(p.descripcion) + '</p>' +
          '<div class="precio"><strong>' + plata(p.precio) + '</strong>' + (p.precioAntes ? '<s>' + plata(p.precioAntes) + '</s> <span class="etiqueta etiqueta-oferta">−' + descuento(p) + ' % ilustrativo</span>' : '') +
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
            '<button type="button" class="boton boton-principal" id="ficha-agregar">Agregar al carrito simulado</button>' +
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
      function pintar() {
        var lineas = carrito();
        var lista = $('#carrito-lista');
        var total = lineas.reduce(function (s, l) { return s + producto(l.id).precio * l.cantidad; }, 0);
        $('#carrito-total').textContent = plata(total);
        $('#carrito-simular').disabled = !lineas.length;
        if (!lineas.length) {
          lista.innerHTML = '<p class="vacio">El carrito de demostración está vacío. <a href="tienda.html">Ver la tienda</a>.</p>';
          return;
        }
        lista.innerHTML = lineas.map(function (l) {
          var p = producto(l.id);
          return '<div class="fila">' +
            '<div class="miniatura">' + ILUS.ilustracion(p) + '</div>' +
            '<div><a href="producto.html?id=' + p.id + '"><strong>' + esc(p.nombre) + '</strong></a><br><span class="nota">' + esc(p.marca) + ' · ' + plata(p.precio) + ' c/u (ilustrativo)</span></div>' +
            '<div class="controles"><label class="visual-oculto" for="cant-' + p.id + '">Cantidad de ' + esc(p.nombre) + '</label>' +
              '<input class="campo" id="cant-' + p.id + '" type="number" min="1" max="10" value="' + l.cantidad + '" data-cantidad="' + p.id + '">' +
              '<button type="button" class="boton boton-secundario boton-chico" data-quitar="' + p.id + '">Quitar<span class="visual-oculto"> ' + esc(p.nombre) + '</span></button></div>' +
          '</div>';
        }).join('');
      }
      $('#carrito-lista').addEventListener('change', function (e) {
        var id = e.target.getAttribute('data-cantidad');
        if (!id) return;
        var n = Math.max(1, Math.min(10, parseInt(e.target.value, 10) || 1));
        guardarCarrito(carrito().map(function (l) { return l.id === id ? { id: id, cantidad: n } : l; }));
        pintar();
      });
      $('#carrito-lista').addEventListener('click', function (e) {
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
      function pintar() {
        var pedidos = leer(CLAVE_PEDIDOS, []);
        if (!Array.isArray(pedidos)) pedidos = [];
        var ejemplo = { numero: 'EJEMPLO-0001', fecha: null, ejemplo: true, total: 249800,
          lineas: [{ id: 'p03', cantidad: 1 }, { id: 'p17', cantidad: 2 }] };
        var todos = pedidos.concat([ejemplo]);
        $('#pedidos-lista').innerHTML = todos.map(function (o) {
          var lineas = (Array.isArray(o.lineas) ? o.lineas : []).filter(function (l) { return producto(l.id); });
          var fecha = o.fecha ? new Date(o.fecha).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : 'Pedido de ejemplo';
          return '<article class="pedido"><header><div><h2 class="visual-oculto">Pedido ' + esc(o.numero) + '</h2><strong>' + esc(o.numero) + '</strong> <span class="etiqueta sin-validar">Simulado</span><br>' +
            '<span class="nota">' + esc(fecha) + '</span></div><strong>' + plata(Number(o.total) || 0) + '</strong></header>' +
            '<ul>' + lineas.map(function (l) { return '<li>' + (parseInt(l.cantidad, 10) || 1) + ' × ' + esc(producto(l.id).nombre) + '</li>'; }).join('') + '</ul>' +
            '<ol class="pasos" aria-label="Estado simulado"><li class="hecho">Recibido (simulado)</li><li>Preparando</li><li>En camino</li><li>Entregado</li></ol>' +
            '<p class="nota">Este pedido no existe en ningún sistema: no se cobró ni se va a enviar.</p></article>';
        }).join('');
        $('#pedidos-borrar').disabled = !pedidos.length;
      }
      $('#pedidos-borrar').addEventListener('click', function () {
        guardar(CLAVE_PEDIDOS, []);
        pintar();
        avisar('Se borraron los pedidos simulados de este navegador');
      });
      pintar();
    }
  };

  // ---------- arranque ----------
  document.addEventListener('DOMContentLoaded', function () {
    // menú del celular
    var boton = $('#menu-boton');
    var menu = $('#menu');
    if (boton && menu) {
      boton.addEventListener('click', function () {
        var abierto = menu.classList.toggle('abierto');
        boton.setAttribute('aria-expanded', abierto ? 'true' : 'false');
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && menu.classList.contains('abierto')) {
          menu.classList.remove('abierto');
          boton.setAttribute('aria-expanded', 'false');
          boton.focus();
        }
      });
    }

    // cualquier botón «Agregar al carrito» de cualquier página
    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-agregar]');
      if (b) agregar(b.getAttribute('data-agregar'), 1);
    });

    pintarCuenta();
    var pagina = document.body.getAttribute('data-pagina');
    if (PAGINAS[pagina]) PAGINAS[pagina]();
  });

  window.NOVA_APP = { plata: plata, producto: producto, esc: esc, parametro: parametro };
})();
