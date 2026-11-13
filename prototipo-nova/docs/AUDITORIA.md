# Auditoría antes del prototipo NOVA Premium Futurista

11 de noviembre de 2026. Hecha **solo leyendo**, antes de escribir el prototipo. Rama `prototipo/nova-premium-futurista`,
creada desde `main` en `387a026`.

## Cómo está armado hoy nova-workorder

Hay **tres cosas que se publican por caminos distintos**:

| Qué | Dónde vive en el repo | Quién lo sirve | Dominio |
|---|---|---|---|
| Página de ventas (Servicios y Pedidos, blog, precios, legales) | `landing/` | Caddy, archivos estáticos desde `/var/www/novaworkorder` | `novaworkorder.com` |
| App de Servicios (órdenes, técnicos, cotizaciones, informes) | `frontend/` (React con Vite) compilado a `frontend/dist` | Express (`src/app.js`), detrás de Caddy | `app.novaworkorder.com` |
| API | `src/` | Express en `127.0.0.1:5000` | `app.novaworkorder.com/api/*` y solo `/api/public/*` desde `novaworkorder.com` |

NOVA PEDIDOS (`pedidos.novaworkorder.com`) **no está en este repositorio**: la página solo enlaza a
`https://pedidos.novaworkorder.com/admin` y a `/demo`.

### Lo que sirve el backend (`src/app.js`)
- Rutas de la API: `/api/health`, `/api/auth`, `/api/workorders`, `/api/clients`, `/api/dashboard`, `/api/users`,
  `/api/platform`, `/api/public`, `/api/company` (con `/api/company/branding`), `/api/audit`, `/api/reports`,
  `/api/integrations`, `/api/checklists`, `/api/quotes`, `/api/wompi`, `/api/cotizaciones`, `/api/informes`, `/api/v1`.
- **Lo único estático es `frontend/dist`** (si existe). Además, **toda ruta que no empieza por `/api/` devuelve el
  `index.html` de la app** (`app.get(/^\/(?!api\/).*/)`). Si no hay `frontend/dist`, devuelve 404 en JSON.
- Conclusión: **Express no sirve `prototipo-nova/`**. Una dirección como `app.novaworkorder.com/prototipo-nova/` devuelve la
  pantalla de inicio de sesión de la app, no el prototipo. Lo comprueba `test/prototipo.test.js` en los dos casos (con y
  sin `frontend/dist`).

### Lo que sirve Caddy (`deploy/Caddyfile`)
- `novaworkorder.com`: archivos de `/var/www/novaworkorder`, que es una **copia de `landing/`** hecha por
  `deploy/actualizar.sh`, `deploy/instalar.sh` y `deploy/publicar-web.sh`. Ninguno copia otra carpeta.
- `app.novaworkorder.com`: todo va a Express.
- Conclusión: **Caddy tampoco sirve `prototipo-nova/`**.

### Accesos, formularios y servicios que hay que cuidar
| Qué | Dónde | Cómo funciona |
|---|---|---|
| «Ingresar» → Servicios | `landing/*.html` | enlace a `https://app.novaworkorder.com/` (la app muestra su inicio de sesión) |
| «Ingresar» → Pedidos | `landing/*.html` | enlace a `https://pedidos.novaworkorder.com/admin` (fuera de este repo) |
| Inicio de sesión de Servicios | `frontend/src/App.jsx` → `POST /api/auth/login` | correo y contraseña, con límite de intentos (`loginLimiter`); `POST /api/auth/register` está cerrado (410) |
| «Empieza gratis» (página) | `landing/index.html`, `#demo` → `POST /api/public/demo` | formulario `#demo-form`, con límite (`demoLimiter`); también `es-us`, `es-mx` y `en` |
| «Empieza gratis 7 días» (app) | `frontend/src/App.jsx`, `TRIAL_URL` | enlace a `novaworkorder.com/?utm_source=app-login#demo` |
| Chat de la página (Gaby real) | `landing/index.html` → `GET/POST /api/public/chat`, `GET /api/public/chat/messages` | con límites (`chatLimiter`, `chatPollLimiter`) |
| Visitas | `POST /api/public/visit` | contador por mercado |
| Soporte | texto «Soporte por chat y correo» en los planes; WhatsApp 321 392 7697 | no hay ruta de soporte aparte |
| Facturación electrónica | `/api/company/factus` (Factus, solo administrador) | cada empresa conecta la suya |
| Pagos de cotizaciones | `/api/cotizaciones/:token/pago`, eventos firmados en `/api/wompi/:slug/eventos` | Wompi de cada empresa |

