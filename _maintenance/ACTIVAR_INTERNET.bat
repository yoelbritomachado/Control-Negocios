@echo off
cd /d "%~dp0"
title CONECTAR A INTERNET (NGROK)
color 0A

echo ===================================================
echo   CONFIGURACION DE ACCESO REMOTO
echo ===================================================
echo.

if not exist "ngrok.exe" (
    echo [ERROR] No encuentro ngrok.exe
    echo Por favor asegurate de que el archivo descargado este en esta carpeta.
    pause
    exit
)

echo Paso 1: Autenticacion
echo.
echo Ngrok necesita tu "AUTHTOKEN" para funcionar.
echo Lo puedes encontrar en: https://dashboard.ngrok.com/get-started/your-authtoken
echo.
set /p token="Pega tu AUTHTOKEN aqui y dale Enter (si ya lo pusiste antes, dejalo vacio): "

if not "%token%"=="" (
    echo Configurando token...
    ngrok config add-authtoken %token%
)

echo.
echo ===================================================
echo   INICIANDO TUNEL...
echo ===================================================
echo.
echo Copia la direccion que aparecera abajo (Forwarding)
echo Ejemplo: https://xxxx-xxxx.ngrok-free.app
echo.
ngrok http 5173
