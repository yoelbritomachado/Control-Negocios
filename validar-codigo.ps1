# validar-codigo.ps1
# Script de validación de código antes de commit
# Detecta errores comunes: shadowing, funciones duplicadas, etc.

$ErrorActionPreference = "Continue"
$hasErrors = $false
$hasWarnings = $false

Write-Host ""
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  🔍 VALIDACIÓN DE CÓDIGO PRE-COMMIT" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# ============================================
# Función para mostrar errores
function Show-Error($message) {
    Write-Host "   ❌ $message" -ForegroundColor Red
    $script:hasErrors = $true
}

function Show-Warning($message) {
    Write-Host "   ⚠️  $message" -ForegroundColor Yellow
    $script:hasWarnings = $true
}

function Show-Success($message) {
    Write-Host "   ✅ $message" -ForegroundColor Green
}

function Show-Info($message) {
    Write-Host "   ℹ️  $message" -ForegroundColor Gray
}

# ============================================
# 1. VALIDAR SINTAXIS JS BÁSICA
Write-Host "📋 PASO 1: Validando sintaxis de archivos JS..." -ForegroundColor White
Write-Host ""

$jsFiles = Get-ChildItem -Path "." -Recurse -Filter "*.js" -File | 
    Where-Object { $_.FullName -notmatch "node_modules" -and $_.FullName -notmatch "\.git" }

$syntaxErrors = 0
foreach ($file in $jsFiles) {
    try {
        $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
        if ($content) {
            # Verificar llaves balanceadas básicas
            $openBraces = ($content -match "{").Count
            $closeBraces = ($content -match "}").Count
            $openParens = ($content -match "\(").Count
            $closeParens = ($content -match "\)").Count
            
            if ($openBraces -ne $closeBraces) {
                Show-Error "Llaves desbalanceadas en: $($file.FullName)"
                $syntaxErrors++
            }
        }
    } catch {
        # Ignorar archivos que no se pueden leer
    }
}

if ($syntaxErrors -eq 0) {
    Show-Success "Sintaxis básica validada en $($jsFiles.Count) archivos"
}

Write-Host ""

# ============================================
# 2. DETECTAR SHADOWING DE VARIABLES GLOBALES
Write-Host "📋 PASO 2: Buscando shadowing de variables globales..." -ForegroundColor White
Write-Host ""

$shadowingPatterns = @(
    @{ Pattern = "let\s+posCart|const\s+posCart"; Name = "posCart"; Fix = "Usa 'window.posCart' en lugar de declarar local" },
    @{ Pattern = "let\s+db\s*=|const\s+db\s*="; Name = "db"; Fix = "Usa 'window.db' en lugar de re-declarar" },
    @{ Pattern = "let\s+currentUser|const\s+currentUser"; Name = "currentUser"; Fix = "Usa 'window.currentUser'" },
    @{ Pattern = "let\s+currentBusiness|const\s+currentBusiness"; Name = "currentBusiness"; Fix = "Usa 'window.currentBusiness'" },
    @{ Pattern = "let\s+cart|const\s+cart\s*="; Name = "cart"; Fix = "Verifica que no sea 'window.posCart'" }
)

$shadowingFound = $false
foreach ($pattern in $shadowingPatterns) {
    $matches = Select-String -Path "client\*.js", "server\*.js" -Pattern $pattern.Pattern -ErrorAction SilentlyContinue | 
        Where-Object { $_.Line -notmatch "window\." }
    
    if ($matches) {
        Show-Error "Shadowing detectado: '$($pattern.Name)'"
        Show-Info "$($pattern.Fix)"
        foreach ($match in $matches | Select-Object -First 3) {
            Write-Host "      → $($match.FileName):$($match.LineNumber)" -ForegroundColor DarkGray
        }
        $shadowingFound = $true
    }
}

if (-not $shadowingFound) {
    Show-Success "No se detectó shadowing de variables globales"
}

Write-Host ""

# ============================================
# 3. DETECTAR FUNCIONES DUPLICADAS (CÓDIGO ZOMBIE)
Write-Host "📋 PASO 3: Buscando funciones duplicadas (código zombie)..." -ForegroundColor White
Write-Host ""

$duplicateFound = $false
$jsFilesToCheck = Get-ChildItem -Path "client", "server" -Recurse -Filter "*.js" -ErrorAction SilentlyContinue

