# 🔧 Browser Tools MCP - Guía de Instalación

Browser Tools MCP permite que tu IA en VS Code interactúe con tu navegador Chrome, capturando screenshots, logs de consola, actividad de red, y más.

## 📦 Componentes

Este sistema tiene **3 componentes** que deben estar ejecutándose:

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ Chrome Extension│────▶│  Browser Tools   │────▶│   MCP Server    │
│   (Captura)     │     │  Server (local)  │     │ (En VS Code)    │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

## 🚀 Instalación Paso a Paso

### Paso 1: Descargar la Extensión de Chrome

1. Ve a: https://github.com/AgentDeskAI/browser-tools-mcp/releases
2. Descarga el archivo `browser-tools-chrome-extension.zip`
3. Extrae el contenido en una carpeta (ej: `C:\tools\browser-tools-extension`)

### Paso 2: Instalar la Extensión en Chrome

1. Abre Chrome y ve a `chrome://extensions/`
2. Activa el **"Modo desarrollador"** (toggle arriba a la derecha)
3. Click en **"Cargar descomprimida"** (Load unpacked)
4. Selecciona la carpeta donde extrajiste la extensión
5. La extensión "BrowserToolsMCP" debería aparecer en tu lista

### Paso 3: Iniciar el Browser Tools Server

**Opción A - Script automático:**
```bash
.\_tools\browser-tools\INICIAR_SERVIDOR.bat
```

**Opción B - Manual:**
```bash
npx -y @agentdeskai/browser-tools-server@latest
```

Dejar esta terminal abierta mientras uses el MCP.

### Paso 4: Configurar VS Code

El archivo `.vscode/mcp.json` ya está configurado. Solo necesitas:

1. Abrir VS Code
2. Asegurarte de tener instalada una extensión que soporte MCP (Roo Code, Cline, etc.)
3. La configuración se cargará automáticamente

### Paso 5: Usar en Chrome

1. Abre Chrome y navega a cualquier página web
2. Abre **DevTools** (F12)
3. Busca la pestaña **"BrowserToolsMCP"** en DevTools
4. Click en "Connect" para conectar con el servidor

## ✅ Verificar que Funciona

1. **Servidor**: Debe mostrar "Server ready" en la terminal
2. **Extensión**: En DevTools debe decir "Connected"
3. **VS Code**: El MCP debe aparecer en la lista de servidores disponibles

## 🛠️ Herramientas Disponibles

Una vez configurado, podrás usar estos comandos desde tu IA en VS Code:

| Comando | Descripción |
|---------|-------------|
| `browser_snapshot` | Captura el estado actual de la página |
| `browser_take_screenshot` | Toma una screenshot de la página actual |
| `runAccessibilityAudit` | Audit accesibilidad (WCAG) |
| `runPerformanceAudit` | Audit de performance (Lighthouse) |
| `runSEOAudit` | Audit de SEO |
| `runBestPracticesAudit` | Audit de mejores prácticas |
| `runAuditMode` | Ejecuta todos los audits |
| `runDebuggerMode` | Modo debugging completo |

## 📝 Ejemplos de Uso

```
"Toma una screenshot de la página actual"
"Audita la accesibilidad de esta página"
"Revisa el performance de mi sitio web"
"Analiza el SEO de esta página"
"Entra en modo debugger"
```

## 🔧 Solución de Problemas

### No se conecta la extensión
- Cierra Chrome completamente y vuelve a abrirlo
- Asegúrate de que solo haya UNA instancia de DevTools abierta
- Reinicia el servidor con `Ctrl+C` y vuelve a iniciarlo

### El MCP no aparece en VS Code
- Verifica que tu extensión de IA soporte MCP (Roo Code, Cline)
- Revisa que el archivo `.vscode/mcp.json` exista
- Reinicia VS Code

### Error "Cannot connect to server"
- Asegúrate de que el Browser Tools Server esté corriendo
- Verifica que no haya firewall bloqueando el puerto 3025

## 📚 Recursos

- Documentación oficial: https://browsertools.agentdesk.ai/
- GitHub: https://github.com/AgentDeskAI/browser-tools-mcp
- Releases: https://github.com/AgentDeskAI/browser-tools-mcp/releases
