# Publicar NOVA WORKORDER en internet

NOVA WORKORDER corre en el mismo servidor que GABY, pero **separada**: escucha solo en `127.0.0.1:5000` y **Caddy** la
publica con HTTPS automático en tu dominio. GABY sigue privada en Tailscale (puerto 8443) y Caddy no la toca.

## 1. El dominio
1. Compra el dominio (por ejemplo `novaworkorder.com`).
2. En el panel del dominio crea un registro **A**:
   - Nombre: `app`
   - Valor: la **IP pública** del servidor (la que muestra Vultr en *Overview*; **no** la `100.x` de Tailscale)
3. Espera a que propague (de minutos a una hora). Compruébalo con `nslookup app.tudominio.com`.

## 2. Firewall
En Vultr → *Firewall* (si usas uno), permite la entrada a los puertos **80** y **443** (TCP). El 80 lo usa Caddy solo
para obtener el certificado y redirigir a HTTPS. El script abre esos puertos en `ufw` si ufw está activo.

## 3. Instalar (una sola vez)
En PowerShell, desde la carpeta `nova-workorder` de tu PC:

```powershell
git checkout main; git pull
powershell -ExecutionPolicy Bypass -File .\deploy\publicar.ps1 -Instalar -Dominio app.tudominio.com
```

Instala Node 22, MongoDB 7 (solo accesible dentro del servidor), Caddy, el servicio `nova`, la copia diaria de la base
(3:30 a. m., últimas 14 en `/opt/nova-workorder/respaldos`) y crea el `.env` con **secretos nuevos generados en el
servidor**. Al final debe decir `NOVA WORKORDER arriba`.

> MongoDB 5 o superior necesita un procesador con AVX; los servidores de Vultr lo tienen.

## 4. Actualizar (cada vez que haya cambios)
```powershell
git checkout main; git pull
powershell -ExecutionPolicy Bypass -File .\deploy\publicar.ps1
```
Respalda la base antes de actualizar y conserva el `.env`.

## 5. Conectar GABY
La llave de la API de plataforma (`PLATFORM_API_KEY`) se generó en el servidor. Para verla:
```bash
ssh -i ~/.ssh/laboratorio_servidor root@100.93.219.72 "grep PLATFORM_API_KEY /opt/nova-workorder/.env"
```
Va en el `.env` de GABY (paso 3 del plan de ventas). **Nunca la pegues en un chat.**

## Comandos útiles en el servidor
- Estado: `systemctl status nova caddy mongod`
- Registros: `journalctl -u nova -n 100` · `journalctl -u caddy -n 50`
- Copia manual: `bash /opt/nova-workorder/deploy/respaldo.sh`
- Restaurar una copia: `mongorestore --drop --gzip --archive=/opt/nova-workorder/respaldos/nova-AAAA-MM-DD_HHMM.gz`
