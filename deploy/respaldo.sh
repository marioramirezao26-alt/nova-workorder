#!/usr/bin/env bash
# Copia diaria de la base de NOVA WORKORDER (mongodump comprimido); guarda las últimas 14. La ejecuta nova-respaldo.timer.
set -euo pipefail
DIR=/opt/nova-workorder/respaldos
mkdir -p "$DIR"
chmod 700 "$DIR"
# Trabaja dentro de la carpeta de respaldos: si se lanza desde /root (un usuario sin acceso), `find` no falla al volver.
cd "$DIR"
STAMP=$(date +%Y-%m-%d_%H%M)
# La misma conexión de la app (con usuario y contraseña si MongoDB pide autenticación); nunca se imprime.
URI=$(grep -E '^MONGODB_URI=' /opt/nova-workorder/.env 2>/dev/null | head -1 | cut -d= -f2- || true)
URI=${URI:-mongodb://127.0.0.1:27017/nova-workorder}
mongodump --quiet --uri="$URI" --archive="$DIR/nova-$STAMP.gz" --gzip
find "$DIR" -maxdepth 1 -type f -name 'nova-*.gz' -mtime +14 -delete
echo "Respaldo listo: $DIR/nova-$STAMP.gz"
