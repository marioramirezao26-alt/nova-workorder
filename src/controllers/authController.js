const bcrypt = require('bcryptjs');
const User = require('../models/User');

const DUMMY_HASH = bcrypt.hashSync('nadie-tiene-esta-clave', 10);
const Company = require('../models/Company');
const generateToken = require('../utils/generateToken');
const { publicBranding } = require('../utils/branding');
const { marketOf } = require('../utils/money');
const { recordFailure, clearFailures } = require('../middleware/loginLimiter');

const publicUser = (user, company) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  client: user.client || null,
  mustChangePassword: Boolean(user.mustChangePassword),
  locationConsentAt: user.locationConsentAt || null,
  liveConsentAt: user.liveConsentAt || null,
  company: company ? { _id: company._id, name: company.name, status: company.status, lang: company.lang || 'es', market: marketOf(company), branding: publicBranding(company),
    locationTracking: Boolean(company.locationTracking), liveTracking: Boolean(company.liveTracking),
    requireSignature: Boolean(company.requireSignature) } : null,
});

// El registro público quedó cerrado: cada empresa crea sus usuarios desde «Usuarios», y las empresas nuevas
// las crea la plataforma (GABY) cuando se compra el servicio.
const registerUser = async (req, res) => {
  res.status(410).json({
    message: 'El registro público está cerrado. Pide tu cuenta al administrador de tu empresa o solicita una demo de NOVA WORKORDER.',
  });
};

// Último ingreso de la empresa (lo lee GABY en el uso): como mucho una escritura por minuto, porque el filtro solo
// encuentra la empresa si no tenía fecha o la que tenía ya pasó del minuto. Sin `timestamps` para no mover `updatedAt`;
// si falla, el ingreso sigue igual.
const LAST_LOGIN_EVERY_MS = 60 * 1000;
const touchLastLogin = async (company) => {
  const now = new Date();
  await Company.updateOne(
    { _id: company._id, $or: [{ lastLoginAt: null }, { lastLoginAt: { $lt: new Date(now.getTime() - LAST_LOGIN_EVERY_MS) } }] },
    { $set: { lastLoginAt: now } },
    { timestamps: false },
  ).catch(() => {});
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
    // Sin usuario igual se compara contra un hash: el tiempo de respuesta no revela qué emails existen.
    const ok = user ? await user.matchPassword(String(password)) : (await bcrypt.compare(String(password), DUMMY_HASH), false);

    if (!user || !ok) {
      await recordFailure(req);
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    if (!user.active) {
      await recordFailure(req);
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const company = await Company.findById(user.tenant);

    if (!company) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    if (company.status === 'suspendida') {
      return res.status(402).json({ message: 'La cuenta de tu empresa está suspendida. Escríbenos para reactivarla.' });
    }

    await clearFailures(req);
    await touchLastLogin(company);
    res.status(200).json({ ...publicUser(user, company), token: generateToken(user._id, user.tokenVersion) });
  } catch (error) {
    res.status(500).json({
      message: error.message || 'Error al iniciar sesión',
    });
  }
};

const getProfile = async (req, res) => {
  res.status(200).json(publicUser(req.user, req.company));
};

// El técnico autoriza (o retira) que se registre su ubicación al iniciar y cerrar órdenes.
const setLocationConsent = async (req, res) => {
  try {
    req.user.locationConsentAt = req.body.accept ? new Date() : null;
    await req.user.save();
    res.status(200).json(publicUser(req.user, req.company));
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error al guardar la autorización' });
  }
};

// El técnico autoriza (o retira) compartir dónde va mientras tiene una orden en proceso (mapa en vivo).
const setLiveConsent = async (req, res) => {
  try {
    req.user.liveConsentAt = req.body.accept ? new Date() : null;
    await req.user.save();
    res.status(200).json(publicUser(req.user, req.company));
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error al guardar la autorización' });
  }
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

    // Los tokens anteriores quedan inválidos: este es el nuevo de esta sesión.
    res.status(200).json({ message: 'Contraseña actualizada', ...publicUser(user, req.company), token: generateToken(user._id, user.tokenVersion) });
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
  setLocationConsent,
  setLiveConsent,
};
