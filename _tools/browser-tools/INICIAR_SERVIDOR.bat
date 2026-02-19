@echo off
chcp 65001 >nul
echo ============================================
echo   🔧 Browser Tools Server
echo ============================================
echo.
echo Este servidor es necesario para que el MCP
echo de Browser Tools funcione correctamente.
echo.
echo Requisitos previos:
echo  1. Tener la extensión de Chrome instalada
echo  2. Tener Chrome abierto con DevTools en la pestaña Browser Tools
echo.
echo Presiona cualquier tecla para iniciar...
pause >nul

echo.
echo 🚀 Iniciando Browser Tools Server...
echo.

npx -y @agentdeskai/browser-tools-server@latest

echo.
echo Servidor detenido.
pause
