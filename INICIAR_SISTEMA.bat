@echo off
TITLE Miss Chulerias - Business Control System v2.7
chcp 65001 >nul
color 0A
cls

echo.
echo   ╔══════════════════════════════════════════════════════════╗
echo   ║                                                          ║
echo   ║   🛍️  MISS CHULERIAS - Business Control System v2.7      ║
echo   ║                                                          ║
echo   ║   Sistema de Inventario y Punto de Venta                ║
echo   ║                                                          ║
echo   ╚══════════════════════════════════════════════════════════╝
echo.

:: Obtener ruta del script
cd /d "%~dp0"
set "PROJECT_PATH=%~dp0"

echo 📂 Proyecto: %PROJECT_PATH%
echo.

:: ============================================
:: PASO 1: Actualizar desde GitHub
echo ════════════════════════════════════════════════════════════
echo 🔽 PASO 1: Descargando ultimos cambios de GitHub...
echo ════════════════════════════════════════════════════════════
echo.

git pull origin main

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ⚠️  Advertencia: No se pudieron descargar cambios.
    echo    Verifica tu conexion a internet.
    echo.
    timeout /t 3 >nul
) else (
    echo.
    echo ✅ Codigo actualizado correctamente!
    echo.
)

:: ============================================
:: PASO 2: Verificar dependencias
echo ════════════════════════════════════════════════════════════
echo 📦 PASO 2: Verificando dependencias...
echo ════════════════════════════════════════════════════════════
echo.

if not exist "server\node_modules" (
    echo    Instalando dependencias del servidor...
    cd server
    call npm install
    cd ..
) else (
    echo    ✅ Server dependencies OK
)

if not exist "client\node_modules" (
    echo    Instalando dependencias del cliente...
    cd client
    call npm install
    cd ..
) else (
    echo    ✅ Client dependencies OK
)

echo.

:: ============================================
:: PASO 3: Iniciar Backend
echo ════════════════════════════════════════════════════════════
echo 🚀 PASO 3: Iniciando Backend (Puerto 3001)...
echo ════════════════════════════════════════════════════════════
echo.

start "🖥️  MCH Backend" cmd /k "cd /d "%PROJECT_PATH%server" && npm run dev"

echo    ⏳ Esperando 5 segundos para iniciar backend...
timeout /t 5 /nobreak >nul
echo    ✅ Backend iniciado
echo.

:: ============================================
:: PASO 4: Iniciar Frontend
echo ════════════════════════════════════════════════════════════
echo 🎨 PASO 4: Iniciando Frontend (Puerto 5173)...
echo ════════════════════════════════════════════════════════════
echo.

start "🎨 MCH Frontend" cmd /k "cd /d "%PROJECT_PATH%client" && npm run dev"

echo    ⏳ Esperando 5 segundos para iniciar frontend...
timeout /t 5 /nobreak >nul
echo    ✅ Frontend iniciado
echo.

:: ============================================
:: PASO 5: Abrir navegador
echo ════════════════════════════════════════════════════════════
echo 🌐 PASO 5: Abriendo navegador...
echo ════════════════════════════════════════════════════════════
echo.

start http://localhost:5173

echo    ✅ Navegador abierto en http://localhost:5173
echo.

:: ============================================
:: FINAL
echo ════════════════════════════════════════════════════════════
echo ✅ SISTEMA INICIADO CORRECTAMENTE
echo ════════════════════════════════════════════════════════════
echo.
echo 📱 Accede a: http://localhost:5173
echo.
echo 🖥️  Se abrieron 2 ventanas de comandos:
echo    - Backend (Puerto 3001)
echo    - Frontend (Puerto 5173)
echo.
echo ⚠️  NO CIERRES esas ventanas mientras uses el sistema!
echo.
echo Presiona cualquier tecla para cerrar esta ventana...
pause >nul
