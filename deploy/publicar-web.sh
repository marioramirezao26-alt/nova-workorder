#!/usr/bin/env bash
# P-034 A3: publica SOLO la página estática (blog, portadas, precios, mapa del sitio, imágenes) de un paquete nuevo,
# sin instalar paquetes, sin compilar y sin reiniciar la app ni Caddy. Sirve para cada artículo nuevo del blog.
# Avisa a IndexNow igual que actualizar.sh. Si el paquete cambia el Caddyfile o el código, se usa actualizar.sh.
#   bash /opt/nova-workorder/deploy/publicar-web.sh /tmp/nova.tar
set -euo pipefail
TAR="${1:?uso: publicar-web.sh /tmp/nova.tar}"
DEST=/opt/nova-workorder
WEB=/var/www/novaworkorder
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
tar -xf "$TAR" -C "$TMP" landing docs/blog
[ -f "$TMP/landing/index.html" ] || { echo ">> El paquete no trae landing/index.html: no publico nada"; exit 1; }
# la copia del servidor también se pone al día, para que el próximo actualizar.sh no la eche para atrás
rm -rf "$DEST/landing.nuevo" && cp -r "$TMP/landing" "$DEST/landing.nuevo" && rm -rf "$DEST/landing" && mv "$DEST/landing.nuevo" "$DEST/landing"
mkdir -p "$DEST/docs" && rm -rf "$DEST/docs/blog" && cp -r "$TMP/docs/blog" "$DEST/docs/blog"
chown -R nova:nova "$DEST/landing" "$DEST/docs"
# cambio de una vez: la carpeta nueva al lado y un mv (Caddy nunca ve la página a medias)
rm -rf "$WEB.nuevo" && cp -r "$TMP/landing" "$WEB.nuevo" && chmod -R a+rX "$WEB.nuevo"
rm -rf "$WEB.viejo" && { [ -d "$WEB" ] && mv "$WEB" "$WEB.viejo" || true; } && mv "$WEB.nuevo" "$WEB" && rm -rf "$WEB.viejo"
node "$DEST/src/scripts/indexnow.js" --web "$WEB" --llave "$DEST/deploy/.indexnow" \
  --estado "$DEST/deploy/.indexnow-estado.json" || echo ">> IndexNow no avisó esta vez"
echo ">> Página publicada (sin reiniciar nada)"
