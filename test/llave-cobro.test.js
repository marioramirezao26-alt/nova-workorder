// P-061 (Mario, 3-nov-2026): la llave Bre-B de cobro es @bold1093742000. La vieja (@BOLD3103767561) lleva el número 310
// retirado (regla 3) y no puede salir en nada que vea un cliente: la página, el chat ni sus textos.
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
