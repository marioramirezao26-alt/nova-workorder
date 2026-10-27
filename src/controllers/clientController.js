const Client = require('../models/Client');
const { companyScope } = require('../middleware/authMiddleware');
const { audit } = require('../utils/audit');

// Lo que ve cada rol: su empresa; un usuario cliente, solo su propia ficha.
const clientFilter = (req) => {
  const filter = companyScope(req);
  if (req.user.role === 'cliente') filter._id = req.user.client || null;
  return filter;
};

// El correo del cliente es opcional: vacío (o sin enviar) queda sin correo.
const cleanEmail = (email) => String(email ?? '').trim().toLowerCase();

const getPageOptions = (req) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(Math.max(1, Number(req.query.limit) || 10), 100);

  return { page, limit, skip: (page - 1) * limit };
};

const getClients = async (req, res) => {
  try {
    const { page, limit, skip } = getPageOptions(req);

    const [items, total] = await Promise.all([
      Client.find(clientFilter(req)).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Client.countDocuments(clientFilter(req)),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    res.status(200).json({
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: error.message || 'Error al obtener los clientes',
    });
  }
};

const createClient = async (req, res) => {
  try {
    const { name, phone, company, address } = req.body;
    const email = cleanEmail(req.body.email);

    if (!name) {
      return res.status(400).json({
        message: 'El nombre del cliente es obligatorio',
      });
    }

    if (email && await Client.findOne({ ...companyScope(req), email })) {
      return res.status(400).json({
        message: 'Ya existe un cliente con ese email',
      });
    }

    const client = await Client.create({
      name,
      email,
      phone,
      company,
      address,
      ...companyScope(req),
    });

    await audit(req, 'cliente.crear', `Creó el cliente «${client.name}»`, { entityId: client._id });
    res.status(201).json(client);
  } catch (error) {
    res.status(500).json({
      message: error.message || 'Error al crear el cliente',
    });
  }
};

const getClientById = async (req, res) => {
  try {
    const client = await Client.findOne({ $and: [clientFilter(req), { _id: req.params.id }] });

    if (!client) {
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }

    res.status(200).json(client);
  } catch (error) {
    res.status(500).json({
      message: error.message || 'Error al obtener el cliente',
    });
  }
};

const updateClient = async (req, res) => {
  try {
    const client = await Client.findOne({ $and: [clientFilter(req), { _id: req.params.id }] });

    if (!client) {
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }

    const { name, phone, company, address, active } = req.body;
    const email = req.body.email !== undefined ? cleanEmail(req.body.email) : undefined;

    client.name = name !== undefined ? name : client.name;
    if (email && email !== client.email && await Client.findOne({ ...companyScope(req), email })) {
      return res.status(400).json({ message: 'Ya existe un cliente con ese email' });
    }
    if (email !== undefined) client.email = email;   // vacío: el cliente queda sin correo
    client.phone = phone !== undefined ? phone : client.phone;
    client.company = company !== undefined ? company : client.company;
    client.address = address !== undefined ? address : client.address;
    client.active = active !== undefined ? active : client.active;

    const updatedClient = await client.save();
    await audit(req, 'cliente.editar', `Editó el cliente «${updatedClient.name}»`, { entityId: updatedClient._id });
    res.status(200).json(updatedClient);
  } catch (error) {
    res.status(500).json({
      message: error.message || 'Error al actualizar el cliente',
    });
  }
};

const deleteClient = async (req, res) => {
  try {
    const client = await Client.findOne({ $and: [clientFilter(req), { _id: req.params.id }] });

    if (!client) {
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }

    const name = client.name;
    await client.deleteOne();

    await audit(req, 'cliente.borrar', `Borró el cliente «${name}»`, { entityId: client._id });
    res.status(200).json({ message: 'Cliente eliminado correctamente' });
  } catch (error) {
    res.status(500).json({
      message: error.message || 'Error al eliminar el cliente',
    });
  }
};

module.exports = {
  getClients,
  createClient,
  getClientById,
  updateClient,
  deleteClient,
};
