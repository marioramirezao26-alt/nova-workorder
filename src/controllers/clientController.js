const Client = require('../models/Client');

const getClients = async (req, res) => {
  try {
    const clients = await Client.find().sort({ createdAt: -1 });
    res.status(200).json(clients);
  } catch (error) {
    res.status(500).json({
      message: error.message || 'Error al obtener los clientes',
    });
  }
};

const createClient = async (req, res) => {
  try {
    const { name, email, phone, company, address } = req.body;

    if (!name || !email) {
      return res.status(400).json({
        message: 'Nombre y email son obligatorios',
      });
    }

    const existingClient = await Client.findOne({ email: email.toLowerCase() });

    if (existingClient) {
      return res.status(400).json({
        message: 'Ya existe un cliente con ese email',
      });
    }

    const client = await Client.create({
      name,
      email: email.toLowerCase(),
      phone,
      company,
      address,
    });

    res.status(201).json(client);
  } catch (error) {
    res.status(500).json({
      message: error.message || 'Error al crear el cliente',
    });
  }
};

const getClientById = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);

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
    const client = await Client.findById(req.params.id);

    if (!client) {
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }

    const { name, email, phone, company, address, active } = req.body;

    client.name = name || client.name;
    client.email = email ? email.toLowerCase() : client.email;
    client.phone = phone !== undefined ? phone : client.phone;
    client.company = company !== undefined ? company : client.company;
    client.address = address !== undefined ? address : client.address;
    client.active = active !== undefined ? active : client.active;

    const updatedClient = await client.save();
    res.status(200).json(updatedClient);
  } catch (error) {
    res.status(500).json({
      message: error.message || 'Error al actualizar el cliente',
    });
  }
};

const deleteClient = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);

    if (!client) {
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }

    await client.deleteOne();

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
