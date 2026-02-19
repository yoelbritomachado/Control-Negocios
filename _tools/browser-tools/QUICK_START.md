# ⚡ Quick Start - Browser Tools MCP

## TL;DR - Inicio Rápido

### 1. Instalar Extensión (Una sola vez)
```powershell
.\_tools\browser-tools\INSTALAR_EXTENSION.ps1
```
O manualmente desde: https://github.com/AgentDeskAI/browser-tools-mcp/releases

### 2. Iniciar Servidor (Cada vez que uses)
```bash
.\_tools\browser-tools\INICIAR_SERVIDOR.bat
```

### 3. Conectar en Chrome
1. Abre cualquier página web
2. Presiona `F12` (DevTools)
3. Busca pestaña **"BrowserToolsMCP"**
4. Click en **Connect**

### 4. Usar en VS Code
Tu IA ahora puede usar comandos como:
- `"Toma una screenshot"`
- `"Audita el SEO de esta página"`
- `"Revisa la accesibilidad"`

---

## 📁 Archivos Creados

| Archivo | Descripción |
|---------|-------------|
| `.vscode/mcp.json` | Configuración MCP para VS Code |
| `_tools/browser-tools/INICIAR_SERVIDOR.bat` | Script para iniciar el servidor |
| `_tools/browser-tools/INSTALAR_EXTENSION.ps1` | Script para descargar extensión |
| `_tools/browser-tools/README.md` | Documentación completa |

---

## 🎯 Comandos Útiles

### Iniciar servidor
```bash
npx @agentdeskai/browser-tools-server@latest
```

### Verificar instalación MCP
```bash
npx @agentdeskai/browser-tools-mcp@latest --help
```

---

## ❓ ¿Necesitas Ayuda?

Lee el archivo `README.md` completo en esta carpeta para troubleshooting detallado.
