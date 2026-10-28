# NOVA WORKORDER - VERSION 1.1 (Fase 1: multiempresa)

## Estado: base vendible en construcción (Fase 1 lista; faltan publicación, cobro y funciones de campo)

### El chat de la página lo atiende GABY (CRM) con salesChat de respaldo (28-oct-2026)
- Mario: «todo el que entre por ese chat queda en el CRM y GABY lo debe atender igual que por WhatsApp». GABY expone
  `POST /api/webchat/message` y `GET /api/webchat/messages` (llave `x-webchat-key` = `GABY_WEBCHAT_KEY`, en los dos .env).
- **Proxy (`src/utils/gabyWebchat.js`, `chatController.js`):** con `GABY_WEBCHAT_KEY` y una `session` válida
  (`[A-Za-z0-9_-]{16,64}`), `POST /api/public/chat` manda a GABY solo el mensaje nuevo, `lang`, `page` limpio (app, cinco
  utm, ref, referral, l, path) e `ip_hash` = sha256(ip + `WEBCHAT_IP_SALT`, o una sal derivada de `JWT_SECRET`): nunca
  la IP. Lo que vuelve se limpia (`messages` de visitor/gaby/mario, `actions` solo hacia novaworkorder.com o la misma
  página, `handoff`). Si GABY falla, no responde (20 s), no está configurada o el navegador no manda sesión (la página en
  inglés), responde salesChat como antes. El 429 de GABY llega al visitante. Se conserva el límite de 30 por IP por hora.
  `GET /api/public/chat/messages?session=&after=` hace proxy a GABY (1.000 consultas por IP por hora). Sesión o `after`
  inválidos: 400 sin llegar a GABY.
- **La burbuja:** sesión al azar en `localStorage` (con try/catch); al abrir recupera la conversación de GABY; mientras
  está abierta y la pestaña visible consulta lo nuevo cada 8 s (para al cerrar o al ocultar la pestaña); muestra las
  `actions` como botones y lo de Mario como «Equipo NOVA»; aviso fijo «GABY es una asistente virtual con IA. Guardamos
  esta conversación para atenderte (política de privacidad)». `GET /api/public/chat` dice además `history`.
- **Pendiente:** `privacidad.html` (6.1 dice que la conversación no se guarda): Mario pasa el texto nuevo.
- Pruebas en `test/webchat.test.js` (GABY falso con un servidor http local).

### La página atiende por el chat de GABY, sin WhatsApp (28-oct-2026)
- El WhatsApp de NOVA (+57 310 376 7561) dejó de recibir mensajes. Mario: «Quita el botón de WhatsApp en la página, que
  GABY atienda por el chat de la página no más».
- **`landing/index.html`:** los 19 enlaces fijos a `wa.me/573103767561` (portada, filas de botones, Servicios, Pedidos,
  precios, límites, preguntas, quién está detrás, formulario, pie, barra del celular y el «Prefiero seguir por WhatsApp»
  del chat) y los que armaba el JS (`waButton` de los mensajes del formulario y la barra) pasan a botones «Pregúntale a GABY» (`button[data-chat]`, ícono de chat, `aria-label`) que abren la
  burbuja con la pregunta de esa sección ya escrita, sin enviarla. La barra del celular queda en dos botones: «Empieza
  gratis» y «Pregúntale a GABY». Dentro del chat, «Prefiero escribir por correo». Los mensajes del formulario mandan al
  chat y a contacto@novaworkorder.com. Lo de WhatsApp como función del producto no cambia.
- **Sin chat** (`GET /api/public/chat` con `enabled: false`, o un 503 del chat por el tope del día): esos botones dicen
  «Pide información» y llevan al formulario en «información por correo», con la app elegida si el botón la trae. Sin
  JavaScript se esconden.
- **`salesChat.js`:** soporte = este chat y contacto@novaworkorder.com; lo que GABY no sabe, «el equipo te responde en
  contacto@novaworkorder.com»; con interés, el botón «Empieza gratis» del chat; si preguntan por un WhatsApp o un teléfono,
  no da números.
- La analítica no cambia: WhatsApp nunca se contó (solo `visita` y un `clic` en «Empieza gratis»), así que tampoco se
  cuentan los clics al chat.

