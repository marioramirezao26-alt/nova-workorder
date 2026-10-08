const crypto = require('crypto');

// Contraseña temporal legible (sin caracteres confusos), para entregar una sola vez y cambiar al entrar.
const temporaryPassword = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(14);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
};

module.exports = { temporaryPassword };
