# Script para descargar e instalar Browser Tools Chrome Extension
# Ejecutar: .\_tools\browser-tools\INSTALAR_EXTENSION.ps1

$ErrorActionPreference = "Stop"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "   🔧 Browser Tools - Instalador" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Crear directorio temporal
$tempDir = "$env:TEMP\browser-tools-extension"
$zipFile = "$tempDir\extension.zip"

Write-Host "📁 Creando directorio temporal..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path $tempDir | Out-Null

# URL de la última release
$releaseUrl = "https://api.github.com/repos/AgentDeskAI/browser-tools-mcp/releases/latest"

try {
    Write-Host "🌐 Buscando última versión..." -ForegroundColor Yellow
    $release = Invoke-RestMethod -Uri $releaseUrl
    $asset = $release.assets | Where-Object { $_.name -like "*chrome-extension*" } | Select-Object -First 1
    
    if (-not $asset) {
        Write-Host "❌ No se encontró el asset de la extensión" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "⬇️  Descargando: $($asset.name)..." -ForegroundColor Yellow
    Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $zipFile
    
    Write-Host "📦 Extrayendo archivos..." -ForegroundColor Yellow
    Expand-Archive -Path $zipFile -DestinationPath $tempDir -Force
    
    # Buscar la carpeta de la extensión
    $extensionDir = Get-ChildItem -Path $tempDir -Directory | Where-Object { $_.Name -like "*chrome*" -or $_.Name -like "*extension*" } | Select-Object -First 1
    
    if (-not $extensionDir) {
        # Listar contenido para debug
        Write-Host "Contenido del zip:" -ForegroundColor Gray
        Get-ChildItem -Path $tempDir -Recurse | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
        $extensionDir = Get-ChildItem -Path $tempDir -Directory | Select-Object -First 1
    }
    
    $finalDir = "$PWD\chrome-extension"
    
    Write-Host "📂 Copiando a: $finalDir..." -ForegroundColor Yellow
    if (Test-Path $finalDir) {
        Remove-Item -Path $finalDir -Recurse -Force
    }
    Copy-Item -Path $extensionDir.FullName -Destination $finalDir -Recurse
    
    Write-Host ""
    Write-Host "✅ Extensión descargada exitosamente!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 Siguientes pasos:" -ForegroundColor Cyan
    Write-Host "   1. Abre Chrome y ve a: chrome://extensions/" -ForegroundColor White
    Write-Host "   2. Activa 'Modo desarrollador' (toggle arriba derecha)" -ForegroundColor White
    Write-Host "   3. Click en 'Cargar descomprimida'" -ForegroundColor White
    Write-Host "   4. Selecciona esta carpeta: $finalDir" -ForegroundColor White
    Write-Host ""
    
    # Preguntar si quiere abrir Chrome
    $openChrome = Read-Host "¿Deseas abrir Chrome ahora? (s/n)"
    if ($openChrome -eq "s" -or $openChrome -eq "S") {
        Start-Process "chrome" "chrome://extensions/"
    }
    
} catch {
    Write-Host ""
    Write-Host "❌ Error: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Solución alternativa:" -ForegroundColor Yellow
    Write-Host "   1. Ve manualmente a: https://github.com/AgentDeskAI/browser-tools-mcp/releases" -ForegroundColor White
    Write-Host "   2. Descarga el archivo browser-tools-chrome-extension.zip" -ForegroundColor White
    Write-Host "   3. Extrae el contenido en: $PWD\chrome-extension" -ForegroundColor White
    Write-Host "   4. Sigue las instrucciones del README.md" -ForegroundColor White
}

# Limpiar temporal
if (Test-Path $tempDir) {
    Remove-Item -Path $tempDir -Recurse -Force
}

Write-Host ""
Write-Host "Presiona cualquier tecla para salir..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
