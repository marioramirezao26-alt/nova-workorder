const User = require('../models/User');
const Client = require('../models/Client');
const { companyScope } = require('../middleware/authMiddleware');
const { temporaryPassword } = require('../utils/passwords');

const ROLES = ['admin', 'tecnico', 'cliente'];
const fields = 'name email role client active mustChangePassword createdAt';

// Técnicos activos de la empresa frente al límite de su plan (maxTechnicians; null = sin límite).
const checkTechnicianLimit = async (company, exceptUserId = null) => {
  if (company.maxTechnicians === null || company.maxTechnicians === undefined) return null;
  const filter = { tenant: company._id, role: 'tecnico', active: true };
  if (exceptUserId) filter._id = { $ne: exceptUserId };
  const count = await User.countDocuments(filter);
  if (count >= company.maxTechnicians) {
    return `Tu plan incluye ${company.maxTechnicians} técnico(s) activo(s). Amplía el plan para agregar más.`;
  }
  return null;
};

// La ficha de cliente debe ser de la misma empresa.
const resolveClient = async (req, clientId) => {
  if (!clientId) return null;
  const client = await Client.findOne({ _id: clientId, ...companyScope(req) });
  if (!client) {
    const error = new Error('El cliente indicado no existe en tu empresa');
    error.statusCode = 400;
    throw error;
  }
  return client._id;
};

const getUsers = async (req, res) => {
  try {
    const filter = { ...companyScope(req) };
    if (req.query.role && ROLES.includes(req.query.role)) filter.role = req.query.role;
    // Los técnicos solo necesitan la lista para asignar órdenes: ven técnicos y administradores activos.
    if (req.user.role === 'tecnico') {
      filter.active = true;
      filter.role = filter.role && filter.role !== 'cliente' ? filter.role : { $in: ['tecnico', 'admin'] };
    }
    const items = await User.find(filter).select(req.user.role === 'admin' ? fields : 'name email role').sort({ name: 1 });
    res.status(200).json({ items });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error al obtener los usuarios' });
  }
};

const createUser = async (req, res) => {
  try {
    const { name, email, role, password, client } = req.body;

    if (await User.findOne({ email: String(email).toLowerCase() })) {
      return res.status(400).json({ message: 'Ya existe un usuario con ese email' });
    }

    if (role === 'tecnico') {
      const limit = await checkTechnicianLimit(req.company);
      if (limit) return res.status(403).json({ message: limit });
    }

    const temp = password ? null : temporaryPassword();
    const user = await User.create({
      name,
      email: String(email).toLowerCase(),
      role,
      password: password || temp,
      tenant: req.user.tenant,
      client: role === 'cliente' ? await resolveClient(req, client) : null,
      mustChangePassword: true,
    });

    const out = await User.findById(user._id).select(fields);
    // La contraseña temporal se muestra una sola vez: el administrador se la entrega al usuario.
    res.status(201).json({ user: out, temporaryPassword: temp });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message || 'Error al crear el usuario' });
  }
};

const updateUser = async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.id, ...companyScope(req) });

    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    const { name, role, active, client, resetPassword } = req.body;
    const isSelf = String(user._id) === String(req.user._id);

    if (isSelf && ((role !== undefined && role !== 'admin') || active === false)) {
      return res.status(400).json({ message: 'No puedes quitarte el rol de administrador ni desactivarte a ti mismo' });
    }

    const willBeTechnician = (role ?? user.role) === 'tecnico' && (active ?? user.active);
    const wasTechnician = user.role === 'tecnico' && user.active;
    if (willBeTechnician && !wasTechnician) {
      const limit = await checkTechnicianLimit(req.company, user._id);
      if (limit) return res.status(403).json({ message: limit });
    }

    if (name !== undefined) user.name = name;
    if (role !== undefined) user.role = role;
    if (active !== undefined) user.active = Boolean(active);
    if (client !== undefined || role !== undefined) {
      user.client = user.role === 'cliente' ? await resolveClient(req, client ?? user.client) : null;
    }

    let temp = null;
    if (resetPassword) {
      temp = temporaryPassword();
      user.password = temp;
      user.mustChangePassword = true;
    }

    await user.save();
    const out = await User.findById(user._id).select(fields);
    res.status(200).json({ user: out, temporaryPassword: temp });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message || 'Error al actualizar el usuario' });
  }
};

module.exports = { getUsers, createUser, updateUser, checkTechnicianLimit };
