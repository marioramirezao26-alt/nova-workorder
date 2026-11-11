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
    '<feGaussianBlur in="SourceAlpha" stdDeviation="16" result="a"/><feFlood flood-color="#0B5BFF"/><feComposite in2="a" operator="in" result="lejos"/>' +
    '<feGaussianBlur in="SourceAlpha" stdDeviation="6" result="b"/><feFlood flood-color="#2EA8FF"/><feComposite in2="b" operator="in" result="cerca"/>' +
    '<feMerge><feMergeNode in="lejos"/><feMergeNode in="lejos"/><feMergeNode in="cerca"/><feMergeNode in="cerca"/><feMergeNode in="SourceGraphic"/></feMerge>' +
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
    '<ellipse cx="205" cy="340" rx="96" ry="16" fill="#22D3EE" opacity=".3" filter="' + u('difuso') + '"/>' +
    '<image class="piel" x="0" y="40" width="400" height="308.7" preserveAspectRatio="xMidYMid meet"/>' +
    '<circle class="nucleo" cx="243" cy="232" r="22" fill="' + u('halo') + '"/>' +
    '<ellipse class="luz" cx="63" cy="210" rx="27" ry="42" fill="#D77BFF" filter="' + u('difuso') + '"/>' +
    '<ellipse class="luz" cx="368" cy="188" rx="9" ry="48" fill="#D77BFF" filter="' + u('difuso') + '"/>' +
  '</g>' +

  // Caras: una por estado; solo se ve la del estado activo.
  // Medidas tomadas de la imagen aprobada (lienzo de 635 × 440): ojo izquierdo centrado en (320,222), derecho en (498,210), boca en (418,297).
  '<g class="caras" transform="translate(-38 52) scale(.6)" fill="none" stroke-linecap="round" stroke-linejoin="round">' +
    '<g class="ojos" stroke="#CFEFFF" filter="' + u('ojo') + '">' +
      '<g class="cara feliz">' +
        '<path d="M263 245 C275 200 345 185 381 236" stroke-width="27"/><path d="M447 229 C462 180 520 172 550 231" stroke-width="27"/>' +
      '</g>' +
      '<g class="cara escuchando">' +
        '<rect class="ojo" x="307" y="186" width="27" height="70" rx="13.5" fill="#CFEFFF" stroke="none"/>' +
        '<rect class="ojo" x="486" y="176" width="25" height="66" rx="12.5" fill="#CFEFFF" stroke="none"/>' +
      '</g>' +
      '<g class="cara pensando">' +
        '<path d="M270 228 L372 222" stroke-width="23"/><path d="M450 218 C470 200 522 196 548 216" stroke-width="23"/>' +
      '</g>' +
      '<g class="cara hablando">' +
        '<path d="M263 241 C275 196 345 181 381 232" stroke-width="27"/><path d="M447 225 C462 176 520 168 550 227" stroke-width="27"/>' +
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
