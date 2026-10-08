#!/usr/bin/env bash
# Instalación única de NOVA WORKORDER en el servidor (Ubuntu/Debian, como root):
#   bash /tmp/nova/deploy/instalar.sh /tmp/nova.tar app.tudominio.com
# Instala Node 22, MongoDB 7 (solo en 127.0.0.1), Caddy (HTTPS automático), el usuario `nova`, /opt/nova-workorder,
# el .env con secretos nuevos, el servicio y la copia diaria. No toca GABY ni Tailscale.
set -euo pipefail
TAR="${1:?uso: instalar.sh /tmp/nova.tar app.tudominio.com}"
DOMINIO="${2:?falta el dominio, por ejemplo app.novaworkorder.com}"
DEST=/opt/nova-workorder
. /etc/os-release
CODENAME="${VERSION_CODENAME:-jammy}"

apt-get update -qq
apt-get install -y -qq curl gnupg ca-certificates debian-keyring debian-archive-keyring apt-transport-https >/dev/null

# Node.js 22 (NodeSource)
if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi

# MongoDB 7 (repositorio oficial). Escucha solo en 127.0.0.1 (valor por defecto de mongod.conf).
if ! command -v mongod >/dev/null; then
  curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg
  case "$ID" in
    ubuntu) MCODE="$CODENAME"; [ "$MCODE" = "noble" ] || [ "$MCODE" = "jammy" ] || [ "$MCODE" = "focal" ] || MCODE=jammy
            echo "deb [arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg] https://repo.mongodb.org/apt/ubuntu $MCODE/mongodb-org/7.0 multiverse" ;;
    *)      echo "deb [signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg] https://repo.mongodb.org/apt/debian bookworm/mongodb-org/7.0 main" ;;
  esac > /etc/apt/sources.list.d/mongodb-org-7.0.list
  if ! { apt-get update -qq && apt-get install -y -qq mongodb-org mongodb-database-tools >/dev/null; }; then
    echo ">> MongoDB 7 no tiene paquetes para $CODENAME: uso los de Ubuntu 22.04 (jammy)"
    sed -i "s#ubuntu [a-z]*/mongodb-org#ubuntu jammy/mongodb-org#" /etc/apt/sources.list.d/mongodb-org-7.0.list
    apt-get update -qq
    apt-get install -y -qq mongodb-org mongodb-database-tools >/dev/null
  fi
fi
grep -q "bindIp: 127.0.0.1" /etc/mongod.conf || echo ">> Revisa /etc/mongod.conf: bindIp debe ser 127.0.0.1"
systemctl enable --now mongod

# Caddy (repositorio oficial): HTTPS automático para el dominio.
if ! command -v caddy >/dev/null; then
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq
  apt-get install -y -qq caddy >/dev/null
fi

# Código, usuario y .env con secretos generados aquí (nunca viajan por el chat ni por git).
id nova >/dev/null 2>&1 || useradd --system --home "$DEST" --shell /usr/sbin/nologin nova
mkdir -p "$DEST/respaldos"
tar -xf "$TAR" -C "$DEST"
if [ ! -f "$DEST/.env" ]; then
  secreto() { node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"; }
  cat > "$DEST/.env" <<ENV
MONGODB_URI=mongodb://127.0.0.1:27017/nova-workorder
JWT_SECRET=$(secreto)
PLATFORM_API_KEY=$(secreto)
CORS_ORIGINS=https://$DOMINIO
ENV
  echo ">> Creado $DEST/.env con secretos nuevos. La llave de plataforma para GABY: grep PLATFORM_API_KEY $DEST/.env"
fi
(cd "$DEST" && npm ci --omit=dev --silent)
chown -R nova:nova "$DEST"
chmod 600 "$DEST/.env"

install -m 644 "$DEST/deploy/nova.service" /etc/systemd/system/nova.service
install -m 644 "$DEST/deploy/nova-respaldo.service" /etc/systemd/system/nova-respaldo.service
install -m 644 "$DEST/deploy/nova-respaldo.timer" /etc/systemd/system/nova-respaldo.timer
systemctl daemon-reload
systemctl enable --now nova nova-respaldo.timer

# Caddy: el dominio y la IP pública van en su entorno; el Caddyfile se copia tal cual.
bash "$DEST/deploy/caddy-entorno.sh" "$DOMINIO"
install -m 644 "$DEST/deploy/Caddyfile" /etc/caddy/Caddyfile
systemctl daemon-reload
systemctl enable caddy >/dev/null
systemctl restart caddy

# Firewall: si ufw está activo, abre solo 80 y 443 (SSH y Tailscale no se tocan). No se activa ufw aquí.
if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
  ufw allow 80/tcp >/dev/null && ufw allow 443/tcp >/dev/null && echo ">> ufw: abiertos 80 y 443"
fi

sleep 3
curl -fsS http://127.0.0.1:5000/api/health && echo " <- NOVA WORKORDER arriba"
echo ">> En unos minutos: https://$DOMINIO (Caddy pide el certificado al llegar la primera visita)."
echo ">> Crea la empresa de demostración: cd $DEST && sudo -u nova SEED_PASSWORD='<clave>' npm run seed"
