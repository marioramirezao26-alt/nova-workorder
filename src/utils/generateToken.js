const jwt = require('jsonwebtoken');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'nova-workorder-secret', {
    expiresIn: '7d',
  });
};

module.exports = generateToken;
