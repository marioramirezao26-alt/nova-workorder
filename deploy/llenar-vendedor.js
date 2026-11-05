#!/usr/bin/env node
'use strict';
// Los datos de quien vende en /kit (Ley 1480, art. 50 a: nombre, cédula o NIT y dirección para notificaciones) NO van en
// el repositorio, que es público (revisión de Bruno, 3-nov-2026). landing/kit.html trae los marcadores {{VENDEDOR_NOMBRE}},
// {{VENDEDOR_ID}} y {{VENDEDOR_DIRECCION}}, y este script los llena al publicar (publicar-web.sh y actualizar.sh, antes de
// sin-falta-dato.sh) desde un archivo del servidor que pone Mario, fuera del repositorio, de root y en 600:
//   /etc/nova-workorder/vendedor-kit     tres líneas: VENDEDOR_NOMBRE=…, VENDEDOR_ID=… y VENDEDOR_DIRECCION=…
//   node llenar-vendedor.js CARPETA [ARCHIVO]
// Sale con 0 si llenó todo, o si ninguna página trae marcadores (y entonces ni abre el archivo). Sale con 1, sin cambiar
// nada, si una página trae un marcador y el archivo falta, lo pueden leer otros, no es de root (cuando corre como root), le
// falta un dato o trae algo raro. Nunca escribe los datos en la pantalla.
const fs = require('node:fs');
const path = require('node:path');

const ARCHIVO = '/etc/nova-workorder/vendedor-kit';
const CLAVES = ['VENDEDOR_NOMBRE', 'VENDEDOR_ID', 'VENDEDOR_DIRECCION'];
const HAY = /\{\{VENDEDOR_[A-Z_]+\}\}/;
const MARCAS = /\{\{(VENDEDOR_[A-Z_]+)\}\}/g;

function paginas(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const f = path.join(dir, d.name);
    if (d.isDirectory()) return paginas(f);
    return /\.html?$/.test(d.name) ? [f] : [];
  });
}

const escapar = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

function leerDatos(archivo) {
  let st;
  try { st = fs.statSync(archivo); } catch (e) {
    throw new Error(`no está ${archivo}: lo pone Mario (README.md, «Piloto del kit: antes de abrir la venta»)`);
  }
  if (!st.isFile()) throw new Error(`${archivo} no es un archivo`);
  if (st.mode & 0o077) throw new Error(`a ${archivo} lo pueden leer otros: debe estar en 600 (sudo chmod 600 ${archivo})`);
  if (typeof process.getuid === 'function' && process.getuid() === 0 && st.uid !== 0) {
    throw new Error(`${archivo} debe ser de root (sudo chown root:root ${archivo})`);
  }
  const datos = {};
  fs.readFileSync(archivo, 'utf8').replace(/^﻿/, '').split(/\r?\n/).forEach((linea, i) => {
    const l = linea.trim();
    if (!l || l.startsWith('#')) return;
    const m = l.match(/^([A-Z_]+)\s*=(.*)$/);
    if (!m || !CLAVES.includes(m[1])) throw new Error(`la línea ${i + 1} de ${archivo} no es ${CLAVES.join('=, ')}=`);
    if (m[1] in datos) throw new Error(`${m[1]} está dos veces en ${archivo}`);
    let v = m[2].trim();
    if (v.length >= 2 && (v[0] === '"' || v[0] === "'") && v[v.length - 1] === v[0]) v = v.slice(1, -1).trim();
    datos[m[1]] = v;
  });
  for (const k of CLAVES) {
    const v = datos[k];
    if (!v) throw new Error(`a ${archivo} le falta ${k}`);
    if (v.length > 200 || /[\u0000-\u001f\u007f]|\{\{|\}\}|FALTA DATO/i.test(v)) {
      throw new Error(`${k} en ${archivo} trae algo raro (muy largo, un marcador o un carácter de control)`);
    }
  }
  return datos;
}

function llenar(dir, archivo = ARCHIVO) {
  const con = paginas(dir).filter((f) => HAY.test(fs.readFileSync(f, 'utf8')));
  if (!con.length) return [];
  const datos = leerDatos(archivo);
  // primero se arma todo y después se escribe: si algo falla, no queda una página a medias
  const nuevas = con.map((f) => [f, fs.readFileSync(f, 'utf8').replace(MARCAS, (todo, k) => {
    if (!CLAVES.includes(k)) throw new Error(`${path.relative(dir, f)} trae un marcador que no conozco: ${k}`);
    return escapar(datos[k]);
  })]);
  for (const [f, html] of nuevas) fs.writeFileSync(f, html);
  return con.map((f) => path.relative(dir, f));
}

if (require.main === module) {
  const [dir, archivo] = process.argv.slice(2);
  if (!dir) { console.error('uso: node llenar-vendedor.js CARPETA [ARCHIVO]'); process.exit(2); }
  try {
    const hechas = llenar(dir, archivo || ARCHIVO);
    console.log(hechas.length ? `>> Datos de quien vende puestos en: ${hechas.join(', ')}` : '>> Ninguna página pide los datos de quien vende');
  } catch (e) {
    console.log(`>> No puse los datos de quien vende: ${e.message}`);
    process.exit(1);
  }
}

module.exports = { llenar, leerDatos };