### Landing más elegante y recomendaciones de clientes reales (27-oct-2026)
- Pedido de Mario: una landing más elegante y, al final, recomendaciones de los clientes. **Decisión: no se publican
  reseñas ficticias** (Ley 1480 y la SIC lo tratan como publicidad engañosa, y Meta rechaza anuncios hacia páginas con
  testimonios falsos). La sección se hizo para reseñas reales y **no se muestra mientras no haya al menos una aprobada**.
- **Diseño (es y en, `estilos.css` + `inicio.css`):** mismos datos, precios y promesas; ningún `id`, `name`, `utm`, `ref`,
  JSON-LD, texto de WhatsApp, ruta legal ni `meta` cambia. Tipografía más fina (Inter Display en títulos si está, `-0,035em`
  en el h1, números tabulares en precios), ritmo vertical de 72–112 px, superficies con borde de 1 px, sombra suave y
  degradado discreto, botones con relieve y foco de 2 px, iconos SVG de línea en vez de emojis (sprite en la misma página),
  cuadrícula tenue en el hero, líneas finas de color por app en vez de bordes de 4 px, precios con chulos verdes y botones
  alineados, preguntas con flecha que gira, contraste AA (texto secundario 9:1, terciario 6:1, botón azul 5,2–6,7).
  Aparición discreta al bajar (`animar.js`): solo con JavaScript y sin «reducir movimiento»; lo que ya se ve al cargar no se
  anima. Sin librerías ni fuentes nuevas. El fondo ya no es `fixed`. Medido: los dos «Empieza gratis» y WhatsApp siguen
  sin scroll en 360×740, 390×664, 390×844 y 1280×800, y ninguna página se sale de lado en el celular.
- **«Recomiéndanos» en la app** (Inicio, solo el administrador): calificación de 1 a 5, opinión de 20 a 400 caracteres,
  nombre, cargo y ciudad opcionales, la empresa sale de la cuenta y la casilla obligatoria «Autorizo a NOVA Desarrollos a
  publicar esta opinión…». Muestra en qué va (en revisión, publicada, no publicada con su motivo, retirada), deja cambiarla
  y retirarla. En español e inglés.
- **Modelo `Review`** (una por empresa, índice único por `tenant`): `pendiente`, `aprobada`, `rechazada` o `retirada`;
  `consentText` y `consentAt` como constancia, `submittedAt`, `decidedAt`, `withdrawnAt`. Solo lo del formulario y el
  nombre de la empresa: nada de correo ni teléfono. Reenviarla **reemplaza** la anterior con un documento nuevo (otro
  `_id`) y vuelve a `pendiente`: una aprobación pedida sobre el texto viejo responde 404 y no publica el nuevo sin leerlo.
- **API de la empresa:** `GET|PUT|DELETE /api/company/review` (sesión de administrador; técnico y cliente, 403; tope de 20
  envíos por hora por empresa). El estado no se puede mandar desde la app. Queda en la bitácora (`resena.enviar`,
  `resena.reemplazar`, `resena.retirar`).
- **API de plataforma (GABY, `x-platform-key`):** `GET /api/platform/reviews?status=pendiente` (o `aprobada`,
  `rechazada`, `retirada`), `POST /api/platform/reviews/:id/approve` (solo una pendiente) y `POST
  /api/platform/reviews/:id/reject` con `reason` opcional (una pendiente, o una aprobada para despublicarla). Los cambios son
  atómicos: una retirada en el camino responde 409 con su estado.
- **Público:** `GET /api/public/reviews` → `{ items: [{ name, role, company, city, rating, text, month }] }`, solo las
  aprobadas (12 como mucho, la última aprobada primero), `Cache-Control: public, max-age=300`. `month` es el mes en que la
  escribió en hora de Colombia (`2026-10`). Las retiradas y rechazadas desaparecen.
- **Landing:** `#resenas` al final, antes del pie, en `/` y `/en/` (texto original del cliente; etiquetas y mes
  traducidos). Arranca con `hidden` y `resenas.js` la muestra solo si la API trae al menos una; todo con `textContent`.
  **Sin JSON-LD de reseñas:** Google no acepta reseñas propias («self-serving») de la organización, y marcarlas sería
  pedir un resultado enriquecido que no corresponde.
- Las reseñas de ejemplo solo existen en las capturas de vista previa (base en memoria, con la franja «Vista previa con
  reseñas de ejemplo»). Ni el código ni la base las tienen. Capturas en `informes/landing-elegante/antes|despues/`.
