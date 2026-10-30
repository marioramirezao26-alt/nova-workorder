// Imágenes de ejemplo generadas aquí mismo (PNG, sin librerías ni archivos): el logo de la cuenta de demostración, las
// fotos «antes / después» de un equipo de aire acondicionado y la firma. Solo figuras y colores: ninguna persona, ninguna
// foto real.
const zlib = require('zlib');

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

// PNG de `width` × `height` en color (RGB); `paint(x, y)` devuelve [r, g, b] de cada punto.
const png = (width, height, paint) => {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  let o = 0;
  for (let y = 0; y < height; y += 1) {
    raw[o++] = 0;                                   // sin filtro
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = paint(x, y);
      raw[o++] = r; raw[o++] = g; raw[o++] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const inRect = (x, y, x0, y0, x1, y1) => x >= x0 && x < x1 && y >= y0 && y < y1;

// Logo: un copo de nieve sencillo (seis brazos) en blanco sobre un círculo del color principal.
const logo = (primary = '#0e7490', accent = '#f59e0b') => {
  const size = 256;
  const c = size / 2;
  const [p, a, white] = [hex(primary), hex(accent), [255, 255, 255]];
  return png(size, size, (x, y) => {
    const dx = x - c;
    const dy = y - c;
    const r = Math.hypot(dx, dy);
    if (r > 120) return white;
    if (r > 110) return a;
    const ang = Math.atan2(dy, dx);
    const arm = Math.abs(Math.sin(3 * ang)) * r;   // distancia a uno de los 6 brazos
    if (r < 90 && arm < 7) return white;
    if (r < 14) return white;
    return p;
  });
};

// Foto de un equipo de aire acondicionado en la pared: «antes» con polvo y manchas, «después» limpio.
const photo = (kind = 'antes', seed = 1) => {
  const [w, h] = [480, 360];
  const wall = kind === 'antes' ? hex('#d6cbb5') : hex('#e6eef2');
  const body = kind === 'antes' ? hex('#c9c4b8') : hex('#f7f9fa');
  const vent = kind === 'antes' ? hex('#8f877a') : hex('#b9c4cc');
  const dirt = hex('#7a6a4f');
  const led = kind === 'antes' ? hex('#c0392b') : hex('#27ae60');
  let s = seed * 9301 + 49297;
  const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const spots = kind === 'antes' ? Array.from({ length: 28 }, () => [70 + rand() * 340, 90 + rand() * 120, 3 + rand() * 7]) : [];
  return png(w, h, (x, y) => {
    if (y > 300) return hex('#9aa5ab');                                  // piso
    if (inRect(x, y, 60, 80, 420, 220)) {
      if (spots.some(([sx, sy, sr]) => Math.hypot(x - sx, y - sy) < sr)) return dirt;
      if (inRect(x, y, 90, 175, 390, 205) && (y - 175) % 8 < 3) return vent;   // rejilla
      if (Math.hypot(x - 395, y - 100) < 5) return led;
      if (y < 86 || y > 214 || x < 66 || x > 414) return vent;           // borde
      return body;
    }
    if (inRect(x, y, 230, 220, 240, 300)) return hex('#7f8c8d');         // tubo de desagüe
    return wall;
  });
};

// Firma: un trazo azul a mano alzada sobre blanco (no es la firma de nadie).
const signature = () => {
  const [w, h] = [400, 160];
  const ink = hex('#1f3a93');
  return png(w, h, (x, y) => {
    const t = x / w;
    const curve = 80 + Math.sin(t * Math.PI * 5) * 30 * (1 - t * 0.6) + Math.sin(t * Math.PI * 13) * 8;
    if (x > 30 && x < 370 && Math.abs(y - curve) < 2.5) return ink;
    if (x > 40 && x < 360 && Math.abs(y - 135) < 1) return hex('#bdc3c7');   // renglón
    return [255, 255, 255];
  });
};

module.exports = { png, logo, photo, signature };
