# API de NOVA WORKORDER (v1)

Para conectar NOVA con el ERP, la facturación, Zapier o cualquier sistema de la empresa. Todo vive dentro de la empresa
dueña de la llave: nunca se ve ni se toca nada de otra empresa.

## 1. Llaves de API

El administrador las crea en **Integraciones → Llaves de API**. La llave completa (`nwo_…`) se muestra **una sola vez**;
NOVA guarda solo su huella. Si se pierde, se revoca y se crea otra.

- **Lectura:** consultar órdenes y clientes.
- **Escritura:** además crear órdenes y cambiarles el estado. La API no borra nada.
- La llave actúa como el administrador que la creó. Si ese usuario se desactiva o deja de ser administrador, la llave
  deja de servir. En «Actividad» lo que hace una llave aparece como `API «nombre» (de Ana)`.
- Límite: 120 peticiones por minuto por llave (`API_KEY_PER_MINUTE`). Pasado el límite responde `429`.

Se envía en el encabezado:

```
Authorization: Bearer nwo_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

(o `X-Api-Key: nwo_…`).

## 2. Endpoints

Base: `https://<tu-dominio>/api/v1`

| Método | Ruta | Permiso | Qué hace |
|---|---|---|---|
| GET | `/workorders?page=1&limit=50&status=pendiente&q=texto` | lectura | Lista de órdenes, la más nueva primero (`limit` máx. 100) |
| GET | `/workorders/:id` | lectura | Una orden |
| POST | `/workorders` | escritura | Crea una orden: `title`, `description` (10+ caracteres), y opcionales `priority`, `client`, `assignedTo`, `dueDate`, `notes`, `customerName` |
| PATCH | `/workorders/:id/status` | escritura | Cambia el estado: `{ "status": "en_proceso" \| "completada" \| "cancelada" \| "pendiente", "note": "opcional" }` |
| GET | `/clients?page=1&limit=50` | lectura | Lista de clientes |
| GET | `/clients/:id` | lectura | Un cliente |

Las validaciones y respuestas son las mismas del panel. La ubicación del técnico nunca entra ni sale por la API.

```bash
curl -s https://<tu-dominio>/api/v1/workorders?status=pendiente \
  -H "Authorization: Bearer $NOVA_API_KEY"
```

## 3. Webhooks

En **Integraciones → Webhooks** el administrador pone una dirección `https://` y elige los eventos. NOVA le manda un
`POST` con JSON cada vez que pasa algo:

| Evento | Cuándo |
|---|---|
| `orden.creada` | Se creó una orden (en el panel, el celular o la API) |
| `orden.actualizada` | Se editó una orden |
| `orden.estado` | Cambió el estado (iniciada, completada, cancelada…) |
| `orden.borrada` | Se borró una orden |
| `ping` | El botón «Enviar prueba» |

Cuerpo:

```json
{
  "id": "6720…",                 // id del envío: el mismo en los reintentos (úsalo para no procesar dos veces)
  "event": "orden.estado",
  "createdAt": "2026-10-20T15:04:05.000Z",
  "data": { "id": "671f…", "title": "Revisar aire", "status": "completada", "priority": "media",
            "customerName": "Hotel Central", "client": { "id": "…", "name": "Hotel Central" },
            "assignedTo": { "id": "…", "name": "Luis" }, "dueDate": null, "startedAt": "…", "completedAt": "…",
            "createdAt": "…", "updatedAt": "…" }
}
```

Encabezados: `X-Nova-Event`, `X-Nova-Delivery` (id del envío), `X-Nova-Timestamp` (segundos Unix) y
`X-Nova-Signature: sha256=<hex>`.

### Verificar la firma

La firma es HMAC-SHA256 de `"<X-Nova-Timestamp>.<cuerpo crudo>"` con el secreto `whsec_…` que se mostró al crear el
webhook. Rechaza avisos con más de 5 minutos.

```js
const crypto = require('crypto');
function valido(req, rawBody, secreto) {
  const ts = req.headers['x-nova-timestamp'];
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const esperado = 'sha256=' + crypto.createHmac('sha256', secreto).update(`${ts}.${rawBody}`).digest('hex');
  const recibido = String(req.headers['x-nova-signature'] || '');
  return recibido.length === esperado.length && crypto.timingSafeEqual(Buffer.from(recibido), Buffer.from(esperado));
}
```

### Entrega y reintentos

- Responde `2xx` en menos de 5 segundos. Cualquier otra respuesta (o ninguna) cuenta como fallo.
- Se reintenta a los 1, 5, 30, 120 y 360 minutos (6 intentos en total). Los envíos quedan 30 días en «Ver envíos».
- Con 50 fallos seguidos el webhook se apaga solo; se prende de nuevo desde el panel.
- «Nuevo secreto» cambia el secreto y el anterior deja de valer de inmediato.
- Por seguridad, NOVA no llama direcciones de redes internas (localhost, 10.x, 192.168.x, 169.254.x…), ni sigue
  redirecciones.

## Variables del servidor

- `WEBHOOK_SECRET_KEY` (opcional): llave de la que se derivan los secretos de firma. Sin ella se usa `JWT_SECRET`
  (si se cambia, hay que generar un secreto nuevo en cada webhook). La pone Mario en el `.env`, nunca en el código.
- `API_KEY_PER_MINUTE` (opcional, 120).
