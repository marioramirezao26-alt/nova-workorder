#!/usr/bin/env bash
# Escribe el entorno de Caddy para NOVA: el dominio (NOVA_DOMINIO) y la IP pública donde escucha (NOVA_BIND).
#   bash caddy-entorno.sh app.tudominio.com     # instalar
#   bash caddy-entorno.sh                       # actualizar: conserva el dominio ya configurado
# La IP pública es la de origen de la ruta hacia internet; Tailscale (100.x) usa su propio 443 y no se toca.
set -euo pipefail
CONF=/etc/systemd/system/caddy.service.d/nova.conf
DOMINIO="${1:-}"
if [ -z "$DOMINIO" ] && [ -f "$CONF" ]; then
  DOMINIO=$(sed -n 's/^Environment=NOVA_DOMINIO=//p' "$CONF")
fi
[ -n "$DOMINIO" ] || { echo ">> Falta el dominio: bash caddy-entorno.sh app.tudominio.com" >&2; exit 1; }
IP=$(ip -4 route get 1.1.1.1 | awk '{for (i = 1; i < NF; i++) if ($i == "src") print $(i + 1)}')
case "$IP" in
  ""|100.*|10.*|192.168.*|172.1[6-9].*|172.2[0-9].*|172.3[0-1].*) echo ">> No encontré la IP pública (vi '$IP')" >&2; exit 1 ;;
esac
mkdir -p "$(dirname "$CONF")"
printf '[Service]\nEnvironment=NOVA_DOMINIO=%s\nEnvironment=NOVA_BIND=%s\n' "$DOMINIO" "$IP" > "$CONF"
echo ">> Caddy: $DOMINIO en la IP pública $IP"
