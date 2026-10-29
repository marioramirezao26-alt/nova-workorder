# Portadas del blog (landing/img/blog/<slug>.jpg, 1200×630) con los colores de la marca, como el paquete de
# informes/marca-nova/_fuente: HTML con la fuente Inter, fotografiado con el Chromium de Playwright.
# Uso: python3 docs/blog/portadas.py   (lee los datos de cada artículo de docs/blog/es y docs/blog/en)
import json
import pathlib
import re
from playwright.sync_api import sync_playwright

RAIZ = pathlib.Path(__file__).resolve().parents[2]
SALIDA = RAIZ / 'landing' / 'img' / 'blog'

# Íconos de línea, del mismo estilo que los de la página (24×24, trazo redondeado).
ICONOS = {
    'orden': '<rect x="5" y="2" width="14" height="20" rx="2.5"/><path d="M9 7h6M9 11h6M9 15h4"/>',
    'plantilla': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
    'catalogo': '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18M16 10a4 4 0 0 1-8 0"/>',
    'aire': '<path d="M12 2v20M4.9 6.5l14.2 11M4.9 17.5l14.2-11"/><path d="m9 4 3 2 3-2M9 20l3-2 3 2"/>',
    'cotizacion': '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8M12 17.5v-11"/>',
    'entrega': '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2M15 18H9M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
}
TIENDA = {'Tiendas', 'Shops'}

LOGO = '''<svg viewBox="0 0 100 100" width="58" height="58"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="#1f5fd6"/><stop offset="1" stop-color="#5ea2ff"/></linearGradient></defs>
<rect width="100" height="100" rx="24" fill="url(#g)"/><path d="M28 72 V30 L55 66 L76 26" fill="none" stroke="#fff"
stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/></svg>'''


def pagina(texto, icono, categoria, lang):
    color = '#ffb35c' if categoria in TIENDA else '#5ea2ff'
    blog = 'Blog' if lang == 'es' else 'Blog'
    return f'''<!doctype html><html><head><meta charset="utf-8"><style>
* {{ margin: 0; box-sizing: border-box; }}
body {{ width: 1200px; height: 630px; overflow: hidden; font-family: Inter, sans-serif; color: #edf3ff;
  background: radial-gradient(ellipse at 15% 10%, rgba(79,150,255,.25), transparent 55%),
              radial-gradient(ellipse at 90% 95%, {color}33, transparent 55%), linear-gradient(160deg, #07111d 0%, #0c1a2b 100%); }}
.marca {{ position: absolute; top: 56px; left: 72px; display: flex; align-items: center; gap: 18px; }}
.marca b {{ font-family: 'Inter Display', Inter, sans-serif; font-weight: 800; font-size: 32px; letter-spacing: .01em; }}
.marca b span {{ font-weight: 600; color: #7db8ff; }}
.cat {{ position: absolute; top: 172px; left: 72px; font-size: 22px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: {color}; }}
h1 {{ position: absolute; top: 214px; left: 72px; width: 690px; font-family: 'Inter Display', Inter, sans-serif; font-weight: 800;
  font-size: 64px; line-height: 1.06; letter-spacing: -.025em; }}
.ico {{ position: absolute; right: 84px; top: 170px; width: 290px; height: 290px; border-radius: 64px; display: grid; place-items: center;
  background: linear-gradient(180deg, rgba(255,255,255,.07), rgba(255,255,255,.02)); border: 2px solid rgba(148,178,220,.22);
  box-shadow: 0 40px 80px -30px rgba(0,0,0,.8), inset 0 1px 0 rgba(255,255,255,.06); }}
.ico svg {{ width: 150px; height: 150px; fill: none; stroke: {color}; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }}
.pie {{ position: absolute; bottom: 52px; left: 72px; font-size: 22px; color: #b7cce9; }}
.barra {{ position: absolute; left: 0; right: 0; bottom: 0; height: 10px; background: linear-gradient(90deg, #1f5fd6, {color}); }}
</style></head><body>
<div class="marca">{LOGO}<b>NOVA <span>WORKORDER</span></b></div>
<p class="cat">{blog} · {categoria}</p>
<h1>{texto}</h1>
<div class="ico"><svg viewBox="0 0 24 24">{ICONOS[icono]}</svg></div>
<p class="pie">novaworkorder.com</p>
<div class="barra"></div>
</body></html>'''


def articulos():
    for lang in ('es', 'en'):
        for f in sorted((RAIZ / 'docs' / 'blog' / lang).glob('*.html')):
            m = re.match(r'^<!--\s*(\{.*?\})\s*-->', f.read_text(encoding='utf-8'), re.S)
            datos = json.loads(m.group(1))
            yield lang, datos


def main():
    SALIDA.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={'width': 1200, 'height': 630})
        for lang, a in articulos():
            pg.set_content(pagina(a['portada']['texto'], a['portada']['icono'], a['categoria'], lang))
            pg.wait_for_timeout(150)
            destino = SALIDA / f"{a['slug']}.jpg"
            pg.screenshot(path=str(destino), type='jpeg', quality=86)
            print(destino.relative_to(RAIZ))
        b.close()


if __name__ == '__main__':
    main()
