const jwt = require('jsonwebtoken');

// `v`: la versión de la contraseña del usuario; al cambiarla, los tokens anteriores dejan de servir.
const generateToken = (id, v = 0) => {
  return jwt.sign({ id, v }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });
};

module.exports = generateToken;
