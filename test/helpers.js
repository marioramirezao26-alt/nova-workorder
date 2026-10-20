// Pruebas con un MongoDB real en memoria (mongodb-memory-server) y el servidor Express en un puerto libre.
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

process.env.JWT_SECRET = 'prueba-secreto-solo-para-tests-0123456789abcdef';
process.env.PLATFORM_API_KEY = 'llave-de-plataforma-para-pruebas-0123456789';
process.env.NODE_ENV = 'test';

const app = require('../src/app');

let mongo;
let server;
let base;

const start = async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}/api`;
};

const stop = async () => {
  server?.close();
  await mongoose.disconnect();
  await mongo?.stop();
};

const reset = async () => {
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
};

// Petición JSON; `as` es un token o `{ platform: true }` para la llave de plataforma.
const call = async (method, path, { body, as, platformKey } = {}) => {
  const headers = { 'Content-Type': 'application/json' };
  if (as) headers.Authorization = `Bearer ${as}`;
  if (platformKey !== undefined) headers['x-platform-key'] = platformKey;
  const res = await fetch(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data };
};

const KEY = process.env.PLATFORM_API_KEY;

// Una empresa recién vendida, con su administrador ya con contraseña propia.
const company = async (name, { adminEmail, maxTechnicians = null } = {}) => {
  const email = adminEmail || `admin@${name.toLowerCase().replace(/\W+/g, '')}.com`;
  const made = await call('POST', '/platform/companies', { platformKey: KEY, body: { name, adminName: `Admin ${name}`, adminEmail: email, maxTechnicians } });
  if (made.status !== 201) throw new Error(JSON.stringify(made));
  const login = await call('POST', '/auth/login', { body: { email, password: made.data.admin.temporaryPassword } });
  const changed = await call('PUT', '/auth/password', { as: login.data.token, body: { currentPassword: made.data.admin.temporaryPassword, newPassword: 'Clave-segura-123' } });
  return { id: made.data.company._id, token: changed.data.token, email };
};

// Inicia sesión; con contraseña temporal la cambia primero (el servidor no deja hacer nada más con ella).
const login = async (email, password) => {
  const r = (await call('POST', '/auth/login', { body: { email, password } })).data;
  if (!r.mustChangePassword) return r.token;
  return (await call('PUT', '/auth/password', { as: r.token, body: { currentPassword: password, newPassword: 'Clave-nueva-456' } })).data.token;
};

const origin = () => base.replace(/\/api$/, '');

module.exports = { start, stop, reset, call, company, login, KEY, origin };
