// Arma el schema FAQPage (JSON-LD) de las cuatro portadas con las preguntas que de verdad muestra cada página: las
// <details> de <div class="faq">, sin los bloques de «Lo que todavía no hace» (son listas, no una pregunta). Así Google
// lee lo mismo que ve el visitante. Se corre después de cambiar una pregunta:
//   node src/scripts/faqLanding.js
// test/seo.test.js revisa que el JSON-LD y la página digan lo mismo.
const fs = require('node:fs');
const path = require('node:path');

const LANDING = path.join(__dirname, '..', '..', 'landing');
const PORTADAS = ['index.html', 'en/index.html', 'es-us/index.html', 'es-mx/index.html'];
const LD = /\n?  <script type="application\/ld\+json" id="faq-ld">[\s\S]*?<\/script>/;

const entidades = { '&nbsp;': ' ', '&amp;': '&', '&quot;': '"', '&#39;': "'", '&lt;': '<', '&gt;': '>' };
const texto = (html) => html.replace(/<[^>]+>/g, '').replace(/&[a-z#0-9]+;/g, (e) => entidades[e] || e).replace(/\s+/g, ' ').trim();

// [{ q, a }] de la sección de preguntas de una portada.
const preguntas = (html) => {
  const ini = html.indexOf('<div class="faq">');
  if (ini < 0) throw new Error('sin <div class="faq">');
  const fin = html.indexOf('<div class="cta-row">', ini);
  const faq = html.slice(ini, fin < 0 ? undefined : fin);
  const out = [];
  for (const m of faq.matchAll(/<details(?: class="([^"]*)")?>\s*<summary>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/g)) {
    if ((m[1] || '').includes('limites')) continue;
    out.push({ q: texto(m[2]), a: texto(m[3]) });
  }
  return out;
};

const bloque = (lista) => {
  const json = JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: lista.map(({ q, a }) => (
    { '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) });
  return `\n  <script type="application/ld+json" id="faq-ld">\n${json.replace(/</g, '\\u003c')}\n  </script>`;
};

// Devuelve el HTML con el bloque puesto (o cambiado) justo después del primer JSON-LD de la página.
const conFaq = (html) => {
  const limpio = html.replace(LD, '').replace(/\n  <!-- FAQPAGE -->/, '');
  const primero = limpio.indexOf('<script type="application/ld+json">');
  const corte = limpio.indexOf('</script>', primero) + '</script>'.length;
  return limpio.slice(0, corte) + bloque(preguntas(limpio)) + limpio.slice(corte);
};

if (require.main === module) {
  for (const f of PORTADAS) {
    const file = path.join(LANDING, f);
    const html = fs.readFileSync(file, 'utf8');
    const nuevo = conFaq(html);
    if (nuevo !== html) fs.writeFileSync(file, nuevo);
    console.log(`${f}: ${preguntas(nuevo).length} preguntas`);
  }
}

module.exports = { preguntas, conFaq, PORTADAS };
