/* NOVA Enterprise — prelanzamiento. El registro de interés va al MISMO formulario de la página de ventas
   (/api/public/demo), como solicitud de información (kind «demo»): NO crea cuentas ni pruebas, no cobra nada y GABY la lee
   como un prospecto. Va con la campaña «prelanzamiento-nova» para distinguirla. Sin librerías ni nada de afuera. */
(function () {
  'use strict';
  document.body.classList.remove('sin-js');

  // Aparecer al bajar (respeta «reducir movimiento» desde el CSS).
  var piezas = document.querySelectorAll('.aparece');
  if ('IntersectionObserver' in window) {
    var mirar = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('visto'); mirar.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    piezas.forEach(function (p) { mirar.observe(p); });
  } else {
    piezas.forEach(function (p) { p.classList.add('visto'); });
  }

  // Gaby saluda cuando alguien empieza a llenar el formulario.
  var gaby = document.getElementById('gaby');
  var form = document.getElementById('interes');
  var msg = document.getElementById('mensaje');
  var enviar = document.getElementById('enviar');
  if (!form) return;
  form.addEventListener('focusin', function () { if (gaby && gaby.estado !== 'escuchando') gaby.estado = 'escuchando'; });

  // El servidor solo conoce dos apps (servicios y pedidos). «Agentes de IA» va como servicios, con el interés en el mensaje.
  var APP = { agentes: 'servicios', servicios: 'servicios', pedidos: 'pedidos' };
  var NOMBRE = { agentes: 'Agentes de IA (NOVA Enterprise)', servicios: 'Órdenes de trabajo (NOVA Workorder)', pedidos: 'Pedidos y tienda (NOVA Pedidos y Commerce)' };
  var CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function decir(clase, texto) { msg.className = 'mensaje ancho ' + clase; msg.textContent = texto; }
  function fallar(campo, texto) { decir('mal', texto); if (campo && campo.focus) campo.focus(); return false; }

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var f = form.elements;
    var interes = (form.querySelector('input[name="interes"]:checked') || {}).value || 'agentes';
    var empresa = f.company.value.trim(), nombre = f.name.value.trim(), correo = f.email.value.trim();
    if (empresa.length < 2) return fallar(f.company, 'Escribe el nombre de tu empresa o negocio.');
    if (nombre.length < 2) return fallar(f.name, 'Escribe tu nombre.');
    if (!CORREO.test(correo)) return fallar(f.email, 'Revisa tu correo: así te avisamos del lanzamiento.');
    if (!f.consent.checked) return fallar(f.consent, 'Para registrarte, acepta la política de privacidad.');

    var mensaje = '[Prelanzamiento NOVA Enterprise] Interés: ' + NOMBRE[interes] + '.';
    if (f.message.value.trim()) mensaje += ' ' + f.message.value.trim();
    var datos = {
      kind: 'demo', product: APP[interes], company: empresa, name: nombre, email: correo,
      phone: f.phone.value.trim(), message: mensaje.slice(0, 1000), website: f.website.value,
      campaign: 'prelanzamiento-nova', source: 'web'
    };
    enviar.disabled = true;
    decir('', 'Enviando…');
    fetch('/api/public/demo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (b) { return { ok: r.ok, b: b }; }); },
            function () { return { ok: false, b: {} }; })
      .then(function (res) {
        if (!res.ok) {
          var b = res.b || {};
          var texto = String((b.errors && b.errors[0] && b.errors[0].message) || b.message || 'No se pudo enviar.').trim();
          if (!/[.!?]$/.test(texto)) texto += '.';
          decir('mal', texto + ' Si sigue fallando, escríbenos a contacto@novaworkorder.com.');
          return;
        }
        form.reset();
        decir('bien', '¡Listo, ' + nombre.split(' ')[0] + '! Quedaste en la lista. Te escribimos a ' + correo + ' cuando abramos el acceso anticipado.');
        if (gaby && gaby.reaccionar) gaby.reaccionar('sorprendida', 1400);
      })
      .finally(function () { enviar.disabled = false; });
  });
})();
