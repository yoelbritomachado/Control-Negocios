@echo off
TITLE DETENER MCH Control
echo ===================================================
echo   DETENIENDO SISTEMA...
echo   (Liberando puertos 3001 y 5173)
echo ===================================================
echo.
taskkill /F /IM node.exe
echo.
echo Listo. Ahora puedes ejecutar 'iniciar_sistema.bat' de nuevo.
timeout /t 3
