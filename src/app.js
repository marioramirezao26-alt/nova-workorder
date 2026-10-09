const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const workOrderRoutes = require('./routes/workOrderRoutes');
const clientRoutes = require('./routes/clientRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const userRoutes = require('./routes/userRoutes');
const platformRoutes = require('./routes/platformRoutes');
const publicRoutes = require('./routes/publicRoutes');
const companyRoutes = require('./routes/companyRoutes');

dotenv.config();

const app = express();

app.disable('x-powered-by');
if (process.env.TRUST_PROXY) app.set('trust proxy', 1);   // detrás de un proxy (Caddy/Nginx): IP real del visitante

// CORS: solo los orígenes de CORS_ORIGINS (separados por comas). Sin la variable, en desarrollo se permite todo y
// en producción solo el mismo origen (el frontend servido junto al backend).
const allowed = String(process.env.CORS_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean);
app.use(cors({
  origin: allowed.length ? allowed : process.env.NODE_ENV !== 'production',
}));
app.use((req, res, next) => {
  res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer' });
  next();
});
// «Mi marca» sube el logo (hasta 300 KB, en base64): solo esa ruta acepta un cuerpo más grande.
app.use('/api/company/branding', express.json({ limit: '500kb' }));
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'NOVAWORKORDER Servicios funcionando correctamente',
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/workorders', workOrderRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/users', userRoutes);
app.use('/api/platform', platformRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/company', companyRoutes);

// En producción el mismo proceso sirve la interfaz compilada (frontend/dist): un solo origen, sin CORS.
const dist = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(path.join(dist, 'index.html'))) {
  app.use(express.static(dist, { index: false, maxAge: '1h' }));
  app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use((req, res) => {
  res.status(404).json({
    message: 'Ruta no encontrada',
  });
});

app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed' || err.type === 'entity.too.large') {
    return res.status(err.status || 400).json({ message: 'El cuerpo de la petición no es válido' });
  }
  console.error(err);
  return res.status(err.statusCode || 500).json({
    message: err.statusCode ? err.message : 'Error interno del servidor',
  });
});

const startServer = async () => {
  try {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET no está definido en el archivo .env (ver .env.example)');
    }

    await connectDB();

    const PORT = process.env.PORT || 5000;
    const HOST = process.env.HOST || '0.0.0.0';             // en el servidor: 127.0.0.1 (lo publica Caddy)

    app.listen(PORT, HOST, () => {
      console.log(`Servidor corriendo en http://${HOST}:${PORT}`);
    });
  } catch (error) {
    console.error('No se pudo iniciar el servidor:', error.message);
    process.exit(1);
  }
};

// Solo arranca al ejecutar `node src/app.js`; así las pruebas pueden importar `app` sin abrir el puerto.
if (require.main === module) {
  startServer();
}

module.exports = app;
