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

## Estado del proyecto

Versión funcional y lista para entrega: v1.0

El sistema incluye:
- autenticación con JWT
- roles de usuario
- gestión de clientes
- gestión de órdenes de trabajo
- dashboard ejecutivo
- búsquedas y filtros
- validaciones y protección por permisos
- documentación de presentación y defensa

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
- Búsqueda por texto (en el panel y con `?q=` en la API)
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

Copiar `.env.example` a `.env` en la raíz del proyecto y completar los valores:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/nova-workorder
JWT_SECRET=<un secreto largo y aleatorio>
NODE_ENV=development
SEED_PASSWORD=<contraseña de los usuarios de demo, mínimo 8 caracteres>
```

Para generar un `JWT_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

El backend no arranca sin `JWT_SECRET`. **Importante:** versiones anteriores de este README publicaron un `JWT_SECRET` de
ejemplo; si alguna instalación lo usó, cámbialo por uno nuevo (los tokens firmados con el anterior dejarán de valer).

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

El registro público siempre crea usuarios con rol **cliente** (el rol enviado en el formulario se ignora). Los usuarios
de demo, incluido el administrador, se crean con:

```bash
npm run seed
```

Crea o actualiza estas cuentas con la contraseña de `SEED_PASSWORD`:

- Admin: admin@nova.com
- Técnico: tecnico@nova.com
- Cliente: cliente@nova.com

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
- GET /api/workorders — filtros `?status=pendiente|en_proceso|completada|cancelada`, búsqueda `?q=texto` (título,
  descripción o cliente) y paginación `?page=1&limit=10`
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

## Documentación del proyecto

- VERSION.md — información de la versión final
- PRESENTACION_FINAL.md — presentación ejecutiva del proyecto
- GUION_DEFENSA.md — guion para defensa oral
- README.md — documentación principal del repositorio

## Mejoras futuras

- exportación de reportes PDF/Excel
- calendario y agenda de tareas
- notificaciones por email o WhatsApp
- historial de cambios
- facturación y pagos
- analítica avanzada
- integración con herramientas externas

## Estado del proyecto

El proyecto se encuentra en una versión funcional con dashboard, gestión de clientes, control de tareas y permisos por rol. Está preparado para presentarse como una solución operativa real completa y usable.

## Licencia

Proyecto académico y de demostración para gestión de operaciones y servicios.

## Autor

NOVA WORKORDER
