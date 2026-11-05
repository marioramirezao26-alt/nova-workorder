#!/usr/bin/env bash
# Regla R11 del cerebro: nada se publica con un marcador «[FALTA DATO: …]» (por ejemplo, las fechas de la oferta de /kit,
# que pone Mario) ni con un dato de quien vende sin poner (los marcadores VENDEDOR_… entre llaves dobles, que llena
# llenar-vendedor.js). publicar-web.sh y actualizar.sh lo corren ANTES de tocar nada.
#   bash sin-falta-dato.sh CARPETA...   -> 0 si ninguna lo trae; 1 (y dice qué archivos) si alguna lo trae o no se pudo leer
# Una carpeta que no existe no cuenta (un paquete sin blog, por ejemplo).
set -euo pipefail
[ "$#" -gt 0 ] || { echo "uso: sin-falta-dato.sh CARPETA..." >&2; exit 2; }
hay=0
for carpeta in "$@"; do
  [ -e "$carpeta" ] || continue
  set +e
  grep -rlE -- '\[FALTA DATO|\{\{VENDEDOR_[A-Z_]+\}\}' "$carpeta"
  s=$?
  set -e
  [ "$s" -eq 1 ] || hay=1          # 0: lo encontró; 2 o más: no se pudo leer (mejor no publicar)
done
if [ "$hay" -ne 0 ]; then
  echo ">> Esos archivos dicen [FALTA DATO] o les falta un dato de quien vende (o no se pudieron leer): no se publica nada (R11). Faltan datos de Mario."
  exit 1
fi
