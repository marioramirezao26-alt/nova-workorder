# NOVA WORKORDER

NOVA WORKORDER es una plataforma moderna de gestión operativa diseñada para empresas que necesitan controlar órdenes de trabajo, clientes y métricas de desempeño en tiempo real.

La solución centraliza la administración de clientes, tareas, prioridades, estados y reportes clave para una operación más eficiente y organizada.

## Descripción general

NOVA WORKORDER permite:
- registrar clientes
- crear y gestionar órdenes de trabajo
- asignar prioridades y estados
- seguir el avance de cada tarea
- visualizar dashboard con indicadores clave
- controlar acceso mediante permisos por rol

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
- CSS custom

## Funcionalidades principales

- Registro e inicio de sesión
- Gestión de usuarios con roles:
  - Administrador
  - Técnico
  - Cliente
- CRUD de clientes
- CRUD de órdenes de trabajo
- Dashboard con métricas:
  - total de órdenes
  - pendientes
  - en proceso
  - completadas
  - canceladas
  - prioridad
  - tendencia mensual
- Búsqueda por texto
- Filtros por estado
- Control de permisos y acceso
- Validaciones y manejo de errores

## Roles del sistema

### Administrador
Puede gestionar todo el sistema, incluyendo clientes, órdenes y permisos.

### Técnico
Puede gestionar clientes y órdenes, así como visualizar reportes del sistema.

### Cliente
Tiene acceso de consulta y visualización, pero no puede modificar información crítica.

## Requisitos previos

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

La app estará disponible en:
- Frontend: http://localhost:5173
- Backend: http://localhost:5000

## Usuarios de prueba

### Admin
- Email: admin@nova.com
- Contraseña: 123456

### Técnico
- Email: tecnico@nova.com
- Contraseña: 123456

### Cliente
- Email: cliente@nova.com
- Contraseña: 123456

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

## Datos de prueba sugeridos

### Clientes
- Servicios Eléctricos del Sur
- Mantenimiento Industrial Pro
- Soluciones Técnicas López
- Telecom Norte
- Grupo Inmobiliario Vega

### Órdenes
- Revisar tablero eléctrico del local principal — prioridad alta — pendiente
- Cambio de sensores en planta 2 — prioridad media — en_proceso
- Instalación de sistema de monitoreo — prioridad urgente — completada
- Mantenimiento preventivo de bombas — prioridad media — pendiente
- Diagnóstico de fallas en red — prioridad alta — en_proceso
- Revisión de servidores y cableado — prioridad urgente — completada
- Reparación de compresor industrial — prioridad alta — cancelada
- Ajuste de accesos de seguridad — prioridad baja — pendiente

## Mejoras futuras

- exportación de reportes PDF/Excel
- calendario y agenda de tareas
- notificaciones por email o WhatsApp
- historial de cambios
- facturación y pagos
- analítica avanzada
- integración con herramientas externas

## Estado del proyecto

El proyecto se encuentra en una versión funcional con dashboard, gestión de clientes, control de tareas y permisos por rol. Está preparado para presentarse como una solución operativa real con base sólida para continuar desarrollándose.

## Licencia

Proyecto académico y de demostración para gestión de operaciones y servicios.

## Autor

NOVA WORKORDER
