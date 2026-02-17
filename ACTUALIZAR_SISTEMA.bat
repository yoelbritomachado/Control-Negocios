@echo off
TITLE MCH - Descargar Cambios de GitHub
chcp 65001 >nul
color 0B
cls

echo.
echo   ╔══════════════════════════════════════════════════════════╗
echo   ║                                                          ║
echo   ║   ⬇️  DESCARGAR CAMBIOS DE GITHUB                        ║
echo   ║                                                          ║
echo   ║   Actualiza tu codigo local con los cambios de la nube   ║
echo   ║                                                          ║
echo   ╚══════════════════════════════════════════════════════════╝
echo.

:: Obtener ruta del script
cd /d "%~dp0"

echo 📂 Ubicacion: %CD%
echo.

:: ============================================
:: ADVERTENCIA
echo ════════════════════════════════════════════════════════════
echo ⚠️  ADVERTENCIA
echo ════════════════════════════════════════════════════════════
echo.
echo    Este comando descargara los cambios de GitHub y los
echo    mezclara con tu codigo local.
echo.
echo    ℹ️  Si tienes cambios sin subir, usa primero:
echo       SINCRONIZAR_MANUAL.bat para subirlos.
echo.
set /p CONFIRMAR="¿Deseas continuar con la actualizacion? (S/N): "
if /I not "%CONFIRMAR%"=="S" (
    echo.
    echo ❌ Operacion cancelada.
    pause
    exit /b 0
)

echo.

:: ============================================
:: DESCARGAR CAMBIOS
echo ════════════════════════════════════════════════════════════
echo 🔽 Descargando ultimos cambios de GitHub...
echo ════════════════════════════════════════════════════════════
echo.

git pull origin main

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ❌ Error al descargar actualizaciones.
    echo.
    echo Posibles soluciones:
    echo    1. Si tienes cambios locales sin subir:
    echo       Ejecuta SINCRONIZAR_MANUAL.bat primero
    echo.
    echo    2. Si hay conflictos de merge:
    echo       git stash
    echo       git pull origin main
    echo       git stash pop
    echo.
    echo    3. Para resetear todo (⚠️ pierdes cambios locales):
    echo       git checkout -- .
    echo       git pull origin main
    echo.
    pause
    exit /b 1
)

echo.
echo ✅ Actualizacion completada exitosamente!
echo.

:: ============================================
:: INSTRUCCIONES FINALES
echo ════════════════════════════════════════════════════════════
echo 📋 INSTRUCCIONES
echo ════════════════════════════════════════════════════════════
echo.
echo ℹ️  Si el sistema esta corriendo:
echo    - El Backend deberia reiniciarse automaticamente.
echo    - El Frontend recargara los cambios automaticamente.
echo    - Si no, cierra las ventanas y usa INICIAR_SISTEMA.bat
    echo.
echo ℹ️  Si el sistema NO esta corriendo:
echo    Usa INICIAR_SISTEMA.bat para iniciar con el codigo actualizado.
echo.
echo Presiona cualquier tecla para cerrar...
pause >nul
