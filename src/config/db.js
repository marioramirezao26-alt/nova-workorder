const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI;

    if (!uri) {
      throw new Error('MONGODB_URI no está definido en el archivo .env');
    }

    // Pool de conexiones ajustable (MONGO_POOL_SIZE) para tráfico alto o varias instancias.
    await mongoose.connect(uri, { maxPoolSize: Number(process.env.MONGO_POOL_SIZE) || 20 });
    console.log('MongoDB conectado correctamente');
  } catch (error) {
    console.error('Error conectando a MongoDB:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