foreach ($file in $jsFilesToCheck) {
    try {
        $content = Get-Content $file.FullName -Raw
        
        # Buscar funciones declaradas con 'function nombre('
        $functionMatches = [regex]::Matches($content, "function\s+(\w+)\s*\(")
        $functionNames = $functionMatches | ForEach-Object { $_.Groups[1].Value }
        $duplicates = $functionNames | Group-Object | Where-Object { $_.Count -gt 1 }
        
        if ($duplicates) {
            foreach ($dup in $duplicates) {
                Show-Error "Función duplicada '$($dup.Name)' en $($file.Name) ($($dup.Count) veces)"
                Show-Info "Elimina la versión antigua para evitar comportamiento inesperado"
            }
            $duplicateFound = $true
        }
        
        # Buscar funciones flecha asignadas const/let duplicadas
        $arrowMatches = [regex]::Matches($content, "(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>|
(?:const|let|var)\s+(\w+)\s*=\s*function")
        $arrowNames = $arrowMatches | ForEach-Object { 
            if ($_.Groups[1].Success) { $_.Groups[1].Value } else { $_.Groups[2].Value }
        } | Where-Object { $_ -ne $null }
        $arrowDuplicates = $arrowNames | Group-Object | Where-Object { $_.Count -gt 1 }
        
        if ($arrowDuplicates) {
            foreach ($dup in $arrowDuplicates) {
                Show-Warning "Posible función duplicada '$($dup.Name)' en $($file.Name)"
            }
            $duplicateFound = $true
        }
    } catch {
        # Ignorar errores de lectura
    }
}

if (-not $duplicateFound) {
    Show-Success "No se detectaron funciones duplicadas obvias"
}

Write-Host ""

# ============================================
# 4. VERIFICAR EXPOSICIÓN GLOBAL DE FUNCIONES
Write-Host "📋 PASO 4: Verificando exposición de funciones globales..." -ForegroundColor White
Write-Host ""

$onclickFiles = Get-ChildItem -Path "client" -Recurse -Filter "*.js" -ErrorAction SilentlyContinue
$exposureIssues = 0

foreach ($file in $onclickFiles) {
    try {
        $content = Get-Content $file.FullName -Raw
        
        # Buscar onclick="funcName(..."
        $onclickMatches = [regex]::Matches($content, 'onclick="(\w+)')
        foreach ($match in $onclickMatches) {
            $funcName = $match.Groups[1].Value
            
            # Ignorar funciones nativas
            if ($funcName -in @('alert', 'console', 'window', 'return', 'true', 'false', 'null', 'undefined')) {
                continue
            }
            
            # Verificar si está expuesta globalmente
            $exposedPattern = "window\.$funcName\s*=\s*$funcName|window\.$funcName\s*="
            $isExposed = $content -match $exposedPattern
            
            if (-not $isExposed) {
                # Buscar en otros archivos si está expuesta
                $globalExposed = $false
                foreach ($otherFile in $onclickFiles) {
                    $otherContent = Get-Content $otherFile.FullName -Raw
                    if ($otherContent -match "window\.$funcName\s*=") {
                        $globalExposed = $true
                        break
                    }
                }
                
                if (-not $globalExposed) {
                    Show-Warning "'$funcName' usada en onclick pero no expuesta como 'window.$funcName'"
                    Show-Info "Agrega: window.$funcName = $funcName;"
                    $exposureIssues++
                }
            }
        }
    } catch {
        # Ignorar errores
    }
}

if ($exposureIssues -eq 0) {
    Show-Success "Funciones globales correctamente expuestas"
}

Write-Host ""

# ============================================
# 5. VERIFICAR ARCHIVOS CRÍTICOS
Write-Host "📋 PASO 5: Verificando archivos de memoria..." -ForegroundColor White
Write-Host ""

$criticalFiles = @(
    "MEMORIA_PROYECTO.md",
    "PROTOCOLO_DE_COLABORACION.md",
    "SYSTEM_LOGIC_RULES.md"
)

foreach ($file in $criticalFiles) {
    if (Test-Path $file) {
        Show-Success "$file presente"
    } else {
        Show-Warning "$file no encontrado"
    }
}

Write-Host ""

# ============================================
# 6. RESUMEN FINAL
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  📊 RESUMEN DE VALIDACIÓN" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

if ($hasErrors) {
    Write-Host "   ❌ SE ENCONTRARON ERRORES CRÍTICOS" -ForegroundColor Red
    Write-Host ""
    Write-Host "   Corrige los errores antes de hacer commit." -ForegroundColor Yellow
    Write-Host "   Revisa el log arriba para más detalles." -ForegroundColor Yellow
    Write-Host ""
    exit 1
} elseif ($hasWarnings) {
    Write-Host "   ⚠️  HAY ADVERTENCIAS (puedes continuar con precaución)" -ForegroundColor Yellow
    Write-Host ""
    exit 0
} else {
    Write-Host "   ✅ TODO CORRECTO - Listo para commit" -ForegroundColor Green
    Write-Host ""
    exit 0
}
