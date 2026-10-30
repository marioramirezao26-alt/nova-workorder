// IndexNow: tras cada actualización le avisa a Bing (y por él a ChatGPT y Copilot), Yandex y los demás buscadores qué
// páginas de novaworkorder.com cambiaron, para que la IA lea la versión nueva sin esperar a que el buscador vuelva solo.
// No pide cuenta: el buscador comprueba que el sitio es nuestro leyendo /<llave>.txt. La llave no es secreta (se publica
// en el sitio a propósito), pero igual no va en el repositorio: la crea el servidor la primera vez y la guarda fuera de
// la carpeta pública. Solo se avisa lo que cambió (huella de cada archivo frente a la vez anterior).
//   node src/scripts/indexnow.js --llave /opt/nova-workorder/deploy/.indexnow --estado /opt/nova-workorder/deploy/.indexnow-estado.json \
//        --web /var/www/novaworkorder [--probar]
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const https = require('node:https');

const SITIO = 'https://novaworkorder.com';
const API = 'https://api.indexnow.org/indexnow';

// Las URL del sitemap (las mismas que lee el buscador).
const urlsDelSitemap = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());

// Como Caddy (deploy/Caddyfile): try_files {path} {path}.html {path}/index.html
const archivoDe = (web, url) => {
  const p = decodeURIComponent(new URL(url).pathname);
  for (const c of [p, `${p}.html`, path.join(p, 'index.html')]) {
    const f = path.join(web, c);
    if (f.startsWith(web) && fs.existsSync(f) && fs.statSync(f).isFile()) return f;
  }
  return null;
};

const huella = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

// La llave: 32 caracteres hexadecimales (IndexNow pide de 8 a 128, letras, números y guiones).
const leerOCrearLlave = (archivo) => {
  if (fs.existsSync(archivo)) {
    const k = fs.readFileSync(archivo, 'utf8').trim();
    if (/^[a-zA-Z0-9-]{8,128}$/.test(k)) return k;
  }
  const k = crypto.randomBytes(16).toString('hex');
  fs.writeFileSync(archivo, `${k}\n`, { mode: 0o600 });
  return k;
};

// Qué URL cambiaron desde la vez anterior. Devuelve la lista y el estado nuevo (url -> huella).
const cambios = (web, urls, antes) => {
  const ahora = {};
  const lista = [];
  for (const u of urls) {
    if (!u.startsWith(`${SITIO}/`)) continue;
    const f = archivoDe(web, u);
    if (!f) continue;
    ahora[u] = huella(f);
    if (antes[u] !== ahora[u]) lista.push(u);
  }
  return { lista, ahora };
};

const enviar = (cuerpo) => new Promise((resolve) => {
  const datos = JSON.stringify(cuerpo);
  const req = https.request(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(datos) },
    timeout: 20000,
  }, (res) => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
  req.on('timeout', () => req.destroy(new Error('tiempo agotado')));
  req.on('error', (e) => resolve(`error: ${e.message}`));
  req.end(datos);
});

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };

const main = async () => {
  const web = path.resolve(arg('--web', '/var/www/novaworkorder'));
  const archivoLlave = arg('--llave', '/opt/nova-workorder/deploy/.indexnow');
  const archivoEstado = arg('--estado', '/opt/nova-workorder/deploy/.indexnow-estado.json');
  const probar = process.argv.includes('--probar');

  const llave = leerOCrearLlave(archivoLlave);
  fs.writeFileSync(path.join(web, `${llave}.txt`), llave, { mode: 0o644 });   // así el buscador comprueba que es nuestro

  const urls = urlsDelSitemap(fs.readFileSync(path.join(web, 'sitemap.xml'), 'utf8'));
  let antes = {};
  try { antes = JSON.parse(fs.readFileSync(archivoEstado, 'utf8')); } catch { /* primera vez: se avisan todas */ }
  const { lista, ahora } = cambios(web, urls, antes);

  if (!lista.length) { console.log('IndexNow: nada cambió'); return; }
  if (probar) { console.log(`IndexNow (prueba, no se envía): ${lista.length} URL\n${lista.join('\n')}`); return; }

  const estado = await enviar({ host: new URL(SITIO).host, key: llave, keyLocation: `${SITIO}/${llave}.txt`, urlList: lista });
  // 200 y 202 son «recibido». Si falla, no se guarda el estado: la próxima actualización lo vuelve a intentar.
  if (estado === 200 || estado === 202) {
    fs.writeFileSync(archivoEstado, JSON.stringify(ahora, null, 1));
    console.log(`IndexNow: ${lista.length} URL avisadas (${estado})`);
  } else {
    console.log(`IndexNow: no se pudo avisar (${estado}); se intenta en la próxima actualización`);
  }
};

if (require.main === module) main().catch((e) => { console.log(`IndexNow: ${e.message}`); });

module.exports = { urlsDelSitemap, archivoDe, cambios, leerOCrearLlave };
