# Afirmaciones no validadas

Lo que un mockup de tienda suele sugerir y que **NOVA no ha validado**. Ninguna se presenta como real en el prototipo.
Antes de publicar algo parecido, cada una se valida con evidencia (y la decisión de Mario cuando toque plata) o se quita.

| # | Afirmación que sugiere el mockup | Estado | Cómo queda en el prototipo |
|---|---|---|---|
| A1 | «Envíos a todo el país», tiempos o envío gratis | Sin validar: no hay operador logístico ni tarifas | Tarjeta «Envíos» con etiqueta **Sin validar**: «Cobertura, tiempos y costos por definir». Ficha: «Las condiciones de envío no están definidas». Gaby: «no te puedo prometer tiempos ni costos». |
| A2 | «Compra protegida», garantía, devoluciones | Sin validar: no hay política aprobada | Tarjeta «Compra protegida» con **Sin validar**: «Aún no hay una política aprobada». Ficha: garantía «Sin validar, dependerá de cada proveedor». |
| A3 | «Atención 24/7» con Gaby | Sin validar: el horario y el alcance no están definidos | Tarjeta «Atención con Gaby IA» con **Sin validar**: «no se promete atención 24/7». |
| A4 | Pagos seguros, medios de pago | Sin validar: no hay pasarela para la tienda | Tarjeta «Pagos» con **Sin validar**; carrito: «Simular compra (no se cobra)»; Gaby: «no hay pagos». |
| A5 | Inventario o «disponible» | Sin validar: no hay inventario | Ficha: disponibilidad **Sin validar**, «No hay inventario: es un producto de demostración». No hay contadores de unidades. |
| A6 | Precios | Ilustrativos | Cada tarjeta y ficha: «Precio ilustrativo, no es de venta». Total del carrito: «Total ilustrativo». |
| A7 | Descuentos y ofertas | Ilustrativos | Etiqueta «−N % ilustrativo»; página Ofertas con **Sin validar**: «no son promociones reales ni tienen fecha». Sin contadores de tiempo. |
| A8 | Marcas y productos | Inventados | «Marca ficticia» en cada tarjeta y ficha; nombres que no son de marcas reales. |
| A9 | Fotos de producto | Dibujos propios | Ilustraciones SVG hechas en `assets/ilustraciones.js`; ninguna foto ni logo de terceros. |
| A10 | Reseñas, estrellas, «más vendido» | No existen | **No se muestran** (no se inventan testimonios). |
| A11 | Estado de pedidos (preparando, en camino) | Simulado | «Mis pedidos» marca cada pedido como **Simulado** y dice que no existe en ningún sistema. |
| A12 | Gaby como asesora de compra | Demo | «Gaby IA (demo)», respuestas fijas escritas a mano, admite que es IA, sin compromisos comerciales. |
| A13 | WhatsApp de contacto | Dato real, uso de demostración | Solo texto «321 392 7697» con **Solo demostración**; el prototipo no abre chats ni enlaza a WhatsApp. |
| A14 | Que NOVA ya es una tienda multimarca | No: es un proyecto | Franja fija en todas las páginas: «Prototipo de demostración · productos, precios y fotos ilustrativos · no es una tienda real». |

Las pruebas (`test/prototipo.test.js`) revisan que estén la franja, «precio ilustrativo», «marca ficticia», que no haya
fotos, que «24/7» solo salga negado y que no aparezca el 310.
