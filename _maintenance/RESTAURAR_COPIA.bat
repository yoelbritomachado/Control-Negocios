@echo off
cd /d "%~dp0"
echo ===================================================
echo   RESTAURADOR DE COPIAS DE SEGURIDAD
echo ===================================================
echo.

if "%~1"=="" (
    echo INSTRUCCIONES:
    echo 1. Busca el archivo .ZIP de tu respaldo.
    echo 2. ARRASTRA ese archivo encima de este icono (RESTAURAR_COPIA.bat).
    echo.
    echo O escribe aqui la ruta del archivo y dale Enter:
    set /p zipfile=
) else (
    set zipfile=%~1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "restaurar.ps1" "%zipfile%"
pause