## Riesgos (escritos antes de tocar código) y qué se hizo con cada uno

| # | Riesgo | Qué tan grave | Qué se hizo |
|---|---|---|---|
| R1 | El catch-all de Express (`/^\/(?!api\/).*/`) podría tapar o exponer rutas nuevas | Bajo | El prototipo **no se monta en Express**. Prueba de regresión: las rutas montadas y lo estático (`dist`) siguen exactamente iguales, y ninguna dirección `/prototipo-nova/...` devuelve el prototipo. |
| R2 | `deploy/publicar.ps1` arma el paquete con `git archive HEAD`: si la rama se uniera, `prototipo-nova/` llegaría a `/opt/nova-workorder` (no se serviría, pero estaría en el servidor) | Bajo | `.gitattributes` con `prototipo-nova export-ignore`: `git archive` lo deja por fuera. Prueba de regresión con `git check-attr`. |
| R3 | Copiar el prototipo dentro de `landing/` lo publicaría en `novaworkorder.com` en el siguiente despliegue | Alto si pasa | El prototipo vive en una carpeta **aparte** (`prototipo-nova/`), no en `landing/`. Prueba: nada de `landing/`, `src/`, `deploy/` ni `frontend/src` nombra el prototipo. |
| R4 | Un prototipo que parezca tienda real puede confundir a un cliente o a un buscador (precios, envíos, «compra protegida») | Medio | Franja fija en cada página, marcas ficticias, «precio ilustrativo» en cada tarjeta, etiquetas «Sin validar», `noindex`, y ver `AFIRMACIONES-NO-VALIDADAS.md`. |
| R5 | Que el prototipo mande datos a algún lado (formularios, chat, analítica) | Medio | Sin formularios, sin `fetch`, y una política de seguridad en cada página (`connect-src 'none'`, `form-action 'none'`, `script-src 'self'`) que el navegador hace cumplir. Prueba estática de regresión. |
| R6 | Confundir a los clientes de WORKORDER o romper su inicio de sesión | Alto si pasa | No se cambió nada de `landing/`, `frontend/` ni `src/`. El acceso WORKORDER del prototipo solo **enlaza** a los mismos dos inicios de sesión de hoy; una prueba verifica que esos enlaces existen igual en `landing/index.html`. |
| R7 | Gaby demo diciendo algo comercial que no está aprobado | Medio | Respuestas fijas escritas a mano, sin compromisos; admite que es IA; prueba de regresión de las respuestas. |
| R8 | El repo es **público**: cualquiera puede abrir el prototipo desde GitHub | Bajo | No hay secretos, datos personales, clientes ni precios reales. Igual va marcado como demostración por todos lados. |
| R9 | Si algún día se sirve el prototipo en el mismo dominio que la página, `localStorage` se comparte | Bajo | Claves propias (`nova-demo-carrito`, `nova-demo-pedidos`), distintas de las de la página. Se tiene en cuenta en `PLAN-MIGRACION.md`. |
| R10 | El mockup aprobado está en ChatGPT, no en GitHub | Bajo | Se siguió la descripción del encargo (menú, hero, Gaby, categorías, tarjetas y acceso WORKORDER). Si Mario quiere comparar detalle por detalle, hace falta la imagen. |

## Lo que cambia este PR
- Carpeta nueva `prototipo-nova/` (páginas, estilos, scripts, documentos y el guion de capturas).
- `test/prototipo.test.js`: pruebas de regresión nuevas.
- `.gitattributes`: deja `prototipo-nova/` fuera del paquete de despliegue.
- **Nada más.** No cambia `landing/`, `frontend/`, `src/`, `deploy/`, `package.json` ni `package-lock.json`.