- `test/resenas.test.js`: solo el administrador con sesión, la casilla obligatoria, largo y calificación, el reemplazo por
  empresa, el retiro, aprobar y rechazar solo con la llave (el token de la app no sirve), la página pública sin datos de
  contacto y con caché, el mes en hora de Colombia y que la landing arranque oculta, sin JSON-LD ni reseñas de ejemplo.

### Uso para acompañar la prueba de 7 días (27-oct-2026)
- GABY lee el uso de cada empresa por `GET /api/platform/companies` y `/companies/:id`. Dentro del mismo `usage` se
  **agregan** cuatro campos; los de antes no cambian:
  - `lastLoginAt`: último ingreso de cualquier usuario de la empresa, ISO UTC o `null`.
  - `lastActivityAt`: lo más reciente entre la última orden creada o cambiada (el informe, sus fotos, la firma y el
    enlace viven en la orden) y la última cotización creada o cambiada. ISO UTC o `null`.
  - `ordersLast24h`: órdenes creadas en las últimas 24 horas.
  - `activeTechnicians7d`: técnicos distintos (rol `tecnico`, el de la orden asignada) con alguna orden iniciada o
    completada en los últimos 7 días.
- **Nuevo en la base:** `Company.lastLoginAt`. Se escribe en `POST /auth/login` (ingreso válido de una empresa no
  suspendida) con un `updateOne` que solo encuentra la empresa si no tenía fecha o la que tenía pasó del minuto: como
  mucho una escritura por minuto por empresa, sin mover `updatedAt` y sin frenar el ingreso si falla.
- **Índices nuevos** (Mongoose los crea al arrancar): órdenes `{ tenant, updatedAt }` y `{ tenant, startedAt }`;
  cotizaciones `{ tenant, updatedAt }`. Las consultas van por empresa y por índice (`ordersLast24h` usa el que ya
  existía de `createdAt`; los técnicos activos, `startedAt` y el de `completedAt`).
- Sin datos de personas en el `usage`: solo fechas y conteos. README actualizado (sección «Plataforma»).
- `test/plataforma.test.js`: cada campo nuevo, el caso sin actividad (`null` y 0), que un ingreso mueve `lastLoginAt`
  (y otro dentro del minuto no), que otra empresa no suma, que el uso solo trae fechas y conteos y que las consultas
  nuevas van por índice.

### Enlace de prueba con la ficha de GABY (27-oct-2026)
- Paso 2 del plan de Mario («una sola ficha por persona»), junto con GABY 0.127.0 (TASK-185, ADR-104). GABY manda por el
  chat un enlace propio: `https://novaworkorder.com/?l=<código>&app=<servicios|pedidos>&t=<técnicos>#demo`. `l` es un
  código opaco de la ficha de esa persona en GABY (no dice quién es ni su número).
- **La landing** (`landing/enlace.js`, nuevo, cargado antes del script de la página) lee `l`, `app` y `t`: deja elegida
  la app, pone los técnicos (solo Servicios) y muestra «Vienes del chat con GABY…». El código queda en la pestaña
  (`sessionStorage`) y viaja como `l` en `POST /api/public/demo`. Lo que no tenga la forma esperada se ignora y el
  formulario funciona igual sin enlace.
- **`DemoRequest.leadToken`**: letras y números, de 8 a 32. La ruta acepta `l` como texto de hasta 64 caracteres (más
  largo o que no sea texto: 400); el controlador solo guarda uno con la forma esperada y, si no, guarda `null` y la
  solicitud sigue (un enlace mal copiado nunca impide crear la prueba). `GET /api/platform/demo-requests` lo devuelve:
  GABY une la prueba a esa ficha antes que por correo o celular.
- **El botón de WhatsApp de después de crear la prueba** lleva «(ref <código>)» si llegó con el enlace, para que GABY la
  una a su ficha aunque no haya dejado su WhatsApp en el formulario. Sin enlace, el texto de siempre.
- `test/demo.test.js`: el código se guarda validado y llega a GABY; la landing lee los parámetros (`enlace.js`, con
  `require`) y los manda en el formulario.

### Arreglos rápidos de la revisión de producto (27-oct-2026)
- Aprobados por Mario de la revisión de Servicios (§10 «Quick wins», §3 y §8). Nada de funciones grandes (agenda,
  recurrencia, sin señal): eso va después.
