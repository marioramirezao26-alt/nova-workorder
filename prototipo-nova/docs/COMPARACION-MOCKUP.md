# Comparación con el mockup aprobado

11 de noviembre de 2026. La referencia es el mockup de la tienda NOVA que aprobó Mario (conversación con ChatGPT del 11-nov).

**Dónde está el mockup.** La imagen **no se copia a este repositorio** porque es público y el café del mockup lleva visible el
nombre de una tienda que está pendiente de la decisión 26 de Mario. El mockup está guardado en el repositorio privado
**nova-cerebro (PR #11)**.

**Capturas.** `docs/capturas/inicio-1628.png` es el Inicio al mismo tamaño del mockup (1628 × 966), para ponerlas lado a lado.
Las otras 19 capturas (escritorio 1440 × 900, celular 390 × 844 y el menú del celular) están en la misma carpeta. Se toman con
`scripts/capturas.js`, que además falla si alguna página pide algo fuera de 127.0.0.1, si hay errores de JavaScript o si alguna
página se mueve de lado a 360 px.

## Las reglas mandan sobre el mockup

Cuando un elemento del mockup choca con una regla del prototipo, no se copia tal cual y se dice cuál regla:

- **R1:** datos de demostración inequívocos (la franja «Prototipo de demostración…», «marca ficticia», «precio ilustrativo»).
- **R2:** los sellos no están validados (`AFIRMACIONES-NO-VALIDADAS.md`, A1 a A4).
- **R3:** la marca del café del mockup no se copia (decisión 26 de Mario, pendiente). Se usa la marca ficticia **Talvo**.
- **R4:** nada de fotos ni marcas de terceros, y nada recortado del mockup: el fondo, Gaby y los productos son SVG propios.
- **R5:** Gaby es demostración, con respuestas fijas.
- **R6:** sin red, sin formularios que envíen y sin scripts ni fuentes de afuera (la política de seguridad no cambió).
- **R7:** movimiento reducido, contraste y teclado.
- **R8:** solo se toca `prototipo-nova/` (y `test/prototipo.test.js`); nunca el 310.

## Matriz de diferencias

| # | Elemento del mockup | Cómo estaba | Qué se hizo | Estado |
|---|---|---|---|---|
| 1 | Logo: «N» con degradado cian a violeta, «NOVA» y «Comercio Inteligente» | «N» cian plana, «NOVA» y «DEMO» | «N» en SVG propio con degradado, «NOVA» y «Comercio Inteligente» debajo. El lema se oculta por debajo de 520 px | Hecho. La pastilla **DEMO** se queda (R1) |
| 2 | Menú con íconos; «Inicio» activo en píldora con borde cian | Solo texto | Íconos de línea propios (`assets/iconos/`) puestos por CSS, así el texto del enlace no cambia. Píldora activa con borde cian y brillo. Por debajo de 1240 px pasa al menú del celular | Hecho |
| 3 | Separador y botón «NOVA WORKORDER» con ícono de capas | Botón «WORKORDER» de texto | Ícono de capas, «NOVA» sobre «WORKORDER», nombre accesible «NOVA WORKORDER, accesos de clientes» | Hecho |
| 4 | Botón redondo de cuenta | No existía | Botón redondo «Cuenta (no disponible en la demostración)». Al tocarlo sale el aviso «La demostración no tiene cuentas ni inicio de sesión». Sin formulario ni campos | Hecho, sin inicio de sesión (R6, R1) |
| 5 | Carrito redondo con globito | Botón de 76 × 40 | Botón redondo de 46 px (44 en celular) con globito cian | Hecho |
| 6 | Fondo de montañas azules con niebla | Fondo casi plano | `assets/fondo-montanas.svg` propio: 3 cordilleras, niebla, estrellas y luz azul. Velo oscuro a la izquierda para el contraste del texto. En las otras páginas va tenue arriba | Hecho. No se recortó el fondo del mockup (R4) |
| 7 | «BIENVENIDO A NOVA» | «NOVA · TIENDA MULTIMARCA» | Cambiado | Hecho |
| 8 | Titular en 2 líneas, solo «comprar» en cian | Degradado en «nueva forma de comprar», 3 líneas | Solo «comprar» en cian; 2 líneas a 1440 y 1628 px | Hecho. Letra del sistema, sin fuentes de afuera (R6) |
| 9 | Bajada «Productos seleccionados, atención inteligente…» | Párrafo de 3 líneas | «Productos de muchas marcas, Gaby IA para ayudarte a elegir y una compra sencilla.» | Hecho. No se dice «seleccionados»: no hay curaduría real (R1) |
| 10 | «Explorar productos» (cian) y «Hablar con Gaby IA» (contorno) | «Ver la tienda» y «Hablar con Gaby IA (demo)» | Botón cian con texto oscuro (11:1), ícono de carrito y flecha; el de Gaby en contorno con destellos y la pastilla «demo» | Hecho. «demo» se queda (R5) |
| 11 | Tres sellos: «Envío seguro a todo el país», «Compras protegidas», «Asesoría inteligente 24/7» | Bloque de 4 tarjetas «Sin validar» a todo el ancho | Fila de 3 sellos con el ícono del mockup y la etiqueta «Sin validar»: «Envíos · por definir», «Compra protegida · sin política aún», «Gaby IA · horario por definir». Enlace «Qué falta definir» a un recuadro al final del Inicio con los 4 puntos (incluye Pagos) | Hecho con texto honesto. **No se copian los textos del mockup** (R2; A1 a A3). «24/7» solo sale negado |
| 12 | Gaby IA grande en el centro: holográfica, audífonos, anillos, «N» en la mano y en el pecho | Tarjeta de chat con una esfera de 56 px | Hero en 3 zonas: texto, figura y burbuja. Gaby dibujada en SVG propio (`ilustraciones.js`, `gaby()`): personaje estilizado con audífonos, 3 anillos que giran despacio, borde de luz, líneas de escaneo, «N» flotando sobre la mano abierta y «N» en el pecho. `role="img"` con «Ilustración de Gaby IA, asistente de demostración». En celular va después del titular | Hecho. No se recortó ni se calcó la imagen del mockup, y no imita a una persona real (R4) |
| 13 | Burbuja «Soy Gaby IA · Tu asesora comercial… compra rápida y segura» con onda de voz | Chat de ejemplo | Burbuja de vidrio con pico hacia Gaby: «Soy **Gaby IA**» y «Tu asesora en NOVA (demostración). Te ayudo a encontrar y comparar productos del catálogo de ejemplo.» Onda decorativa en SVG (`aria-hidden`) y enlace «Probar la demostración» | Hecho. Sin «rápida y segura»: no hay pagos ni política (R2; A2, A4). La onda no suena (R5, R6) |
| 14 | 8 categorías con ícono: Todas, Hogar, Tecnología, Bienestar, Deportes, Café y Bebidas, Oficina, Accesorios | 6 tarjetas: Tecnología, Hogar, Moda, Belleza, Deportes, Mascotas | `datos.js` con las 7 del mockup; «Todas» lleva a la tienda sin filtro. Fila de 8 tarjetas con ícono sobre el fondo de montañas; en celular se desliza de lado. Moda pasó a Accesorios y Deportes, Belleza a Bienestar, Mascotas salió; se sumaron Café y Bebidas y Oficina (19 productos). La tienda muestra las mismas categorías como chips | Hecho |
| 15 | «⚡ Productos destacados» y «Ver toda la tienda →» | «Novedades de demostración» | Rayo, «Productos destacados», subtítulo «Marcas ficticias · precios ilustrativos» y «Ver toda la tienda →» | Hecho. El rótulo de demostración se queda (R1) |
| 16 | Carrusel de 4 tarjetas con flechas redondas | Cuadrícula de 7 con hueco | Carrusel propio con `scroll-snap`, flechas «Anteriores»/«Siguientes» que se apagan en los extremos, flechas del teclado y sin pasar solo. 8 destacados. Salto inmediato con movimiento reducido | Hecho. Sin librerías (R6) |
| 17 | Tarjeta horizontal: imagen grande, nombre, descripción, precio y botón cuadrado cian | Tarjeta vertical con botón azul ancho | Tarjeta horizontal con imagen a la izquierda, borde de luz y botón cian de 44 × 44 «Agregar <nombre> al carrito». En la tienda, la tarjeta vertical también usa ese botón y se puede tocar entera | Hecho. «marca ficticia» y «Precio ilustrativo» se quedan (R1) |
| 18 | Café en bolsa con taza, audífonos, reloj «10:08» y humidificador con vapor y LED | Íconos planos | Dibujos con volumen (degradados, brillo, sombra) que ocupan 70–80 % del lienzo: bolsa de café **Talvo** con taza, vapor y granos; audífonos; reloj 10:08; humidificador con vapor y aro LED cian; y el resto del catálogo | Hecho. **El café no lleva el nombre de la tienda del mockup** (R3). Ningún producto imita un modelo o logo real (R4) |
| 19 | Precios «Desde $21.000», $129.900, $189.900 y $89.900 | Precios propios | Precios del mismo orden: $32.900, $129.900, $189.900 y $89.900, todos con «Precio ilustrativo» | Hecho. No se usa «Desde»: no hay variantes. Ninguno es de venta (R1, A6) |
| 20 | Descripciones «origen selecto», «larga duración», «salud y productividad», «aroma relajante» | Solo en la ficha | Una línea por tarjeta: «Café colombiano (ejemplo)», «Audífonos de diadema», «Reloj para deporte y día a día», «Humidificador con luz LED» | Hecho sin promesas medibles (R1, R2) |
| 21 | Franja «NOVA WORKORDER · ¿Ya eres cliente…? · gestión, soporte y pedidos · Ingresar a WORKORDER →» con borde violeta y portátil | Recuadro sencillo | Franja ancha con borde en degradado azul a violeta y brillo, capas con «NOVA / WORKORDER», separador, «¿Ya eres cliente de nuestros servicios?», «Entra a Servicios y Pedidos con tus accesos de siempre», portátil SVG con un tablero genérico y «Ingresar a WORKORDER →» | Hecho. Sin «gestión, soporte»: solo lo que existe (Servicios y Pedidos). El portátil no es una captura del sistema (R1, R4) |
| 22 | Contenido de unos 1450 px de ancho | 1200 px | `--max: 1440px`, márgenes de 16 px en celular | Hecho |
| 23 | El mockup no tiene franja de demostración y casi no tiene pie | Franja ámbar y pie de 4 párrafos | La franja se queda con el texto exacto; en celular sale una versión corta. El pie quedó en una línea, un «Sobre esta demostración» plegable y el enlace a WORKORDER | Hecho. La franja se queda (R1) |
| 24 | Vidrio, bordes de luz y brillos | Tarjetas planas | Tokens `--vidrio` y `--borde-luz`, bordes cian, brillos y entrada suave de secciones con `IntersectionObserver` propio | Hecho. Todo quieto con movimiento reducido (R7) |
| 25 | (Otras páginas) Tienda, Ofertas y Categorías | Títulos enormes, íconos planos, filtros a pantalla completa en celular | Montañas tenues arriba, títulos más bajos, chips de categoría, tarjetas e ilustraciones nuevas, filtros plegables en celular («Filtros (n)»), tarjetas de categoría con ilustración | Hecho (R1 en los rótulos) |
| 26 | (Otras páginas) Gaby IA | Chat con orbe de 34 px | Figura holográfica en tamaño medio junto al título; los anillos aceleran y brillan mientras sale la respuesta. Chat con borde cian, sugerencias como chips encima del campo, texto guía corto | Hecho. Respuestas fijas, sin red (R5, R6) |
| 27 | (Otras páginas) WORKORDER | Título y 2 tarjetas | Título con capas, portátil genérico, tarjetas Servicios y Pedidos con ícono y borde de luz | Hecho. Los enlaces reales no cambian y no se pide usuario ni contraseña (R6) |
| 28 | (Otras páginas) Ficha | Título gigante | Título más chico, ilustración nueva fija en escritorio con borde de luz, `role="img"` con nombre | Hecho. «Sin validar» en envío, garantía y disponibilidad (R2) |
| 29 | (Otras páginas) Carrito y Mis pedidos | Estilo plano | Vidrio, botón cian, cantidad con − y + y rótulo «Cant.», «Simular compra» con «No se cobra nada» debajo, estado vacío en Mis pedidos, deshabilitados con estilo propio | Hecho. Compra simulada (R1; A4, A11) |
| 30 | Menú del celular (no está en el mockup) | Panel transparente que no se cerraba | Panel opaco, íconos, se cierra al tocar afuera, con Escape y cuando el foco sale; el botón dice «Abrir el menú» o «Cerrar el menú» | Hecho (R7) |

## Hallazgos previos (revisiones de diseño y de celular y accesibilidad)

| Id | Gravedad | Qué se hizo | Estado |
|---|---|---|---|
| D-01 | alta | Gaby protagonista y holográfica (fila 12) | Hecho |
| D-02 | alta | Página de Gaby con la figura (fila 26) | Hecho |
| D-03 / M-02 | alta | Filtros plegables en el celular: el primer producto pasó de y≈1179 a y≈640 a 390 px | Hecho |
| D-04 | alta | Ilustraciones con volumen y más grandes (filas 17 y 18) | Hecho |
| D-05 | media | Sellos en una fila y detalle al final (fila 11) | Hecho |
| D-06 | media | «Productos destacados» con 8 y carrusel (filas 15 y 16) | Hecho |
| D-07 | media | Título de la ficha más chico e imagen fija | Hecho |
| D-08 / M-04 | media | Menú del celular opaco; el desenfoque pasó a una capa aparte | Hecho |
| D-09 | media | Categorías con ilustración | Hecho |
| D-10 | baja | Botón de ícono en las tarjetas; el azul sólido ya no se repite | Hecho |
| D-11 / M-07 | media | Sugerencias de Gaby como chips alineados, sobre el campo; texto guía corto | Hecho |
| D-12 / M-09 | baja | Franja corta en celular y pie resumido | Hecho |
| D-13 | baja | Entrada suave, anillos, onda y brillos (todo quieto con movimiento reducido) | Hecho |
| M-01 | alta | Botones redondos de 44 px, lema oculto en celular; `capturas.js` revisa que a 360 px ninguna página sea más ancha que la pantalla | Hecho |
| M-03 | media | Menú: cierre al tocar afuera y al salir el foco; etiqueta «Cerrar el menú» | Hecho |
| M-05 | media | Botones chicos, sugerencias, casillas y control de precio de 44 px o más en celular | Hecho |
| M-06 | baja | Tarjeta clicable entera; migas, «Ver toda la tienda» y enlaces del pie con más área | Hecho |
| M-08 | media | Estado vacío en Mis pedidos, el ejemplo va aparte («Así se vería un pedido») y el botón de borrar se esconde si no hay pedidos | Hecho |
| M-10 | baja | En la ficha del celular cada dato va en su propia fila | Hecho |
| M-11 | baja | Cantidad con − y +, rótulo «Cant.» visible y «Simular compra» corto | Hecho |
| M-12 | baja | Ilustración de la ficha con nombre; «Antes» del precio tachado como texto oculto | Hecho |
| M-13 | baja | Control de precio con `aria-valuetext` en pesos; el conteo se anuncia con 400 ms de espera | Hecho |
| M-14 | baja | Deshabilitados con borde punteado y texto legible, y la nota «Agrega un producto para simular la compra» | Hecho |

**Arreglo extra encontrado al revisar:** el control de precio redondeaba a pasos de 10.000 y dejaba por fuera el producto más
caro sin que nadie filtrara («18 productos» y «Filtros (1)»). Ahora el tope se redondea hacia arriba.

**Queda para Mario:** la franja dice «fotos ilustrativos», aunque el prototipo solo tiene dibujos. Se deja igual porque es la
palabra del encargo y la prueba la revisa letra por letra; si Mario prefiere «imágenes ilustrativas», se cambian juntos el texto
de las 9 páginas y la constante `FRANJA` de `test/prototipo.test.js`.

## Lo que no cambia aunque el mockup lo muestre

- La franja «Prototipo de demostración…».
- «Marca ficticia» y «precio ilustrativo».
- «Sin validar» en envíos, compra protegida y atención.
- Que no aparezca el nombre de la tienda del café del mockup ni otra marca real.
- Que no se recorten imágenes del mockup.
- Gaby con respuestas fijas.
- Que no haya red, formularios, cuentas, fuentes ni scripts de afuera.
- Que nada salga de `prototipo-nova/`, y que no aparezca el 310.
