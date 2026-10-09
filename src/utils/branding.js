// La marca de cada empresa: su logo y sus colores. El logo llega como data URL (PNG, JPG o WEBP; nunca SVG, que puede
// llevar código) y se guarda en la base; los colores, como hexadecimal #rrggbb.
const HEX = /^#[0-9a-f]{6}$/i;
const IMAGE = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/;
const MAX_LOGO_BYTES = 300 * 1024;

// Revisa los bytes reales (no solo lo que dice el data URL): PNG, JPEG o WEBP.
const looksLike = (buf, type) => {
  if (type === 'image/png') return buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (type === 'image/jpeg') return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  return buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP';
};

// { ok, value } o { error }. value: { primary?, accent?, logo?: { data, type } | null }
const parseBranding = (body = {}) => {
  const out = {};
  for (const key of ['primary', 'accent']) {
    if (body[key] === undefined) continue;
    if (body[key] === null || body[key] === '') { out[key] = null; continue; }
    if (!HEX.test(String(body[key]))) return { error: 'Los colores deben ser como #2f78f6' };
    out[key] = String(body[key]).toLowerCase();
  }
  if (body.logo !== undefined) {
    if (body.logo === null || body.logo === '') {
      out.logo = null;
    } else {
      const m = IMAGE.exec(String(body.logo));
      if (!m) return { error: 'El logo debe ser una imagen PNG, JPG o WEBP' };
      const data = Buffer.from(m[2], 'base64');
      if (data.length > MAX_LOGO_BYTES) return { error: 'El logo es muy pesado: máximo 300 KB' };
      if (!looksLike(data, m[1])) return { error: 'El archivo no es una imagen válida' };
      out.logo = { data, type: m[1] };
    }
  }
  return { ok: true, value: out };
};

// Lo que ve la app (sin los bytes del logo: se piden aparte por /api/public/logo/:id).
const publicBranding = (company) => {
  const b = (company && company.branding) || {};
  return {
    primary: b.primary || null,
    accent: b.accent || null,
    hasLogo: Boolean(b.logoType),
    logoVersion: b.updatedAt ? new Date(b.updatedAt).getTime() : 0,
  };
};

module.exports = { parseBranding, publicBranding, MAX_LOGO_BYTES };
