@echo off
TITLE MCH Control v2.0 - Sistema de Inventarios
color 0A
cd /d "%~dp0"
echo ===================================================
echo   INICIANDO MCH CONTROL (Backend + Frontend)
echo ===================================================
echo.
echo 1. Iniciando servidor y cliente...
echo    (Esta ventana debe permanecer abierta)
echo.

:: Iniciar npm start en segundo plano o paralelo no es ideal en BAT simple si queremos ver logs.
:: Estrategia MCH: Lanzar el proceso y luego abrir navegador.
:: Como npm start bloquea, usaremos 'start' para abrir el navegador en paralelo ANTES o comando compuesto.

:: Opción A: Abrir navegador despues de unos segundos en proceso paralelo
start "Abrir Navegador" /min cmd /c "timeout /t 8 >nul && start http://localhost:5173"

:: Ejecutar sistema (bloqueante)
call npm start

if %ERRORLEVEL% NEQ 0 (
    color 0C
    echo.
    echo [ERROR] El sistema se detuvo inesperadamente.
    pause
)
