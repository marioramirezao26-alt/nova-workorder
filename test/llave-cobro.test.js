// P-061 (Mario, 3-nov-2026): la llave Bre-B de cobro es @bold1093742000. La vieja (@BOLD3103767561) lleva el número 310
// retirado (regla 3) y no puede salir en nada que vea un cliente: la página, el chat ni sus textos.
// P-065 (Mario, 3-nov-2026: «quitemos el pago por QR, solo dejemos la llave»): en Colombia se paga con Bold o a la llave;
// ninguna página, artículo del blog (ni su fuente) ni el chat da el QR como forma de pago.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.join(__dirname, '..');
const archivos = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(dir, e.name);
  if (e.isDirectory()) return e.name === 'node_modules' ? [] : archivos(p);
  return /\.(html|js|json|txt|xml|md|svg)$/i.test(e.name) ? [p] : [];
});

test('ningún archivo que ve un cliente lleva la llave de cobro vieja', () => {
  const vistos = [...archivos(path.join(raiz, 'landing')), ...archivos(path.join(raiz, 'src'))];
  assert.ok(vistos.length > 10);
  const malos = vistos.filter((f) => /bold3103767561/i.test(fs.readFileSync(f, 'utf8')));
  assert.deepStrictEqual(malos.map((f) => path.relative(raiz, f)), []);
});

test('la página y el chat dan la llave nueva', () => {
  const index = fs.readFileSync(path.join(raiz, 'landing', 'index.html'), 'utf8');
  assert.match(index, /@bold1093742000/);
  const faq = JSON.parse(index.match(/<script type="application\/ld\+json" id="faq-ld">([\s\S]*?)<\/script>/)[1]);
  assert.ok(JSON.stringify(faq).includes('@bold1093742000'));
  assert.match(require('../src/utils/salesChat').FACTS, /@bold1093742000/);
});

// El QR impreso de la tienda (artículo 3: «Impreso con un código QR en el empaque o en el mostrador») abre la tienda: no es
// una forma de pago y se deja.
const QR_DE_TIENDA = /c[oó]digo QR (?:en el empaque|de (?:tu|la) tienda)/gi;
const texto = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
const qrDePago = (html) => {
  const t = texto(html).replace(QR_DE_TIENDA, '');
  return [...t.matchAll(/\bQR\b/gi)].map((m) => t.slice(Math.max(0, m.index - 120), m.index + 120))
    .filter((cerca) => /\bbold\b|bre-?b|\bpag/i.test(cerca));
};

test('ninguna página ni artículo del blog da el QR como forma de pago (P-065)', () => {
  // la prueba sí ve el caso de antes, y deja pasar el QR de la tienda
  assert.strictEqual(qrDePago('<li>En Colombia se paga con <strong>Bold, llave Bre-B o código QR</strong>.</li>').length, 1);
  assert.strictEqual(qrDePago('<h3>¿Con qué puedo pagar en Colombia?</h3>\n<p>Con código QR.</p>').length, 1);
  assert.strictEqual(qrDePago('<li>Impreso con un código QR en el empaque o en el mostrador, para que el cliente repita.</li>'
    + '<li>Se paga con Bold o llave Bre-B.</li>').length, 0);
  const vistos = [...archivos(path.join(raiz, 'landing')), ...archivos(path.join(raiz, 'docs', 'blog'))];
  assert.ok(vistos.some((f) => f.includes(path.join('docs', 'blog'))) && vistos.length > 10);
  const malos = vistos.map((f) => [path.relative(raiz, f), qrDePago(fs.readFileSync(f, 'utf8'))]).filter(([, q]) => q.length);
  assert.deepStrictEqual(malos, []);
  const chat = require('../src/utils/salesChat');
  for (const k of ['FACTS', 'FACTS_EN', 'FACTS_US_ES', 'FACTS_MX']) assert.doesNotMatch(chat[k], /\bQR\b/i, k);
});
