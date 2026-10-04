# NOVA WORKORDER

Backend empresarial para gestión de órdenes de trabajo.

## Requisitos

- Node.js 18+
- MongoDB
- npm

## Instalación

```bash
npm install
```

## Variables de entorno

Copia el archivo `.env.example` y ajusta los valores:

```bash
cp .env.example .env
```

## Ejecutar en desarrollo

```bash
npm run dev
```

## Ejecutar en producción

```bash
npm start
```

## Endpoints principales

### Autenticación

- `POST /api/auth/register`
- `POST /api/auth/login`

### Órdenes de trabajo

- `GET /api/workorders`
- `POST /api/workorders`
- `GET /api/workorders/:id`
- `PUT /api/workorders/:id`
- `DELETE /api/workorders/:id`

## Tecnologías

- Express
- MongoDB + Mongoose
- JWT
- bcryptjs
- CORS
