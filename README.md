# NOVA WORKORDER

NOVA WORKORDER es una plataforma de gestión operativa para empresas que necesitan controlar órdenes de trabajo, clientes y rendimiento del servicio en tiempo real.

La solución centraliza la administración de clientes, tareas, prioridades, estados y métricas clave para una operación más eficiente y ordenada.

## Visión general

NOVA WORKORDER está diseñada para ayudar a equipos de servicio, mantenimiento, soporte técnico y atención al cliente a:

- registrar clientes
- crear y gestionar órdenes de trabajo
- priorizar tareas por urgencia
- controlar el estado de cada servicio
- visualizar métricas de performance
- proteger el acceso con roles y permisos

## Stack tecnológico

### Backend
- Node.js
- Express.js
- MongoDB
- Mongoose
- JWT
- bcryptjs
- Express Validator

### Frontend
- React
- Vite
- Axios

## Funcionalidades

- Sistema de autenticación y registro
- Login seguro con JWT
- Roles diferenciados:
  - Administrador
  - Técnico
  - Cliente
- Gestión completa de clientes
- Gestión completa de órdenes de trabajo
- Dashboard ejecutivo con métricas
- Reportes por estado y prioridad
- Tendencia mensual
- Validación de formularios
- Paginación en listados
- Filtros por estado
- Control de permisos por rol

## Roles del sistema

### Administrador
Puede administrar todo el sistema, incluyendo clientes, órdenes y configuración general.

### Técnico
Puede manejar órdenes y clientes, y revisar el estado operativo del sistema.

### Cliente
Tiene acceso de consulta para ver información relevante sin poder generar cambios críticos.

## Casos de uso

NOVA WORKORDER es ideal para:
- empresas de mantenimiento
- servicios técnicos
- soporte remoto
- administración de equipos
- atención a clientes
- gestión interna de tareas operativas

## Estructura del proyecto

```bash
nova-workorder/
├── src/
│   ├── app.js
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   └── utils/
├── frontend/
│   ├── src/
│   ├── public/
│   └── package.json
├── package.json
├── .env
├── README.md
└── .gitignore
```

## Requisitos

- Node.js 18+
- MongoDB
- npm

## Instalación

### 1. Clonar el repositorio

```bash
git clone https://github.com/marioramirezao26-alt/nova-workorder.git
cd nova-workorder
```

### 2. Instalar dependencias del backend

```bash
npm install
```

### 3. Instalar dependencias del frontend

```bash
cd frontend
npm install
```

## Variables de entorno

Crear un archivo `.env` en la raíz del proyecto con este contenido:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/nova-workorder
JWT_SECRET=nova-workorder-secret-key
NODE_ENV=development
```

## Ejecutar la aplicación

### Backend

```bash
npm run dev
```

### Frontend

```bash
cd frontend
npm run dev
```

La aplicación estará disponible en:
- Frontend: http://localhost:5173
- Backend: http://localhost:5000

## Endpoints principales

### Autenticación
- POST /api/auth/register
- POST /api/auth/login
- GET /api/auth/profile

### Clientes
- GET /api/clients
- POST /api/clients
- GET /api/clients/:id
- PUT /api/clients/:id
- DELETE /api/clients/:id

### Órdenes de trabajo
- GET /api/workorders
- POST /api/workorders
- GET /api/workorders/:id
- PUT /api/workorders/:id
- DELETE /api/workorders/:id

### Dashboard
- GET /api/dashboard/summary

## Flujo recomendado

1. Registrar un usuario
2. Iniciar sesión
3. Crear clientes
4. Registrar órdenes de trabajo
5. Actualizar estado y prioridad
6. Revisar el dashboard ejecutivo
7. Analizar rendimiento por trabajo y cliente

## Estado del proyecto

Esta versión del proyecto incluye la lógica principal de una herramienta funcional de gestión operativa, con base sólida para crecer hacia una solución de producción.

## Mejoras futuras

- exportación de reportes PDF/Excel
- gestión de calendario de tareas
- alertas y notificaciones
- historial de cambios
- facturación y cobros
- integración con WhatsApp o correo
- panel más avanzado para analítica
- accesos específicos por área de negocio

## Licencia

Proyecto académico y de demostración para gestión de operaciones y servicios.

## Autor

NOVA WORKORDER