- **Login:** «Solicita una demo» pasa a «Empieza gratis 7 días» → `novaworkorder.com/?utm_source=app-login#demo` (en
  inglés, `/en/?utm_source=app-login#start`). El error sale junto al formulario con `role="alert"`, no en `alert()`.
- **Barra del celular:** como mucho 5 botones. El administrador ve Inicio, Órdenes, Cotizaciones, Clientes y «Más», que
  abre una hoja con Mapa, Checklists, Usuarios, Reportes, Actividad, Integraciones y Mi marca (antes 4 quedaban fuera de
  la pantalla). El técnico (5) y el usuario cliente (2) siguen igual; medido a 390 px, ningún botón se sale. Los iconos de
  texto llevan `aria-hidden`.
- **Reportes** con las clases que existen (`view`, `panel-box`, `stats-grid`, `report-grid`, `quote-table`). El fondo de
  la app ya no se corta al alto de la ventana: `body` crece con la página (antes `height: 100%`).
- **Informe y cotización públicos:** el pie es «Hecho con NOVAWORKORDER · Prueba gratis», enlazado a
  `novaworkorder.com/?utm_source=informe` (o `cotizacion`) `&utm_content=<nombre de la empresa normalizado>`. Va en
  `utm_content` y no en `ref`, porque la landing toma `ref` como código de referido de un cliente (canal «referido»).
- **Correo del cliente opcional** (modelo, validación y formulario). Sin correo el campo no se guarda y la API lo
  devuelve como `''`. El índice único pasa a ser solo entre clientes con correo (`tenant_1_email_1_con_correo`, parcial);
  al arrancar, `Client.syncEmailIndex()` quita el viejo `tenant_1_email_1` (idempotente, sin tocar datos). La app no
  envía correos; la factura de Factus ya trataba el correo como opcional.
- **Avisar al técnico por WhatsApp:** los usuarios tienen celular opcional (Usuarios → al crear o «Agregar celular»).
  Al crear una orden con técnico o cambiarle el técnico sale «Avisar a Juan por WhatsApp» (`whatsappLink`, con la
  orden, el cliente, la dirección, la fecha y el enlace `/#mis`). Sin celular no hay botón.
- **Al completar** desde «Mis órdenes», la orden pasa a «Cerradas» con «Compartir informe» ya abierto.
- **Aviso en Inicio del dueño:** «N cotizaciones aprobadas sin técnico» → «Órdenes» filtrado (`#ordenes?sin-tecnico`).
  El resumen trae `approvedQuotesUnassigned` y `GET /workorders` acepta `assigned=none`, `origin=quote` y `status=open`.
- **`usage` de plataforma (GABY):** se agregan `completedOrders`, `reportsShared` (órdenes con enlace de informe creado:
  la app no sabe si se envió) y `quotesSent` (cotizaciones con `sentAt`). Los campos de antes no cambian.
- Integraciones ya no dice «Ver la guía en docs/API.md» (no hay página pública de la API).
- Pruebas: `test/arreglos.test.js` (correo opcional, cambio de índice, celular, aviso y filtros) y `test/plataforma.test.js`
  (`usage` con los campos nuevos). Capturas antes y después en `informes/revision-apps/arreglos/servicios/`.

### Precio final, sin IVA (27-oct-2026)
- Decisión de Mario: NOVAWORKORDER no cobra IVA. $49.000 por técnico al mes (Servicios) y $39.000 por tienda al mes
  (Pedidos) es todo lo que se paga. Revierte el «IVA incluido» del 21-oct.
- En `index.html` el «IVA incluido» de la portada, los precios y la calculadora pasa a un discreto «precio final»; la
  descripción dice «Precios finales» y el JSON-LD ya no lleva `valueAddedTaxIncluded`. Los términos (punto 4) dicen que
  los precios son finales y que NOVA Desarrollos no cobra IVA. Los `FACTS` del chat dicen «precio final: NOVA no cobra
  IVA». La página en inglés y sus términos no hablaban de impuestos y no cambian.
- El IVA de las cotizaciones y facturas que hacen las empresas (19 %, 5 %, 0 % o excluido) es otra cosa y sigue igual.
- `test/chat.test.js` falla si los `FACTS`, la página, los términos o la privacidad vuelven a decir «IVA incluido» (o
  «más IVA», «+ IVA»…) o a llevar `valueAddedTaxIncluded`.

