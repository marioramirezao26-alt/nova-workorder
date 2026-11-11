/*
 * <gaby-spark> — mascota de la IA de NOVA. Prototipo de referencia (11-nov-2026).
 * Sin dependencias: SVG + CSS + JavaScript. Funciona con solo incluir este archivo.
 *
 *   <script src="gaby-spark.js"></script>
 *   <gaby-spark estado="feliz" style="width:240px"></gaby-spark>
 *
 * Atributos:
 *   estado  feliz | escuchando | pensando | hablando | sorprendida   (por defecto: feliz)
 *   piel    ruta de la imagen del cuerpo 3D (gaby-spark-piel.webp). Sin ella se usa el dibujo vectorial
 *   quieta  si está presente, no se anima (también respeta «reducir movimiento» del sistema)
 *   sin-plataforma  oculta la plataforma holográfica (para avatares pequeños)
 * Propiedades y métodos:
 *   el.estado = 'hablando'
 *   el.nivel = 0..1        intensidad de voz o actividad (mueve boca, ondas y audífonos)
 *   el.reaccionar('sorprendida', 1200)   cambia de estado un momento y vuelve al anterior
 */
(function () {
  if (customElements.get('gaby-spark')) return;

  var ESTADOS = ['feliz', 'escuchando', 'pensando', 'hablando', 'sorprendida'];
  var NOMBRES = {
    feliz: 'feliz', escuchando: 'escuchando', pensando: 'pensando',
    hablando: 'hablando', sorprendida: 'sorprendida'
  };
  var n = 0; // ids únicos por instancia para gradientes y filtros

  function svg(id) {
    var u = function (x) { return 'url(#' + x + id + ')'; };
    return '' +
'<svg viewBox="0 0 400 420" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="t' + id + '">' +
'<title id="t' + id + '">Gaby Spark, asistente de inteligencia artificial de NOVA</title>' +
'<defs>' +
  '<radialGradient id="cuerpo' + id + '" cx="34%" cy="24%" r="85%">' +
    '<stop offset="0" stop-color="#BFE0FF"/><stop offset=".22" stop-color="#5E8DFF"/>' +
    '<stop offset=".6" stop-color="#2A3FC9"/><stop offset="1" stop-color="#150F5C"/>' +
  '</radialGradient>' +
  '<linearGradient id="borde' + id + '" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0" stop-color="#7DE8FF"/><stop offset=".5" stop-color="#6C7BFF"/><stop offset="1" stop-color="#D36BFF"/>' +
  '</linearGradient>' +
  '<radialGradient id="cara' + id + '" cx="40%" cy="22%" r="90%">' +
    '<stop offset="0" stop-color="#1B2248"/><stop offset=".45" stop-color="#070A1C"/><stop offset="1" stop-color="#02030A"/>' +
  '</radialGradient>' +
  '<linearGradient id="copa' + id + '" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0" stop-color="#3B4BD8"/><stop offset="1" stop-color="#120E4A"/>' +
  '</linearGradient>' +
  '<radialGradient id="halo' + id + '" cx="50%" cy="50%" r="50%">' +
    '<stop offset="0" stop-color="#22D3EE" stop-opacity=".55"/><stop offset="1" stop-color="#22D3EE" stop-opacity="0"/>' +
  '</radialGradient>' +
  '<filter id="brillo' + id + '" x="-40%" y="-40%" width="180%" height="180%">' +
    '<feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>' +
  '</filter>' +
  // Luz de los ojos: centro casi blanco con halo azul, como en el render aprobado
  '<filter id="ojo' + id + '" x="-60%" y="-90%" width="220%" height="280%" color-interpolation-filters="sRGB">' +
    '<feGaussianBlur in="SourceAlpha" stdDeviation="14" result="a"/><feFlood flood-color="#0B6BFF" flood-opacity=".9"/><feComposite in2="a" operator="in" result="lejos"/>' +
    '<feGaussianBlur in="SourceAlpha" stdDeviation="5" result="b"/><feFlood flood-color="#2FA8FF"/><feComposite in2="b" operator="in" result="cerca"/>' +
    '<feMerge><feMergeNode in="lejos"/><feMergeNode in="cerca"/><feMergeNode in="cerca"/><feMergeNode in="SourceGraphic"/></feMerge>' +
  '</filter>' +
  '<filter id="difuso' + id + '" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="9"/></filter>' +
  '<radialGradient id="disco' + id + '" cx="50%" cy="50%" r="50%">' +
    '<stop offset="0" stop-color="#BFF4FF" stop-opacity=".95"/><stop offset=".35" stop-color="#22D3EE" stop-opacity=".55"/><stop offset="1" stop-color="#1B3BFF" stop-opacity="0"/>' +
  '</radialGradient>' +
  '<clipPath id="visor' + id + '"><ellipse cx="386" cy="233" rx="176" ry="126"/></clipPath>' +
  '<clipPath id="recorte' + id + '"><ellipse cx="210" cy="194" rx="113" ry="100"/></clipPath>' +
'</defs>' +

// Plataforma holográfica
'<g class="plataforma">' +
  '<ellipse cx="200" cy="372" rx="170" ry="32" fill="' + u('halo') + '"/>' +
  '<ellipse cx="200" cy="372" rx="120" ry="20" fill="' + u('disco') + '" opacity=".55"/>' +
  '<ellipse class="aro a1" cx="200" cy="372" rx="148" ry="25" fill="none" stroke="#E07BFF" stroke-width="4" filter="' + u('brillo') + '"/>' +
  '<ellipse cx="200" cy="372" rx="126" ry="21" fill="none" stroke="#6C7BFF" stroke-width="1.2" opacity=".7"/>' +
  '<ellipse class="aro a2" cx="200" cy="372" rx="100" ry="16.5" fill="none" stroke="#3FE0FF" stroke-width="3.5" filter="' + u('brillo') + '"/>' +
  '<ellipse class="aro a3" cx="200" cy="372" rx="56" ry="9" fill="#BFF4FF" fill-opacity=".35" stroke="#BFF4FF" stroke-width="2"/>' +
  '<path class="haz" d="M168 372 L200 300 L232 372 Z" fill="' + u('disco') + '" opacity=".35"/>' +
'</g>' +

'<g class="flota">' +
  // Rayos eléctricos
  '<g class="rayos" filter="' + u('brillo') + '">' +
    '<g class="rayo r1"><path d="M70 60 l9 -22 l9 22 l-9 22 z" fill="#F3B0FF"/><path d="M79 82 L92 108" stroke="#F3B0FF" stroke-width="3" stroke-linecap="round"/></g>' +
    '<g class="rayo r2"><path d="M124 30 l6 -15 l6 15 l-6 15 z" fill="#F3B0FF"/><path d="M130 45 L138 62" stroke="#F3B0FF" stroke-width="2.5" stroke-linecap="round"/></g>' +
    '<g class="rayo r3"><path d="M296 26 l7 -18 l7 18 l-7 18 z" fill="#8FEAFF"/><path d="M303 44 L298 64" stroke="#8FEAFF" stroke-width="2.5" stroke-linecap="round"/></g>' +
    '<g class="rayo r4"><path d="M348 84 l8 -20 l8 20 l-8 20 z" fill="#F3B0FF"/><path d="M356 104 L346 126" stroke="#F3B0FF" stroke-width="3" stroke-linecap="round"/></g>' +
    '<g class="rayo r5"><path d="M30 132 l6 -14 l6 14 l-6 14 z" fill="#8FEAFF"/><path d="M36 146 L48 162" stroke="#8FEAFF" stroke-width="2.5" stroke-linecap="round"/></g>' +
  '</g>' +

  // Dibujo vectorial del cuerpo (se oculta cuando hay piel 3D)
  '<g class="vector">' +
  '<g class="audifono der">' +
    '<ellipse cx="330" cy="200" rx="30" ry="50" fill="' + u('copa') + '" stroke="' + u('borde') + '" stroke-width="3"/>' +
    '<ellipse class="luz" cx="338" cy="200" rx="12" ry="32" fill="none" stroke="#D36BFF" stroke-width="4" filter="' + u('brillo') + '"/>' +
  '</g>' +

  // Cuerpo esférico
  '<circle cx="200" cy="190" r="132" fill="' + u('cuerpo') + '" stroke="' + u('borde') + '" stroke-width="3"/>' +
  '<path d="M96 120 A126 126 0 0 1 250 68" fill="none" stroke="#FFFFFF" stroke-opacity=".55" stroke-width="7" stroke-linecap="round"/>' +
  '<ellipse cx="128" cy="96" rx="20" ry="9" fill="#FFFFFF" opacity=".5" transform="rotate(-38 128 96)"/><path d="M300 262 A126 126 0 0 1 150 306" fill="none" stroke="#D36BFF" stroke-opacity=".75" stroke-width="5" stroke-linecap="round" filter="url(#brillo' + id + ')"/><path d="M322 150 A128 128 0 0 1 326 232" fill="none" stroke="#7DE8FF" stroke-opacity=".6" stroke-width="4" stroke-linecap="round"/>' +

  // Rostro negro brillante
  '<ellipse cx="210" cy="194" rx="113" ry="100" fill="' + u('cara') + '" stroke="#0A1030" stroke-width="3"/>' +
  '<g clip-path="' + u('recorte') + '">' +
    '<path d="M108 150 Q204 74 312 138" fill="none" stroke="#FFFFFF" stroke-opacity=".10" stroke-width="30" stroke-linecap="round"/><path d="M118 250 Q210 320 306 246" fill="none" stroke="#B46CFF" stroke-opacity=".22" stroke-width="10" stroke-linecap="round"/>' +
    '<circle class="nucleo" cx="206" cy="262" r="26" fill="' + u('halo') + '"/>' +
  '</g>' +
  '</g>' +

  // Piel 3D: el cuerpo del render aprobado, con el rostro en blanco
  '<g class="piel3d">' +
    '<ellipse cx="205" cy="326" rx="104" ry="15" fill="#39C8FF" opacity=".42" filter="' + u('difuso') + '"/>' +
    '<image class="piel" x="0" y="40" width="400" height="284.9" preserveAspectRatio="xMidYMid meet"/>' +
    '<circle class="nucleo" cx="243" cy="232" r="22" fill="' + u('halo') + '"/>' +
    '<ellipse class="luz" cx="63" cy="210" rx="27" ry="42" fill="#D77BFF" filter="' + u('difuso') + '"/>' +
    '<ellipse class="luz" cx="368" cy="188" rx="9" ry="48" fill="#D77BFF" filter="' + u('difuso') + '"/>' +
  '</g>' +

  // Caras: una por estado; solo se ve la del estado activo.
  // Medidas tomadas de la imagen aprobada (lienzo de 635 × 440): ojo izquierdo centrado en (320,222), derecho en (498,210), boca en (418,297).
  '<g class="caras" transform="translate(-38 52) scale(.6)" fill="none" stroke-linecap="round" stroke-linejoin="round">' +
    '<g class="ojos" stroke="#ECF7FF" filter="' + u('ojo') + '">' +
      '<g class="cara feliz">' +
        '<path d="M260.6 244.4 L261.0 238.5 L262.6 233.1 L265.0 227.9 L267.9 223.0 L271.3 218.4 L275.3 214.2 L279.6 210.4 L284.3 207.1 L289.4 204.1 L294.7 201.6 L300.3 199.6 L306.1 198.1 L312.1 197.1 L318.1 196.6 L324.3 196.6 L330.4 197.1 L336.6 198.3 L342.7 199.9 L348.7 202.2 L354.5 205.0 L360.2 208.4 L365.6 212.4 L370.7 217.0 L375.4 222.1 L379.7 227.9 L383.0 234.6 L379.0 237.4 L373.7 232.9 L368.8 228.6 L364.0 224.9 L359.0 221.6 L354.0 218.9 L349.0 216.6 L343.9 214.7 L338.9 213.3 L333.8 212.3 L328.8 211.7 L323.8 211.4 L318.8 211.5 L313.9 211.9 L309.2 212.7 L304.5 213.8 L300.0 215.3 L295.6 217.0 L291.4 219.0 L287.4 221.3 L283.6 223.9 L280.1 226.8 L276.8 230.0 L273.7 233.5 L270.9 237.3 L268.3 241.3 L265.4 245.6 Z" fill="#ECF7FF" stroke="#ECF7FF" stroke-width="11"/><path d="M444.6 228.3 L445.4 222.1 L447.2 216.5 L449.6 211.2 L452.4 206.2 L455.7 201.7 L459.3 197.5 L463.3 193.8 L467.6 190.6 L472.2 187.9 L477.0 185.7 L482.1 184.1 L487.3 183.0 L492.6 182.5 L498.0 182.6 L503.4 183.3 L508.8 184.6 L514.1 186.5 L519.3 189.0 L524.4 192.1 L529.2 195.7 L533.9 200.0 L538.3 204.8 L542.4 210.1 L546.2 216.0 L549.7 222.6 L552.2 229.9 L547.8 232.1 L543.2 226.4 L539.0 221.1 L534.8 216.3 L530.5 212.1 L526.3 208.5 L522.0 205.3 L517.8 202.7 L513.5 200.6 L509.3 199.0 L505.2 197.8 L501.1 196.9 L497.1 196.5 L493.1 196.5 L489.2 196.8 L485.4 197.5 L481.7 198.6 L478.0 200.0 L474.4 201.7 L470.9 203.9 L467.5 206.4 L464.2 209.3 L461.0 212.6 L458.0 216.3 L455.1 220.4 L452.4 224.9 L449.4 229.7 Z" fill="#ECF7FF" stroke="#ECF7FF" stroke-width="11"/>' +
      '</g>' +
      '<g class="cara escuchando">' +
        '<rect class="ojo" x="307" y="186" width="27" height="70" rx="13.5" fill="#ECF7FF" stroke="none"/>' +
        '<rect class="ojo" x="486" y="176" width="25" height="66" rx="12.5" fill="#ECF7FF" stroke="none"/>' +
      '</g>' +
      '<g class="cara pensando">' +
        '<path d="M269.9 226.0 L273.8 225.1 L277.7 224.5 L281.6 224.0 L285.5 223.5 L289.4 223.1 L293.3 222.7 L297.2 222.3 L301.1 221.9 L305.1 221.6 L309.0 221.3 L312.9 221.0 L316.8 220.7 L320.7 220.5 L324.7 220.3 L328.6 220.1 L332.5 219.9 L336.4 219.8 L340.4 219.6 L344.3 219.5 L348.2 219.4 L352.2 219.4 L356.1 219.4 L360.0 219.4 L364.0 219.4 L367.9 219.5 L371.9 220.0 L372.1 224.0 L368.2 224.9 L364.3 225.5 L360.4 226.0 L356.5 226.5 L352.6 226.9 L348.7 227.3 L344.8 227.7 L340.9 228.1 L336.9 228.4 L333.0 228.7 L329.1 229.0 L325.2 229.3 L321.3 229.5 L317.3 229.7 L313.4 229.9 L309.5 230.1 L305.6 230.2 L301.6 230.4 L297.7 230.5 L293.8 230.6 L289.8 230.6 L285.9 230.6 L282.0 230.6 L278.0 230.6 L274.1 230.5 L270.1 230.0 Z" fill="#ECF7FF" stroke="#ECF7FF" stroke-width="11"/><path d="M448.7 216.5 L450.8 213.8 L453.5 211.5 L456.5 209.4 L459.8 207.5 L463.3 205.7 L466.9 204.2 L470.8 202.8 L474.8 201.6 L479.0 200.5 L483.3 199.7 L487.6 199.0 L492.1 198.5 L496.6 198.3 L501.1 198.2 L505.6 198.3 L510.1 198.6 L514.6 199.2 L519.0 199.9 L523.4 200.9 L527.6 202.0 L531.7 203.5 L535.7 205.1 L539.5 207.0 L543.0 209.1 L546.4 211.5 L549.2 214.4 L546.8 217.6 L543.4 216.1 L540.1 214.5 L536.6 213.0 L533.1 211.8 L529.3 210.6 L525.5 209.7 L521.6 208.9 L517.6 208.2 L513.5 207.7 L509.4 207.4 L505.3 207.2 L501.1 207.2 L496.9 207.2 L492.8 207.5 L488.7 207.9 L484.7 208.4 L480.7 209.0 L476.9 209.8 L473.1 210.6 L469.5 211.6 L466.1 212.7 L462.8 214.0 L459.7 215.3 L456.8 216.7 L454.1 218.1 L451.3 219.5 Z" fill="#ECF7FF" stroke="#ECF7FF" stroke-width="11"/>' +
      '</g>' +
      '<g class="cara hablando">' +
        '<path d="M260.6 240.4 L261.0 234.5 L262.6 229.1 L265.0 223.9 L267.9 219.0 L271.3 214.4 L275.3 210.2 L279.6 206.4 L284.3 203.1 L289.4 200.1 L294.7 197.6 L300.3 195.6 L306.1 194.1 L312.1 193.1 L318.1 192.6 L324.3 192.6 L330.4 193.1 L336.6 194.3 L342.7 195.9 L348.7 198.2 L354.5 201.0 L360.2 204.4 L365.6 208.4 L370.7 213.0 L375.4 218.1 L379.7 223.9 L383.0 230.6 L379.0 233.4 L373.7 228.9 L368.8 224.6 L364.0 220.9 L359.0 217.6 L354.0 214.9 L349.0 212.6 L343.9 210.7 L338.9 209.3 L333.8 208.3 L328.8 207.7 L323.8 207.4 L318.8 207.5 L313.9 207.9 L309.2 208.7 L304.5 209.8 L300.0 211.3 L295.6 213.0 L291.4 215.0 L287.4 217.3 L283.6 219.9 L280.1 222.8 L276.8 226.0 L273.7 229.5 L270.9 233.3 L268.3 237.3 L265.4 241.6 Z" fill="#ECF7FF" stroke="#ECF7FF" stroke-width="11"/><path d="M444.6 224.3 L445.4 218.1 L447.2 212.5 L449.6 207.2 L452.4 202.2 L455.7 197.7 L459.3 193.5 L463.3 189.8 L467.6 186.6 L472.2 183.9 L477.0 181.7 L482.1 180.1 L487.3 179.0 L492.6 178.5 L498.0 178.6 L503.4 179.3 L508.8 180.6 L514.1 182.5 L519.3 185.0 L524.4 188.1 L529.2 191.7 L533.9 196.0 L538.3 200.8 L542.4 206.1 L546.2 212.0 L549.7 218.6 L552.2 225.9 L547.8 228.1 L543.2 222.4 L539.0 217.1 L534.8 212.3 L530.5 208.1 L526.3 204.5 L522.0 201.3 L517.8 198.7 L513.5 196.6 L509.3 195.0 L505.2 193.8 L501.1 192.9 L497.1 192.5 L493.1 192.5 L489.2 192.8 L485.4 193.5 L481.7 194.6 L478.0 196.0 L474.4 197.7 L470.9 199.9 L467.5 202.4 L464.2 205.3 L461.0 208.6 L458.0 212.3 L455.1 216.4 L452.4 220.9 L449.4 225.7 Z" fill="#ECF7FF" stroke="#ECF7FF" stroke-width="11"/>' +
      '</g>' +
      '<g class="cara sorprendida">' +
        '<circle cx="320" cy="220" r="30" stroke-width="13"/><circle cx="498" cy="208" r="27" stroke-width="12"/>' +
      '</g>' +
    '</g>' +
    '<g class="bocas" stroke="#39A9FF" filter="' + u('brillo') + '">' +
      '<g class="cara feliz"><path d="M388 290 Q417 314 445 289" stroke-width="9"/></g>' +
      '<g class="cara escuchando"><path d="M400 293 Q417 305 434 292" stroke-width="7"/></g>' +
      '<g class="cara pensando"><path d="M402 300 L434 294" stroke-width="7"/></g>' +
      '<g class="cara hablando"><path class="boca" d="M386 284 Q417 338 448 282 Z" fill="#3FB4FF" stroke="#3FB4FF" stroke-width="6"/></g>' +
      '<g class="cara sorprendida"><ellipse cx="418" cy="300" rx="11" ry="14" stroke-width="7"/></g>' +
    '</g>' +
    '<g class="cara pensando particulas" fill="#8FEAFF" stroke="none" filter="' + u('brillo') + '">' +
      '<circle class="p p1" cx="560" cy="96" r="6"/><circle class="p p2" cx="586" cy="64" r="8"/><circle class="p p3" cx="618" cy="28" r="11"/>' +
    '</g>' +
    // Reflejo del vidrio por encima de los ojos: los ojos quedan «detrás» del visor
    '<g class="vidrio" clip-path="' + u('visor') + '" stroke="none">' +
      '<path d="M214 250 C214 150 300 108 400 106 C330 126 262 168 238 262 Z" fill="#FFFFFF" opacity=".055"/>' +
      '<ellipse cx="386" cy="233" rx="176" ry="126" fill="none" stroke="#04061A" stroke-opacity=".5" stroke-width="10"/>' +
    '</g>' +
  '</g>' +

  // Audífono izquierdo (delante), con el símbolo de onda
  '<g class="audifono izq">' +
    '<path d="M92 132 Q200 36 316 140" fill="none" stroke="' + u('borde') + '" stroke-width="5" opacity=".0"/>' +
    '<circle cx="80" cy="200" r="54" fill="' + u('copa') + '" stroke="' + u('borde') + '" stroke-width="3"/>' +
    '<circle cx="80" cy="200" r="49" fill="none" stroke="#7DE8FF" stroke-opacity=".7" stroke-width="2"/><circle class="luz" cx="80" cy="200" r="41" fill="none" stroke="#D36BFF" stroke-width="6" filter="' + u('brillo') + '"/>' +
    '<circle cx="80" cy="200" r="30" fill="#0A0D2A" stroke="#22D3EE" stroke-width="3"/>' +
    '<path class="onda-icono" d="M58 200 h9 l4 -10 l7 22 l6 -31 l6 25 l4 -6 h9" fill="none" stroke="#5CE6FF" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" filter="' + u('brillo') + '"/>' +
  '</g>' +

  // Ondas de sonido (escuchando y hablando)
  '<g class="ondas" fill="none" stroke="#5CE6FF" stroke-width="4" stroke-linecap="round" filter="' + u('brillo') + '">' +
    '<path class="onda o1" d="M26 176 Q16 200 26 224"/><path class="onda o2" d="M10 164 Q-6 200 10 236"/>' +
    '<path class="onda o1" d="M368 176 Q378 200 368 224"/><path class="onda o2" d="M384 164 Q400 200 384 236"/>' +
  '</g>' +

  // Destello (sorprendida)
  '<g class="destello" stroke="#FF8AD8" stroke-width="7" stroke-linecap="round" filter="' + u('brillo') + '">' +
    '<path d="M318 40 L310 78"/><path d="M344 52 L328 84"/><circle cx="304" cy="98" r="2" fill="#FF8AD8"/>' +
  '</g>' +
'</g>' +
'</svg>';
  }

  var CSS = '' +
':host{display:inline-block;width:240px;aspect-ratio:400/420;--nivel:0;contain:content}' +
'svg{display:block;width:100%;height:100%;overflow:visible}' +
':host([sin-plataforma]) .plataforma{display:none}' +
':host(:not([piel])) .vidrio,:host(:not([piel])) .piel3d,:host([piel]) .vector,:host([piel]) .audifono.izq{display:none}' +
':host([piel]) .caras{transform:translate(0px,40px) scale(.63)}' +
':host([piel]:not([estado=pensando])) .piel3d .nucleo{display:none}' +
':host([piel]) .piel3d .luz{opacity:0;mix-blend-mode:screen}' +
':host([piel][estado=escuchando]) .piel3d .luz,:host([piel][estado=hablando]) .piel3d .luz{opacity:.75}' +
'.cara{opacity:0;transition:opacity .18s ease}' +
'.ondas,.destello{opacity:0;transition:opacity .2s ease}' +
'.flota,.rayo,.luz,.nucleo,.boca,.ojo,.aro,.onda-icono{transform-box:fill-box;transform-origin:center}' +
'.boca{transform-origin:center top}' +

':host([estado=feliz]) .feliz,:host(:not([estado])) .feliz,' +
':host([estado=escuchando]) .escuchando,:host([estado=pensando]) .pensando,' +
':host([estado=hablando]) .hablando,:host([estado=sorprendida]) .sorprendida{opacity:1}' +
':host([estado=escuchando]) .ondas,:host([estado=hablando]) .ondas{opacity:calc(.35 + var(--nivel)*.65)}' +
':host([estado=sorprendida]) .destello{opacity:1}' +

// Movimiento (solo si el sistema no pide reducirlo y no está «quieta»)
'@media (prefers-reduced-motion:no-preference){' +
  ':host(:not([quieta])) .flota{animation:flotar 4s ease-in-out infinite}' +
  ':host(:not([quieta])) .aro.a2{animation:aro 4s ease-in-out infinite}' +
  ':host(:not([quieta])) .rayo{animation:chispa 2.6s steps(1,end) infinite}' +
  ':host(:not([quieta])) .r2{animation-delay:-.7s}:host(:not([quieta])) .r3{animation-delay:-1.3s}' +
  ':host(:not([quieta])) .r4{animation-delay:-1.9s}:host(:not([quieta])) .r5{animation-delay:-.4s}' +
  ':host(:not([quieta])) .nucleo{animation:latir 3.2s ease-in-out infinite}' +
  ':host(:not([quieta])[estado=escuchando]) .luz{animation:pulso 1.1s ease-in-out infinite}' +
  ':host(:not([quieta])[estado=escuchando]) .onda,:host(:not([quieta])[estado=hablando]) .onda{animation:ondear 1.2s ease-out infinite}' +
  ':host(:not([quieta])[estado=escuchando]) .o2,:host(:not([quieta])[estado=hablando]) .o2{animation-delay:.25s}' +
  ':host(:not([quieta])[estado=escuchando]) .ojo{animation:parpadeo 4.5s ease-in-out infinite}' +
  ':host(:not([quieta])[estado=pensando]) .nucleo{animation:latir 1.1s ease-in-out infinite}' +
  ':host(:not([quieta])[estado=pensando]) .p{animation:subir 1.8s ease-in-out infinite}' +
  ':host(:not([quieta])[estado=pensando]) .p2{animation-delay:.3s}:host(:not([quieta])[estado=pensando]) .p3{animation-delay:.6s}' +
  ':host(:not([quieta])[estado=pensando]) .rayo{animation-duration:1.4s}' +
  ':host(:not([quieta])[estado=hablando]) .boca{animation:hablar .38s ease-in-out infinite alternate}' +
  ':host(:not([quieta])[estado=hablando]) .luz{animation:pulso .76s ease-in-out infinite}' +
  ':host(:not([quieta])[estado=sorprendida]) .flota{animation:salto .5s cubic-bezier(.2,1.6,.4,1) 1,flotar 4s ease-in-out .5s infinite}' +
  ':host(:not([quieta])[estado=sorprendida]) .destello{animation:destello .7s ease-out 1 both}' +
  ':host(:not([quieta])[estado=sorprendida]) .rayo{animation:chispa .5s steps(1,end) 2}' +
'}' +
// Con nivel de voz real, la boca y las luces siguen el nivel en vez del ciclo fijo
':host([con-nivel][estado=hablando]) .boca{animation:none;transform:scaleY(calc(.25 + var(--nivel)*.95))}' +
':host([con-nivel]) .luz{animation:none;opacity:calc(.45 + var(--nivel)*.55)}' +

'@keyframes flotar{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}' +
'@keyframes aro{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(.93);opacity:.65}}' +
'@keyframes chispa{0%,100%{opacity:.25}8%{opacity:1}16%{opacity:.4}24%{opacity:1}40%{opacity:.25}}' +
'@keyframes latir{0%,100%{transform:scale(.8);opacity:.45}50%{transform:scale(1.25);opacity:1}}' +
'@keyframes pulso{0%,100%{opacity:.45}50%{opacity:1}}' +
'@keyframes ondear{0%{opacity:0;transform:scale(.9)}30%{opacity:1}100%{opacity:0;transform:scale(1.12)}}' +
'@keyframes parpadeo{0%,92%,100%{transform:scaleY(1)}96%{transform:scaleY(.12)}}' +
'@keyframes subir{0%,100%{transform:translateY(4px);opacity:.3}50%{transform:translateY(-6px);opacity:1}}' +
'@keyframes hablar{0%{transform:scaleY(.3)}100%{transform:scaleY(1.05)}}' +
'@keyframes salto{0%{transform:translateY(0) scale(1)}40%{transform:translateY(-22px) scale(1.05)}100%{transform:translateY(0) scale(1)}}' +
'@keyframes destello{0%{opacity:0;transform:scale(.6)}30%{opacity:1;transform:scale(1.1)}100%{opacity:1;transform:scale(1)}}';

  var _hoja;
  function hojaCompartida() {
    if (_hoja !== undefined) return _hoja;
    try { _hoja = new CSSStyleSheet(); _hoja.replaceSync(CSS); } catch (e) { _hoja = null; }
    return _hoja;
  }

  class GabySpark extends HTMLElement {
    static get observedAttributes() { return ['estado', 'piel']; }
    constructor() {
      super();
      var id = ++n;
      var raiz = this.attachShadow({ mode: 'open' });
      // Con una política de seguridad estricta (style-src 'self') no se permiten estilos en línea:
      // se usa una hoja construida por código, que sí está permitida. Si el navegador no la tiene, va en <style>.
      var hoja = hojaCompartida();
      raiz.innerHTML = (hoja ? '' : '<style>' + CSS + '</style>') + svg(id);
      if (hoja) raiz.adoptedStyleSheets = [hoja];
      this._titulo = raiz.querySelector('title');
      this._piel = raiz.querySelector('image.piel');
      this._vuelve = null;
    }
    connectedCallback() {
      if (!this.hasAttribute('estado')) this.setAttribute('estado', 'feliz');
      this._nombrar();
    }
    attributeChangedCallback(nombre) {
      if (nombre === 'piel') {
        var ruta = this.getAttribute('piel');
        if (ruta) this._piel.setAttribute('href', ruta); else this._piel.removeAttribute('href');
        return;
      }
      if (this.hasAttribute('estado') && ESTADOS.indexOf(this.getAttribute('estado')) < 0) {
        this.setAttribute('estado', 'feliz');
        return;
      }
      this._nombrar();
      this.dispatchEvent(new CustomEvent('gaby-estado', { detail: { estado: this.estado }, bubbles: true }));
    }
    _nombrar() {
      if (this._titulo) this._titulo.textContent =
        'Gaby Spark, asistente de inteligencia artificial de NOVA. Está ' + NOMBRES[this.estado] + '.';
    }
    get estado() { return this.getAttribute('estado') || 'feliz'; }
    set estado(v) { this.setAttribute('estado', v); }
    get nivel() { return parseFloat(this.style.getPropertyValue('--nivel')) || 0; }
    set nivel(v) {
      v = Math.max(0, Math.min(1, Number(v) || 0));
      this.style.setProperty('--nivel', String(v));
      this.setAttribute('con-nivel', '');
    }
    soltarNivel() { this.removeAttribute('con-nivel'); this.style.removeProperty('--nivel'); }
    reaccionar(estado, ms) {
      var antes = this._vuelve ? this._vuelve.antes : this.estado;
      if (this._vuelve) clearTimeout(this._vuelve.t);
      this.estado = estado;
      var yo = this;
      this._vuelve = { antes: antes, t: setTimeout(function () { yo.estado = antes; yo._vuelve = null; }, ms || 1200) };
    }
  }
  GabySpark.ESTADOS = ESTADOS;
  customElements.define('gaby-spark', GabySpark);
})();
