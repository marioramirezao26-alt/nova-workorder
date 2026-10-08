#!/usr/bin/env bash
# Copia diaria de la base de NOVA WORKORDER (mongodump comprimido); guarda las últimas 14. La ejecuta nova-respaldo.timer.
set -euo pipefail
DIR=/opt/nova-workorder/respaldos
mkdir -p "$DIR"
STAMP=$(date +%Y-%m-%d_%H%M)
mongodump --quiet --uri="mongodb://127.0.0.1:27017/nova-workorder" --archive="$DIR/nova-$STAMP.gz" --gzip
ls -1t "$DIR"/nova-*.gz | tail -n +15 | xargs -r rm -f
echo "Respaldo listo: $DIR/nova-$STAMP.gz"
