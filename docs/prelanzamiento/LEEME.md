# Prelanzamiento de NOVA Enterprise — página `/nova`

Rama `nova/m07-prelanzamiento` (13-nov-2026). **No está publicada:** se publica solo con el sí de Mario.

## Qué es

Una página **solo informativa**: presenta NOVA Enterprise y su equipo de agentes de IA y registra el interés de las empresas.
No vende, no cobra, no crea cuentas ni pruebas gratis.

- **Dónde:** `https://novaworkorder.com/nova`. La página actual de ventas (`/`) no cambia. Caddy la sirve sin tocar su
  configuración (`try_files {path}/index.html`).
- **Archivos:** `landing/nova/` (`index.html`, `nova.css`, `nova.js`) y, del prototipo aprobado por Mario el 11-nov-2026 (rama
  `nova/m07-prototipo-web`), `gaby-spark.js` (Gaby animada) y `fondo-montanas.svg`. No carga nada de otro dominio.
- **El registro** usa el MISMO formulario de la página de ventas (`/api/public/demo`) como solicitud de información
  (`kind: demo`), con la campaña `prelanzamiento-nova` y el interés al comienzo del mensaje
  (`[Prelanzamiento NOVA Enterprise] Interés: …`). GABY la lee como cualquier solicitud de la página. Sin cambios en el servidor.
- **Lo que dice de NOVA** sale de lo que ya dice la página de ventas. Los agentes distintos de Gaby salen como «Pronto», y
  NOVA Commerce como «En preparación».

## Verla en el PC (sin publicar nada)

1. Abrir una terminal en la carpeta `nova-workorder`.
2. `git checkout nova/m07-prelanzamiento`
3. Servir la carpeta `landing` como lo hace Caddy, con cualquier servidor estático. Por ejemplo:
   `npx --yes serve landing -l 8790`
4. Abrir `http://localhost:8790/nova` en el computador. En el celular, usar el modo de celular del navegador (F12 y luego
   Ctrl+Shift+M).

Con ese servidor, el formulario no tiene a dónde enviar y muestra el aviso de error: es lo esperado, porque `/api/public/demo` solo
existe en el servidor. Para probar el envío sin la base, el taller usó un servidor de vista previa que simula esa ruta.

## Capturas

`docs/prelanzamiento/capturas/`:
- `nova-computador-arriba.png` y `nova-celular-arriba.png`: lo primero que se ve;
- `nova-computador-completa.png` y `nova-celular-completa.png`: la página entera;
- `nova-*-registro-enviado.png`: el registro, después de enviar.

## Publicar (cuando Mario lo apruebe)

Ver `PUBLICAR.md` en esta carpeta.
