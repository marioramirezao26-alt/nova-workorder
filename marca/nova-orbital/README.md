# NOVA Orbital: identidad visual oficial de NOVA

**Estado:** aprobado por Mario (opción 3 de las propuestas de logo, Orden 37 del 15-nov-2026). **No rediseñar ni sustituir por
otra opción sin su aprobación.**

## Qué se conserva siempre

Las variantes de esta carpeta deben conservar estos elementos del logo:
- las órbitas luminosas cian, azul y violeta;
- la estrella blanca de cuatro puntas en el centro;
- la palabra **NOVA** en blanco;
- el pequeño triángulo cian dentro de la **A**.

## Origen

Los originales vienen del paquete `NOVA_Orbital_Oficial.zip` que Mario entregó el 15-nov-2026. Se copiaron sin ningún cambio a `originales/`:

| Archivo | Tamaño | SHA-256 |
|---|---|---|
| `originales/NOVA_Orbital_logo_horizontal_oficial.png` | 2172×724, RGB, 1,4 MB | `70a3b2a33588c24b1b977cded7f88a11c17beab4a5b8fbfeee9c9a4451456326` |
| `originales/NOVA_Orbital_simbolo_fondo_oscuro.png` | 720×565, RGB, 412 KB | `b6be2015252d7d764ace91bd5dc12402dcb7ad77e2c7189883e989226e50a6b2` |

- **El logo horizontal es el maestro.** Fondo azul noche casi negro, medido en el borde: `#00000C`.
- **El recorte del símbolo es solo una referencia.** La órbita toca su borde derecho, así que sirve para mirar pero no para hacer íconos. Los íconos salen de un recorte cuadrado del logo horizontal.
- **No existe una versión vectorial (SVG) nativa.** Los dos originales son imágenes de mapa de bits (PNG). Una versión vectorial habría que redibujarla, y eso necesita la aprobación de Mario.

## Cómo se hicieron los derivados

Todos salen de `derivar_nova_orbital.py`, que es reproducible:

```
python derivar_nova_orbital.py originales derivados
```

El guion solo hace cuatro cosas:
- recorta;
- cambia el tamaño (con Lanczos);
- vuelve a codificar (WebP con calidad 92, o PNG optimizado);
- separa el fondo.

No dibuja nada, ni cambia formas, colores o letras. El inventario de cada corrida queda en `derivados/inventario.json`.

- **Exacta:** los mismos píxeles del original, recortados, reescalados o en otro formato.
- **Aproximada (revisar):** necesita el visto bueno de Mario. Hay dos casos:
  1. **Transparentes.** La transparencia se calcula separando el fondo `#00000C`. Sobre ese mismo fondo reproducen el original con un error máximo de 2/255.
     - **Solo sirven sobre fondos oscuros.** La palabra NOVA es blanca y en un fondo claro desaparece. Además, el brillo de las órbitas se vuelve un halo.
     - El ruido de compresión más oscuro que el fondo (±3/255) se aplanó.
  2. **El ícono «maskable» de Android.** El símbolo va al 80 % sobre un fondo liso `#00000C` nuevo, para respetar la zona segura del sistema.

