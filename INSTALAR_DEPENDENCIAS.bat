@echo off
chcp 65001 > nul
echo ==========================================
echo  INSTALANDO DEPENDENCIAS FALTANTES
echo ==========================================
echo.

cd /d "%~dp0server"

echo Verificando instalación de adm-zip...
npm list adm-zip > nul 2>&1
if %errorlevel% neq 0 (
    echo Instalando adm-zip...
    npm install adm-zip
    if %errorlevel% neq 0 (
        echo ERROR: No se pudo instalar adm-zip
        pause
        exit /b 1
    )
    echo ✓ adm-zip instalado correctamente
) else (
    echo ✓ adm-zip ya está instalado
)

echo.
echo ==========================================
echo  INSTALACIÓN COMPLETADA
echo ==========================================
echo.
pause
