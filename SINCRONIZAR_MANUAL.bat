@echo off
TITLE Subir Cambios a GitHub - Control Negocios
chcp 65001 >nul
color 0A
cls

echo.
echo   ╔══════════════════════════════════════════════════════════╗
echo   ║                                                          ║
echo   ║   ⬆️  SUBIR CAMBIOS A GITHUB                             ║
echo   ║                                                          ║
echo   ║   Sube tus cambios locales al repositorio remoto         ║
echo   ║                                                          ║
echo   ╚══════════════════════════════════════════════════════════╝
echo.

cd /d "%~dp0"

echo 📂 Ubicacion: %CD%
echo.

:: ============================================
:: PASO 1: Verificar estado
echo ════════════════════════════════════════════════════════════
echo PASO 1: Verificando estado del repositorio...
echo ════════════════════════════════════════════════════════════
echo.

git status --short

echo.
set /p CONFIRMAR="¿Deseas subir estos cambios? (S/N): "
if /I not "%CONFIRMAR%"=="S" (
    echo.
    echo ❌ Operacion cancelada por el usuario.
    pause
    exit /b 0
)

echo.

:: ============================================
:: PASO 2: Agregar cambios
echo ════════════════════════════════════════════════════════════
echo PASO 2: Agregando cambios...
echo ════════════════════════════════════════════════════════════
echo.

git add .
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ❌ Error al agregar archivos
    pause
    exit /b 1
)
echo ✅ Archivos agregados al stage
echo.

:: ============================================
:: PASO 3: Pedir mensaje de commit
echo ════════════════════════════════════════════════════════════
echo PASO 3: Mensaje del commit
echo ════════════════════════════════════════════════════════════
echo.
echo 💡 Tipos de commit comunes:
echo    feat:  Nueva funcionalidad
echo    fix:   Correccion de bug
echo    docs:  Documentacion
echo    style: Cambios de estilo/CSS
echo    chore: Tareas de mantenimiento
echo.
set /p MENSAJE="Escribe el mensaje del commit: "

if "%MENSAJE%"=="" (
    set MENSAJE=update: cambios locales
    echo.
    echo ℹ️  Usando mensaje por defecto: "%MENSAJE%"
)

echo.

:: ============================================
:: PASO 4: Crear commit
echo ════════════════════════════════════════════════════════════
echo PASO 4: Creando commit...
echo ════════════════════════════════════════════════════════════
echo.

git commit -m "%MENSAJE%"
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ⚠️  No se pudo crear el commit (puede que no haya cambios)
    pause
    exit /b 1
)
echo ✅ Commit creado correctamente
echo.

:: ============================================
:: PASO 5: Subir a GitHub
echo ════════════════════════════════════════════════════════════
echo PASO 5: Subiendo a GitHub (git push)...
echo ════════════════════════════════════════════════════════════
echo.

git push origin main
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ❌ Error al subir cambios.
    echo.
    echo Posibles causas:
    echo    1. No tienes conexion a internet
    echo    2. Hay cambios en GitHub que no tienes localmente
    echo    3. Problema de autenticacion
    echo.
    echo Solucion:
    echo    Ejecuta ACTUALIZAR_SISTEMA.bat primero para descargar
    echo    los cambios de la nube, luego vuelve a subir.
    pause
    exit /b 1
)

echo.
echo ✅ Cambios subidos correctamente a GitHub!
echo.

:: ============================================
:: VERIFICACION FINAL
echo ════════════════════════════════════════════════════════════
echo ✅ SINCRONIZACION COMPLETADA
echo ════════════════════════════════════════════════════════════
echo.
echo 📝 Resumen:
echo    - Cambios agregados al stage
echo    - Commit creado con mensaje: "%MENSAJE%"
echo    - Subido a la rama main de GitHub
echo.
echo ℹ️  Railway detectara los cambios y hara deploy automatico.
echo.
echo Presiona cualquier tecla para cerrar...
pause >nul
