# Correr el prototipo en tu computador

No hay que instalar nada ni compilar: son archivos HTML, CSS y JavaScript. Tampoco se necesita internet.

## Opción 1 (recomendada): un servidor local de Python

Desde la carpeta del repositorio `nova-workorder`:

```bash
python3 -m http.server 8765 --bind 127.0.0.1 --directory prototipo-nova
```

En Windows puede ser `py -m http.server 8765 --bind 127.0.0.1 --directory prototipo-nova`.

Abre `http://127.0.0.1:8765/` en el navegador. Para apagarlo: `Ctrl + C` en la terminal.

Se usa `127.0.0.1` para que solo lo veas tú, no otros equipos de la red.

## Opción 2: abrir el archivo

Doble clic en `prototipo-nova/index.html`. Algunos navegadores bloquean los scripts de archivos locales por la política
de seguridad de la página; si la tienda sale vacía, usa la opción 1.

## Qué probar
1. **Inicio**: el hero «Descubre una nueva forma de comprar», la tarjeta de Gaby IA, las categorías y las novedades.
2. **Tienda**: busca, filtra por categoría, marca, precio máximo y ofertas; ordena por precio.
3. **Categorías** → toca una y llegas a la tienda ya filtrada.
4. **Ofertas**: productos con precio tachado (ilustrativo).
5. **Ficha de producto**: toca el nombre de cualquier producto. «Agregar al carrito simulado» y «Preguntarle a Gaby IA (demo)».
6. **Carrito** (arriba a la derecha): cambia cantidades, quita, «Simular compra (no se cobra)».
7. **Mis pedidos**: aparece el pedido simulado `DEMO-0001`; «Borrar mis pedidos simulados» lo quita.
8. **Gaby IA**: escribe o toca una sugerencia. Son respuestas fijas.
9. **WORKORDER**: los dos botones llevan a los inicios de sesión reales de Servicios y Pedidos (los mismos de hoy).
10. **Teclado**: con `Tab` se recorre todo; el foco se ve con un borde cian; «Saltar al contenido» aparece al primer `Tab`.
11. **Celular**: achica la ventana (o usa el modo celular del navegador); el menú se abre con «Menú» y se cierra con `Esc`.

El carrito y los pedidos simulados quedan **solo en ese navegador** (localStorage). Para empezar de cero, borra los datos
del sitio `127.0.0.1:8765` en el navegador.

## Pruebas
```bash
npm ci
npm test                          # toda la suite, incluye test/prototipo.test.js
node --test test/prototipo.test.js   # solo las del prototipo (no necesitan base de datos)
```

## Capturas
Necesitan Playwright con Chromium, que **no** viene en el proyecto (a propósito: el prototipo no tiene dependencias).
Con Playwright disponible:
```bash
python3 -m http.server 8765 --bind 127.0.0.1 --directory prototipo-nova &
node prototipo-nova/scripts/capturas.js http://127.0.0.1:8765
kill %1
```
Guarda los PNG en `prototipo-nova/docs/capturas/` y falla si alguna página pide algo fuera de `127.0.0.1` o tiene errores de
JavaScript.
