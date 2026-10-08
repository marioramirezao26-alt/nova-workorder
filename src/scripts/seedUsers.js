// Crea (o actualiza) la empresa de demostración «NOVA Demo» con sus usuarios: admin, técnico y cliente.
//   SEED_PASSWORD=<contraseña segura> npm run seed
// Las empresas reales no se crean aquí: las crea la plataforma (GABY) con /api/platform al vender el servicio.
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Company = require('../models/Company');
const Client = require('../models/Client');
const User = require('../models/User');

dotenv.config();

const run = async () => {
  const password = process.env.SEED_PASSWORD;

  if (!password || password.length < 8) {
    console.error('Define SEED_PASSWORD (mínimo 8 caracteres) en el .env o al ejecutar: SEED_PASSWORD=... npm run seed');
    process.exit(1);
  }

  await connectDB();

  const company = await Company.findOneAndUpdate(
    { slug: 'nova-demo' },
    { $setOnInsert: { name: 'NOVA Demo', slug: 'nova-demo', status: 'activa' } },
    { upsert: true, new: true }
  );
  const client = await Client.findOneAndUpdate(
    { tenant: company._id, email: 'contacto@cliente-demo.com' },
    { $setOnInsert: { name: 'Cliente Demo S.A.S.', tenant: company._id, phone: '3000000000', address: 'Calle 1 # 2-3' } },
    { upsert: true, new: true }
  );

  const users = [
    { name: 'Administrador', email: process.env.SEED_ADMIN_EMAIL || 'admin@nova.com', role: 'admin' },
    { name: 'Técnico', email: process.env.SEED_TECNICO_EMAIL || 'tecnico@nova.com', role: 'tecnico' },
    { name: 'Cliente', email: process.env.SEED_CLIENTE_EMAIL || 'cliente@nova.com', role: 'cliente', client: client._id },
  ];

  for (const data of users) {
    let user = await User.findOne({ email: data.email });

    if (user) {
      Object.assign(user, { role: data.role, tenant: company._id, client: data.client || null, active: true, password });
    } else {
      user = new User({ ...data, tenant: company._id, password });
    }

    user.mustChangePassword = false;
    await user.save();
    console.log(`Listo: ${data.email} (${data.role}) en «${company.name}»`);
  }

  await mongoose.disconnect();
};

run().catch((error) => {
  console.error('No se pudieron crear los usuarios:', error.message);
  process.exit(1);
});
