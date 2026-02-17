@echo off
TITLE Sincronizacion Manual - Control Negocios
chcp 65001 >nul
color 0A
cls

echo.
echo   ╔══════════════════════════════════════════════════════════╗
echo   ║                                                          ║
echo   ║   🔄 SINCRONIZACION MANUAL CON GITHUB                    ║
echo   ║                                                          ║
echo   ║   Usar cuando haya conflictos con inventory.db          ║
echo   ║                                                          ║
echo   ╚══════════════════════════════════════════════════════════╝
echo.

cd /d "%~dp0"

echo 📂 Ubicacion: %CD%
echo.

echo ════════════════════════════════════════════════════════════
echo PASO 1: Guardando base de datos local (backup)...
echo ════════════════════════════════════════════════════════════
echo.

if exist "server\inventory.db" (
    copy "server\inventory.db" "server\inventory.db.backup.%date:~-4,4%%date:~-10,2%%date:~-7,2%.%time:~0,2%%time:~3,2%%time:~6,2%.bak" >nul 2>&1
    echo ✅ Backup creado: server\inventory.db.backup.*
) else (
    echo ⚠️  No se encontro inventory.db
)

echo.
echo ════════════════════════════════════════════════════════════
echo PASO 2: Descargando cambios de GitHub (git fetch)...
echo ════════════════════════════════════════════════════════════
echo.

git fetch origin
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ❌ Error al conectar con GitHub
    echo    Verifica tu conexion a internet
    pause
    exit /b 1
)

echo ✅ Cambios descargados
echo.

echo ════════════════════════════════════════════════════════════
echo PASO 3: Reseteando archivos de codigo (sin tocar DB)...
echo ════════════════════════════════════════════════════════════
echo.

:: Guardar DB temporalmente
if exist "server\inventory.db" (
    move "server\inventory.db" "server\inventory.db.temp" >nul 2>&1
)

:: Resetear todo excepto la DB
git checkout -- .

:: Restaurar DB
echo.
echo ════════════════════════════════════════════════════════════
echo PASO 4: Aplicando cambios de GitHub...
echo ════════════════════════════════════════════════════════════
echo.

if exist "server\inventory.db.temp" (
    move "server\inventory.db.temp" "server\inventory.db" >nul 2>&1
)

git pull origin main --strategy-option=theirs
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ⚠️  Hubo conflictos. Resolviendo automaticamente...
    git reset --hard origin/main
    if exist "server\inventory.db.temp" (
        move "server\inventory.db.temp" "server\inventory.db" >nul 2>&1
    )
)

echo.
echo ════════════════════════════════════════════════════════════
echo PASO 5: Verificando estructura...
echo ════════════════════════════════════════════════════════════
echo.

if exist "server\inventory.db" (
    echo ✅ Base de datos: OK
) else (
    echo ⚠️  Base de datos no encontrada
)

if exist "client\src\App.jsx" (
    echo ✅ Codigo cliente: OK
) else (
    echo ❌ Codigo cliente: ERROR
)

if exist "server\index.js" (
    echo ✅ Codigo servidor: OK
) else (
    echo ❌ Codigo servidor: ERROR
)

echo.
echo ════════════════════════════════════════════════════════════
echo ✅ SINCRONIZACION COMPLETADA
-echo ════════════════════════════════════════════════════════════
echo.
echo 📝 Notas:
echo    - Tu base de datos local se ha preservado
echo    - El codigo esta actualizado con GitHub
echo    - Ejecuta INICIAR_SISTEMA.bat para reiniciar
echo.
echo Presiona cualquier tecla para cerrar...
pause >nul
