$date = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$sourcePath = "d:\J work\Inventarios\Entradas"
$destinationFile = "d:\J work\Inventarios\Entradas\RESPALDO_COMPLETO_$date.zip"
$exclude = @("node_modules", ".git", ".vscode", "dist", "RESPALDO_COMPLETO_*.zip")

Write-Host "Iniciando respaldo completo del sistema..." -ForegroundColor Cyan
Write-Host "Fuente: $sourcePath"
Write-Host "Destino: $destinationFile"
Write-Host "Excluyendo: node_modules (se reinstalan facil), .git"

Add-Type -AssemblyName System.IO.Compression.FileSystem

function Zip-Folder($source, $destination) {
    $zip = [System.IO.Compression.ZipFile]::Open($destination, "Update")
    
    $files = Get-ChildItem $source -Recurse | Where-Object {
        $path = $_.FullName
        $exclude | ForEach-Object { if ($path -like "*\$_*") { return $false } }
        return $true
    }

    foreach ($file in $files) {
        if ($file.Attributes -ne "Directory") {
            $relativePath = $file.FullName.Substring($source.Length + 1)
            # Skip existing backups inside source to avoid loop
            if ($relativePath -like "RESPALDO_COMPLETO_*.zip") { continue }
            
            [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $file.FullName, $relativePath)
        }
    }
    $zip.Dispose()
}

try {
    # Basic Zip (Simpler method using automated exclude might be tricky in pure PS without 7zip, 
    # so we'll use a slightly broader approach if specific filtering is complex, 
    # but let's try to just zip the key folders: client/src, client/public, server, and root files)
    
    # Actually, simpler approach for reliability:
    # 1. Create temp folder
    # 2. Robocopy key files there
    # 3. Zip temp folder
    
    $tempDir = "$env:TEMP\InventoryBackup_$date"
    New-Item -ItemType Directory -Force -Path $tempDir | Out-Null
    
    Write-Host "Copiando archivos..."
    # Copy Server (includes DB and Uploads)
    robocopy "$sourcePath\server" "$tempDir\server" /E /XD node_modules
    # Copy Client (Source only)
    robocopy "$sourcePath\client" "$tempDir\client" /E /XD node_modules dist
    # Copy Root Scripts
    robocopy "$sourcePath" "$tempDir" *.bat *.json *.md *.ps1
    
    Write-Host "Comprimiendo..."
    [System.IO.Compression.ZipFile]::CreateFromDirectory($tempDir, $destinationFile)
    
    # Cleanup
    Remove-Item -Recurse -Force $tempDir
    
    Write-Host "¡RESPALDO COMPLETADO EXITOSAMENTE!" -ForegroundColor Green
    Write-Host "Archivo guardado en: $destinationFile"
}
catch {
    Write-Error "Error durante el respaldo: $_"
}

Start-Sleep -Seconds 5
