// El enlace de prueba que GABY manda por el chat (WhatsApp, Instagram, Facebook o correo):
//   https://novaworkorder.com/?l=<ficha>&app=<servicios|pedidos>&t=<técnicos>#demo
// `l` es el código opaco de la ficha de esa persona en GABY (no dice nada de ella ni su número): viaja en el formulario
// para que su prueba quede en la misma ficha del chat. `app` deja elegida la app y `t` los técnicos (Pedidos se cobra por
// tienda, así que ahí no se usa). Lo que no tenga la forma esperada se ignora: el formulario funciona igual sin enlace.
// Se carga antes del script de la página (window.NovaEnlace) y las pruebas lo leen con require().
(function (root) {
  var LEAD = /^[A-Za-z0-9]{8,32}$/;
  var APPS = ['servicios', 'pedidos'];

  function valor(search, nombre) {
    var m = String(search || '').match(new RegExp('[?&]' + nombre + '=([^&#]*)'));
    if (!m) return '';
    try { return decodeURIComponent(m[1].replace(/\+/g, ' ')).trim(); } catch (e) { return ''; }
  }

  // { lead, app, size }: cada uno vacío (o null el tamaño) si no vino o no sirve.
  function leer(search) {
    var lead = valor(search, 'l');
    var app = valor(search, 'app').toLowerCase();
    var t = valor(search, 't');
    var size = /^\d{1,5}$/.test(t) ? parseInt(t, 10) : null;
    return {
      lead: LEAD.test(lead) ? lead : '',
      app: APPS.indexOf(app) >= 0 ? app : '',
      size: size && size >= 1 && size <= 10000 ? size : null,
    };
  }

  // El texto del botón de WhatsApp después de crear la prueba: con el código de la ficha, GABY la une a su ficha aunque
  // en el formulario no haya dejado su WhatsApp (sin enlace, el texto de siempre).
  function textoPrueba(nombreApp, lead) {
    return 'Hola, acabo de crear mi prueba gratis de NOVAWORKORDER ' + nombreApp + ' en la web'
      + (LEAD.test(String(lead || '')) ? ' (ref ' + lead + ').' : '.');
  }

  var api = { leer: leer, textoPrueba: textoPrueba, LEAD: LEAD };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NovaEnlace = api;
})(this);