## Inventario
| Archivo (`derivados/`) | Tamaño | Peso | Tipo | Nota |
|---|---|---|---|---|
| `nova-orbital-horizontal-2172.webp` | 2172×724 | 71 KB | Exacta | Logo horizontal, fondo oscuro original |
| `nova-orbital-horizontal-1200.webp` | 1200×400 | 30 KB | Exacta | Logo horizontal, fondo oscuro original |
| `nova-orbital-horizontal-600.webp` | 600×200 | 12 KB | Exacta | Logo horizontal, fondo oscuro original |
| `nova-orbital-horizontal-320.webp` | 320×107 | 6 KB | Exacta | Logo horizontal, fondo oscuro original |
| `nova-orbital-horizontal-1200.png` | 1200×400 | 387 KB | Exacta | Logo horizontal PNG |
| `nova-orbital-horizontal-transparente-2172.png` | 2172×724 | 1729 KB | **Aproximada (revisar)** | Fondo separado; sobre #00000C reproduce el original (error máx 2.0/255). Solo para fondos oscuros |
| `nova-orbital-horizontal-transparente-1200.webp` | 1200×400 | 233 KB | **Aproximada (revisar)** | Igual que la transparente de 2172, reescalada; solo para fondos oscuros |
| `nova-orbital-horizontal-transparente-600.webp` | 600×200 | 63 KB | **Aproximada (revisar)** | Igual que la transparente de 2172, reescalada; solo para fondos oscuros |
| `nova-orbital-horizontal-transparente-320.webp` | 320×107 | 21 KB | **Aproximada (revisar)** | Igual que la transparente de 2172, reescalada; solo para fondos oscuros |
| `nova-orbital-encabezado-48.webp` | 136×48 | 6 KB | **Aproximada (revisar)** | Transparente recortada (x 0–2052, alto completo) para encabezados oscuros; alfa máx. en el borde 8/255 |
| `nova-orbital-encabezado-96.webp` | 272×96 | 18 KB | **Aproximada (revisar)** | Transparente recortada (x 0–2052, alto completo) para encabezados oscuros; alfa máx. en el borde 8/255 |
| `nova-orbital-encabezado-144.webp` | 408×144 | 35 KB | **Aproximada (revisar)** | Transparente recortada (x 0–2052, alto completo) para encabezados oscuros; alfa máx. en el borde 8/255 |
| `nova-orbital-simbolo-cuadrado-724.png` | 724×724 | 466 KB | Exacta | Recorte 724x724 del logo horizontal (x 191–915): símbolo completo con su fondo |
| `nova-orbital-simbolo-cuadrado-512.webp` | 512×512 | 26 KB | Exacta | Símbolo cuadrado reescalado |
| `nova-orbital-simbolo-cuadrado-256.webp` | 256×256 | 10 KB | Exacta | Símbolo cuadrado reescalado |
| `nova-orbital-simbolo-transparente-724.png` | 724×724 | 723 KB | **Aproximada (revisar)** | Símbolo con el fondo separado (error máx 2.0/255 sobre #00000C). Solo para fondos oscuros |
| `nova-orbital-simbolo-transparente-128.png` | 128×128 | 29 KB | **Aproximada (revisar)** | Símbolo transparente pequeño (encabezados) |
| `nova-orbital-simbolo-referencia-720x565.webp` | 720×565 | 40 KB | Exacta | Recorte suministrado, re-codificado. La órbita toca el borde derecho: referencia, no para iconos |
| `favicon-16.png` | 16×16 | 1 KB | Exacta | Símbolo cuadrado reescalado (icono) |
| `favicon-32.png` | 32×32 | 2 KB | Exacta | Símbolo cuadrado reescalado (icono) |
| `favicon-48.png` | 48×48 | 4 KB | Exacta | Símbolo cuadrado reescalado (icono) |
| `apple-touch-icon-180.png` | 180×180 | 38 KB | Exacta | Símbolo cuadrado reescalado (icono) |
| `icono-app-192.png` | 192×192 | 43 KB | Exacta | Símbolo cuadrado reescalado (icono) |
| `icono-app-512.png` | 512×512 | 259 KB | Exacta | Símbolo cuadrado reescalado (icono) |
| `favicon.ico` | 48×48 | 7 KB | Exacta | ICO con 16, 32 y 48 px |
| `icono-app-maskable-512.png` | 512×512 | 175 KB | **Aproximada (revisar)** | Símbolo al 80 % sobre fondo liso #00000C (relleno nuevo alrededor del recorte). **Defecto (Orden 38): costura cuadrada tenue donde termina el recorte**; ver abajo. Hoy no lo usa ninguna página |

## Dónde se usa (PR de la Orden 37, en borrador)

**Página pública (`landing/`, novaworkorder.com).** Las 35 páginas cambian solo en el encabezado y en los íconos:
- inicio;
- precios, términos y privacidad;
- blog;
- versiones en inglés, México y Estados Unidos;
- 404.

Los archivos web van en `landing/marca/`.

| Qué | Antes | Ahora |
|---|---|---|
| Logo del encabezado (`.brand`) | `favicon.svg` (cuadro azul) + texto «NOVA» + «WORKORDER» | `marca/nova-orbital-encabezado-48.webp` (2x: 96, 3x: 144), `alt="NOVA"`, y debajo el mismo «WORKORDER» pequeño |
| Ícono de la pestaña | `favicon.svg` | `marca/favicon.ico` + `marca/favicon-32.png` |
| Ícono de iPhone | `img/icono-180.png` | `marca/apple-touch-icon-180.png` |

**La app (`frontend/`, app.novaworkorder.com):**
- en la pantalla de entrada y en la de cambio de contraseña, el ícono de arriba ahora es `marca/nova-orbital-simbolo-transparente-128.png`;
- el ícono de la pestaña y el de iPhone cambian igual que en la página.

**Lo que NO cambia, a propósito:**
- **NOVA Store (`landing/tienda/`):** es pública y la Orden 36 prohíbe modificarla. Sigue con `favicon.svg`, que no se borró ni se cambió.
- **El nombre público NOVAWORKORDER:** títulos, textos, datos estructurados y dominio siguen igual. El `logo` de los datos estructurados de Google (`img/icono-180.png`) también sigue igual; cambiarlo es una decisión aparte.
- **La imagen para redes (`img/og-novaworkorder.jpg`)** sigue igual.
- **Los logos de las empresas clientes en la app («Mi marca»).** Cuando una empresa no tiene logo propio, sigue saliendo `logo.svg`.
- **`favicon.svg`, `logo.svg`, `img/icono-180.png` y `apple-touch-icon.png`** siguen en el repositorio, para volver atrás sin perder nada.

## Revisión de la Orden 38 (15-nov-2026)

- **Encabezado corregido.** El recorte anterior (x 200–1960, y 60–664) cortaba el brillo de las órbitas con un alfa de hasta 36/255, y en el encabezado se veía el borde del rectángulo junto al símbolo. Ahora el recorte es x 0–2052 con la altura completa del original: el borde queda en 8/255, el brillo que el original ya trae en su propio borde. Sigue siendo **solo un recorte**: no hay desvanecidos ni retoques. Como el cuadro es más alto, el logo se muestra a 48 px (antes 40) para que la palabra NOVA conserve su tamaño; en celular se muestra a 40 px.
- **Símbolo (cuadrado, transparente y «maskable»): defecto de origen, sin corregir.** Entre el símbolo y la N del original siempre hay brillo (mínimo 35/255, en x = 929), y a la izquierda del cuadro también (31/255). Ningún recorte del símbolo puede evitar cortar ese brillo; el recorte que Mario envió tiene lo mismo.
  - En los íconos (favicon, iPhone, app) no se nota: el corte coincide con el borde del ícono.
  - En la entrada de la app, a 72 px, tampoco se nota.
  - En el «maskable» sí aparece una costura cuadrada tenue, porque el recorte va sobre un relleno liso. Ninguna página lo usa hoy.
  - Corregirlo exigiría desvanecer el brillo del borde, y eso altera píxeles del original. **Queda para decisión de Mario.**
- **Transparentes: solo para fondos oscuros, sin cambios.** Sobre blanco, la estrella y la palabra NOVA, que son blancas, se pierden. Es lo esperado: el original no tiene una versión para fondo claro.

