// De dónde llegó un visitante de la página de ventas: el `utm_source` del enlace (los posts de GABY lo llevan) o, si
// no hay, el sitio que lo trajo (referrer). Solo se guarda el nombre del canal, nunca el enlace completo.
const CHANNELS = ['instagram', 'facebook', 'linkedin', 'tiktok', 'youtube', 'whatsapp', 'buscador', 'correo', 'referido', 'directo', 'otro'];

const ALIASES = {
  ig: 'instagram', instagram: 'instagram',
  fb: 'facebook', facebook: 'facebook', meta: 'facebook',
  linkedin: 'linkedin', li: 'linkedin',
  tiktok: 'tiktok', tt: 'tiktok',
  youtube: 'youtube', yt: 'youtube',
  whatsapp: 'whatsapp', wa: 'whatsapp',
  google: 'buscador', bing: 'buscador', buscador: 'buscador',
  email: 'correo', correo: 'correo', mail: 'correo', brevo: 'correo',
};

const HOSTS = [
  [/(^|\.)instagram\.com$/, 'instagram'],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me|messenger\.com)$/, 'facebook'],
  [/(^|\.)(linkedin\.com|lnkd\.in)$/, 'linkedin'],
  [/(^|\.)tiktok\.com$/, 'tiktok'],
  [/(^|\.)(youtube\.com|youtu\.be)$/, 'youtube'],
  [/(^|\.)(whatsapp\.com|wa\.me)$/, 'whatsapp'],
  [/(^|\.)(google\.[a-z.]+|bing\.com|duckduckgo\.com|yahoo\.com|ecosia\.org)$/, 'buscador'],
  [/(^|\.)(mail\.google\.com|outlook\.live\.com|outlook\.office\.com)$/, 'correo'],
];

const fromUtm = (utm) => {
  const key = String(utm || '').trim().toLowerCase();
  if (!key) return null;
  if (CHANNELS.includes(key)) return key;
  return ALIASES[key] || 'otro';
};

const fromReferrer = (ref, ownHost = 'novaworkorder.com') => {
  let host;
  try {
    host = new URL(String(ref || '')).hostname.toLowerCase();
  } catch (e) {
    return 'directo';
  }
  if (!host || host === ownHost || host.endsWith(`.${ownHost}`)) return 'directo';
  const hit = HOSTS.find(([re]) => re.test(host));
  return hit ? hit[1] : 'otro';
};

// Un enlace de recomendación de un cliente (?ref=código) cuenta como «referido», venga de donde venga.
const REF = /^[a-z0-9-]{3,20}$/;
const channelOf = ({ utm, ref, referral } = {}) => (REF.test(String(referral || '').toLowerCase()) ? 'referido' : (fromUtm(utm) || fromReferrer(ref)));

module.exports = { CHANNELS, REF, channelOf, fromUtm, fromReferrer };
