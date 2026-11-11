/* Gaby Spark — DEMOSTRACIÓN. No es la Gaby real: no se conecta a ningún modelo ni servidor, no guarda lo que escribes y
   no promete nada. Responde con frases fijas, escritas a mano, según palabras clave de lo que escribes.
   La integración futura con NOVA Commerce AI está descrita en docs/integracion-commerce-ai.md. */
(function () {
  'use strict';

  var APP = window.NOVA_APP;
  var DEMO = window.NOVA_DEMO;

  // Respuestas fijas. Cada una: palabras que la activan y el texto (sin compromisos comerciales).
  var RESPUESTAS = [
    { claves: ['eres ia', 'eres una ia', 'robot', 'humano', 'persona real', 'inteligencia artificial', 'eres un bot'],
      texto: 'Sí, Gaby es una asistente de inteligencia artificial. Y en esta página ni siquiera soy la Gaby real: soy una demostración con respuestas escritas a mano.' },
    { claves: ['asesor', 'hablar con alguien', 'whatsapp', 'llamar', 'contacto'],
      texto: 'En la tienda real te podría pasar con una persona del equipo. En esta demostración no se abre ningún chat ni se envía nada.' },
    { claves: ['envio', 'envío', 'envios', 'envíos', 'domicilio', 'llega', 'entrega'],
      texto: 'Las condiciones de envío de NOVA todavía no están definidas, así que no te puedo prometer tiempos ni costos. En el prototipo no se envía nada.' },
    { claves: ['pago', 'pagar', 'tarjeta', 'nequi', 'pse', 'contraentrega'],
      texto: 'En este prototipo no hay pagos: el carrito es simulado y no se cobra nada. Los medios de pago de la tienda real están por definir.' },
    { claves: ['devolucion', 'devolución', 'garantia', 'garantía', 'cambio', 'protegida', 'proteccion', 'protección'],
      texto: 'La garantía y las devoluciones dependerán de cada producto y proveedor real. Aquí no aplica nada porque los productos son de demostración.' },
    { claves: ['pedido', 'mis pedidos', 'rastrear', 'seguimiento'],
      texto: 'En «Mis pedidos» puedes ver los pedidos simulados que hayas creado desde el carrito. Ninguno existe de verdad.' },
    { claves: ['workorder', 'ordenes de trabajo', 'órdenes de trabajo', 'tecnicos', 'técnicos', 'iniciar sesion', 'iniciar sesión', 'login'],
      texto: 'Si tu empresa ya usa NOVA WORKORDER, entra por «WORKORDER» en el menú: ahí están los mismos accesos de siempre a Servicios y Pedidos.' },
    { claves: ['oferta', 'descuento', 'promo', 'barato', 'rebaja'],
      texto: 'En «Ofertas» hay productos con precio tachado para que veas cómo se verían. Son descuentos ilustrativos, no promociones reales.' },
    { claves: ['regalo', 'recomienda', 'recomiendas', 'que compro', 'qué compro', 'busco', 'necesito'],
      texto: 'Te puedo mostrar ideas del catálogo de demostración. Por ejemplo, para alguien que entrena: la botella Ritmo, el tapete Calma o las mancuernas Forja. ¿Qué categoría te interesa?' },
    { claves: ['hola', 'buenas', 'buenos dias', 'buenos días', 'buenas tardes', 'hey'],
      texto: '¡Hola! Soy Gaby Spark, en versión de demostración. Pregúntame por productos, ofertas o cómo funcionaría la tienda.' }
  ];

  var SUGERENCIAS = [
    '¿Qué me recomiendas para regalar?',
    '¿Cómo funcionan los envíos?',
    '¿Cómo pago?',
    '¿Eres una IA?',
    'Ya soy cliente de WORKORDER'
  ];

  function sinTildes(s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, ''); }

  function responder(pregunta) {
    var p = sinTildes(pregunta.toLowerCase());
    // ¿Nombra una categoría? Muestra productos de esa categoría.
    var cat = DEMO.CATEGORIAS.filter(function (c) { return p.indexOf(sinTildes(c.nombre.toLowerCase())) !== -1; })[0];
    if (cat) {
      var ejemplos = DEMO.PRODUCTOS.filter(function (x) { return x.categoria === cat.id; }).slice(0, 3)
        .map(function (x) { return x.nombre; }).join(', ');
      return { texto: 'En ' + cat.nombre + ' el catálogo de demostración tiene, por ejemplo: ' + ejemplos + '. Los precios son ilustrativos.',
        enlace: { href: 'tienda.html?categoria=' + cat.id, texto: 'Ver ' + cat.nombre + ' en la tienda' } };
    }
    for (var i = 0; i < RESPUESTAS.length; i++) {
      for (var j = 0; j < RESPUESTAS[i].claves.length; j++) {
        if (p.indexOf(sinTildes(RESPUESTAS[i].claves[j])) !== -1) return { texto: RESPUESTAS[i].texto };
      }
    }
    return { texto: 'Esa no me la sé: en esta demostración solo tengo algunas respuestas escritas a mano. Prueba con una de las preguntas sugeridas.' };
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
      q.textContent = quien === 'persona' ? 'Tú' : 'Gaby Spark (demo)';
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

    function preguntar(texto) {
      texto = texto.trim().slice(0, 200);
      if (!texto) return;
      burbuja('persona', texto);
      var r = responder(texto);
      // pequeña pausa para que se sienta como una respuesta; sin pausa si la persona pidió menos movimiento
      // mientras «piensa», el halo de la figura de Gaby late (solo visual; con menos movimiento no se anima)
      var quieto = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      // Gaby Spark piensa mientras «llega» la respuesta, habla al mostrarla y vuelve a estar feliz
      estado('pensando');
      setTimeout(function () {
        burbuja('gaby', r.texto, r.enlace);
        estado('hablando');
        clearTimeout(vuelve);
        vuelve = setTimeout(function () { estado('feliz'); }, quieto ? 0 : 1800);
      }, quieto ? 0 : 650);
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

    var p = APP.producto(APP.parametro('producto'));
    if (p) {
      burbuja('gaby', 'Veo que te interesa «' + p.nombre + '» (' + APP.plata(p.precio) + ', precio ilustrativo). ' +
        'En la tienda real te contaría detalles del proveedor; aquí solo es una demostración.', { href: 'producto.html?id=' + p.id, texto: 'Volver a la ficha' });
    } else {
      burbuja('gaby', '¡Hola! Soy Gaby Spark, en versión de demostración. Escribe una pregunta o toca una sugerencia.');
    }
  });
})();
