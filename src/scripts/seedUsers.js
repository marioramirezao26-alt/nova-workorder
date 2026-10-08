// Crea (o actualiza la contraseña de) los usuarios de la demo: admin, técnico y cliente.
// Es la vía controlada para crear administradores: el registro público solo crea clientes.
//   SEED_PASSWORD=<contraseña segura> npm run seed
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');

dotenv.config();

const users = [
  { name: 'Administrador', email: process.env.SEED_ADMIN_EMAIL || 'admin@nova.com', role: 'admin' },
  { name: 'Técnico', email: process.env.SEED_TECNICO_EMAIL || 'tecnico@nova.com', role: 'tecnico' },
  { name: 'Cliente', email: process.env.SEED_CLIENTE_EMAIL || 'cliente@nova.com', role: 'cliente' },
];

const run = async () => {
  const password = process.env.SEED_PASSWORD;

  if (!password || password.length < 8) {
    console.error('Define SEED_PASSWORD (mínimo 8 caracteres) en el .env o al ejecutar: SEED_PASSWORD=... npm run seed');
    process.exit(1);
  }

  await connectDB();

  for (const data of users) {
    let user = await User.findOne({ email: data.email });

    if (user) {
      user.role = data.role;
      user.password = password;
    } else {
      user = new User({ ...data, password });
    }

    await user.save();
    console.log(`Listo: ${data.email} (${data.role})`);
  }

  await mongoose.disconnect();
};

run().catch((error) => {
  console.error('No se pudieron crear los usuarios:', error.message);
  process.exit(1);
});
