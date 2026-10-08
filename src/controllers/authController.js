const User = require('../models/User');
const Company = require('../models/Company');
const generateToken = require('../utils/generateToken');
const { recordFailure, clearFailures } = require('../middleware/loginLimiter');

const publicUser = (user, company) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  client: user.client || null,
  mustChangePassword: Boolean(user.mustChangePassword),
  company: company ? { _id: company._id, name: company.name, status: company.status } : null,
});

// El registro público quedó cerrado: cada empresa crea sus usuarios desde «Usuarios», y las empresas nuevas
// las crea la plataforma (GABY) cuando se compra el servicio.
const registerUser = async (req, res) => {
  res.status(410).json({
    message: 'El registro público está cerrado. Pide tu cuenta al administrador de tu empresa o solicita una demo de NOVA WORKORDER.',
  });
};

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: 'Email y contraseña son obligatorios',
      });
    }

    const user = await User.findOne({ email: String(email).toLowerCase() });

    if (!user || !(await user.matchPassword(password))) {
      recordFailure(req);
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    if (!user.active) {
      recordFailure(req);
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const company = await Company.findById(user.tenant);

    if (!company) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    if (company.status === 'suspendida') {
      return res.status(402).json({ message: 'La cuenta de tu empresa está suspendida. Escríbenos para reactivarla.' });
    }

    clearFailures(req);
    res.status(200).json({ ...publicUser(user, company), token: generateToken(user._id) });
  } catch (error) {
    res.status(500).json({
      message: error.message || 'Error al iniciar sesión',
    });
  }
};

const getProfile = async (req, res) => {
  res.status(200).json(publicUser(req.user, req.company));
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);

    if (!(await user.matchPassword(String(currentPassword || '')))) {
      return res.status(400).json({ message: 'La contraseña actual no es correcta' });
    }

    if (String(newPassword) === String(currentPassword)) {
      return res.status(400).json({ message: 'La nueva contraseña debe ser distinta de la actual' });
    }

    user.password = newPassword;
    user.mustChangePassword = false;
    await user.save();

    res.status(200).json({ message: 'Contraseña actualizada' });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error al cambiar la contraseña' });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getProfile,
  changePassword,
  publicUser,
};
