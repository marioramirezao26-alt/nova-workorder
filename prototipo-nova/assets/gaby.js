/* Gaby Spark — RESPUESTAS DE EJEMPLO. No es la Gaby real: no se conecta a ningún modelo ni servidor, no guarda lo que escribes y
   no promete nada. Responde con frases fijas, escritas a mano, según palabras clave de lo que escribes.
   Lo que diga de productos sale de la fuente de catálogo (assets/fuente-catalogo.js); ver LEEME.md. */
(function () {
  'use strict';

  var APP = window.NOVA_APP;
  var FUENTE = window.NOVA_FUENTE_CATALOGO;

  // Respuestas fijas. Cada una: palabras que la activan y el texto (sin compromisos comerciales).
  var RESPUESTAS = [
    { claves: ['eres ia', 'eres una ia', 'robot', 'humano', 'persona real', 'inteligencia artificial', 'eres un bot'],
      texto: 'Sí, Gaby es una asistente de inteligencia artificial. Y en esta página ni siquiera soy la Gaby real: contesto con respuestas de ejemplo escritas a mano.' },
    { claves: ['asesor', 'hablar con alguien', 'whatsapp', 'llamar', 'contacto'],
      texto: 'El WhatsApp de NOVA es 321 392 7697. Este prototipo no abre ningún chat ni envía nada.' },
    { claves: ['envio', 'envío', 'envios', 'envíos', 'domicilio', 'llega', 'entrega'],
      texto: 'Las condiciones de envío de NOVA todavía no están definidas, así que no te puedo prometer tiempos ni costos. En el prototipo no se envía nada.' },
    { claves: ['pago', 'pagar', 'tarjeta de credito', 'tarjeta débito', 'nequi', 'pse', 'contraentrega'],
      texto: 'En este prototipo no hay pagos: el pago está en pruebas y apagado, el carrito es simulado y no se cobra nada.' },
    { claves: ['devolucion', 'devolución', 'garantia', 'garantía', 'cambio', 'protegida', 'proteccion', 'protección'],
      texto: 'Todavía no hay una política aprobada de garantía ni de devoluciones, así que no te puedo prometer nada sobre eso.' },
    { claves: ['pedido', 'mis pedidos', 'rastrear', 'seguimiento'],
      texto: 'En «Mis pedidos» puedes ver los pedidos simulados que hayas creado desde el carrito. Ninguno existe de verdad.' },
    { claves: ['workorder', 'ordenes de trabajo', 'órdenes de trabajo', 'tecnicos', 'técnicos', 'iniciar sesion', 'iniciar sesión', 'login'],
      texto: 'Si tu empresa ya usa NOVA WORKORDER, entra por «WORKORDER» en el menú: ahí están los mismos accesos de siempre a Servicios y Pedidos.' },
    { claves: ['hola', 'buenas', 'buenos dias', 'buenos días', 'buenas tardes', 'hey'],
      texto: '¡Hola! Soy Gaby Spark, con respuestas de ejemplo. Pregúntame por una categoría del catálogo o por cómo funcionaría la tienda.' }
  ];

  var SUGERENCIAS = [
    '¿Qué hay en el catálogo?',
    '¿Cómo funcionan los envíos?',
    '¿Cómo pago?',
    '¿Eres una IA?',
    'Ya soy cliente de WORKORDER'
  ];

  function sinTildes(s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, ''); }

  // cat: la lectura general del catálogo (APP.cargar()). Si la pregunta nombra una categoría del catálogo o una palabra
  // que la fuente encuentra, muestra lo que la fuente trae. Nunca un producto ni un precio escrito aquí.
  function responder(pregunta, cat) {
    var p = sinTildes(pregunta.toLowerCase());
    for (var i = 0; i < RESPUESTAS.length; i++) {
      for (var j = 0; j < RESPUESTAS[i].claves.length; j++) {
        if (p.indexOf(sinTildes(RESPUESTAS[i].claves[j])) !== -1) return Promise.resolve({ texto: RESPUESTAS[i].texto });
      }
    }
    var categoria = APP.categorias(cat).filter(function (c) { return p.indexOf(sinTildes(c.nombre.toLowerCase())) !== -1; })[0];
    var pedido = { q: pregunta.slice(0, 80) || 'catálogo', channel: FUENTE.CANAL, limit: 3 };
    if (categoria) { pedido.q = 'catálogo'; pedido.category = categoria.llave; }
    return FUENTE.search(pedido).then(function (r) {
      if (r.query.generic && !categoria) {
        return { texto: 'Te puedo mostrar lo que hay en el catálogo de ejemplo. Dime una categoría: ' +
          APP.categorias(cat).map(function (c) { return c.nombre; }).join(', ') + '.' };
      }
      if (r.match === 'none') {
        return { texto: 'No encontré eso en el catálogo de ejemplo, y aquí solo tengo algunas respuestas escritas a mano. Prueba con una de las preguntas sugeridas.' };
      }
      var nombres = r.results.map(function (o) { return APP.nombre(o); }).join(', ');
      return { texto: 'En el catálogo de ejemplo encontré: ' + nombres + '. Son datos de ejemplo, no una oferta.',
        enlace: categoria ? { href: 'tienda.html?categoria=' + encodeURIComponent(categoria.llave), texto: 'Ver ' + categoria.nombre + ' en la tienda' } :
          { href: 'tienda.html', texto: 'Ver la tienda' } };
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var registro = document.getElementById('gaby-registro');
    var entrada = document.getElementById('gaby-entrada');
    var enviar = document.getElementById('gaby-enviar');
    var sugerencias = document.getElementById('gaby-sugerencias');
    if (!registro) return;

    function burbuja(quien, texto, enlace) {
      var b = document.createElement('p');
      b.className = 'burbuja ' + (quien === 'persona' ? 'burbuja-persona' : 'burbuja-gaby');
      var q = document.createElement('span');
      q.className = 'quien';
      q.textContent = quien === 'persona' ? 'Tú' : 'Gaby Spark (ejemplo)';
      b.appendChild(q);
      b.appendChild(document.createTextNode(texto));
      if (enlace) {
        b.appendChild(document.createTextNode(' '));
        var a = document.createElement('a');
        a.href = enlace.href;
        a.textContent = enlace.texto;
        b.appendChild(a);
      }
      registro.appendChild(b);
      registro.scrollTop = registro.scrollHeight;
    }

    // La mascota (figura grande y avatar del chat) cambia de estado con la conversación; solo es visual
    var vuelve = null;
    function estado(e) {
      ['gaby-figura', 'gaby-avatar'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.setAttribute('estado', e);
      });
    }

    var catalogo = APP.cargar();
    function preguntar(texto) {
      texto = texto.trim().slice(0, 200);
      if (!texto) return;
      burbuja('persona', texto);
      // pequeña pausa para que se sienta como una respuesta; sin pausa si la persona pidió menos movimiento
      var quieto = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      // Gaby Spark piensa mientras «llega» la respuesta, habla al mostrarla y vuelve a estar feliz
      estado('pensando');
      return catalogo.then(function (cat) { return responder(texto, cat); }).then(function (r) {
        setTimeout(function () {
          burbuja('gaby', r.texto, r.enlace);
          estado('hablando');
          clearTimeout(vuelve);
          vuelve = setTimeout(function () { estado('feliz'); }, quieto ? 0 : 1800);
        }, quieto ? 0 : 650);
      });
    }

    SUGERENCIAS.forEach(function (s) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip-sugerencia';
      b.textContent = s;
      b.addEventListener('click', function () { preguntar(s); });
      sugerencias.appendChild(b);
    });

    entrada.addEventListener('input', function () { clearTimeout(vuelve); estado(entrada.value ? 'escuchando' : 'feliz'); });
    enviar.addEventListener('click', function () { preguntar(entrada.value); entrada.value = ''; entrada.focus(); });
    entrada.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); preguntar(entrada.value); entrada.value = ''; }
    });

    var pedida = APP.parametro('oferta');
    var saludo = '¡Hola! Soy Gaby Spark, con respuestas de ejemplo. Escribe una pregunta o toca una sugerencia.';
    if (!pedida) { burbuja('gaby', saludo); return; }
    FUENTE.item(pedida, { channel: FUENTE.CANAL }).then(function (r) {
      var o = r.item;
      burbuja('gaby', 'Veo que te interesa «' + APP.nombre(o) + '»' + (APP.conPrecio(o) ? ' (' + APP.plata(o.price.amount) + ', precio de ejemplo)' : ' (precio por confirmar)') +
        '. Disponibilidad: ' + APP.disponibilidad(o).texto.toLowerCase() + '. Son datos de ejemplo, no una oferta.',
        { href: 'producto.html?oferta=' + encodeURIComponent(o.offerId), texto: 'Volver a la ficha' });
    }, function () { burbuja('gaby', saludo); });
  });
})();
