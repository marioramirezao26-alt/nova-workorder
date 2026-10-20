# NOVA WORKORDER - VERSION 1.1 (Fase 1: multiempresa)

## Estado: base vendible en construcción (Fase 1 lista; faltan publicación, cobro y funciones de campo)

### Factura electrónica DIAN con Factus (Mejora 3, tercera parte)
- **Cada empresa conecta SU cuenta de Factus** (proveedor tecnológico autorizado por la DIAN) en «Integraciones»:
  ambiente (pruebas/habilitación o producción), client_id, client_secret, usuario, contraseña y el id del rango de
  numeración. Las credenciales se prueban pidiendo un token antes de guardarlas; el secreto y la contraseña quedan
  cifrados y nunca se devuelven. No aplica a empresas en dólares.
- **El administrador factura una cotización aprobada** desde «Cotizaciones»: a consumidor final o a nombre del cliente
  (NIT con dígito de verificación, cédula, cédula de extranjería o pasaporte). Van los renglones con su precio sin IVA y
  su tarifa (la DIAN solo acepta 0 %, 5 % y 19 %: otra tarifa no se envía), de contado si ya está pagada o a crédito a
  30 días si no, y la diferencia de redondeo en `cash_rounding_amount`.
- **No se factura dos veces:** con CUFE no se vuelve a enviar, y la referencia `NWO-COT-<id>` hace que Factus devuelva
  la misma factura si se reintenta. Si Factus o la DIAN rechazan, el error queda en la cotización para corregir y
  reintentar. El cliente descarga la factura desde el enlace de su cotización. Cubierto por `test/factura.test.js`.

### Cobro con Wompi (Mejora 3, segunda parte)
- **Cada empresa conecta SU cuenta de Wompi** en «Integraciones» (solo el administrador). La llave pública se comprueba
  con Wompi; los secretos de integridad y de eventos se guardan cifrados (AES-256-GCM, `COMPANY_SECRETS_KEY` o
  `JWT_SECRET`) y nunca salen de la API. Las tres llaves deben ser del mismo ambiente (pruebas o producción). No aplica a
  empresas en dólares.
- **El cliente paga la cotización aprobada** desde su misma página: el total o un anticipo (30 % a 100 %, lo elige la
  empresa). El valor se fija al primer intento. El enlace al checkout va con la firma de integridad, y cada intento
  lleva una referencia distinta (`NWO-<cotización>-<sufijo>`) porque Wompi no repite referencias.
- **Queda pagada solo cuando Wompi lo confirma:** por el evento firmado (`/api/wompi/<empresa>/eventos`, la URL que se
  pega en el panel de Wompi) o consultando la transacción cuando el cliente vuelve del checkout. Cuenta solo si la
  referencia es de esa empresa y el valor y la moneda cuadran; un intento rechazado posterior no la devuelve a pendiente.
- La oficina puede marcarla pagada a mano (efectivo, transferencia) y devolverla a «por cobrar»; un pago confirmado por
  Wompi no se cambia a mano. Cubierto por `test/wompi.test.js`.

### Cotizaciones (Mejora 3, primera parte)
- **Cotizaciones** (sección nueva para el administrador y los técnicos): cliente, renglones (descripción, cantidad,
  precio unitario e IVA 19 %, 5 % o sin IVA; en las empresas de Estados Unidos, dólares con centavos y un impuesto en %),
  condiciones y fecha de validez (15 días por defecto, hasta el final de ese día en Colombia). El servidor calcula los
  totales; nunca usa los que mande el navegador. Numeradas por empresa (#1, #2…).
- **Enviar:** pasa a «enviada» y da un enlace (`/cotizacion/<llave>`) para mandarlo por WhatsApp o copiarlo.
- **El cliente la aprueba sin cuenta** escribiendo su nombre y marcando que acepta, o la rechaza con un motivo
  opcional. Una sola respuesta (dos clics no aprueban dos veces) y nunca después de vencida. Queda en «Actividad».
- **Al aprobarse se crea la orden de trabajo** (pendiente, con el cliente y lo cotizado), una sola vez, y sale el
  webhook `orden.creada`. El administrador también puede marcarla «Aprobada por teléfono».
- Volver a borrador para corregirla o reenviarla tras un rechazo o vencimiento; el enlace no muestra borradores.
- El técnico maneja sus cotizaciones; el administrador, todas; un usuario cliente ve las suyas (sin borradores).
  Cubierto por `test/cotizaciones.test.js`.

### Informe de servicio (Mejora 1)
- **Checklists por tipo de servicio:** el administrador arma plantillas en «Checklists» (hasta 40 puntos; los marcados
  con * son obligatorios). El técnico elige la plantilla en la orden y la marca desde el celular, con una nota por punto.
  La orden guarda una copia: si la plantilla cambia después, la orden sigue diciendo lo que se revisó.
- **Fotos de antes y después:** el celular las reduce a 1280 px en JPEG antes de subirlas (máximo 400 KB y 12 por orden;
  el servidor revisa que sean imágenes reales por sus primeros bytes). Se guardan aparte de la orden (`WorkOrderFile`).
- **Firma del cliente** con el dedo en la pantalla, con el nombre de quien recibe. El administrador puede exigirla
  para que el técnico complete la orden («Checklists» → «Pedir la firma del cliente…»).
- **No se completa** una orden sin los puntos obligatorios del checklist (ni sin firma, si la empresa la pide).
- **Informe público** en `/informe/<llave>`: el técnico o el administrador lo comparten por WhatsApp o copiando el
  enlace. El cliente lo ve sin cuenta y lo guarda en PDF con «Descargar PDF». Muestra la marca de la empresa, el
  checklist, las fotos, las notas y la firma; nunca la ubicación del técnico ni datos internos. Solo sirve las fotos y la
  firma de esa orden. Cubierto por `test/informe.test.js`.

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
- **Reportes:** el administrador ve en «Reportes» (`GET /api/reports`) las órdenes por día, por estado y por técnico, y
  los totales (creadas y completadas) en un rango de fechas, con descarga a CSV (`GET /api/reports/orders.csv`). Las fechas
  se interpretan en hora de Colombia. Cubierto por `test/reporteria.test.js`.
- **Lista para varias instancias:** los límites (inicio de sesión, chat, demo, visitas) viven en la base con caducidad automática, no en la memoria del proceso; `/api/health` responde 503 si la base no contesta; apagado ordenado con SIGTERM; pool de conexiones ajustable (`MONGO_POOL_SIZE`, 20) e índices compuestos de las consultas de órdenes. Cubierto por `test/escala.test.js`.
- **Integraciones:** llaves de API por empresa (`/api/v1`, lectura o escritura; solo se guarda su huella) y webhooks firmados (HMAC-SHA256) de órdenes creadas, editadas, con cambio de estado o borradas, con cola en la base y reintentos. Se manejan en «Integraciones»; guía en `docs/API.md`. Cubierto por `test/integraciones.test.js`.
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
