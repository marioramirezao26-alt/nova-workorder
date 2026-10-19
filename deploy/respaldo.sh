#!/usr/bin/env bash
# Copia diaria de la base de NOVA WORKORDER (mongodump comprimido); guarda las últimas 14. La ejecuta nova-respaldo.timer.
set -euo pipefail
DIR=/opt/nova-workorder/respaldos
mkdir -p "$DIR"
chmod 700 "$DIR"
STAMP=$(date +%Y-%m-%d_%H%M)
mongodump --quiet --uri="mongodb://127.0.0.1:27017/nova-workorder" --archive="$DIR/nova-$STAMP.gz" --gzip
find "$DIR" -maxdepth 1 -type f -name 'nova-*.gz' -mtime +14 -delete
echo "Respaldo listo: $DIR/nova-$STAMP.gz"
