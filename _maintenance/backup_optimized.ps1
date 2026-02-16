$d = Get-Date -Format 'yyyy-MM-dd_HH-mm'
$n = "Salva_Registro_de_Compras_$d.zip"

Write-Host "Iniciando copia de seguridad: $n"

# 1. Detener procesos Node.js
Stop-Process -Name node -ErrorAction SilentlyContinue

# 2. Crear carpeta temporal
$temp = "temp_backup_source"
if (Test-Path $temp) { Remove-Item -Recurse -Force $temp }
New-Item -ItemType Directory -Force -Path $temp | Out-Null

# 3. Copiar Archivos Raíz
Copy-Item "package.json", "inventory.db", "*.bat", "*.md", ".env" -Destination $temp -ErrorAction SilentlyContinue

# 4. Copiar Server (Solo código fuente y config)
New-Item -ItemType Directory -Force -Path "$temp\server" | Out-Null
Copy-Item "server\index.js", "server\package.json" -Destination "$temp\server"

# 5. Copiar Client (Solo código fuente y config)
New-Item -ItemType Directory -Force -Path "$temp\client" | Out-Null
Copy-Item "client\package.json", "client\vite.config.js", "client\index.html", "client\postcss.config.js", "client\tailwind.config.js", "client\jsconfig.json", "client\.eslintrc.cjs" -Destination "$temp\client" -ErrorAction SilentlyContinue
Copy-Item "client\src" -Destination "$temp\client" -Recurse
Copy-Item "client\public" -Destination "$temp\client" -Recurse

# 6. Comprimir
Compress-Archive -Path "$temp\*" -DestinationPath $n -Force

# 7. Limpieza
Remove-Item -Recurse -Force $temp
if (Test-Path "backup_script.ps1") { Remove-Item "backup_script.ps1" }

Write-Host "Copia de seguridad completada exitosamente."

# 8. Reiniciar Servidor
Start-Process node -ArgumentList "server/index.js" -WindowStyle Hidden -RedirectStandardOutput "server_log.txt" -RedirectStandardError "server_log.txt"
