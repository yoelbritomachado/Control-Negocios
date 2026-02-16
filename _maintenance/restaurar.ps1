param([string]$ZipPath)

if ([string]::IsNullOrEmpty($ZipPath)) {
    Write-Host "Por favor, arrastra el archivo ZIP de respaldo sobre este script o ejecutalo pasandole la ruta."
    exit
}

$DestPath = "$PSScriptRoot\server"

Write-Host "==================================================="
Write-Host "   RESTAURANDO COPIA DE SEGURIDAD..."
Write-Host "==================================================="
Write-Host "Archivo: $ZipPath"
Write-Host "Destino: $DestPath"
Write-Host ""

# Check if server is running (simple check)
$Process = Get-Process node -ErrorAction SilentlyContinue
if ($Process) {
    Write-Host "[ATENCION] Se detectaron procesos de Node.js activos."
    Write-Host "Cerrando sistema para poder restaurar archivos..."
    Stop-Process -Name node -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

try {
    # Extract
    Write-Host "extrayendo archivos..."
    Expand-Archive -LiteralPath $ZipPath -DestinationPath $DestPath -Force
    
    Write-Host ""
    Write-Host "[OK] RESTAURACION COMPLETADA EXITOSAMENTE"
    Write-Host "Ya puedes iniciar el sistema con INICIAR_SISTEMA.bat"
}
catch {
    Write-Error "Ocurrio un error al restaurar: $_"
}

Write-Host ""
Read-Host "Presiona Enter para salir..."
