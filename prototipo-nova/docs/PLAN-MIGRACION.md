# Plan de migración reversible a novaworkorder.com

**Nada de esto está aprobado ni se va a hacer con este PR.** Es el camino propuesto para cuando Mario decida llevar el
diseño Premium Futurista a `novaworkorder.com` sin afectar a los clientes actuales de NOVA WORKORDER. Cada etapa necesita
el sí de Mario y su propio PR; cada una se puede devolver sola.

## Principios
1. **Los clientes de hoy no notan nada**: `app.novaworkorder.com` (Servicios) y `pedidos.novaworkorder.com` (Pedidos) no
   cambian de dirección ni de inicio de sesión en ninguna etapa.
2. **Lo nuevo entra al lado, no encima**: primero en una ruta o subdominio aparte; la portada actual se reemplaza de último.
3. **Volver atrás es un comando**: el despliegue ya cambia la carpeta de la página de una vez (`mv`), así que devolver es
   publicar el paquete anterior.
4. **Nada sale con datos sin validar**: antes de publicar, cada afirmación de `AFIRMACIONES-NO-VALIDADAS.md` se valida o se
   quita, y pasa `revisar_reglas.py` del cerebro.

## Etapas

### Etapa 0 — Revisión (esta)
- Prototipo en `prototipo-nova/`, fuera de todo lo que se despliega (`export-ignore`).
- **Devolver**: cerrar el PR. No hay nada publicado.

### Etapa 1 — Vista privada para Mario
- Publicar el prototipo en un subdominio de prueba **con clave** (por ejemplo `prueba.novaworkorder.com`, con `basic_auth`
  de Caddy) y `noindex`. Necesita el sí de Mario, un registro DNS y una línea nueva en Caddy (lo hace Mario como root).
- **Devolver**: borrar el bloque del subdominio en Caddy y el registro DNS.

### Etapa 2 — Datos reales de catálogo, solo lectura
- Conectar la tienda a NOVA Commerce AI (`/v1/catalog/search`) con los interruptores de
  `INTEGRACION-COMMERCE-AI.md`, apagados por defecto. Sin carrito real todavía.
- **Devolver**: apagar el interruptor; la tienda vuelve al catálogo de demostración.

### Etapa 3 — Página de campaña en ruta propia
- Una ruta nueva en la página, por ejemplo `novaworkorder.com/tienda/`, para el embudo de `EMBUDO.md`. La portada `/`
  sigue siendo la de hoy, con Servicios, Pedidos y «Empieza gratis».
- Revisar antes: que `/tienda/` no choque con rutas ni con el `try_files` de Caddy, que el `sitemap.xml` y el
  `llms.txt` la traten aparte, y que el formulario `/api/public/demo` y el chat sigan igual.
- **Devolver**: publicar el paquete anterior con `publicar-web.sh` (no reinicia la app).

### Etapa 4 — Compra real
- Solo con decisiones de Mario sobre medios de pago, envíos, garantías, devoluciones, quién vende (Ley 1480) y
  privacidad (Ley 1581). Esto **gasta o mueve plata**: requiere su «1. Sí» en `registro/aprobaciones.md`.
- **Devolver**: interruptor de compra apagado; la tienda queda en modo catálogo.

### Etapa 5 — Portada nueva
- La portada `novaworkorder.com/` pasa al diseño nuevo, con un **acceso WORKORDER visible** en el menú (como en el
  prototipo) que lleva a los mismos dos inicios de sesión. Las páginas de precios, legales, blog y mercados (`/en/`,
  `/es-us/`, `/es-mx/`) se migran una por una o se dejan como están.
- Mantener las direcciones que hoy reciben anuncios y buscadores (`/`, `/precios`, `/#demo`, `/en/pricing`), o redirigir con
  301 donde cambien.
- **Devolver**: publicar el paquete anterior.

## Lo que hay que revisar en cada etapa
- Suite completa en verde (`npm test`), más `test/prototipo.test.js`.
- Los enlaces «Ingresar → Servicios» y «Ingresar → Pedidos» llegan a su inicio de sesión.
- «Empieza gratis» sigue creando la solicitud de demo.
- El chat de Gaby de la página sigue contestando.
- Cabeceras de seguridad de Caddy (`X-Frame-Options`, `frame-ancestors`) iguales o más estrictas.
- `localStorage`: las claves del prototipo (`nova-demo-*`) no chocan con las de la página.
- Nada con [FALTA DATO], datos inventados ni el número 310.
