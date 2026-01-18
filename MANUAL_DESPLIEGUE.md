# 🚀 Manual de Despliegue en Internet
**Business Control System**

Este proyecto es una **Aplicación Web Estática**. Esto significa que puede ser alojada en servicios gratuitos y seguros sin necesidad de configurar servidores complejos.

---

## ⚠️ Advertencia Importante
**LOS DATOS SON LOCALES.**
Al subir este proyecto a internet, **la base de datos NO se comparte**.
- Si abres la web en tu PC, verás los datos de tu PC.
- Si abres la misma web en tu celular, verás una base de datos **VACÍA** (o distinta).
- **Ideal para:** Mostrar el proyecto, demos, o uso individual en un solo dispositivo.

---

## 🌐 Opción 1: Netlify (Recomendado - Permanente)
Esta opción te da una dirección web (ej: `tu-negocio.netlify.app`) que funciona 24/7.

1.  **Regístrate**: Entra a [netlify.com](https://www.netlify.com/) y crea una cuenta gratuita.
2.  **Prepara la Carpeta**:
    - Asegúrate de saber dónde está la carpeta del proyecto en tu computadora:
    - Ruta: `c:\Users\Yoe_Laptop\.gemini\antigravity\scratch\business_control_system`
3.  **Subir**:
    - En el panel de Netlify, busca el área que dice **"Drag and drop your site output folder here"**.
    - Arrastra la carpeta `business_control_system` completa ahí dentro.
4.  **¡Listo!**:
    - Netlify subirá los archivos y en unos segundos te dará un link color verde.
    - Haz clic en él para ver tu aplicación online.

### ¿Cómo actualizar?
Si haces cambios en el código, ve a "Deploys" en Netlify y arrastra la carpeta nuevamente.

---

## 🚇 Opción 2: Ngrok (Temporal - Pruebas Rápidas)
Si tienes instalado `ngrok` y quieres dar acceso a tu PC actual (con sus datos actuales) por unas horas.

1.  Abre una terminal/consola en la carpeta del proyecto.
2.  Si tienes Python instalado, inicia un servidor simple:
    ```bash
    python -m http.server 8000
    ```
    (O usa "Live Server" en VS Code si prefieres).
3.  En otra terminal, corre Ngrok:
    ```bash
    ngrok http 8000
    ```
4.  Ngrok te dará una URL (ej: `https://abcd-1234.ngrok-free.app`). Comparte ese link.
    - **Nota**: Al cerrar la terminal, el link deja de funcionar.

---

## 📱 Guardar como App (PWA)
Una vez tengas el link (de Netlify o Ngrok):
1.  Ábrelo en Chrome en tu celular Android.
2.  Toca los 3 puntos -> **"Agregar a la pantalla principal"**.
3.  Ahora tendrás un ícono como si fuera una App nativa.
