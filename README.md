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

Versión 1.1 (Fase 1): **multiempresa**. Cada empresa que compra el servicio tiene sus propios usuarios, clientes y
órdenes, aislados del resto. Ver `VERSION.md` para el detalle de cambios.

El sistema incluye:
- empresas aisladas entre sí, con un plan de técnicos y estado (prueba, activa, suspendida)
- gestión de usuarios por el administrador de cada empresa
- API de plataforma para que GABY entregue y administre empresas
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

Todos los roles ven solo los datos de **su empresa**.

### Administrador
Gestiona su empresa: usuarios (crear, desactivar, nueva contraseña temporal), clientes y órdenes.

### Técnico
Gestiona clientes y órdenes de su empresa y ve el tablero.

### Cliente
Usuario de una empresa cliente: solo consulta **las órdenes de su propia ficha de cliente**. No puede modificar nada.

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
CORS_ORIGINS=<en producción: https://tu-dominio>
PLATFORM_API_KEY=<llave de al menos 32 caracteres para la API de plataforma; vacía = apagada>
OPENROUTER_API_KEY=<clave de OpenRouter para el chat de la página de ventas; vacía = sin chat>
```

Ver `.env.example` para todas las variables (`TRUST_PROXY`, `MIGRATE_COMPANY_NAME`, `CHAT_MODEL`, `CHAT_DAILY_LIMIT`, `CHAT_ENABLED`).

### Pasar de la versión 1.0 a la 1.1

```bash
MIGRATE_COMPANY_NAME="Nombre de tu empresa" npm run migrate
```

Asigna todos los datos existentes a esa empresa, enlaza las órdenes con su cliente por nombre y desactiva los usuarios
«cliente» sin ficha (los que creaba el registro público). Se puede ejecutar más de una vez.

### Pruebas

```bash
npm test
```

Usan un MongoDB real en memoria (no tocan tu base de datos).

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

## Publicar en el servidor

Ver [`deploy/PUBLICAR.md`](deploy/PUBLICAR.md): un comando desde el PC (`deploy/publicar.ps1`) instala NOVA WORKORDER
con HTTPS en tu dominio (Caddy), MongoDB local y copias diarias. En producción el backend sirve también la interfaz
compilada (`frontend/dist`), en un solo origen.

## Usuarios de prueba

El registro público está cerrado. Los usuarios de la empresa de demostración «NOVA Demo» (con un cliente de ejemplo
enlazado al usuario cliente) se crean con:

```bash
npm run seed
```

Crea o actualiza estas cuentas con la contraseña de `SEED_PASSWORD`:

- Admin: admin@nova.com
- Técnico: tecnico@nova.com
- Cliente: cliente@nova.com

## Endpoints principales

### Autenticación
- POST /api/auth/login — máximo 10 intentos fallidos cada 15 minutos; 402 si la empresa está suspendida
- GET /api/auth/profile — incluye la empresa y `mustChangePassword`
- PUT /api/auth/password — cambia la contraseña (`currentPassword`, `newPassword`)
- POST /api/auth/register — cerrado (410)

### Usuarios (administrador; los técnicos pueden listar para asignar órdenes)
- GET /api/users
- POST /api/users — devuelve una contraseña temporal una sola vez
- PUT /api/users/:id — `name`, `role`, `active`, `client`, `resetPassword`

### Plataforma (GABY, con el encabezado `x-platform-key`)
- POST /api/platform/companies — crea la empresa y su administrador (contraseña temporal)
- GET /api/platform/companies · GET /api/platform/companies/:id — con el uso (técnicos, usuarios, órdenes)
- PATCH /api/platform/companies/:id — `status` (prueba, activa, suspendida), `maxTechnicians`, `name`
- GET /api/platform/demo-requests · POST /api/platform/demo-requests/:id/ack — solicitudes de la página de ventas (con su canal)
- GET /api/platform/analytics?days=7 — visitas, clics en «Empieza gratis», solicitudes y conversión por canal y por día

### Mi marca (administrador de la empresa)
- PUT /api/company/branding — `primary` y `accent` (#rrggbb), `logo` (data URL PNG, JPG o WEBP, máx. 300 KB; `null` lo quita)
- GET /api/public/logo/:id — el logo de la empresa (lo muestra su app)

### Página de ventas (sin sesión)
- POST /api/public/demo — «Empieza gratis» o «Pide tu demo»; guarda el canal de llegada (`utm`/`ref`)
- POST /api/public/visit — contador anónimo (`event`: visita o clic). Sin cookies ni IP: solo suma por día, página,
  canal (utm_source del enlace o el sitio que lo trajo) y tipo de equipo. Los robots y los avances de enlaces no cuentan.
- GET /api/public/chat — `{ enabled }`: si la página muestra la burbuja del chat «GABY · Ventas».
- POST /api/public/chat — `{ messages: [{ role, content }] }` → `{ reply }`. Una IA (OpenRouter) que solo sabe precios y
  funciones (`src/utils/salesChat.js`), sin herramientas ni acceso a datos. No guarda lo que escribe el visitante: solo
  cuenta conversaciones y mensajes por día (`ChatStat`). Topes: 30 mensajes por IP cada hora y `CHAT_DAILY_LIMIT` por día.
  Si después llena «Empieza gratis», la solicitud llega a GABY con `source: chat` y sus preguntas en el mensaje.

### Clientes
- GET /api/clients
- POST /api/clients
- GET /api/clients/:id
- PUT /api/clients/:id
- DELETE /api/clients/:id

### Órdenes de trabajo
- GET /api/workorders — filtros `?status=pendiente|en_proceso|completada|cancelada`, búsqueda `?q=texto` (título,
  descripción o cliente) y paginación `?page=1&limit=10`
- POST /api/workorders — `client` (ficha de cliente) y `assignedTo` (técnico activo) de la misma empresa, `dueDate`
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

Fase 2 (competitiva): fotos y evidencias, firma del cliente, reporte PDF de la orden, avisos por WhatsApp o correo,
vista móvil para el técnico, checklist por servicio, materiales y horas.

- exportación de reportes PDF/Excel
- calendario y agenda de tareas
- notificaciones por email o WhatsApp
- historial de cambios
- facturación y pagos
- analítica avanzada
- integración con herramientas externas

## Estado del proyecto

Versión 1.1: multiempresa, con aislamiento de datos por empresa, gestión de usuarios, API de plataforma y pruebas
automáticas. Pendiente para vender: publicarla en un dominio propio con HTTPS y copias de seguridad, el cobro (Mercado
Pago, desde GABY) y las funciones de campo de la Fase 2.

## Licencia

Proyecto académico y de demostración para gestión de operaciones y servicios.

## Autor

NOVA WORKORDER
