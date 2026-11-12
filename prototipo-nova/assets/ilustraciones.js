/* Ilustraciones SVG propias del prototipo (no son fotos ni logos de nadie, y no copian ninguna imagen del mockup).
   - ilustracion(producto): un dibujo genérico por tipo de producto (no es una foto del producto), con volumen (degradados, brillo y sombra).
   - gaby(prefijo): la figura holográfica de Gaby IA (personaje estilizado, no una persona real).
   - portatil(): un portátil con un tablero genérico para la franja de WORKORDER (no es una captura del sistema real).
   Se arman como texto y se insertan en la página; no se descarga nada. Solo atributos de presentación (sin style=),
   para respetar la política de seguridad del prototipo. */
(function () {
  'use strict';

  var cuenta = 0;

  function c(tono, sat, luz) { return 'hsl(' + tono + ' ' + sat + '% ' + luz + '%)'; }

  // ---------- productos ----------
  // Cada dibujo recibe el tono y una función u(nombre) que devuelve el degradado de esa ilustración:
  //   u('c') cuerpo del color del producto, u('o') metal oscuro, u('m') mate claro, u('b') brillo, u('g') desenfoque.
  // El lienzo mide 200 × 160 y el objeto ocupa entre el 70 y el 80 %.
  var DIBUJOS = {
    audifonos: function (t, u) {
      return '<path d="M48 100 C46 34 154 34 152 100" fill="none" stroke="' + u('o') + '" stroke-width="13" stroke-linecap="round"/>' +
        '<path d="M60 74 C72 46 128 46 140 74" fill="none" stroke="' + c(t, 80, 75) + '" stroke-width="2.5" stroke-linecap="round" opacity=".55"/>' +
        '<rect x="40" y="84" width="10" height="22" rx="4" fill="' + c(t, 20, 45) + '"/><rect x="150" y="84" width="10" height="22" rx="4" fill="' + c(t, 20, 45) + '"/>' +
        '<ellipse cx="50" cy="112" rx="24" ry="33" fill="' + u('o') + '"/><ellipse cx="150" cy="112" rx="24" ry="33" fill="' + u('o') + '"/>' +
        '<ellipse cx="54" cy="112" rx="15" ry="24" fill="' + u('c') + '"/><ellipse cx="146" cy="112" rx="15" ry="24" fill="' + u('c') + '"/>' +
        '<ellipse cx="54" cy="112" rx="15" ry="24" fill="none" stroke="' + c(t, 90, 70) + '" stroke-width="1.5" opacity=".7"/>' +
        '<ellipse cx="146" cy="112" rx="15" ry="24" fill="none" stroke="' + c(t, 90, 70) + '" stroke-width="1.5" opacity=".7"/>' +
        '<path d="M36 96 C38 86 46 82 52 82" stroke="' + u('b') + '" stroke-width="4" fill="none" stroke-linecap="round"/>' +
        '<path d="M136 96 C138 86 146 82 152 82" stroke="' + u('b') + '" stroke-width="4" fill="none" stroke-linecap="round"/>';
    },
    reloj: function (t, u) {
      return '<path d="M80 14 h40 l-4 34 h-32 Z" fill="' + u('o') + '"/><path d="M84 112 h32 l4 34 h-40 Z" fill="' + u('o') + '"/>' +
        '<circle cx="100" cy="80" r="44" fill="' + u('o') + '"/>' +
        '<circle cx="100" cy="80" r="44" fill="none" stroke="' + c(t, 30, 70) + '" stroke-width="2" opacity=".6"/>' +
        '<rect x="143" y="72" width="6" height="16" rx="2" fill="' + c(t, 20, 55) + '"/>' +
        '<circle cx="100" cy="80" r="36" fill="#04060d"/>' +
        '<circle cx="100" cy="80" r="32" fill="none" stroke="' + c(t, 90, 62) + '" stroke-width="3" stroke-dasharray="120 81" stroke-linecap="round"/>' +
        '<text x="100" y="78" text-anchor="middle" font-size="22" font-weight="700" fill="#e8f6ff" font-family="system-ui, sans-serif">10</text>' +
        '<text x="100" y="100" text-anchor="middle" font-size="22" font-weight="700" fill="#e8f6ff" font-family="system-ui, sans-serif">08</text>' +
        '<path d="M70 56 A40 40 0 0 1 104 40" stroke="' + u('b') + '" stroke-width="4" fill="none" stroke-linecap="round"/>';
    },
    parlante: function (t, u) {
      return '<rect x="30" y="56" width="140" height="74" rx="37" fill="' + u('c') + '"/>' +
        '<rect x="40" y="64" width="120" height="58" rx="29" fill="' + u('o') + '" opacity=".75"/>' +
        '<circle cx="76" cy="93" r="18" fill="#04060d" stroke="' + c(t, 85, 65) + '" stroke-width="3"/><circle cx="124" cy="93" r="18" fill="#04060d" stroke="' + c(t, 85, 65) + '" stroke-width="3"/>' +
        '<circle cx="76" cy="93" r="6" fill="' + c(t, 85, 65) + '"/><circle cx="124" cy="93" r="6" fill="' + c(t, 85, 65) + '"/>' +
        '<rect x="88" y="46" width="24" height="12" rx="5" fill="' + u('o') + '"/>' +
        '<path d="M48 66 C60 58 120 56 150 64" stroke="' + u('b') + '" stroke-width="4" fill="none" stroke-linecap="round"/>';
    },
    celular: function (t, u) {
      return '<rect x="64" y="10" width="72" height="138" rx="15" fill="' + u('o') + '"/>' +
        '<rect x="64" y="10" width="72" height="138" rx="15" fill="none" stroke="' + c(t, 40, 65) + '" stroke-width="2"/>' +
        '<rect x="70" y="18" width="60" height="122" rx="10" fill="' + u('c') + '"/>' +
        '<circle cx="100" cy="24" r="2.5" fill="#04060d"/>' +
        '<path d="M70 104 L130 52 L130 140 L70 140 Z" fill="' + c(t + 50, 85, 62) + '" opacity=".4"/>' +
        '<path d="M76 30 L96 30 L76 70 Z" fill="' + u('b') + '"/>';
    },
    lampara: function (t, u) {
      return '<ellipse cx="66" cy="140" rx="38" ry="9" fill="' + u('o') + '"/>' +
        '<path d="M66 138 L90 80 L140 46" fill="none" stroke="' + u('o') + '" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<path d="M66 138 L90 80 L140 46" fill="none" stroke="' + c(t, 60, 70) + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity=".6"/>' +
        '<circle cx="90" cy="80" r="7" fill="' + u('c') + '"/>' +
        '<path d="M128 30 L178 54 L158 82 Z" fill="' + u('c') + '"/>' +
        '<path d="M160 76 L190 146 L112 126 Z" fill="' + c(t, 95, 72) + '" opacity=".22"/>' +
        '<ellipse cx="168" cy="70" rx="9" ry="5" fill="' + c(t, 100, 85) + '" filter="' + u('g') + '"/>';
    },
    taza: function (t, u) {
      return '<path d="M66 40 h68 l-7 98 a10 10 0 0 1 -10 9 h-34 a10 10 0 0 1 -10 -9 Z" fill="' + u('c') + '"/>' +
        '<rect x="60" y="26" width="80" height="20" rx="8" fill="' + u('o') + '"/>' +
        '<rect x="70" y="80" width="60" height="16" fill="' + c(t, 30, 92) + '" opacity=".35"/>' +
        '<path d="M80 52 L84 132" stroke="' + u('b') + '" stroke-width="7" stroke-linecap="round"/>' +
        '<path d="M88 18 q8 -8 0 -16 M108 18 q8 -8 0 -16" stroke="' + c(t, 30, 85) + '" stroke-width="3" fill="none" stroke-linecap="round" opacity=".7"/>';
    },
    planta: function (t, u) {
      return '<path d="M100 104 C92 64 58 58 42 30 C76 32 98 62 100 104" fill="' + u('c') + '"/>' +
        '<path d="M100 104 C106 58 136 44 160 24 C158 62 128 78 100 104" fill="' + u('c') + '"/>' +
        '<path d="M100 104 C84 84 56 88 36 76 C58 66 88 74 100 104" fill="' + c(t, 55, 32) + '"/>' +
        '<path d="M100 104 C118 84 146 88 166 80 C146 66 114 76 100 104" fill="' + c(t, 55, 38) + '"/>' +
        '<path d="M100 104 C100 74 100 50 100 22" stroke="' + c(t, 50, 30) + '" stroke-width="4" fill="none"/>' +
        '<path d="M62 100 h76 l-12 46 h-52 Z" fill="' + u('o') + '"/>' +
        '<path d="M72 106 L78 140" stroke="' + u('b') + '" stroke-width="5" stroke-linecap="round"/>';
    },
    tenis: function (t, u) {
      return '<path d="M18 112 C22 80 52 58 80 56 L104 78 C126 86 164 88 182 106 L182 122 L18 122 Z" fill="' + u('c') + '"/>' +
        '<path d="M80 56 L104 78 C92 82 76 80 62 70 Z" fill="' + c(t, 50, 30) + '" opacity=".6"/>' +
        '<rect x="14" y="118" width="172" height="18" rx="9" fill="' + u('m') + '"/>' +
        '<path d="M84 70 l12 10 M96 64 l12 10 M106 74 l10 8" stroke="' + c(t, 20, 92) + '" stroke-width="3" stroke-linecap="round"/>' +
        '<path d="M30 100 C40 80 60 66 78 64" stroke="' + u('b') + '" stroke-width="5" fill="none" stroke-linecap="round"/>' +
        '<path d="M130 112 h44" stroke="' + c(t, 90, 72) + '" stroke-width="3" stroke-linecap="round"/>';
    },
    morral: function (t, u) {
      return '<path d="M80 30 a20 20 0 0 1 40 0" fill="none" stroke="' + u('o') + '" stroke-width="7"/>' +
        '<rect x="50" y="26" width="100" height="122" rx="30" fill="' + u('c') + '"/>' +
        '<rect x="64" y="82" width="72" height="50" rx="14" fill="' + u('o') + '"/>' +
        '<path d="M70 82 h60" stroke="' + c(t, 70, 72) + '" stroke-width="3"/>' +
        '<rect x="94" y="88" width="12" height="8" rx="3" fill="' + c(t, 70, 72) + '"/>' +
        '<path d="M62 40 C58 60 58 80 60 100" stroke="' + u('b') + '" stroke-width="6" fill="none" stroke-linecap="round"/>';
    },
    gafas: function (t, u) {
      return '<rect x="18" y="56" width="74" height="54" rx="24" fill="' + u('o') + '"/>' +
        '<rect x="108" y="56" width="74" height="54" rx="24" fill="' + u('o') + '"/>' +
        '<rect x="18" y="56" width="74" height="54" rx="24" fill="none" stroke="' + u('c') + '" stroke-width="7"/>' +
        '<rect x="108" y="56" width="74" height="54" rx="24" fill="none" stroke="' + u('c') + '" stroke-width="7"/>' +
        '<path d="M92 76 q8 -10 16 0" stroke="' + u('c') + '" stroke-width="7" fill="none"/>' +
        '<path d="M32 70 L52 64 L36 96 Z" fill="' + u('b') + '"/><path d="M122 70 L142 64 L126 96 Z" fill="' + u('b') + '"/>';
    },
    frasco: function (t, u) {
      return '<rect x="44" y="66" width="112" height="76" rx="20" fill="' + u('c') + '"/>' +
        '<rect x="40" y="40" width="120" height="32" rx="12" fill="' + u('o') + '"/>' +
        '<rect x="64" y="88" width="72" height="30" rx="6" fill="' + c(t, 30, 94) + '" opacity=".85"/>' +
        '<path d="M74 103 h52" stroke="' + c(t, 50, 45) + '" stroke-width="3" stroke-linecap="round"/>' +
        '<path d="M54 78 L56 132" stroke="' + u('b') + '" stroke-width="7" stroke-linecap="round"/>';
    },
    botella: function (t, u) {
      return '<rect x="82" y="8" width="36" height="24" rx="6" fill="' + u('o') + '"/>' +
        '<path d="M76 30 h48 l10 22 v84 a12 12 0 0 1 -12 12 h-44 a12 12 0 0 1 -12 -12 v-84 Z" fill="' + u('c') + '"/>' +
        '<rect x="66" y="78" width="68" height="34" fill="' + c(t, 30, 92) + '" opacity=".4"/>' +
        '<path d="M80 56 L80 132" stroke="' + u('b') + '" stroke-width="7" stroke-linecap="round"/>';
    },
    pesas: function (t, u) {
      return '<rect x="34" y="74" width="132" height="14" rx="7" fill="' + u('m') + '"/>' +
        '<rect x="14" y="40" width="30" height="82" rx="9" fill="' + u('o') + '"/><rect x="156" y="40" width="30" height="82" rx="9" fill="' + u('o') + '"/>' +
        '<rect x="44" y="52" width="18" height="58" rx="6" fill="' + u('c') + '"/><rect x="138" y="52" width="18" height="58" rx="6" fill="' + u('c') + '"/>' +
        '<path d="M22 50 L22 110" stroke="' + u('b') + '" stroke-width="5" stroke-linecap="round"/><path d="M164 50 L164 110" stroke="' + u('b') + '" stroke-width="5" stroke-linecap="round"/>';
    },
    tapete: function (t, u) {
      return '<rect x="20" y="64" width="128" height="58" rx="10" fill="' + u('c') + '"/>' +
        '<circle cx="148" cy="93" r="31" fill="' + c(t, 55, 42) + '"/>' +
        '<circle cx="148" cy="93" r="21" fill="none" stroke="' + c(t, 55, 62) + '" stroke-width="3"/>' +
        '<circle cx="148" cy="93" r="10" fill="' + c(t, 55, 30) + '"/>' +
        '<rect x="70" y="60" width="12" height="66" rx="4" fill="' + u('o') + '"/>' +
        '<path d="M30 74 h100" stroke="' + u('b') + '" stroke-width="5" stroke-linecap="round"/>';
    },
    humidificador: function (t, u) {
      return '<ellipse cx="100" cy="134" rx="56" ry="10" fill="' + c(t, 95, 60) + '" opacity=".35" filter="' + u('g') + '"/>' +
        '<path d="M60 56 h80 v74 a12 12 0 0 1 -12 12 h-56 a12 12 0 0 1 -12 -12 Z" fill="' + u('m') + '"/>' +
        '<ellipse cx="100" cy="56" rx="40" ry="9" fill="#f5f8ff"/><ellipse cx="100" cy="56" rx="9" ry="3" fill="#7b88a6"/>' +
        '<rect x="60" y="124" width="80" height="7" fill="' + c(t, 95, 60) + '"/>' +
        '<rect x="60" y="124" width="80" height="7" fill="' + c(t, 95, 70) + '" filter="' + u('g') + '"/>' +
        '<rect x="98" y="80" width="4" height="22" rx="2" fill="' + c(t, 95, 60) + '"/>' +
        '<path d="M70 66 L70 120" stroke="#ffffff" stroke-width="6" stroke-linecap="round" opacity=".55"/>' +
        '<path d="M100 46 C92 34 108 26 98 12 M92 46 C84 36 96 30 90 20 M108 46 C116 36 104 28 112 18" stroke="#e8f4ff" stroke-width="6" fill="none" stroke-linecap="round" opacity=".45" filter="' + u('g') + '"/>';
    },
    cafe: function (t, u) {
      var granos = '';
      [[28, 142, -20], [40, 148, 30], [174, 146, 10], [160, 150, -30], [52, 150, 60]].forEach(function (g) {
        granos += '<g transform="translate(' + g[0] + ' ' + g[1] + ') rotate(' + g[2] + ')"><ellipse rx="6" ry="4" fill="#5a3320"/><path d="M-5 0 Q0 -2 5 0" stroke="#2a160c" stroke-width="1.2" fill="none"/></g>';
      });
      return '<path d="M32 36 L104 36 L112 142 L26 142 Z" fill="' + u('c') + '"/>' +
        '<path d="M32 24 h72 v14 h-72 Z" fill="' + u('o') + '"/>' +
        '<rect x="40" y="62" width="58" height="56" rx="5" fill="#f3e9d8"/>' +
        '<path d="M46 110 L62 86 L72 98 L80 88 L92 110 Z" fill="' + c(t, 55, 30) + '"/>' +
        '<text x="69" y="78" text-anchor="middle" font-size="11" font-weight="800" fill="' + c(t, 60, 25) + '" font-family="system-ui, sans-serif">TALVO</text>' +
        '<path d="M38 46 L34 134" stroke="' + u('b') + '" stroke-width="6" stroke-linecap="round"/>' +
        '<ellipse cx="146" cy="140" rx="38" ry="7" fill="' + u('o') + '"/>' +
        '<path d="M118 106 h54 l-5 24 a10 10 0 0 1 -10 8 h-24 a10 10 0 0 1 -10 -8 Z" fill="#f6f7fb"/>' +
        '<path d="M171 112 h6 a7 7 0 0 1 0 14 h-8" fill="none" stroke="#f6f7fb" stroke-width="4"/>' +
        '<ellipse cx="145" cy="106" rx="27" ry="5" fill="#3b1f12"/>' +
        '<path d="M136 96 C130 86 142 80 136 70 M152 96 C146 86 158 80 152 70" stroke="#e8f4ff" stroke-width="4" fill="none" stroke-linecap="round" opacity=".5" filter="' + u('g') + '"/>' +
        granos;
    },
    prensa: function (t, u) {
      return '<rect x="66" y="40" width="68" height="100" rx="8" fill="' + c(t, 40, 80) + '" opacity=".25"/>' +
        '<rect x="70" y="74" width="60" height="62" rx="5" fill="#3b1f12"/>' +
        '<rect x="62" y="34" width="76" height="12" rx="5" fill="' + u('o') + '"/>' +
        '<rect x="96" y="12" width="8" height="24" fill="' + u('o') + '"/><circle cx="100" cy="12" r="7" fill="' + u('c') + '"/>' +
        '<rect x="62" y="136" width="76" height="10" rx="4" fill="' + u('o') + '"/>' +
        '<path d="M134 52 h14 a10 10 0 0 1 10 10 v50 a10 10 0 0 1 -10 10 h-14" fill="none" stroke="' + u('o') + '" stroke-width="8"/>' +
        '<path d="M76 48 L76 132" stroke="' + u('b') + '" stroke-width="6" stroke-linecap="round"/>';
    },
    cuaderno: function (t, u) {
      return '<rect x="46" y="16" width="112" height="132" rx="10" fill="' + u('c') + '"/>' +
        '<rect x="46" y="16" width="18" height="132" rx="6" fill="' + u('o') + '"/>' +
        '<rect x="136" y="16" width="7" height="132" fill="' + u('o') + '"/>' +
        '<rect x="78" y="46" width="46" height="22" rx="4" fill="' + c(t, 30, 94) + '" opacity=".85"/>' +
        '<path d="M150 30 L176 136" stroke="' + u('m') + '" stroke-width="7" stroke-linecap="round"/>' +
        '<path d="M72 26 L72 138" stroke="' + u('b') + '" stroke-width="6" stroke-linecap="round"/>';
    },
    teclado: function (t, u) {
      var teclas = '';
      for (var f = 0; f < 4; f++) {
        for (var k = 0; k < 11; k++) teclas += '<rect x="' + (28 + k * 13.2) + '" y="' + (66 + f * 13) + '" width="10.5" height="10" rx="2.5" fill="' + u('m') + '"/>';
      }
      return '<rect x="18" y="56" width="164" height="68" rx="12" fill="' + u('o') + '"/>' +
        '<rect x="18" y="56" width="164" height="68" rx="12" fill="none" stroke="' + c(t, 60, 62) + '" stroke-width="2" opacity=".7"/>' +
        teclas +
        '<path d="M26 60 h148" stroke="' + u('b') + '" stroke-width="3" stroke-linecap="round"/>';
    },
    // Dibujos genéricos para el catálogo de ejemplo (ropa, hogar y otros). No representan un producto real.
    camiseta: function (t, u) {
      return '<path d="M72 22 L48 30 L18 56 L36 80 L56 66 V140 a6 6 0 0 0 6 6 h76 a6 6 0 0 0 6 -6 V66 L164 80 L182 56 L152 30 L128 22 a28 20 0 0 1 -56 0 Z" fill="' + u('c') + '"/>' +
        '<path d="M72 22 a28 20 0 0 0 56 0" fill="none" stroke="' + u('o') + '" stroke-width="6" stroke-linecap="round"/>' +
        '<path d="M66 74 L66 134" stroke="' + u('b') + '" stroke-width="7" stroke-linecap="round"/>';
    },
    chaqueta: function (t, u) {
      return '<path d="M70 20 L44 30 L16 62 L34 132 L54 126 V140 a6 6 0 0 0 6 6 h80 a6 6 0 0 0 6 -6 V126 L166 132 L184 62 L156 30 L130 20 L100 44 Z" fill="' + u('c') + '"/>' +
        '<path d="M70 20 L100 44 L130 20 L118 14 L100 30 L82 14 Z" fill="' + u('o') + '"/>' +
        '<path d="M100 44 V146" stroke="' + u('m') + '" stroke-width="4"/>' +
        '<rect x="66" y="98" width="24" height="6" rx="3" fill="' + u('o') + '"/><rect x="110" y="98" width="24" height="6" rx="3" fill="' + u('o') + '"/>' +
        '<path d="M62 60 L62 120" stroke="' + u('b') + '" stroke-width="6" stroke-linecap="round"/>';
    },
    pantalon: function (t, u) {
      return '<path d="M58 14 h84 l14 126 a6 6 0 0 1 -6 6 h-30 a6 6 0 0 1 -6 -5 L100 62 L86 141 a6 6 0 0 1 -6 5 h-30 a6 6 0 0 1 -6 -6 Z" fill="' + u('c') + '"/>' +
        '<rect x="58" y="14" width="84" height="14" rx="3" fill="' + u('o') + '"/>' +
        '<path d="M100 28 V58" stroke="' + u('o') + '" stroke-width="3"/>' +
        '<path d="M66 40 L58 132" stroke="' + u('b') + '" stroke-width="6" stroke-linecap="round"/>';
    },
    medias: function (t, u) {
      return '<path d="M52 16 h36 v70 l34 22 a16 16 0 0 1 -9 30 h-30 a31 31 0 0 1 -31 -31 Z" fill="' + u('c') + '" opacity=".75"/>' +
        '<path d="M92 22 h36 v66 l34 22 a16 16 0 0 1 -9 30 h-30 a31 31 0 0 1 -31 -31 Z" fill="' + u('c') + '"/>' +
        '<rect x="92" y="22" width="36" height="16" rx="4" fill="' + u('o') + '"/>' +
        '<path d="M100 46 L100 104" stroke="' + u('b') + '" stroke-width="6" stroke-linecap="round"/>';
    },
    tarjeta: function (t, u) {
      return '<rect x="26" y="34" width="148" height="96" rx="14" fill="' + u('c') + '"/>' +
        '<rect x="26" y="74" width="148" height="12" fill="' + u('m') + '"/>' +
        '<rect x="88" y="34" width="12" height="96" fill="' + u('m') + '"/>' +
        '<path d="M94 74 c-22 -26 -40 -6 -22 0 Z M94 74 c22 -26 40 -6 22 0 Z" fill="' + u('o') + '"/>' +
        '<path d="M38 46 L38 118" stroke="' + u('b') + '" stroke-width="6" stroke-linecap="round"/>';
    },
    vaso: function (t, u) {
      return '<path d="M58 22 h84 l-10 116 a8 8 0 0 1 -8 8 h-48 a8 8 0 0 1 -8 -8 Z" fill="' + u('c') + '" opacity=".55"/>' +
        '<path d="M63 74 h74 l-5 64 a8 8 0 0 1 -8 8 h-48 a8 8 0 0 1 -8 -8 Z" fill="' + u('c') + '"/>' +
        '<path d="M58 22 h84" stroke="' + u('m') + '" stroke-width="5" stroke-linecap="round"/>' +
        '<path d="M72 34 L78 130" stroke="' + u('b') + '" stroke-width="7" stroke-linecap="round"/>';
    },
    hilo: function (t, u) {
      return '<rect x="52" y="18" width="96" height="16" rx="8" fill="' + u('o') + '"/><rect x="52" y="130" width="96" height="16" rx="8" fill="' + u('o') + '"/>' +
        '<rect x="62" y="34" width="76" height="96" rx="10" fill="' + u('c') + '"/>' +
        '<path d="M62 50 l76 12 M62 66 l76 12 M62 82 l76 12 M62 98 l76 12 M62 114 l76 12" stroke="' + u('o') + '" stroke-width="2.5" opacity=".55"/>' +
        '<path d="M138 120 q30 6 34 -28" fill="none" stroke="' + u('c') + '" stroke-width="3" stroke-linecap="round"/>' +
        '<path d="M72 42 L72 122" stroke="' + u('b') + '" stroke-width="6" stroke-linecap="round"/>';
    },
    caja: function (t, u) {
      return '<path d="M100 20 L170 50 V118 L100 148 L30 118 V50 Z" fill="' + u('c') + '"/>' +
        '<path d="M100 80 L170 50 V118 L100 148 Z" fill="' + u('o') + '" opacity=".55"/>' +
        '<path d="M30 50 L100 80 L170 50" fill="none" stroke="' + u('m') + '" stroke-width="4" stroke-linejoin="round"/>' +
        '<path d="M100 80 V148" stroke="' + u('m') + '" stroke-width="4"/>' +
        '<path d="M42 64 L42 112" stroke="' + u('b') + '" stroke-width="6" stroke-linecap="round"/>';
    }
  };

  // Devuelve el SVG del producto. Es decorativo: el nombre del producto ya está en el texto de la tarjeta
  // (en la ficha, el contenedor lleva role="img" con su nombre).
  function ilustracion(producto) {
    cuenta += 1;
    var id = 'g' + cuenta;
    var t = producto.tono;
    var u = function (n) { return 'url(#' + id + n + ')'; };
    var dibujo = DIBUJOS[producto.dibujo] || DIBUJOS.caja;
    return '<svg class="ilus" viewBox="0 0 200 160" aria-hidden="true" focusable="false">' +
      '<defs>' +
        '<radialGradient id="' + id + 'f" gradientUnits="userSpaceOnUse" cx="100" cy="66" r="170"><stop offset="0" stop-color="' + c(t, 65, 24) + '"/><stop offset="1" stop-color="' + c(t, 55, 6) + '"/></radialGradient>' +
        '<linearGradient id="' + id + 'c" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + c(t, 80, 66) + '"/><stop offset=".55" stop-color="' + c(t, 70, 46) + '"/><stop offset="1" stop-color="' + c(t, 65, 26) + '"/></linearGradient>' +
        '<linearGradient id="' + id + 'o" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + c(t, 18, 34) + '"/><stop offset="1" stop-color="' + c(t, 25, 9) + '"/></linearGradient>' +
        '<linearGradient id="' + id + 'm" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4f7fd"/><stop offset="1" stop-color="#8d99b6"/></linearGradient>' +
        '<linearGradient id="' + id + 'b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".55"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></linearGradient>' +
        '<filter id="' + id + 'g" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>' +
      '</defs>' +
      // el fondo pasa de los bordes del lienzo: si la tarjeta tiene otra proporción, no quedan franjas vacías
      '<rect x="-300" y="-240" width="800" height="640" fill="' + u('f') + '"/>' +
      '<circle cx="100" cy="78" r="70" fill="' + c(t, 90, 62) + '" opacity=".1"/>' +
      '<ellipse cx="100" cy="148" rx="76" ry="8" fill="#000" opacity=".45"/>' +
      dibujo(t, u) +
      '</svg>';
  }

  // ---------- Gaby IA, figura holográfica ----------
  // Personaje estilizado (no fotorrealista): busto con audífonos, anillos de luz, una «N» flotando sobre la mano
  // y un barrido de escaneo. Las animaciones están en estilos.css y se apagan con «menos movimiento».
  var G = {
    peloAtras: 'M300 92 C372 92 400 152 396 222 C394 268 390 306 376 334 C364 352 344 350 336 332 L332 300 L268 300 L264 332 C256 350 236 352 224 334 C210 306 206 268 204 222 C200 152 228 92 300 92 Z',
    mono: 'M266 78 a34 34 0 1 0 68 0 a34 34 0 1 0 -68 0 Z',
    cara: 'M300 124 C348 124 368 166 366 214 C364 268 334 306 300 308 C266 306 236 268 234 214 C232 166 252 124 300 124 Z',
    cuello: 'M280 288 L320 288 L326 366 L274 366 Z',
    cuerpo: 'M140 600 C140 470 190 402 300 394 C410 402 460 470 460 600 Z',
    manga: 'M222 446 C186 462 146 470 114 470 L110 506 C150 512 200 504 236 490 Z',
    mano: 'M116 468 C98 460 70 459 48 466 C39 470 40 481 49 484 C74 492 100 494 118 490 Z',
    pulgar: 'M106 468 C104 452 93 446 86 449 C83 457 89 466 98 472 Z',
    flequillo: 'M234 206 C230 146 262 112 302 112 C344 112 372 144 368 196 C356 166 336 150 312 148 C306 172 280 192 234 206 Z'
  };

  function gaby(pre) {
    pre = pre || 'gb';
    var u = function (n) { return 'url(#' + pre + n + ')'; };
    var id = function (n) { return pre + n; };
    var silueta = '<path d="' + G.peloAtras + '"/><path d="' + G.mono + '"/><path d="' + G.cuerpo + '"/><path d="' + G.manga + '"/><path d="' + G.mano + '"/>';
    return '<svg class="gaby-svg" viewBox="0 0 520 600" aria-hidden="true" focusable="false">' +
      '<defs>' +
        '<radialGradient id="' + id('halo') + '" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#3b82f6" stop-opacity=".6"/><stop offset=".55" stop-color="#6d28d9" stop-opacity=".2"/><stop offset="1" stop-color="#05070f" stop-opacity="0"/></radialGradient>' +
        '<linearGradient id="' + id('aro') + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#22d3ee"/><stop offset=".5" stop-color="#6d9bff"/><stop offset="1" stop-color="#a78bfa"/></linearGradient>' +
        '<linearGradient id="' + id('piel') + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7d6c6"/><stop offset="1" stop-color="#dba693"/></linearGradient>' +
        '<linearGradient id="' + id('pielsombra') + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c98f7c"/><stop offset="1" stop-color="#e2b3a1"/></linearGradient>' +
        '<linearGradient id="' + id('pelo') + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4a2f3c"/><stop offset="1" stop-color="#140c14"/></linearGradient>' +
        '<linearGradient id="' + id('chaqueta') + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d2c62"/><stop offset="1" stop-color="#070b1c"/></linearGradient>' +
        '<radialGradient id="' + id('orbe') + '" cx="42%" cy="36%" r="62%"><stop offset="0" stop-color="#e0f7ff" stop-opacity=".95"/><stop offset=".3" stop-color="#22d3ee" stop-opacity=".75"/><stop offset=".75" stop-color="#2563eb" stop-opacity=".4"/><stop offset="1" stop-color="#2563eb" stop-opacity="0"/></radialGradient>' +
        '<linearGradient id="' + id('n') + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a5f3fc"/><stop offset=".5" stop-color="#6d9bff"/><stop offset="1" stop-color="#c4b5fd"/></linearGradient>' +
        '<linearGradient id="' + id('cono') + '" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#22d3ee" stop-opacity=".45"/><stop offset="1" stop-color="#22d3ee" stop-opacity="0"/></linearGradient>' +
        '<pattern id="' + id('lineas') + '" width="6" height="5" patternUnits="userSpaceOnUse"><rect width="6" height="1" fill="#a5f3fc"/></pattern>' +
        '<linearGradient id="' + id('barrido') + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#22d3ee" stop-opacity="0"/><stop offset=".5" stop-color="#67e8f9" stop-opacity=".35"/><stop offset="1" stop-color="#22d3ee" stop-opacity="0"/></linearGradient>' +
        '<linearGradient id="' + id('desvanece') + '" x1="0" y1="0" x2="0" y2="1"><stop offset=".7" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient>' +
        '<mask id="' + id('mascara') + '"><rect width="520" height="600" fill="' + u('desvanece') + '"/></mask>' +
        '<filter id="' + id('brillo') + '" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="7"/></filter>' +
        '<filter id="' + id('suave') + '" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.5"/></filter>' +
        '<clipPath id="' + id('silueta') + '">' + silueta + '</clipPath>' +
      '</defs>' +
      // halo y anillos de luz detrás
      '<circle cx="300" cy="240" r="250" fill="' + u('halo') + '"/>' +
      '<g class="gaby-anillo gaby-anillo-a"><circle cx="300" cy="236" r="206" fill="none" stroke="' + u('aro') + '" stroke-width="2.5" stroke-dasharray="300 70 60 90" stroke-linecap="round" opacity=".85"/></g>' +
      '<g class="gaby-anillo gaby-anillo-b"><circle cx="300" cy="236" r="176" fill="none" stroke="#22d3ee" stroke-width="1.4" stroke-dasharray="3 9" opacity=".6"/></g>' +
      '<g class="gaby-anillo gaby-anillo-c"><circle cx="300" cy="236" r="236" fill="none" stroke="' + u('aro') + '" stroke-width="1" opacity=".4"/>' +
        '<path d="M110 160 A206 206 0 0 1 220 50" fill="none" stroke="#a5f3fc" stroke-width="5" stroke-linecap="round" opacity=".9" filter="' + u('suave') + '"/>' +
        '<path d="M500 300 A206 206 0 0 1 430 400" fill="none" stroke="#c4b5fd" stroke-width="5" stroke-linecap="round" opacity=".8" filter="' + u('suave') + '"/></g>' +
      // borde de luz de la silueta
      '<g filter="' + u('brillo') + '" fill="none" stroke="#22d3ee" stroke-width="5" opacity=".55">' + silueta + '</g>' +
      // la figura, que se desvanece abajo
      '<g mask="' + u('mascara') + '">' +
        '<path d="' + G.peloAtras + '" fill="' + u('pelo') + '"/>' +
        '<path d="' + G.mono + '" fill="' + u('pelo') + '"/>' +
        '<path d="M276 70 C286 56 314 56 324 70" stroke="#6b4656" stroke-width="3" fill="none" opacity=".7"/>' +
        '<path d="' + G.cuello + '" fill="' + u('pielsombra') + '"/>' +
        '<path d="' + G.cuerpo + '" fill="' + u('chaqueta') + '"/>' +
        '<path d="M266 350 L262 404 L300 430 L338 404 L334 350 L300 374 Z" fill="#253675"/>' +
        '<path d="M262 404 L300 430 L338 404" fill="none" stroke="#67e8f9" stroke-width="2" opacity=".8"/>' +
        '<path d="M206 438 C238 466 248 520 244 600" fill="none" stroke="#22d3ee" stroke-width="2.5" opacity=".9"/>' +
        '<path d="M394 438 C362 466 352 520 356 600" fill="none" stroke="#22d3ee" stroke-width="2.5" opacity=".9"/>' +
        '<path d="M206 438 C238 466 248 520 244 600 M394 438 C362 466 352 520 356 600" fill="none" stroke="#22d3ee" stroke-width="8" opacity=".35" filter="' + u('suave') + '"/>' +
        '<path d="M344 520 V492 L374 520 V492" fill="none" stroke="' + u('n') + '" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<path d="M344 520 V492 L374 520 V492" fill="none" stroke="#67e8f9" stroke-width="10" opacity=".4" filter="' + u('suave') + '"/>' +
        // brazo extendido con la mano abierta
        '<path d="' + G.manga + '" fill="' + u('chaqueta') + '"/>' +
        '<path d="M222 446 C186 462 146 470 114 470" fill="none" stroke="#67e8f9" stroke-width="2" opacity=".7"/>' +
        '<path d="M116 466 L114 508" stroke="#22d3ee" stroke-width="4" stroke-linecap="round"/>' +
        '<path d="' + G.mano + '" fill="' + u('piel') + '"/>' +
        '<path d="' + G.pulgar + '" fill="' + u('piel') + '"/>' +
        '<path d="M56 472 C72 476 92 478 108 476" stroke="#c98f7c" stroke-width="1.5" fill="none" opacity=".7"/>' +
        // cara
        '<path d="' + G.cara + '" fill="' + u('piel') + '"/>' +
        '<ellipse cx="262" cy="252" rx="13" ry="7" fill="#f08aa0" opacity=".28"/><ellipse cx="338" cy="252" rx="13" ry="7" fill="#f08aa0" opacity=".28"/>' +
        '<path d="M256 198 Q272 189 289 195" stroke="#3a2530" stroke-width="3.2" fill="none" stroke-linecap="round"/>' +
        '<path d="M311 195 Q328 189 344 198" stroke="#3a2530" stroke-width="3.2" fill="none" stroke-linecap="round"/>' +
        '<path d="M257 222 Q272 208 289 220 Q274 231 257 222 Z" fill="#fbf7f5"/><path d="M343 222 Q328 208 311 220 Q326 231 343 222 Z" fill="#fbf7f5"/>' +
        '<circle cx="274" cy="220" r="7.5" fill="#4a2d55"/><circle cx="326" cy="220" r="7.5" fill="#4a2d55"/>' +
        '<circle cx="274" cy="220" r="3.4" fill="#0b0710"/><circle cx="326" cy="220" r="3.4" fill="#0b0710"/>' +
        '<circle cx="276.5" cy="217" r="2.2" fill="#fff"/><circle cx="328.5" cy="217" r="2.2" fill="#fff"/>' +
        '<circle cx="271" cy="223" r="1.2" fill="#67e8f9"/><circle cx="323" cy="223" r="1.2" fill="#67e8f9"/>' +
        '<path d="M255 221 Q272 205 291 218" stroke="#1a0f18" stroke-width="2.6" fill="none" stroke-linecap="round"/>' +
        '<path d="M345 221 Q328 205 309 218" stroke="#1a0f18" stroke-width="2.6" fill="none" stroke-linecap="round"/>' +
        '<path d="M300 232 Q295 250 299 256 Q303 259 308 255" stroke="#b98472" stroke-width="2" fill="none" stroke-linecap="round"/>' +
        '<path d="M282 274 Q300 290 318 274 Q300 282 282 274 Z" fill="#c9566c"/>' +
        '<path d="M286 276 Q300 281 314 276" stroke="#fff" stroke-width="1.2" fill="none" opacity=".5"/>' +
        // pelo de adelante
        '<path d="' + G.flequillo + '" fill="' + u('pelo') + '"/>' +
        '<path d="M238 200 C230 240 234 282 248 304 C240 272 240 236 246 206 Z" fill="' + u('pelo') + '"/>' +
        '<path d="M362 196 C372 236 368 280 354 304 C360 272 360 236 354 204 Z" fill="' + u('pelo') + '"/>' +
        '<path d="M262 130 C280 118 316 116 340 130" stroke="#7a5566" stroke-width="2" fill="none" opacity=".6"/>' +
        // audífonos
        '<path d="M224 214 C220 116 380 116 376 214" fill="none" stroke="#0f1733" stroke-width="13" stroke-linecap="round"/>' +
        '<path d="M232 196 C236 132 364 132 368 196" fill="none" stroke="#67e8f9" stroke-width="2" opacity=".8"/>' +
        '<rect x="208" y="190" width="32" height="62" rx="15" fill="#0f1733" stroke="' + u('aro') + '" stroke-width="2.5"/>' +
        '<rect x="360" y="190" width="32" height="62" rx="15" fill="#0f1733" stroke="' + u('aro') + '" stroke-width="2.5"/>' +
        '<circle cx="224" cy="221" r="10" fill="#22d3ee" opacity=".85" filter="' + u('suave') + '"/><circle cx="376" cy="221" r="10" fill="#22d3ee" opacity=".85" filter="' + u('suave') + '"/>' +
        '<circle cx="224" cy="221" r="5" fill="#e0f7ff"/><circle cx="376" cy="221" r="5" fill="#e0f7ff"/>' +
        // efecto holográfico: líneas finas y barrido, solo dentro de la silueta
        '<g clip-path="' + u('silueta') + '">' +
          '<rect width="520" height="600" fill="' + u('lineas') + '" opacity=".09"/>' +
          '<rect class="gaby-barrido" x="0" y="-140" width="520" height="140" fill="' + u('barrido') + '"/>' +
        '</g>' +
      '</g>' +
      // la «N» flotando sobre la mano
      '<path d="M62 470 L40 400 L130 400 L108 470 Z" fill="' + u('cono') + '"/>' +
      '<g class="gaby-orbe">' +
        '<circle cx="84" cy="384" r="58" fill="' + u('orbe') + '" opacity=".55" filter="' + u('brillo') + '"/>' +
        '<circle cx="84" cy="384" r="42" fill="#0b1638" opacity=".7"/>' +
        '<circle cx="84" cy="384" r="42" fill="none" stroke="' + u('aro') + '" stroke-width="2.5"/>' +
        '<circle cx="84" cy="384" r="50" fill="none" stroke="#67e8f9" stroke-width="1" stroke-dasharray="2 6" opacity=".8"/>' +
        '<path d="M68 402 V366 L100 402 V366" fill="none" stroke="#67e8f9" stroke-width="14" stroke-linecap="round" stroke-linejoin="round" opacity=".5" filter="' + u('suave') + '"/>' +
        '<path d="M68 402 V366 L100 402 V366" fill="none" stroke="' + u('n') + '" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</g>' +
      // chispas
      '<g fill="#a5f3fc" class="gaby-chispas"><circle cx="150" cy="320" r="2"/><circle cx="40" cy="330" r="1.5"/><circle cx="470" cy="170" r="2"/><circle cx="440" cy="120" r="1.2"/><circle cx="170" cy="120" r="1.6"/></g>' +
      '</svg>';
  }

  // ---------- portátil genérico para WORKORDER ----------
  function portatil() {
    var filas = '';
    for (var i = 0; i < 4; i++) {
      filas += '<rect x="96" y="' + (58 + i * 16) + '" width="150" height="10" rx="3" fill="#1b2a55"/>' +
        '<rect x="100" y="' + (61 + i * 16) + '" width="' + [60, 92, 44, 76][i] + '" height="4" rx="2" fill="' + ['#22d3ee', '#a78bfa', '#6d9bff', '#22d3ee'][i] + '" opacity=".8"/>';
    }
    return '<svg class="portatil-svg" viewBox="0 0 300 180" aria-hidden="true" focusable="false">' +
      '<defs><linearGradient id="pt-borde" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#22d3ee"/><stop offset="1" stop-color="#a78bfa"/></linearGradient>' +
      '<linearGradient id="pt-base" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c7d0e6"/><stop offset="1" stop-color="#5b6685"/></linearGradient>' +
      '<filter id="pt-brillo" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6"/></filter></defs>' +
      '<rect x="40" y="16" width="220" height="134" rx="10" fill="#7c3aed" opacity=".35" filter="url(#pt-brillo)"/>' +
      '<rect x="44" y="18" width="212" height="130" rx="9" fill="#0a1024" stroke="url(#pt-borde)" stroke-width="2"/>' +
      '<rect x="52" y="26" width="196" height="114" rx="5" fill="#0d1631"/>' +
      '<rect x="52" y="26" width="34" height="114" fill="#101c3e"/>' +
      '<path d="M69 40 L60 45 L69 50 L78 45 Z M60 50 L69 55 L78 50 M60 55 L69 60 L78 55" fill="none" stroke="#67e8f9" stroke-width="1.6" stroke-linejoin="round"/>' +
      '<rect x="60" y="72" width="18" height="4" rx="2" fill="#2a3a70"/><rect x="60" y="82" width="18" height="4" rx="2" fill="#2a3a70"/><rect x="60" y="92" width="18" height="4" rx="2" fill="#2a3a70"/>' +
      '<rect x="96" y="34" width="70" height="14" rx="3" fill="#1b2a55"/><rect x="172" y="34" width="70" height="14" rx="3" fill="#1b2a55"/>' +
      filas +
      '<path d="M18 152 h264 l-14 14 h-236 Z" fill="url(#pt-base)"/><rect x="128" y="152" width="44" height="4" rx="2" fill="#3b4566"/>' +
      '</svg>';
  }

  window.NOVA_ILUS = { ilustracion: ilustracion, gaby: gaby, portatil: portatil };
})();
