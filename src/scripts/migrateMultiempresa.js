// Fase 1 (multiempresa): pasa una base creada por la versión 1.0 a la nueva estructura, sin perder datos.
//   MIGRATE_COMPANY_NAME="Mi empresa" npm run migrate
// - crea una empresa (por defecto «NOVA Demo») y le asigna todos los usuarios, clientes y órdenes que no tengan;
// - quita el índice único global de email de clientes (ahora es único por empresa);
// - enlaza cada orden con la ficha de cliente cuyo nombre coincida con `customerName`;
// - desactiva los usuarios «cliente» sin ficha (el registro público los creaba): no verían nada.
// Es idempotente: se puede ejecutar más de una vez.
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Company = require('../models/Company');
const Client = require('../models/Client');
const User = require('../models/User');
const WorkOrder = require('../models/WorkOrder');
const { slugify } = require('../controllers/platformController');

dotenv.config();

const run = async () => {
  await connectDB();
  const name = process.env.MIGRATE_COMPANY_NAME || 'NOVA Demo';
  const company = await Company.findOneAndUpdate(
    { slug: slugify(name) },
    { $setOnInsert: { name, slug: slugify(name), status: 'activa' } },
    { upsert: true, new: true }
  );
  const missing = { $or: [{ tenant: { $exists: false } }, { tenant: null }] };

  const clientsIndexes = await Client.collection.indexes().catch(() => []);
  if (clientsIndexes.some((i) => i.name === 'email_1')) {
    await Client.collection.dropIndex('email_1');
    console.log('Índice único global de email de clientes eliminado');
  }

  const u = await User.updateMany(missing, { $set: { tenant: company._id } });
  const c = await Client.updateMany(missing, { $set: { tenant: company._id } });
  const w = await WorkOrder.updateMany(missing, { $set: { tenant: company._id } });
  await Client.syncIndexes();

  let linked = 0;
  for (const order of await WorkOrder.find({ tenant: company._id, client: null, customerName: { $nin: [null, ''] } })) {
    const client = await Client.findOne({ tenant: company._id, name: order.customerName });
    if (client) {
      order.client = client._id;
      await order.save();
      linked += 1;
    }
  }

  const orphans = await User.updateMany({ tenant: company._id, role: 'cliente', client: null, active: { $ne: false } },
    { $set: { active: false } });

  console.log(`Empresa «${company.name}»: ${u.modifiedCount} usuarios, ${c.modifiedCount} clientes y ${w.modifiedCount} órdenes asignados; `
    + `${linked} órdenes enlazadas a su cliente; ${orphans.modifiedCount} usuarios cliente sin ficha desactivados.`);
  await mongoose.disconnect();
};

run().catch((error) => {
  console.error('La migración falló:', error.message);
  process.exit(1);
});
