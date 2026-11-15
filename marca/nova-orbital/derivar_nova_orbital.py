"""Deriva los formatos web de NOVA Orbital a partir de los dos originales aprobados (opción 3).

Solo recorta, reescala, re-codifica o separa el fondo: no dibuja ni cambia formas, colores ni letras.

  python derivar_nova_orbital.py <carpeta-originales> <carpeta-salida>

Reglas:
- «exacta»: los mismos píxeles del original (recorte y/o cambio de tamaño con Lanczos, o re-codificación).
- «derivada-aproximada»: transparencia calculada separando el fondo azul noche; sobre ese mismo fondo
  reproduce el original, pero en fondos claros no sirve (la palabra NOVA es blanca). Requiere revisión de Mario.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ORIG = Path(sys.argv[1])
OUT = Path(sys.argv[2])
OUT.mkdir(parents=True, exist_ok=True)

HORIZ = Image.open(ORIG / "NOVA_Orbital_logo_horizontal_oficial.png").convert("RGB")
SIMB = Image.open(ORIG / "NOVA_Orbital_simbolo_fondo_oscuro.png").convert("RGB")
assert HORIZ.size == (2172, 724) and SIMB.size == (720, 565)

FONDO = (0, 0, 12)  # promedio del borde del logo horizontal (0,4 · 0,2 · 11,9), medido
CUADRO_SIMBOLO = (191, 0, 915, 724)  # 724 x 724 del logo horizontal: el símbolo entero, centrado, sin tocar la N
inventario = []


def guardar(img, nombre, tipo, nota, **opciones):
    ruta = OUT / nombre
    img.save(ruta, **opciones)
    inventario.append({"archivo": nombre, "ancho": img.size[0], "alto": img.size[1],
                       "bytes": ruta.stat().st_size, "tipo": tipo, "nota": nota})


def reescalar(img, ancho):
    alto = round(img.size[1] * ancho / img.size[0])
    return img.resize((ancho, alto), Image.LANCZOS)


def sin_fondo(img):
    """Separa el fondo FONDO: alfa mínimo tal que FONDO + alfa·(color − FONDO) = original."""
    c = np.asarray(img).astype(np.float64) / 255.0
    b = np.array(FONDO, dtype=np.float64) / 255.0
    c = np.maximum(c, b)  # el ruido más oscuro que el fondo (±3/255) se iguala al fondo
    a = np.max(np.where(c > b, (c - b) / (1.0 - b), 0.0), axis=2)
    a = np.where(a < 3 / 255, 0.0, a)
    seguro = np.where(a > 0, a, 1.0)[..., None]
    fg = np.clip(b + (c - b) / seguro, 0, 1)
    rgba = np.dstack([fg, a]) * 255.0
    return Image.fromarray(np.round(rgba).astype(np.uint8), "RGBA")


def error_contra_fondo(rgba, original):
    f = np.asarray(rgba).astype(np.float64)
    al = f[..., 3:] / 255.0
    rec = f[..., :3] * al + np.array(FONDO) * (1 - al)
    o = np.maximum(np.asarray(original).astype(np.float64), np.array(FONDO))
    return float(np.abs(rec - o).max())


# 1. Logo horizontal: web optimizado (exacta)
for ancho in (2172, 1200, 600, 320):
    r = HORIZ if ancho == 2172 else reescalar(HORIZ, ancho)
    guardar(r, f"nova-orbital-horizontal-{ancho}.webp", "exacta", "Logo horizontal, fondo oscuro original", quality=92, method=6)
guardar(reescalar(HORIZ, 1200), "nova-orbital-horizontal-1200.png", "exacta", "Logo horizontal PNG", optimize=True)

# 2. Logo horizontal transparente (derivada-aproximada)
t = sin_fondo(HORIZ)
err_h = error_contra_fondo(t, HORIZ)
guardar(t, "nova-orbital-horizontal-transparente-2172.png", "derivada-aproximada",
        f"Fondo separado; sobre #00000C reproduce el original (error máx {err_h:.1f}/255). Solo para fondos oscuros", optimize=True)
for ancho in (1200, 600, 320):
    guardar(reescalar(t, ancho), f"nova-orbital-horizontal-transparente-{ancho}.webp", "derivada-aproximada",
            "Igual que la transparente de 2172, reescalada; solo para fondos oscuros", quality=92, method=6)

# 2b. Para encabezados web: la transparente recortada (x 0–2052, alto completo). Solo recorte. Orden 38: el recorte
# anterior (x 200–1960, y 60–664) cortaba el brillo de las órbitas con alfa de hasta 34/255 y en el encabezado se veía
# el borde del rectángulo; este llega hasta donde el brillo del original ya es casi nulo (alfa máx. medido abajo).
# A la derecha de x 2052 el original solo tiene fondo (exceso ≤ 2/255).
CUADRO_ENCABEZADO = (0, 0, 2052, 724)
enc = t.crop(CUADRO_ENCABEZADO)
a_borde = np.asarray(enc)[..., 3]
borde_max = int(max(a_borde[0].max(), a_borde[-1].max(), a_borde[:, 0].max(), a_borde[:, -1].max()))
for alto in (48, 96, 144):
    ancho = round(enc.size[0] * alto / enc.size[1])
    guardar(enc.resize((ancho, alto), Image.LANCZOS), f"nova-orbital-encabezado-{alto}.webp", "derivada-aproximada",
            f"Transparente recortada (x 0–2052, alto completo) para encabezados oscuros; alfa máx. en el borde {borde_max}/255",
            quality=92, method=6)

# 3. Símbolo cuadrado (exacta: recorte del logo horizontal)
cuadro = HORIZ.crop(CUADRO_SIMBOLO)
guardar(cuadro, "nova-orbital-simbolo-cuadrado-724.png", "exacta",
        "Recorte 724x724 del logo horizontal (x 191–915): símbolo completo con su fondo", optimize=True)
for lado in (512, 256):
    guardar(cuadro.resize((lado, lado), Image.LANCZOS), f"nova-orbital-simbolo-cuadrado-{lado}.webp", "exacta",
            "Símbolo cuadrado reescalado", quality=92, method=6)
ts = sin_fondo(cuadro)
err_s = error_contra_fondo(ts, cuadro)
guardar(ts, "nova-orbital-simbolo-transparente-724.png", "derivada-aproximada",
        f"Símbolo con el fondo separado (error máx {err_s:.1f}/255 sobre #00000C). Solo para fondos oscuros", optimize=True)
guardar(ts.resize((128, 128), Image.LANCZOS), "nova-orbital-simbolo-transparente-128.png", "derivada-aproximada",
        "Símbolo transparente pequeño (encabezados)", optimize=True)
# El recorte suministrado por Mario corta la órbita en el borde derecho: se guarda tal cual, solo como referencia
guardar(SIMB, "nova-orbital-simbolo-referencia-720x565.webp", "exacta",
        "Recorte suministrado, re-codificado. La órbita toca el borde derecho: referencia, no para iconos", quality=92, method=6)

# 4. Favicon e iconos de aplicación (exacta: el cuadro reescalado; a 16–32 px el brillo se suaviza)
iconos = {16: "favicon-16.png", 32: "favicon-32.png", 48: "favicon-48.png", 180: "apple-touch-icon-180.png",
          192: "icono-app-192.png", 512: "icono-app-512.png"}
for lado, nombre in iconos.items():
    guardar(cuadro.resize((lado, lado), Image.LANCZOS), nombre, "exacta",
            "Símbolo cuadrado reescalado (icono)", optimize=True)
ico = OUT / "favicon.ico"
cuadro.save(ico, sizes=[(16, 16), (32, 32), (48, 48)])
inventario.append({"archivo": "favicon.ico", "ancho": 48, "alto": 48, "bytes": ico.stat().st_size,
                   "tipo": "exacta", "nota": "ICO con 16, 32 y 48 px"})

# 5. Icono «maskable» (Android): el símbolo al 80 % sobre el mismo fondo, para la zona segura (derivada)
lienzo = Image.new("RGB", (512, 512), FONDO)
s = cuadro.resize((410, 410), Image.LANCZOS)
lienzo.paste(s, (51, 51))
guardar(lienzo, "icono-app-maskable-512.png", "derivada-aproximada",
        "Símbolo al 80 % sobre fondo liso #00000C (relleno nuevo alrededor del recorte); revisar el borde", optimize=True)

(OUT / "inventario.json").write_text(json.dumps(inventario, ensure_ascii=False, indent=1), encoding="utf-8")
print(json.dumps({"alfa_borde_encabezado": borde_max, "error_transparente_horizontal": err_h, "error_transparente_simbolo": err_s,
                  "archivos": len(inventario)}, ensure_ascii=False))