### Prueba gratis de 7 días (27-oct-2026)
- Decisión de Mario: la prueba gratis de Servicios y Pedidos pasa de 14 a 7 días, en español y en inglés. Se cambió en
  la página (`index.html`, términos, `/en/` con aliados y comparaciones), en los `FACTS` del chat de ventas, en
  `docs/directorios.md` y en la imagen para compartir (`img/og-novaworkorder.jpg`, que ahora se pide con `?v=2` para que
  WhatsApp y Facebook no muestren la vieja). En las comparaciones solo cambia nuestra columna: Jobber y Housecall Pro
  siguen con sus 14 días. Las copias de seguridad diarias se siguen guardando 14 días (eso no es la prueba).
- Este repo no fija la duración: la empresa queda en `status: 'prueba'` sin fecha de fin y GABY decide cuándo termina.
  Las cuentas que ya están en prueba no se tocan.

### Página de ventas en español (novaworkorder.com)
- **Portada «elige tu app»:** cada app con su situación, su precio y su «Empieza gratis», y WhatsApp a la vista. En el
  celular (360×740, 390×664 y 390×844) y en 1280×800 los dos botones y el de WhatsApp se ven sin scroll. Siguen ¿Te
  suena?, Servicios (flujo de la cotización al cierre), Pedidos (con la tienda de ejemplo «Café Demo»), Cómo empiezas
  y el video, Precios (calculadora por técnicos y cómo se paga la mensualidad: solo por Bold), Sin riesgo, Preguntas
  (con «lo que todavía no hace» cada app) y el formulario.
- **Un solo botón principal, «Empieza gratis»**, que lleva al formulario con la app ya elegida (por el botón, por la
  sección que se está viendo o por `/#pedidos`). El formulario arranca sin app marcada, pide los técnicos solo en
  Servicios y deja pedir información por correo con un enlace discreto (`kind=demo`). Sin JavaScript el botón de
  enviar queda deshabilitado. El contrato de `POST /api/public/demo` y de la analítica no cambia: `utm`, `ref` y
  `referral` siempre van como texto, `technicians` va vacío en Pedidos y solo se cuentan `visita` y un `clic` por
  pestaña (WhatsApp no se cuenta).
- **WhatsApp:** enlaces `wa.me/573103767561` con el texto ya escrito (sin dígitos, «ref» ni «código», para no chocar
  con los filtros de GABY) en cada sección, en la barra fija del celular y en el chat. La página dice que por WhatsApp
  responde GABY, una asistente virtual con IA.
- **Barra fija solo en el celular** (720 px o menos: Empieza gratis, WhatsApp y chat) fuera de la portada y del
  formulario; el chat se abre desde ella y la burbuja solo sale en pantallas anchas. La barra y el encabezado llevan a la
  prueba de la app solo mientras se ve su sección; en precios, preguntas y las demás secciones comunes, el formulario pide
  elegir la app. En el celular el formulario va justo después del título y los errores salen junto al campo que falla.
- **Se retiraron afirmaciones que no eran ciertas:** pago por Nequi, «tiempo real», «sin límite», vencidas y últimos
  meses en el panel, historial por cliente, «te escribimos hoy mismo». Las afirmaciones nuevas se revisaron contra el
  código y en la revisión se corrigieron tres que prometían de más: Servicios se cobra por los técnicos contratados (el
  máximo de técnicos activos), no por los que se usen; el técnico ve, además de «Mis órdenes», todas las órdenes,
  clientes y cotizaciones de su empresa; y la cuenta suspendida vuelve cuando se confirma el pago (al instante con el link
  de Bold; con la llave, cuando se revisa el comprobante).
