const crypto = require('node:crypto');

// Guarda cifradas en la base las llaves que cada empresa trae de otros servicios (por ejemplo, los secretos de su cuenta
// de Wompi). AES-256-GCM con una llave del servidor: COMPANY_SECRETS_KEY si está, si no derivada de JWT_SECRET. Quien
// copie la base de datos sin el .env no puede leerlas. Cambiar esa llave obliga a cada empresa a conectar de nuevo.
const key = () => {
  const base = process.env.COMPANY_SECRETS_KEY || process.env.JWT_SECRET || '';
  if (base.length < 32) throw new Error('Falta la llave del servidor para guardar datos privados');
  return crypto.createHash('sha256').update(`nova-servicios:empresa:${base}`).digest();
};

const seal = (text) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join('.');
};

// Devuelve el texto, o '' si no se puede abrir (llave cambiada o dato dañado).
const open = (sealed) => {
  try {
    const [v, iv, tag, data] = String(sealed || '').split('.');
    if (v !== 'v1') return '';
    const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
};

module.exports = { seal, open };
