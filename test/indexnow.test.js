// IndexNow (src/scripts/indexnow.js): qué URL del sitemap se avisan, la llave y que el archivo de verificación sale.
// Sin red: la función que envía no se llama aquí.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { urlsDelSitemap, archivoDe, cambios, leerOCrearLlave } = require('../src/scripts/indexnow');

const LANDING = path.join(__dirname, '..', 'landing');

test('cada URL del sitemap real tiene su archivo (como Caddy) y la primera vez se avisan todas', () => {
  const urls = urlsDelSitemap(fs.readFileSync(path.join(LANDING, 'sitemap.xml'), 'utf8'));
  assert.ok(urls.length >= 20);
  for (const u of urls) assert.ok(archivoDe(LANDING, u), `sin archivo: ${u}`);
  const { lista, ahora } = cambios(LANDING, urls, {});
  assert.equal(lista.length, urls.length);
  // La segunda vez, sin cambios, no se avisa nada.
  assert.deepEqual(cambios(LANDING, urls, ahora).lista, []);
});

test('solo se avisa la página que cambió; las de otro sitio o sin archivo no', () => {
  const web = fs.mkdtempSync(path.join(os.tmpdir(), 'indexnow-'));
  fs.writeFileSync(path.join(web, 'index.html'), 'a');
  fs.mkdirSync(path.join(web, 'blog'));
  fs.writeFileSync(path.join(web, 'blog', 'index.html'), 'b');
  const urls = ['https://novaworkorder.com/', 'https://novaworkorder.com/blog/', 'https://otro.com/', 'https://novaworkorder.com/no-existe'];
  const { ahora } = cambios(web, urls, {});
  assert.deepEqual(Object.keys(ahora), ['https://novaworkorder.com/', 'https://novaworkorder.com/blog/']);
  fs.writeFileSync(path.join(web, 'blog', 'index.html'), 'b2');
  assert.deepEqual(cambios(web, urls, ahora).lista, ['https://novaworkorder.com/blog/']);
  // Nada fuera de la carpeta pública.
  assert.equal(archivoDe(web, 'https://novaworkorder.com/../../etc/passwd'), null);
});

test('la llave se crea una vez, privada, y se reutiliza', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'indexnow-'));
  const f = path.join(dir, '.indexnow');
  const k = leerOCrearLlave(f);
  assert.match(k, /^[a-f0-9]{32}$/);
  assert.equal(fs.statSync(f).mode & 0o777, 0o600);
  assert.equal(leerOCrearLlave(f), k);
});

test('--probar publica el archivo de verificación y no envía ni guarda estado', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'indexnow-'));
  const web = path.join(dir, 'web');
  fs.cpSync(LANDING, web, { recursive: true });
  const salida = execFileSync(process.execPath, [path.join(__dirname, '..', 'src', 'scripts', 'indexnow.js'),
    '--web', web, '--llave', path.join(dir, '.indexnow'), '--estado', path.join(dir, 'estado.json'), '--probar'], { encoding: 'utf8' });
  const k = fs.readFileSync(path.join(dir, '.indexnow'), 'utf8').trim();
  assert.equal(fs.readFileSync(path.join(web, `${k}.txt`), 'utf8'), k);
  assert.match(salida, /prueba, no se envía/);
  assert.equal(fs.existsSync(path.join(dir, 'estado.json')), false);
});
