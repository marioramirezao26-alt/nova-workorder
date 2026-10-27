#!/usr/bin/env node
// Render del video promocional y de su portada a partir de escenas.html y portada.html.
//
// Requisitos: Node 18+, Playwright con Chromium y ffmpeg. Si Playwright está instalado de forma global:
//   NODE_PATH=$(npm root -g) node render.js video        → ../novaworkorder.mp4
//   NODE_PATH=$(npm root -g) node render.js portada      → ../portada.webp
//   NODE_PATH=$(npm root -g) node render.js previa 0 12.5 36.9   → PNG de esos instantes en /tmp/nova-previa/
//
// El audio sale de la pista del video actual (../novaworkorder.mp4) con -map, sin recodificar.
// Para usar otra pista: AUDIO=/ruta/al/video-o-audio node render.js video
// Los cuadros van por tubería directo a ffmpeg: no se escribe ningún cuadro en disco.
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const AQUI = __dirname;
const FPS = 30;
const DURACION = 45;            // segundos; la landing dice «Son 45 segundos».
const ANCHO = 1280, ALTO = 720;
const VIDEO = path.join(AQUI, '..', 'novaworkorder.mp4');
const PORTADA = path.join(AQUI, '..', 'portada.webp');

function ffmpeg(args) {
  const p = spawn('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: ['pipe', 'inherit', 'inherit'] });
  const fin = new Promise((ok, mal) => p.on('close', (c) => (c === 0 ? ok() : mal(new Error('ffmpeg salió con ' + c)))));
  return { p, fin };
}

async function abrir(archivo) {
  const navegador = await chromium.launch();
  const pagina = await navegador.newPage({ viewport: { width: ANCHO, height: ALTO }, deviceScaleFactor: 1 });
  await pagina.goto('file://' + path.join(AQUI, archivo), { waitUntil: 'load' });
  await pagina.evaluate(() => window.listo);
  return { navegador, pagina };
}

async function video() {
  const audio = process.env.AUDIO || VIDEO;
  if (!fs.existsSync(audio)) throw new Error('No encuentro la pista de audio: ' + audio);
  const tmpVideo = path.join(os.tmpdir(), 'nova-video-mudo.mp4');
  const tmpFinal = path.join(os.tmpdir(), 'nova-video.mp4');
  const { navegador, pagina } = await abrir('escenas.html');
  // 1) Cuadros → h264 sin audio. CRF alto con preset lento: el video es casi todo planos de color y texto.
  const enc = ffmpeg(['-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264', '-preset', 'veryslow', '-tune', 'animation', '-crf', process.env.CRF || '27',
    '-x264-params', 'keyint=150:min-keyint=30', '-pix_fmt', 'yuv420p', '-r', String(FPS), tmpVideo]);
  const total = Math.round(DURACION * FPS);
  for (let i = 0; i < total; i++) {
    await pagina.evaluate((t) => window.ponerTiempo(t), i / FPS);
    const png = await pagina.screenshot({ type: 'png' });
    if (!enc.p.stdin.write(png)) await new Promise((r) => enc.p.stdin.once('drain', r));
    if (i % 150 === 0) process.stdout.write(`cuadro ${i}/${total}\n`);
  }
  enc.p.stdin.end();
  await enc.fin;
  await navegador.close();
  // 2) Video nuevo + pista de audio original (copiada tal cual). -t recorta el audio si sobra;
  //    si faltara, apad lo rellena con silencio (solo en ese caso se recodifica).
  const dur = await duracionAudio(audio);
  const audioArgs = dur + 0.05 >= DURACION ? ['-c:a', 'copy'] : ['-af', 'apad', '-c:a', 'aac', '-b:a', '96k'];
  const mux = ffmpeg(['-i', tmpVideo, '-i', audio, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', ...audioArgs,
    '-t', String(DURACION + 0.004), '-movflags', '+faststart', tmpFinal]);
  mux.p.stdin.end();
  await mux.fin;
  fs.copyFileSync(tmpFinal, VIDEO);
  fs.unlinkSync(tmpFinal); fs.unlinkSync(tmpVideo);
  console.log('Listo:', VIDEO, (fs.statSync(VIDEO).size / 1e6).toFixed(2), 'MB');
}

function duracionAudio(archivo) {
  return new Promise((ok, mal) => {
    const p = spawn('ffprobe', ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=duration', '-of', 'csv=p=0', archivo]);
    let s = ''; p.stdout.on('data', (d) => (s += d));
    p.on('close', (c) => (c === 0 ? ok(parseFloat(s)) : mal(new Error('ffprobe falló'))));
  });
}

async function portada() {
  const { navegador, pagina } = await abrir('portada.html');
  const png = await pagina.screenshot({ type: 'png' });
  await navegador.close();
  const enc = ffmpeg(['-f', 'image2pipe', '-c:v', 'png', '-i', '-', '-c:v', 'libwebp', '-quality', process.env.CALIDAD || '82',
    '-compression_level', '6', PORTADA]);
  enc.p.stdin.end(png);
  await enc.fin;
  console.log('Listo:', PORTADA, (fs.statSync(PORTADA).size / 1e3).toFixed(0), 'KB');
}

async function previa(tiempos) {
  const dir = path.join(os.tmpdir(), 'nova-previa');
  fs.mkdirSync(dir, { recursive: true });
  const { navegador, pagina } = await abrir('escenas.html');
  for (const t of tiempos) {
    await pagina.evaluate((x) => window.ponerTiempo(x), t);
    await pagina.screenshot({ path: path.join(dir, `t_${t.toFixed(2)}.png`) });
  }
  await navegador.close();
  console.log('Previas en', dir);
}

(async () => {
  const [modo, ...resto] = process.argv.slice(2);
  if (modo === 'video') await video();
  else if (modo === 'portada') await portada();
  else if (modo === 'previa') await previa(resto.map(parseFloat));
  else { console.log('Uso: node render.js video | portada | previa <segundos...>'); process.exit(1); }
})().catch((e) => { console.error(e); process.exit(1); });
