# Integración futura con NOVA Commerce AI

**No está construida.** Hoy el prototipo no hace ninguna llamada de red: el catálogo sale de `assets/datos.js` y Gaby
contesta con frases fijas de `assets/gaby.js`. Esto describe cómo se conectaría después, con el sí de Mario.

## Qué se usaría
- Solo **`GET /v1/catalog/search`** de comerce-ai, **de solo lectura**: buscar productos por texto, categoría, marca y
  precio. Ninguna llamada que cree, cambie o borre algo, ni pedidos, ni pagos.
- El contrato exacto (parámetros, respuesta, límites y autenticación) **hay que confirmarlo** con el repositorio
  comerce-ai antes de programar; aquí no se inventa.

## Interruptores (todos apagados por defecto)
| Interruptor | Qué hace al prenderlo | Apagado |
|---|---|---|
| `NOVA_CATALOGO_REAL` | La tienda, las categorías y las ofertas buscan en `/v1/catalog/search` | Catálogo de demostración |
| `NOVA_GABY_CATALOGO` | Gaby puede sugerir productos del catálogo real (solo nombre, precio y enlace a la ficha) | Respuestas fijas |
| `NOVA_GABY_EN_VIVO` | Gaby contesta con la IA real (con todas las reglas de Gaby: admite que es IA, sin compromisos) | Demo |
| `NOVA_COMPRA` | Carrito y pago reales | Carrito simulado (requiere decisión de Mario: mueve plata) |

Con cualquier interruptor apagado, o si comerce-ai no responde, la página vuelve sola al modo demostración y lo dice.

## Cómo se conectaría sin abrir huecos
1. **El navegador no llama directo a comerce-ai.** Una ruta del backend de la tienda hace de intermediaria, con la llave
   en el `.env` del servidor (la pone Mario), nunca en el código ni en la página.
2. **Lista blanca de campos**: solo id, nombre, marca, categoría, precio, foto del proveedor (si su licencia lo permite) y
   disponibilidad. Nada de datos de clientes.
3. **Límite de peticiones** por IP y caché corta, como `/api/public/*`.
4. La política de seguridad de la página se abre **solo** para el origen propio (`connect-src 'self'`), nunca para
   todos.
5. Cada precio o disponibilidad que venga de comerce-ai se muestra con su fecha de consulta; si no hay, se dice «por
   confirmar» y no se inventa.
6. Pruebas: con comerce-ai simulado (sin red) para encendido, apagado, error y respuesta vacía.

## Lo que no hace la integración
- No toma pedidos ni cobra (eso es `NOVA_COMPRA`, otra decisión).
- No toca Dropi, Meta, WhatsApp ni Canva.
- No cambia nada de NOVA WORKORDER.
