# Guía de Deploy en Railway

## Paso 1: Preparar el proyecto

### 1.1 Crear archivo railway.json

En la raíz del proyecto, crea un archivo `railway.json`:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "node server/index.js",
    "healthcheckPath": "/api/health",
    "healthcheckTimeout": 100,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### 1.2 Crear package.json en raíz

Crea un `package.json` en la raíz del proyecto:

```json
{
  "name": "miss-chulerias-bizcontrol",
  "version": "2.7.0",
  "description": "Sistema de Inventario y Punto de Venta - Miss Chulerías",
  "main": "server/index.js",
  "scripts": {
    "start": "node server/index.js",
    "dev": "concurrently \"cd server && npm run dev\" \"cd client && npm run dev\"",
    "build": "cd client && npm run build",
    "postinstall": "cd server && npm install && cd ../client && npm install"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "keywords": ["pos", "inventory", "retail"],
  "author": "Miss Chulerías",
  "license": "Private"
}
```

### 1.3 Agregar healthcheck endpoint

En `server/index.js`, agrega este endpoint antes del `app.listen`:

```javascript
// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
```

### 1.4 Configurar CORS para producción

En `server/index.js`, modifica el CORS:

```javascript
// CORS configuration
const corsOptions = {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));
```

### 1.5 Usar variables de entorno para la base de datos

En `server/index.js`, cambia la ruta de la base de datos:

```javascript
// Database path - use Railway's persistent storage or local
const dbPath = process.env.RAILWAY_VOLUME_MOUNT_PATH 
    ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'inventory.db')
    : path.join(__dirname, 'inventory.db');

const db = new Database(dbPath);
```

## Paso 2: Crear cuenta en Railway

1. Ve a https://railway.app
2. Click en "Start a New Project"
3. Selecciona "Deploy from GitHub repo"
4. Conecta tu cuenta de GitHub
5. Selecciona el repositorio `Control-Negocios`

## Paso 3: Configurar variables de entorno

En el dashboard de Railway, ve a "Variables" y agrega:

```
NODE_ENV=production
PORT=3001
ADMIN_EMAIL=yoelbritomachado@gmail.com
JWT_SECRET=tu_secreto_seguro_aqui
```

## Paso 4: Configurar volumen persistente

Para que la base de datos no se borre:

1. Ve a "Volumes" en Railway
2. Click "New Volume"
3. Mount path: `/data`
4. Variable: `RAILWAY_VOLUME_MOUNT_PATH=/data`

## Paso 5: Deploy

1. Railway detectará automáticamente el `railway.json`
2. Click en "Deploy"
3. Espera a que termine el build

## Paso 6: Configurar dominio (opcional)

1. Ve a "Settings" → "Domains"
2. Click "Generate Domain" para un dominio gratuito
3. O conecta tu propio dominio

## URLs del sistema deployado

- **Backend**: `https://tu-proyecto.railway.app`
- **API**: `https://tu-proyecto.railway.app/api/...`

## Frontend estático (opcional)

Para el frontend, puedes usar Vercel (más fácil):

1. Sube solo la carpeta `client` a Vercel
2. Configura la variable de entorno `VITE_API_URL` con la URL de Railway

O usar el mismo Railway sirviendo el build estático.

## Comandos útiles

```bash
# Ver logs
railway logs

# Conectar a la base de datos
railway connect

# Variables de entorno
railway variables
```

## Notas importantes

- Railway "duerme" la app después de 30 min de inactividad (plan gratuito)
- La primera request después de dormir puede tardar ~10 segundos
- Para evitar esto, usa un plan de pago ($5/mes) o un ping service

## Troubleshooting

Si hay errores:
1. Revisa los logs en Railway dashboard
2. Verifica que las variables de entorno estén correctas
3. Asegúrate que el volumen esté montado correctamente
