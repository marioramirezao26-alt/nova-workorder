# NOVA WORKORDER

Backend empresarial para gestión de órdenes de trabajo con módulos de clientes y dashboard.

## Requisitos

- Node.js 18+
- MongoDB
- npm

## Instalación

```bash
npm install
```

## Variables de entorno

```bash
cp .env.example .env
```

Contenido recomendado del `.env`:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/nova-workorder
JWT_SECRET=nova-workorder-secret-key
NODE_ENV=development
```

## Ejecutar en desarrollo

```bash
npm run dev
```

## Endpoints principales

### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/profile`

### Work Orders
- `GET /api/workorders`
- `POST /api/workorders`
- `GET /api/workorders/:id`
- `PUT /api/workorders/:id`
- `DELETE /api/workorders/:id`

### Clients
- `GET /api/clients`
- `POST /api/clients`
- `GET /api/clients/:id`
- `PUT /api/clients/:id`
- `DELETE /api/clients/:id`

### Dashboard
- `GET /api/dashboard/summary`

## Tecnologías

- Node.js
- Express
- MongoDB + Mongoose
- JWT
- CORS
