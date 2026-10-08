#!/usr/bin/env bash
# Actualiza NOVA WORKORDER con un paquete nuevo (como root). Conserva .env y respaldos; respalda la base antes.
#   bash /opt/nova-workorder/deploy/actualizar.sh /tmp/nova.tar
set -euo pipefail
TAR="${1:?uso: actualizar.sh /tmp/nova.tar}"
DEST=/opt/nova-workorder
bash "$DEST/deploy/respaldo.sh" || echo ">> No se pudo respaldar antes de actualizar (¿primera vez?)"
tar -xf "$TAR" -C "$DEST" --exclude=.env --exclude=respaldos
(cd "$DEST" && npm ci --omit=dev --silent)
chown -R nova:nova "$DEST"
install -m 644 "$DEST/deploy/nova.service" /etc/systemd/system/nova.service
install -m 644 "$DEST/deploy/nova-respaldo.service" /etc/systemd/system/nova-respaldo.service
install -m 644 "$DEST/deploy/nova-respaldo.timer" /etc/systemd/system/nova-respaldo.timer
install -m 644 "$DEST/deploy/Caddyfile" /etc/caddy/Caddyfile
bash "$DEST/deploy/caddy-entorno.sh"            # conserva el dominio; agrega o refresca la IP pública
systemctl daemon-reload
systemctl restart nova
systemctl restart caddy
sleep 3
curl -fsS http://127.0.0.1:5000/api/health && echo " <- NOVA WORKORDER actualizada"
