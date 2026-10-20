# NOVA WORKORDER - VERSION 1.1 (Fase 1: multiempresa)

## Estado: base vendible en construcción (Fase 1 lista; faltan publicación, cobro y funciones de campo)

### Ubicación al iniciar y completar órdenes
- El administrador lo activa en «Usuarios» («Registrar la ubicación de los técnicos al iniciar y completar cada orden»).
- Cada técnico lo autoriza en su celular (Ley 1581 de 2012) y puede retirarlo cuando quiera. Solo se guarda el punto
  al pulsar «Iniciar» y «Completar», nunca un seguimiento continuo.
- En cada orden se ve dónde inició y cerró el técnico, con enlace al mapa, a cuántos metros del cliente estaba y un
  aviso ⚠ si estaba a más de `OFFSITE_METERS` (300 m). Las coordenadas del cliente se aprenden de su primera visita.

### Mapa en vivo de los técnicos
- Es aparte de lo anterior: el administrador lo activa en «Usuarios» («Mapa en vivo…») y cada técnico lo autoriza por
  separado en su celular; puede retirarlo cuando quiera.
- Solo mientras el técnico tiene una orden **En proceso**: su celular manda un punto por minuto
  (`POST /api/workorders/:id/ping`; el servidor ignora lo que llegue antes de `PING_EVERY_SECONDS`, 30 s). Nunca fuera
  de una orden: al completarla o cancelarla deja de compartirse y desaparece del mapa.
- El administrador ve «Mapa» (`GET /api/workorders/live`): cada técnico, su cliente, el recorrido desde que inició y
  ⚠ «Lejos del cliente desde…» si está a más de `OFFSITE_METERS`; «sin señal» si no llega un punto en 10 minutos.
  Mapa de OpenStreetMap (Leaflet), sin llaves ni costo. Un usuario cliente no ve la ubicación del técnico.

### Cambios de la versión 1.1
- **Multiempresa:** cada empresa cliente ve solo sus usuarios, clientes, órdenes y tablero.
- **Corrección de seguridad:** un usuario «cliente» ya no ve todas las órdenes y clientes del sistema, solo los de su ficha.
- **Aislamiento a prueba de olvidos (defensa en profundidad):** un guard de datos (`src/models/tenantGuard.js`) obliga a que
  toda consulta de órdenes y clientes acote por empresa (`tenant`) o traiga un `_id`; si una función nueva olvida el filtro,
  falla con un error ruidoso en vez de mezclar datos de otra empresa. Los flujos entre empresas (migración) se eximen a
  propósito con `{ allowCrossTenant: true }`. Cubierto por `test/aislamiento.test.js`.
- **Registro público cerrado:** las cuentas las crea el administrador de cada empresa (contraseña temporal que se cambia al entrar).
- **Usuarios:** crear, desactivar y reactivar técnicos, administradores y clientes; nueva contraseña temporal.
- **Plan por técnicos:** cada empresa tiene un máximo de técnicos activos (`maxTechnicians`).
- **API de plataforma** (`/api/platform`, llave `PLATFORM_API_KEY`): GABY crea empresas, ajusta el plan y suspende o reactiva.
- **Órdenes enlazadas** a la ficha del cliente y a un técnico activo de la misma empresa, con fecha límite.
- **Seguridad:** CORS restringido, límite de 10 intentos de inicio de sesión cada 15 minutos, encabezados de seguridad, cuerpo máximo 100 KB.
- **Bitácora de auditoría:** el panel registra quién hizo qué y cuándo (órdenes, clientes y usuarios); el administrador la
  ve en «Actividad» (`GET /api/audit`). No guarda contraseñas ni tokens, solo una frase legible y referencias. Cubierta por
  `test/auditoria.test.js`.
- **Pruebas automáticas** (`npm test`, MongoDB en memoria) y CI en GitHub.
- **Migración** de bases 1.0: `npm run migrate`.

---

## Versión 1.0 (histórico)

Estado de entonces: demo funcional (no multiempresa).

### Fecha de release: 04-10-2026

### Cambios principales en esta versión:

✅ Sistema de autenticación completamente funcional
✅ Roles de usuario implementados y validados
✅ Gestión de clientes estable
✅ Gestión de órdenes de trabajo estable
✅ Dashboard ejecutivo con métricas
✅ Búsqueda y filtros funcionales
✅ Interfaz responsive y consistente
✅ Control de permisos por rol
✅ Validaciones de entrada
✅ Manejo de errores mejorado
✅ README actualizado con datos de prueba
✅ Checklist de QA completado

### Usuarios de prueba:

**Admin:**
- Email: admin@nova.com
- Contraseña: la que definas en `SEED_PASSWORD` (`npm run seed`)
- Permisos: acceso total al sistema

**Técnico:**
- Email: tecnico@nova.com
- Contraseña: la que definas en `SEED_PASSWORD` (`npm run seed`)
- Permisos: gestionar órdenes y clientes

**Cliente:**
- Email: cliente@nova.com
- Contraseña: la que definas en `SEED_PASSWORD` (`npm run seed`)
- Permisos: solo consulta

### Endpoints validados:

**Autenticación:**
- POST /api/auth/register ✅
- POST /api/auth/login ✅
- GET /api/auth/profile ✅

**Clientes:**
- GET /api/clients ✅
- POST /api/clients ✅
- GET /api/clients/:id ✅
- PUT /api/clients/:id ✅
- DELETE /api/clients/:id ✅

**Órdenes:**
- GET /api/workorders ✅
- POST /api/workorders ✅
- GET /api/workorders/:id ✅
- PUT /api/workorders/:id ✅
- DELETE /api/workorders/:id ✅

**Dashboard:**
- GET /api/dashboard/summary ✅

### Checklist de calidad:

- [x] No hay errores críticos
- [x] Flujo de usuario completo funciona
- [x] Permisos por rol validados
- [x] Interfaz limpia y usable
- [x] Validaciones de entrada implementadas
- [x] Manejo de errores correcto
- [x] Base de datos estable
- [x] Seguridad JWT implementada
- [x] Documentación actualizada
- [x] Listo para presentación

### Mejoras futuras planeadas:

- Exportación de reportes PDF/Excel
- Notificaciones por email
- Historial de cambios
- Facturación y pagos
- Analytics avanzado
- Integración con terceros
- Autenticación de dos factores
- Despliegue en servidor

### Notas importantes:

- El sistema está listo para uso en ambiente local o desarrollo
- Para producción, configurar variables de entorno correctamente
- Usar MongoDB Atlas para base de datos en la nube
- Implementar HTTPS y certificados SSL
- Configurar CORS según necesidad

---

**NOVA WORKORDER v1.0 - Proyecto completamente funcional y listo para defensa y presentación.**
