const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Company = require('../models/Company');

// Carga el usuario del token en cada petición: un usuario desactivado o una empresa suspendida pierden el acceso
// al instante, sin esperar a que venza el token.
const protect = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer ')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ message: 'No autorizado, token faltante' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select('-password');

    if (!user || !user.active) {
      return res.status(401).json({ message: 'Usuario no encontrado o desactivado' });
    }

    const company = await Company.findById(user.tenant);

    if (!company) {
      return res.status(401).json({ message: 'La empresa de este usuario no existe' });
    }

    if (company.status === 'suspendida') {
      return res.status(402).json({ message: 'La cuenta de tu empresa está suspendida. Escríbenos para reactivarla.' });
    }

    req.user = user;
    req.company = company;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Token inválido o expirado' });
  }
};

const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'No autorizado' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: 'No tienes permisos para realizar esta acción',
      });
    }

    next();
  };
};

// Filtro base de toda consulta: solo los datos de la empresa del usuario.
const companyScope = (req) => ({ tenant: req.user.tenant });

module.exports = { protect, authorize, companyScope };
