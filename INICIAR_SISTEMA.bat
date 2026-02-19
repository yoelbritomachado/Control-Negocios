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
:: ADVERTENCIA IMPORTANTE
echo ════════════════════════════════════════════════════════════
echo ⚠️  MODO SEGURO: Iniciando SIN actualizar desde GitHub
echo ════════════════════════════════════════════════════════════
echo.
echo    ℹ️  Este script NO descarga cambios de la nube.
echo    ℹ️  Usa ACTUALIZAR_SISTEMA.bat para descargar cambios.
echo    ℹ️  Usa SINCRONIZAR_MANUAL.bat para subir tus cambios.
echo.
timeout /t 3 >nul

:: ============================================
:: PASO 1: Verificar dependencias
echo.
echo ════════════════════════════════════════════════════════════
echo 📦 PASO 1: Verificando dependencias...
echo ════════════════════════════════════════════════════════════
echo.

if not exist "server\node_modules" (
    echo    Instalando dependencias del servidor...
    cd server
    call npm install
    cd ..
) else (
    echo    ✅ Server dependencies OK
    echo    Verificando dependencias adicionales...
    cd server
    call npm list adm-zip > nul 2>&1
    if %errorlevel% neq 0 (
        echo    Instalando adm-zip...
        call npm install adm-zip
    ) else (
        echo    ✅ adm-zip OK
    )
    cd ..
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
:: PASO 2: Iniciar Backend
echo ════════════════════════════════════════════════════════════
echo 🚀 PASO 2: Iniciando Backend (Puerto 3001)...
echo ════════════════════════════════════════════════════════════
echo.

start "🖥️  MCH Backend" cmd /k "cd /d "%PROJECT_PATH%server" && node index.js"

echo    ⏳ Esperando 5 segundos para iniciar backend...
timeout /t 5 /nobreak >nul
echo    ✅ Backend iniciado
echo.

:: ============================================
:: PASO 3: Iniciar Browser Tools Server (MCP)
echo ════════════════════════════════════════════════════════════
echo 🔧 PASO 3: Iniciando Browser Tools Server (MCP)...
echo ════════════════════════════════════════════════════════════
echo.
echo    ℹ️  Esto permite que Kimi acceda al navegador
echo.

start "🔧 Browser Tools Server" cmd /k "npx @agentdeskai/browser-tools-server@latest"

echo    ⏳ Esperando 3 segundos para iniciar servidor MCP...
timeout /t 3 /nobreak >nul
echo    ✅ Browser Tools Server iniciado
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
echo 🖥️  Se abrieron 3 ventanas de comandos:
echo    - Backend (Puerto 3001)
echo    - Browser Tools Server (MCP)
echo    - Frontend (Puerto 5173)
echo.
echo ⚠️  NO CIERRES esas ventanas mientras uses el sistema!
echo.
echo ════════════════════════════════════════════════════════════
echo 📋 COMANDOS GIT UTILES:
echo ════════════════════════════════════════════════════════════
echo.
echo    ACTUALIZAR_SISTEMA.bat  → Descargar cambios de GitHub
echo    SINCRONIZAR_MANUAL.bat  → Subir tus cambios a GitHub
echo.
echo Presiona cualquier tecla para cerrar esta ventana...
pause >nul
