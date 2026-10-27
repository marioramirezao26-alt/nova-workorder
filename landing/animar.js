// Aparición discreta de los bloques al bajar por la página (es y en). Solo con IntersectionObserver y sin «reducir
// movimiento»; si este archivo no carga o falla, la página se ve completa sin animación (el CSS solo oculta con .js-anim).
(function () {
  if (!('IntersectionObserver' in window)) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var SEL = 'main section:not(.hero) .center, .pains > *, .features > .feature, .flujo > li, .steps > .step, .prices > .price, '
    + '.split > *, .screen, .promo, .store-demo, .pago > details, .quien, .demo-intro, #demo-form, #start-form, .demo-aside';
  var els = Array.prototype.slice.call(document.querySelectorAll(SEL));
  var alto = window.innerHeight || 800;
  els.forEach(function (el) {
    // Lo que ya se ve al cargar no se anima (sin parpadeo arriba).
    if (el.getBoundingClientRect().top < alto) return;
    el.classList.add('reveal');
    var i = Array.prototype.indexOf.call(el.parentNode.children, el);
    if (i > 0) el.style.transitionDelay = Math.min(i, 4) * 70 + 'ms';
  });
  var obs = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      en.target.classList.add('visto');
      obs.unobserve(en.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  els.forEach(function (el) { if (el.classList.contains('reveal')) obs.observe(el); });
  document.documentElement.classList.add('js-anim');
})();
