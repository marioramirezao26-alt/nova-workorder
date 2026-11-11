/* Ilustraciones SVG propias del prototipo (no son fotos ni logos de nadie). Cada producto de demostración se dibuja
   con figuras simples y su tono de color. Se arman como texto y se insertan en la página; no se descarga nada. */
(function () {
  'use strict';

  var cuenta = 0;

  function c(tono, sat, luz) { return 'hsl(' + tono + ' ' + sat + '% ' + luz + '%)'; }

  // Cada dibujo recibe el tono y devuelve las figuras (dentro de un lienzo de 200 × 160).
  var DIBUJOS = {
    audifonos: function (t) {
      return '<path d="M60 92 a40 40 0 0 1 80 0" fill="none" stroke="' + c(t, 70, 62) + '" stroke-width="9" stroke-linecap="round"/>' +
        '<rect x="46" y="86" width="24" height="38" rx="10" fill="' + c(t, 75, 55) + '"/>' +
        '<rect x="130" y="86" width="24" height="38" rx="10" fill="' + c(t, 75, 55) + '"/>' +
        '<rect x="52" y="94" width="12" height="22" rx="5" fill="' + c(t, 60, 80) + '" opacity=".5"/>';
    },
    reloj: function (t) {
      return '<rect x="86" y="22" width="28" height="116" rx="10" fill="' + c(t, 40, 35) + '"/>' +
        '<circle cx="100" cy="80" r="34" fill="' + c(t, 30, 14) + '" stroke="' + c(t, 75, 62) + '" stroke-width="5"/>' +
        '<path d="M100 80 L100 60 M100 80 L114 88" stroke="' + c(t, 90, 75) + '" stroke-width="4" stroke-linecap="round"/>' +
        '<circle cx="100" cy="80" r="4" fill="' + c(t, 90, 75) + '"/>';
    },
    parlante: function (t) {
      return '<rect x="58" y="40" width="84" height="88" rx="22" fill="' + c(t, 55, 42) + '"/>' +
        '<circle cx="100" cy="90" r="24" fill="' + c(t, 40, 20) + '" stroke="' + c(t, 75, 65) + '" stroke-width="4"/>' +
        '<circle cx="100" cy="90" r="8" fill="' + c(t, 75, 65) + '"/>' +
        '<circle cx="100" cy="56" r="6" fill="' + c(t, 75, 65) + '"/>';
    },
    celular: function (t) {
      return '<rect x="70" y="18" width="60" height="124" rx="12" fill="' + c(t, 30, 18) + '" stroke="' + c(t, 70, 60) + '" stroke-width="4"/>' +
        '<rect x="77" y="30" width="46" height="96" rx="6" fill="' + c(t, 75, 45) + '" opacity=".75"/>' +
        '<path d="M77 100 L123 60 L123 126 L77 126 Z" fill="' + c(t + 40, 80, 60) + '" opacity=".45"/>' +
        '<rect x="92" y="132" width="16" height="3" rx="1.5" fill="' + c(t, 60, 70) + '"/>';
    },
    lampara: function (t) {
      return '<path d="M80 136 h40" stroke="' + c(t, 30, 55) + '" stroke-width="8" stroke-linecap="round"/>' +
        '<path d="M100 134 L84 84 L120 48" fill="none" stroke="' + c(t, 25, 60) + '" stroke-width="6" stroke-linecap="round"/>' +
        '<path d="M108 34 L146 52 L132 72 Z" fill="' + c(t, 85, 58) + '"/>' +
        '<path d="M136 66 L160 110 L112 96 Z" fill="' + c(t, 95, 70) + '" opacity=".25"/>';
    },
    taza: function (t) {
      return '<rect x="66" y="46" width="62" height="84" rx="12" fill="' + c(t, 60, 45) + '"/>' +
        '<path d="M128 64 h10 a12 12 0 0 1 0 36 h-10" fill="none" stroke="' + c(t, 60, 45) + '" stroke-width="8"/>' +
        '<rect x="62" y="38" width="70" height="14" rx="6" fill="' + c(t, 50, 70) + '"/>' +
        '<path d="M86 28 q6 -8 0 -14 M104 28 q6 -8 0 -14" stroke="' + c(t, 40, 75) + '" stroke-width="3" fill="none" stroke-linecap="round"/>';
    },
    planta: function (t) {
      return '<path d="M74 104 h52 l-8 34 h-36 Z" fill="' + c(t + 200, 45, 45) + '"/>' +
        '<path d="M100 104 C 96 70, 70 64, 60 44 C 84 46, 98 66, 100 104" fill="' + c(t, 55, 42) + '"/>' +
        '<path d="M100 104 C 104 64, 128 52, 142 36 C 140 64, 116 76, 100 104" fill="' + c(t, 60, 52) + '"/>' +
        '<path d="M100 104 C 100 76, 100 56, 100 30" stroke="' + c(t, 50, 35) + '" stroke-width="4" fill="none"/>';
    },
    tenis: function (t) {
      return '<path d="M40 112 C 44 86, 66 72, 84 70 L 104 86 C 120 92, 150 94, 162 108 L 162 120 L 40 120 Z" fill="' + c(t, 70, 55) + '"/>' +
        '<rect x="38" y="118" width="126" height="12" rx="6" fill="' + c(t, 25, 85) + '"/>' +
        '<path d="M86 80 l10 10 M96 76 l10 10 M106 82 l8 8" stroke="' + c(t, 30, 90) + '" stroke-width="3" stroke-linecap="round"/>';
    },
    morral: function (t) {
      return '<path d="M84 40 a16 16 0 0 1 32 0" fill="none" stroke="' + c(t, 40, 40) + '" stroke-width="6"/>' +
        '<rect x="62" y="40" width="76" height="100" rx="22" fill="' + c(t, 55, 45) + '"/>' +
        '<rect x="74" y="92" width="52" height="34" rx="10" fill="' + c(t, 55, 35) + '"/>' +
        '<path d="M80 92 h40" stroke="' + c(t, 70, 70) + '" stroke-width="3"/>';
    },
    gafas: function (t) {
      return '<rect x="40" y="68" width="52" height="38" rx="16" fill="' + c(t, 60, 30) + '" stroke="' + c(t, 70, 62) + '" stroke-width="5"/>' +
        '<rect x="108" y="68" width="52" height="38" rx="16" fill="' + c(t, 60, 30) + '" stroke="' + c(t, 70, 62) + '" stroke-width="5"/>' +
        '<path d="M92 82 q8 -8 16 0" stroke="' + c(t, 70, 62) + '" stroke-width="5" fill="none"/>' +
        '<path d="M50 78 l16 -6" stroke="' + c(t, 30, 90) + '" stroke-width="3" stroke-linecap="round" opacity=".6"/>';
    },
    frasco: function (t) {
      return '<rect x="64" y="64" width="72" height="70" rx="16" fill="' + c(t, 55, 65) + '"/>' +
        '<rect x="70" y="46" width="60" height="22" rx="8" fill="' + c(t, 40, 40) + '"/>' +
        '<rect x="78" y="88" width="44" height="22" rx="5" fill="' + c(t, 30, 92) + '" opacity=".8"/>';
    },
    perfume: function (t) {
      return '<rect x="92" y="30" width="16" height="20" rx="3" fill="' + c(t, 30, 70) + '"/>' +
        '<rect x="84" y="46" width="32" height="12" rx="3" fill="' + c(t, 40, 45) + '"/>' +
        '<path d="M66 70 Q100 52 134 70 L130 134 H70 Z" fill="' + c(t, 65, 58) + '" opacity=".9"/>' +
        '<path d="M80 80 Q90 74 100 76" stroke="' + c(t, 30, 92) + '" stroke-width="4" fill="none" stroke-linecap="round"/>';
    },
    botella: function (t) {
      return '<rect x="88" y="18" width="24" height="16" rx="4" fill="' + c(t, 40, 40) + '"/>' +
        '<path d="M84 34 h32 l6 18 v80 a10 10 0 0 1 -10 10 h-24 a10 10 0 0 1 -10 -10 v-80 Z" fill="' + c(t, 70, 55) + '"/>' +
        '<rect x="80" y="76" width="40" height="30" fill="' + c(t, 40, 85) + '" opacity=".55"/>';
    },
    pesas: function (t) {
      return '<rect x="56" y="76" width="88" height="10" rx="5" fill="' + c(t, 15, 70) + '"/>' +
        '<rect x="36" y="56" width="22" height="50" rx="6" fill="' + c(t, 60, 45) + '"/>' +
        '<rect x="142" y="56" width="22" height="50" rx="6" fill="' + c(t, 60, 45) + '"/>' +
        '<rect x="58" y="64" width="12" height="34" rx="4" fill="' + c(t, 60, 35) + '"/>' +
        '<rect x="130" y="64" width="12" height="34" rx="4" fill="' + c(t, 60, 35) + '"/>';
    },
    tapete: function (t) {
      return '<rect x="40" y="70" width="96" height="44" rx="6" fill="' + c(t, 55, 55) + '"/>' +
        '<circle cx="136" cy="92" r="24" fill="' + c(t, 55, 45) + '"/>' +
        '<circle cx="136" cy="92" r="12" fill="' + c(t, 55, 35) + '"/>' +
        '<path d="M48 84 h76 M48 100 h76" stroke="' + c(t, 40, 75) + '" stroke-width="2" opacity=".6"/>';
    },
    cama: function (t) {
      return '<ellipse cx="100" cy="106" rx="70" ry="30" fill="' + c(t, 55, 45) + '"/>' +
        '<ellipse cx="100" cy="100" rx="52" ry="18" fill="' + c(t, 45, 70) + '"/>' +
        '<path d="M84 96 q16 -18 32 0" fill="' + c(t, 20, 30) + '" opacity=".5"/>';
    },
    hueso: function (t) {
      return '<rect x="64" y="72" width="72" height="18" rx="9" fill="' + c(t, 70, 58) + '"/>' +
        '<circle cx="60" cy="70" r="14" fill="' + c(t, 70, 58) + '"/><circle cx="60" cy="92" r="14" fill="' + c(t, 70, 58) + '"/>' +
        '<circle cx="140" cy="70" r="14" fill="' + c(t, 70, 58) + '"/><circle cx="140" cy="92" r="14" fill="' + c(t, 70, 58) + '"/>';
    },
    comedero: function (t) {
      return '<rect x="34" y="104" width="132" height="22" rx="10" fill="' + c(t, 40, 35) + '"/>' +
        '<path d="M44 88 h48 l-6 20 h-36 Z" fill="' + c(t, 65, 58) + '"/>' +
        '<path d="M108 88 h48 l-6 20 h-36 Z" fill="' + c(t, 65, 58) + '"/>' +
        '<ellipse cx="68" cy="88" rx="24" ry="5" fill="' + c(t, 40, 25) + '"/><ellipse cx="132" cy="88" rx="24" ry="5" fill="' + c(t, 40, 25) + '"/>';
    }
  };

  // Devuelve el SVG del producto. Es decorativo: el nombre del producto ya está en el texto de la tarjeta.
  function ilustracion(producto) {
    cuenta += 1;
    var id = 'g' + cuenta;
    var t = producto.tono;
    var dibujo = DIBUJOS[producto.dibujo] || DIBUJOS.frasco;
    return '<svg class="ilus" viewBox="0 0 200 160" aria-hidden="true" focusable="false">' +
      '<defs><radialGradient id="' + id + '" cx="50%" cy="40%" r="70%">' +
      '<stop offset="0" stop-color="' + c(t, 70, 26) + '"/><stop offset="1" stop-color="' + c(t, 60, 8) + '"/></radialGradient></defs>' +
      '<rect width="200" height="160" fill="url(#' + id + ')"/>' +
      '<circle cx="100" cy="84" r="62" fill="' + c(t, 90, 60) + '" opacity=".08"/>' +
      dibujo(t) +
      '</svg>';
  }

  window.NOVA_ILUS = { ilustracion: ilustracion };
})();