- **`estilos.css` (lo usan las 10 páginas):** botones con contraste AA (blanco sobre #1a5cc8→#1f63d6), foco visible
  con teclado, `color-scheme: dark`, sin desplazamiento suave con `prefers-reduced-motion` y el botón del encabezado
  en una línea. Lo nuevo va en `inicio.css`, que solo carga la portada. Imagen para compartir nueva
  (`img/og-novaworkorder.jpg`, 1200×630) y JSON-LD de la organización y las dos apps.
- **Términos y privacidad** al día: pago de la suscripción solo por Bold, hasta 2.000 productos por tienda, medios de
  pago de las tiendas, datos de cotizaciones, informe, ubicación, Factus y Wompi, y proveedores (Bold, Brevo,
  OpenRouter, Wompi, Factus y la API de WhatsApp de Meta). La privacidad cubre ahora el WhatsApp de NOVA (punto 6.2:
  qué se guarda, que responde una IA por OpenRouter, que se une con el formulario por el número, cuánto se guarda y
  cómo pedir que se borre) y los correos comerciales que se envían a quien pide la prueba o información.
- **Chat «GABY · Ventas»:** `FACTS` dice lo mismo que la página (Bold, informe, cotizaciones, Wompi y Factus con
  cuentas propias, lo que no hace, los permisos del técnico). `test/chat.test.js` impide que vuelvan «mes a mes por
  Nequi», «sin límite», «los últimos meses de un vistazo», «por técnico activo», «ve solo sus órdenes» y «vuelve al
  pagar».

### Factura electrónica DIAN con Factus (Mejora 3, tercera parte)
- **Cada empresa conecta SU cuenta de Factus** (proveedor tecnológico autorizado por la DIAN) en «Integraciones»:
  ambiente (pruebas/habilitación o producción), client_id, client_secret, usuario, contraseña y el id del rango de
  numeración. Al conectar o cambiar los datos SIEMPRE se pide un token nuevo antes de guardarlos; el secreto y la
  contraseña quedan cifrados y nunca se devuelven. No aplica a empresas en dólares. Conectar tiene su propio cupo de
  intentos por empresa (10 por hora), aparte del de Wompi.
- **El token** se guarda en memoria por empresa, ambiente y usuario hasta que vence (`expires_in`) y se olvida al
  conectar, cambiar los datos o desconectar. Si Factus responde 401 al facturar, se pide otro y se reintenta una vez;
  si sigue, el error dice que Factus no aceptó la sesión (no que la DIAN rechazó la factura).
- **El administrador factura una cotización aprobada en pesos** desde «Cotizaciones», con confirmación (a quién, por
  cuánto, de contado o a crédito): a consumidor final o a nombre del cliente. NIT sin DV ni guion (si se pega
  «900.123.456-8», el formulario separa el DV); el DV es opcional (Factus lo calcula) y, si se escribe, se valida con el
  algoritmo de la DIAN en el formulario y en el servidor. Al cambiar el tipo de documento se limpia el DV, y el DV
  solo se envía con NIT. Cédula de extranjería y pasaporte aceptan letras, con el país del comprador (CO por defecto).
- **Los renglones** van con su precio unitario sin IVA y su tarifa (la DIAN solo acepta 0 %, 5 % y 19 %: otra tarifa
  no se envía). Un renglón se puede marcar «Excluido de IVA» (va al 0 % con `is_excluded: true`); al 0 % sin marca es
  exento. La diferencia de redondeo va en `cash_rounding_amount`; si pasa de ±500 (el límite de Factus) la factura no
  se envía y se explica por qué.
- **Forma y medio de pago:** de contado solo si está pagada del todo y no es un pago de prueba, con un renglón de
  `payment_details` por medio: tarjeta 48; PSE, transferencia, Nequi o Daviplata 47; lo que registró la oficina,
  efectivo 10; otro medio de Wompi, ZZZ. Si no (por cobrar, con anticipo o con un pago de prueba), a crédito a 30 días
  (`due_date`) por lo que falta, con ZZZ, y el anticipo pagado en `prepayment_details` con la fecha en que se recibió.
- **Pruebas y producción:** la factura guarda su ambiente (las de antes de guardarlo se reconocen por el número: SETP,
  el prefijo del set de pruebas de la DIAN, es de pruebas; otro prefijo, de producción). Solo la de producción es
  definitiva; la de pruebas se le muestra al administrador como «PRUEBA, sin validez fiscal», no la ve el cliente (ni
  en su enlace ni en su portal) y, cuando la empresa pasa a producción, la cotización se factura de verdad. Se guarda
  también si la DIAN ya la validó (`is_validated`); si no, se muestra «pendiente de validación en la DIAN».
- **No se factura dos veces:** con la factura de producción no se vuelve a enviar, y la referencia `NWO-COT-<id>` hace
  que Factus devuelva la misma factura si se reintenta. En ese caso la cotización guarda el comprador de la factura que
  devolvió Factus y, si no es el que se pidió, avisa que para cambiarlo hay que anularla con nota crédito. Si Factus o
  la DIAN rechazan, el error queda en la cotización para corregir y reintentar. El cliente descarga la factura desde el
  enlace de su cotización. Cubierto por `test/factura.test.js`.
- **Caso abierto:** si Factus responde 409 (quedó una factura pendiente de envío a la DIAN con esa referencia), la app
  lo explica y no hace nada más. La salida es borrarla en Factus (DELETE por referencia) y volver a facturar; no se
  automatizó porque no se ha probado contra Factus.

### Cobro con Wompi (Mejora 3, segunda parte)
- **Cada empresa conecta SU cuenta de Wompi** en «Integraciones» (solo el administrador). La llave pública se comprueba
  con Wompi; los secretos de integridad y de eventos se guardan cifrados (AES-256-GCM, `COMPANY_SECRETS_KEY` o
  `JWT_SECRET`) y nunca salen de la API. Las tres llaves deben ser del mismo ambiente (pruebas o producción). No aplica a
  empresas en dólares.
- **El cliente paga la cotización aprobada** desde su misma página: el total o un anticipo (30 % a 100 %, lo elige la
  empresa). Solo cotizaciones en pesos (por la moneda de la cotización, no por el idioma que tenga hoy la empresa) y con
  valor. El valor se fija al primer intento. El enlace al checkout va con la firma de integridad, y cada intento lleva
  una referencia distinta (`NWO-<cotización>-<sufijo>`) porque Wompi no repite referencias. Mientras el último intento
  siga PENDING en Wompi (PSE, Nequi…; menos de 30 minutos) no se ofrece pagar otra vez; tampoco si el cliente vuelve
  con un pago aprobado cuyo evento aún no llega (se espera la confirmación), y el rechazo atrasado de un intento
  anterior no destraba el que sigue en curso.
- **El pago cambia solo con el evento firmado** de Wompi (`/api/wompi/<empresa>/eventos`, la URL que se pega en el
  panel de Wompi), si la referencia es de esa empresa y el valor y la moneda cuadran. Al volver del checkout la página
  solo muestra lo que dice Wompi («confirmando tu pago…») y vuelve a consultar unas veces: esa consulta es pública y
  Wompi devuelve transacciones de cualquier comercio, así que nunca marca el pago. Funciona también con las cotizaciones
  de antes de Wompi, que no tienen el campo del pago.
- **Estados del pago:** por cobrar, anticipo (se pagó el anticipo; queda el saldo) y pagada, con lo pagado y el saldo.
  Se guarda el medio de Wompi (tarjeta, PSE, Nequi, Bancolombia…) y la factura de una pagada del todo va de contado
  con él (con un anticipo va a crédito, con el anticipo aparte). Un pago aprobado
  que llega con la cotización ya cobrada (dos pestañas, o la oficina ya la había marcado) queda en la cotización y en
  «Actividad» como posible doble cobro para devolver. Si Wompi anula (VOIDED) la transacción que pagó, el pago se
  devuelve y queda en «Actividad»; un APPROVED repetido o atrasado de esa transacción no la vuelve a cobrar. Un pago
  con las llaves de pruebas queda marcado «(prueba)», no se factura de contado y la oficina lo puede quitar (un
  anticipo de prueba se quita antes de registrar el pago: su saldo no es lo que falta).
- La oficina puede marcarla pagada a mano (efectivo, transferencia), registrar el saldo de un anticipo y quitar lo que
  registró si fue un error, sin cambiar lo que se cobra en línea; lo que confirmó Wompi no se cambia a mano. Si quita
  su marca y Wompi sí había cobrado aparte (el posible doble cobro), ese pago queda como el de la cotización. Si hay un
  pago de Wompi en proceso, avisa antes de marcarla. El usuario cliente tiene «Pagar en línea» en su portal.
  Cubierto por `test/wompi.test.js`.

### Cotizaciones (Mejora 3, primera parte)
- **Cotizaciones** (sección nueva para el administrador y los técnicos): cliente, renglones (descripción, cantidad,
  precio unitario e IVA 19 %, 5 %, 0 % (exento) o excluido; en las empresas de Estados Unidos, dólares con centavos y un impuesto en %),
  condiciones y fecha de validez (15 días por defecto, hasta el final de ese día en Colombia). El servidor calcula los
  totales; nunca usa los que mande el navegador. Redondeo comercial sin errores de punto flotante (85 × 9,5 % da 8,08
  dólares), igual en la vista previa; el impuesto en dólares admite tres decimales (8,875 %). Numeradas por empresa
  (#1, #2…).
- **Enviar:** pasa a «enviada» y da un enlace (`/cotizacion/<llave>`) para mandarlo por WhatsApp o copiarlo. La llave
  solo la reciben el administrador, quien armó la cotización y el usuario cliente de la ficha (otro técnico no).
- **El cliente la aprueba sin cuenta** escribiendo su nombre y marcando que acepta, o la rechaza con un motivo
  opcional. Una sola respuesta (dos clics no aprueban dos veces) y nunca después de vencida. Queda en «Actividad»; la
  bitácora guarda además la IP y el navegador desde donde se respondió.
- **Al aprobarse se crea la orden de trabajo** (pendiente, con el cliente y lo cotizado, en el idioma de la empresa),
  una sola vez, y sale el webhook `orden.creada`. El administrador también puede marcarla «Aprobada por teléfono». Si
  se borra la orden, la cotización queda sin orden y «Crear la orden» la vuelve a crear (queda en «Actividad» una sola
  vez, aunque se pulse en dos pestañas a la vez).
- Volver a borrador para corregirla o reenviarla tras un rechazo o vencimiento; el enlace no muestra borradores. Al
  reenviarla sale un enlace nuevo: el anterior (o una página abierta desde antes) ya no la muestra ni la aprueba.
- El técnico maneja sus cotizaciones; el administrador, todas; un usuario cliente ve las suyas (sin borradores).
  Cubierto por `test/cotizaciones.test.js`.

### Informe de servicio (Mejora 1)
- **Checklists por tipo de servicio:** el administrador arma plantillas en «Checklists» (hasta 40 puntos; los marcados
  con * son obligatorios). El técnico elige la plantilla en la orden y la marca desde el celular, con una nota por punto.
  La orden guarda una copia: si la plantilla cambia después, la orden sigue diciendo lo que se revisó. Una plantilla
  elegida por error se quita con «Cambiar checklist». Las marcas van con el nombre de cada punto: si la orden cambió de
  plantilla mientras tanto, no caen en puntos que el técnico no vio.
- **Fotos de antes y después:** el celular las reduce a 1280 px en JPEG antes de subirlas (máximo 400 KB y 12 por orden;
  el servidor revisa que sean imágenes reales por sus primeros bytes). Se guardan aparte de la orden (`WorkOrderFile`).
  Subir y borrar a la vez no se pisan ni dejan archivos sueltos. En «Mis órdenes» las fotos y la firma se descargan solo
  al abrir el informe.
- **Firma del cliente** con el dedo en la pantalla, con el nombre de quien recibe. El administrador puede exigirla
  para que el técnico complete la orden («Checklists» → «Pedir la firma del cliente…»). Si el técnico la reemplaza, la
  anterior se conserva (hasta 5 firmas guardadas por orden; después la cambia el administrador); al reemplazarla el
  administrador se borran las anteriores. Una firma muy larga se guarda más pequeña y, si aún no cabe (60 KB), se pide
  firmar más simple.
- **No se completa** una orden sin los puntos obligatorios del checklist (ni sin firma, si la empresa la pide), tampoco
  desde «Editar» ni al crear una orden ya completada; la fecha de cierre siempre queda. Una orden completada solo la
  corrige o la reabre el administrador: el técnico ya no le cambia fotos, firma, notas, hora de cierre ni datos (y no
  ve «Editar» en ella).
- **Informe público** en `/informe/<llave>`: el técnico o el administrador lo comparten por WhatsApp o copiando el
  enlace. El cliente lo ve sin cuenta y lo guarda en PDF con «Descargar PDF». Muestra la marca de la empresa, el estado,
  el checklist, las fotos, las notas y la firma; nunca la ubicación del técnico ni datos internos. Solo sirve las fotos y
  la firma de esa orden. Las horas (también el sello de las notas) van en la zona de la empresa: Colombia, o la hora del
  Este en las empresas de Estados Unidos.
- **El enlace se puede cambiar** desde la orden («Cambiar enlace», el administrador o el técnico de la orden): el anterior
  deja de servir (por ejemplo, si se mandó a quien no era) y queda en «Actividad».
- **WhatsApp** usa el indicativo del país de la empresa (+57 para celulares de Colombia, +1 en Estados Unidos); si el
  número no es claro, abre WhatsApp sin número para elegir el contacto. Igual en «Cotizaciones».
- Un usuario cliente sin ficha de cliente no ve ninguna orden. Cubierto por `test/informe.test.js`.

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
