# 🔑 Cómo obtener tus llaves de Firebase (5 Minutos)

Necesitamos estos códigos para conectar tu página a la nube de Google. Es gratis y seguro.

1.  **Entra a Firebase**
    - Ve a [console.firebase.google.com](https://console.firebase.google.com/) e inicia sesión con tu cuenta de Google (Gmail).

2.  **Crea un Proyecto**
    - Haz clic en **"Agregar proyecto"** (o "Add project").
    - Ponle un nombre (ej: `MCH-Control`).
    - Desactiva Google Analytics (no hace falta ahora).
    - Dale a "Crear proyecto".

3.  **Crea la Web App**
    - Una vez dentro, verás unos círculos blancos. Haz clic en el ícono de **Web** (`</>`).
    - Ponle nombre a la app (ej: `Sistema Ventas`).
    - Haz clic en **"Registrar app"**.

4.  **COPIA TUS LLAVES**
    - Te aparecerá un bloque de código con `apiKey`, `authDomain`, `projectId`, etc.
    - **¡COPIA ESOS DATOS y pégalos en el chat!** (Solo el contenido dentro de `firebaseConfig`).

5.  **Activa la Base de Datos (Importante)**
    - En el menú lateral izquierdo, ve a **Compilación > Firestore Database**.
    - Haz clic en **"Crear base de datos"**.
    - Ubicación: Déjala como está (ej: `us-central1` o `nam5`).
    - **Reglas de Seguridad**: Elige **"Comenzar en modo de prueba"** (Start in test mode).
    - Dale a "Habilitar".

---

**Cuando tengas los códigos del paso 4, pégalos aquí así:**

```javascript
apiKey: "AIzaSy...",
authDomain: "...",
projectId: "...",
// etc...
```
