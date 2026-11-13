# NOVA Store en preparación: página `/tienda`

Rama `nova/m07-tienda`, del 13-nov-2026. Reemplaza el enfoque del PR #78 por orden de Mario; el #78 se conserva.
**No está publicada:** se publica solo con el sí de Mario.

## Decisión de Mario (13-nov-2026)

NOVA es una **tienda multimarca de su propiedad**. **No es un marketplace** ni una plataforma para que terceros creen
tiendas. Vende productos de distintos proveedores y de marcas propias, por dropshipping y por venta directa.

| Pieza | Qué es | ¿Lo ve el comprador? |
|---|---|---|
| **NOVA Store** (esta página) | Portada pública: productos, categorías, búsqueda y compra | **Sí** |
| **Gaby** | Única asistente de IA visible para el comprador | **Sí**, con respuestas fijas hasta verificar su integración |
| **NOVA Commerce** | Administra por dentro el catálogo, los proveedores, el inventario y los pedidos | No |
| **NOVA Landing Studio** | Crea microlandings comerciales de los productos de la tienda | No (sí las landings que publique) |
| **NOVA Enterprise** | Plataforma interna de administración, automatización y agentes | No |
| **Mercado Pago** | Pasarela de pagos, primero en ambiente de pruebas | Todavía no |

La página no nombra a NOVA Enterprise ni a Landing Studio. Tampoco muestra agentes ni automatización, ni invita a
marcas o terceros a inscribirse. Las pruebas lo revisan.

## Auditoría de la web comercial que ya existe

| Qué | Dónde | Qué se reutilizó |
|---|---|---|
| Prototipo de tienda «NOVA Premium Futurista», aprobado por Mario el 11-nov-2026 | rama `nova/m07-prototipo-web` (`prototipo-nova/`), nunca publicado | **Fuente del catálogo** (`fuente-catalogo.js`, tal cual), **Gaby animada** (`gaby-spark.js`), **fondo de montañas**, colores y vidrio. No se reutilizó: los datos ficticios (`catalogo-ejemplo.js`), los precios y descuentos ilustrativos, el carrito y los pedidos simulados |
| Página de ventas de NOVA Workorder | `landing/` en `main`, publicada en `novaworkorder.com` | Nada visible. No se toca |
| Formulario de la página de ventas | `POST /api/public/demo` | **No sirve para la tienda**: ver más abajo |
| PR #78 (página de NOVA Enterprise con sus agentes) | rama `nova/m07-prelanzamiento` | Se conserva tal cual, con su historia, en borrador. Esta rama lo reemplaza |

## Qué muestra hoy

- **Portada**: «Descubre productos y marcas en un solo lugar», con el buscador y Gaby.
- **Categorías, productos y marcas**: espacios vacíos, marcados «Por anunciar».
- **Buscador**: busca en la fuente del catálogo. Hoy responde que todavía no hay productos publicados.
- **Gaby**: un panel con cuatro respuestas fijas y honestas. Admite que es una IA y no promete productos, precios,
  disponibilidad ni fechas.
- **No vende, no cobra y no recoge datos.** No llama a ninguna API, no guarda cookies y no tiene formulario de datos
  personales.

## Estado de la integración

| Pieza | Estado |
|---|---|
| **Catálogo** | La portada lee de `fuente-catalogo.js`, que tiene la forma de `catalog.search` del contrato de comerce-ai (canal `web_store`). **Hoy está vacía**: la lectura del catálogo autorizado aún no existe en el servidor (faltan B10 a B12 y C01 de comerce-ai), y la página nunca carga los datos ficticios. Tiene un doble seguro: con `deEjemplo: true` no pinta nada. Probado en Chrome con un catálogo simulado, que no está en el repositorio: pinta productos, categorías y marcas, y el buscador encuentra y dice «No encontré» |
| **Qué se muestra de cada producto** | Nombre, variante, categoría y marca. **Sin precio, sin disponibilidad y sin carrito** hasta que Mario lo apruebe |
| **Dropi y marcas propias** | Cada producto debe respetar su política de inventario y disponibilidad (contratos 1.9 y 1.10 de Commerce, en borrador, sin unir). La portada no dice nada de disponibilidad |
| **Gaby** | Respuestas fijas. Su integración real (el chat de GABY) **no está verificada para la tienda**: hoy responde por NOVA Workorder |
| **Pagos (Mercado Pago)** | No conectado. Va en modo de pruebas, en su propio frente |
| **Registro de interesados** | No hay (ver abajo) |

## Por qué no tiene formulario de registro

El formulario de la página de ventas (`/api/public/demo`) **no sirve para la tienda**. GABY convierte cada registro en un
cliente potencial de **NOVA Workorder**: lo pone en el embudo de ventas con el plan de Servicios o de Pedidos y le escribe
a los dos días para ofrecerle una demo (`GABY-OS app/services/billing.py`). Un comprador de la tienda recibiría una
oferta de Workorder. El PR #78 tenía este mismo problema.

Para registrar a los interesados hace falta una decisión de Mario:
- dónde se guardan, aparte de los clientes de Workorder;
- qué dice la política de privacidad sobre esos datos (Ley 1581).

## Verla en el PC (sin publicar nada)

1. Abrir una terminal en la carpeta `nova-workorder` y correr `git checkout nova/m07-tienda`.
2. Correr `npx --yes serve landing -l 8790`.
3. Abrir `http://localhost:8790/tienda`. Para verla como en el celular, oprimir F12 y luego Ctrl+Shift+M.

Capturas en `capturas/`:
- `tienda-*-arriba.png`: lo primero que se ve;
- `tienda-*-completa.png`: la página entera;
- `tienda-*-gaby.png`: el panel de Gaby.

## Publicar (cuando Mario lo apruebe)

Mismo procedimiento que la web estática, sin reiniciar nada ni tocar la base. Primero, con el sí de Mario, se une el PR a
`main`. Después, desde PowerShell en la carpeta `nova-workorder`:

```powershell
git checkout main; git pull
git -c core.autocrlf=false -c core.eol=lf archive --format=tar -o nova.tar HEAD
scp -i $HOME\.ssh\laboratorio_servidor nova.tar root@100.93.219.72:/tmp/nova.tar
ssh -i $HOME\.ssh\laboratorio_servidor root@100.93.219.72 "bash /opt/nova-workorder/deploy/publicar-web.sh /tmp/nova.tar && rm -f /tmp/nova.tar"
Remove-Item nova.tar
```

Al final, el guion debe decir `>> Página publicada (sin reiniciar nada)`.

Para comprobar:
1. Abrir `https://novaworkorder.com/tienda` en el computador y en el celular.
2. Revisar que `https://novaworkorder.com/` siga igual.

**Para quitarla:** revertir el commit en `main` y repetir los mismos pasos.

**La dirección `/tienda` en novaworkorder.com es provisional.** Hoy ese dominio es el de NOVA Workorder. Si la tienda
va a tener su propio dominio, hace falta la decisión de Mario (y quizá un gasto).
