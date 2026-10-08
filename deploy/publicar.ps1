# Publica NOVA WORKORDER desde este PC al servidor. En PowerShell, desde la carpeta nova-workorder:
#   powershell -ExecutionPolicy Bypass -File .\deploy\publicar.ps1 -Instalar -Dominio app.tudominio.com   # primera vez
#   powershell -ExecutionPolicy Bypass -File .\deploy\publicar.ps1                                         # actualizar
# Compila la interfaz aquí, empaqueta el código de git (HEAD) + frontend/dist, lo copia con scp y corre el script del
# servidor. Usa la misma llave SSH y dirección Tailscale que GABY.
param(
  [switch]$Instalar,
  [string]$Dominio = "",
  [string]$Servidor = "root@100.93.219.72",
  [string]$Llave = "$HOME\.ssh\laboratorio_servidor"
)
$ErrorActionPreference = "Stop"
function Paso([string]$Que) { if ($LASTEXITCODE -ne 0) { throw "Falló: $Que (código $LASTEXITCODE). No se publicó nada." } }
if ($Instalar -and -not $Dominio) { throw "Para instalar indica el dominio: -Dominio app.tudominio.com" }
if ((git status --porcelain --untracked-files=no) -ne $null) { Write-Host "Hay cambios sin commit: se publica lo que está en git (HEAD)." -ForegroundColor Yellow }
Push-Location frontend
try {
  npm ci --silent
  Paso "npm ci del frontend (¿está corriendo npm run dev? Detenlo con Ctrl+C)"
  npx vite build
  Paso "compilar la interfaz"
} finally { Pop-Location }
if (-not (Test-Path frontend\dist\index.html)) { throw "No existe frontend\dist\index.html. No se publicó nada." }
# LF siempre: con CRLF bash falla en el servidor.
git -c core.autocrlf=false -c core.eol=lf archive --format=tar -o nova.tar HEAD
Paso "git archive"
tar -rf nova.tar frontend/dist
Paso "empaquetar frontend/dist"
scp -i $Llave nova.tar "${Servidor}:/tmp/nova.tar"
Paso "copiar al servidor (scp)"
if ($Instalar) {
  ssh -i $Llave $Servidor "rm -rf /tmp/nova && mkdir -p /tmp/nova && tar -xf /tmp/nova.tar -C /tmp/nova deploy && bash /tmp/nova/deploy/instalar.sh /tmp/nova.tar $Dominio"
} else {
  ssh -i $Llave $Servidor "rm -rf /tmp/nova && mkdir -p /tmp/nova && tar -xf /tmp/nova.tar -C /tmp/nova deploy && bash /tmp/nova/deploy/actualizar.sh /tmp/nova.tar"
}
Paso "instalar en el servidor"
Remove-Item nova.tar
Write-Host "Listo: NOVA WORKORDER está publicada." -ForegroundColor Green
