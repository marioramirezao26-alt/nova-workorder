# Publicar la página de prelanzamiento en `novaworkorder.com/nova`

**Solo con el sí de Mario.** Publica nada más que la página estática, con el guion que ya existe (`deploy/publicar-web.sh`):
no instala paquetes, no compila, no reinicia la app ni Caddy y no toca la base. No tiene costo: usa el dominio y el servidor
que ya existen.

## Antes

1. Mario aprueba el diseño final, en las capturas o viéndola en el PC (`LEEME.md`).
2. Mario aprueba unir el PR a `main`. Se publica desde `main` para que el próximo `actualizar.sh` no devuelva la página a una
   versión vieja.

## Publicar (desde PowerShell, en la carpeta `nova-workorder` del PC de Mario)

```powershell
git checkout main; git pull
git -c core.autocrlf=false -c core.eol=lf archive --format=tar -o nova.tar HEAD
scp -i $HOME\.ssh\laboratorio_servidor nova.tar root@100.93.219.72:/tmp/nova.tar
ssh -i $HOME\.ssh\laboratorio_servidor root@100.93.219.72 "bash /opt/nova-workorder/deploy/publicar-web.sh /tmp/nova.tar && rm -f /tmp/nova.tar"
Remove-Item nova.tar
```

Qué hace `publicar-web.sh`:
1. saca del paquete solo `landing/` y `docs/blog`;
2. llena los datos de quien vende y frena si falta alguno (`llenar-vendedor.js` y `sin-falta-dato.sh`);
3. cambia la carpeta de la web de una sola vez, sin que Caddy vea nada a medias;
4. avisa a IndexNow.

Al final debe decir `>> Página publicada (sin reiniciar nada)`.

## Comprobar

1. Abrir `https://novaworkorder.com/nova` en el computador y en el celular: debe verse como en las capturas.
2. `https://novaworkorder.com/` (la página de ventas) sigue igual.
3. Mandar **un** registro de prueba con un correo de Mario, revisar que GABY lo vea como solicitud nueva con la campaña
   `prelanzamiento-nova`, y marcarlo como recibido.

## Si hay que quitarla

Revertir el commit en `main` (con el sí de Mario) y volver a correr los mismos pasos de «Publicar»: la carpeta `/nova` desaparece y
`/nova` da la página 404. Los registros que ya llegaron se quedan en la base.
