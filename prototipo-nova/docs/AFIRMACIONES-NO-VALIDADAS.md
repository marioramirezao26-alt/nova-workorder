# Afirmaciones no validadas

Lo que un mockup de tienda suele sugerir y que **NOVA no ha validado**. Ninguna se presenta como real en el prototipo.
Antes de publicar algo parecido, cada una se valida con evidencia (y la decisión de Mario cuando toque plata) o se quita.

| # | Afirmación que sugiere el mockup | Estado | Cómo queda en el prototipo |
|---|---|---|---|
| A1 | «Envíos a todo el país», tiempos o envío gratis | Sin validar: no hay operador logístico ni tarifas | Sello «Envíos · por definir» con etiqueta **Sin validar** en el hero (no «Envío seguro a todo el país» del mockup) y detalle al final del Inicio: «Cobertura, tiempos y costos por definir». Ficha: «Las condiciones de envío no están definidas». Gaby: «no te puedo prometer tiempos ni costos». |
| A2 | «Compra protegida», garantía, devoluciones | Sin validar: no hay política aprobada | Sello «Compra protegida · sin política aún» con **Sin validar** y detalle al final del Inicio: «Aún no hay una política aprobada». Ficha: garantía «Sin validar, dependerá de cada proveedor». |
| A3 | «Atención 24/7» con Gaby | Sin validar: el horario y el alcance no están definidos | Sello «Gaby IA · horario por definir» con **Sin validar** (no «Asesoría inteligente 24/7» del mockup) y detalle: «no se promete atención 24/7». |
| A4 | Pagos seguros, medios de pago | Sin validar: no hay pasarela para la tienda | Detalle «Pagos» con **Sin validar** al final del Inicio; carrito: «Simular compra» y «No se cobra nada: es una compra simulada»; la burbuja de Gaby no dice «compra rápida y segura»; Gaby: «no hay pagos». |
| A5 | Inventario o «disponible» | Sin validar: no hay inventario | Ficha: disponibilidad **Sin validar**, «No hay inventario: es un producto de demostración». No hay contadores de unidades. |
| A6 | Precios | Ilustrativos | Cada tarjeta y ficha: «Precio ilustrativo, no es de venta». Total del carrito: «Total ilustrativo». |
| A7 | Descuentos y ofertas | Ilustrativos | Etiqueta «−N % ilustrativo»; página Ofertas con **Sin validar**: «no son promociones reales ni tienen fecha». Sin contadores de tiempo. |
| A8 | Marcas y productos | Inventados | «Marca ficticia» en cada tarjeta y ficha; nombres que no son de marcas reales. El café del mockup no lleva la marca de la tienda pendiente de la decisión 26: aquí es «Talvo», inventada. |
| A9 | Fotos de producto | Dibujos propios | Ilustraciones SVG hechas en `assets/ilustraciones.js`; ninguna foto ni logo de terceros. |
| A10 | Reseñas, estrellas, «más vendido» | No existen | **No se muestran** (no se inventan testimonios). |
| A11 | Estado de pedidos (preparando, en camino) | Simulado | «Mis pedidos» marca cada pedido como **Simulado** y dice que no existe en ningún sistema. |
| A12 | Gaby como asesora de compra | Demo | «Gaby IA (demo)», respuestas fijas escritas a mano, admite que es IA, sin compromisos comerciales. |
| A13 | WhatsApp de contacto | Dato real, uso de demostración | Solo texto «321 392 7697» con **Solo demostración**; el prototipo no abre chats ni enlaza a WhatsApp. |
| A14 | Que NOVA ya es una tienda multimarca | No: es un proyecto | Franja fija en todas las páginas: «Prototipo de demostración · productos, precios y fotos ilustrativos · no es una tienda real». |

Las pruebas (`test/prototipo.test.js`) revisan que estén la franja, «precio ilustrativo», «marca ficticia», que no haya
fotos, que «24/7» solo salga negado y que no aparezca el 310.
