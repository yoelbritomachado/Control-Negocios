/**
 * Sistema de Logging Offline y Telemetría para Miss Chulerías CRM
 * Almacena logs y errores en IndexedDB localmente cuando el dispositivo está offline
 * y los envía automáticamente al backend central cuando recupera conexión a internet.
 */

const LOG_DB_NAME = 'mch_telemetry_db';
const LOG_DB_VERSION = 1;

function openLogDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB no soportado'));
    }
    const request = indexedDB.open(LOG_DB_NAME, LOG_DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('offline_logs')) {
        const store = db.createObjectStore('offline_logs', { keyPath: 'id', autoIncrement: true });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('level', 'level', { unique: false });
      }
    };
    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });
}

/**
 * Guarda un evento/error en el registro local
 */
export async function recordLog(level = 'info', context = 'APP', message = '', details = null) {
  const logEntry = {
    level,
    context,
    message: typeof message === 'string' ? message : JSON.stringify(message),
    details: details ? (typeof details === 'object' ? details : { raw: details }) : null,
    timestamp: new Date().toISOString(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    onlineStatus: typeof navigator !== 'undefined' ? navigator.onLine : false
  };

  // 1. Mostrar en consola para debug local
  if (level === 'error') {
    console.error(`[${context}]`, message, details || '');
  } else if (level === 'warn') {
    console.warn(`[${context}]`, message, details || '');
  } else {
    console.log(`[${context}]`, message, details || '');
  }

  // 2. Si hay conexión online, intentar enviar directo
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logEntry)
      }).catch(async () => {
        await saveLogToIndexedDB(logEntry);
      });
      return;
    } catch (_) {
      // Fallback a almacenamiento local
    }
  }

  // 3. Si no hay conexión o falló el fetch, almacenar en IndexedDB
  await saveLogToIndexedDB(logEntry);
}

async function saveLogToIndexedDB(entry) {
  try {
    const db = await openLogDB();
    const tx = db.transaction('offline_logs', 'readwrite');
    const store = tx.objectStore('offline_logs');
    store.add(entry);
  } catch (err) {
    console.warn('[Telemetry] No se pudo guardar log en IndexedDB:', err);
  }
}

/**
 * Sube todos los logs offline acumulados al servidor central
 */
export async function flushOfflineLogs() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;

  try {
    const db = await openLogDB();
    const tx = db.transaction('offline_logs', 'readonly');
    const store = tx.objectStore('offline_logs');
    const req = store.getAll();

    req.onsuccess = async () => {
      const logs = req.result || [];
      if (logs.length === 0) return;

      let uploadedCount = 0;
      for (const log of logs) {
        try {
          const res = await fetch('/api/logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              level: log.level,
              context: `${log.context}_OFFLINE_SYNC`,
              message: log.message,
              details: {
                ...log.details,
                originalTimestamp: log.timestamp,
                device: log.userAgent
              }
            })
          });
          if (res.ok) uploadedCount++;
        } catch (_) {
          break; // Si falla la red, detenemos la subida
        }
      }

      if (uploadedCount > 0) {
        const clearTx = db.transaction('offline_logs', 'readwrite');
        const clearStore = clearTx.objectStore('offline_logs');
        clearStore.clear();
        console.log(`[Telemetry] Sincronizados ${uploadedCount} logs offline con el servidor central.`);
      }
    };
  } catch (err) {
    console.warn('[Telemetry] Error en flushOfflineLogs:', err);
  }
}

// Escuchar evento online para vaciar logs automáticamente
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    setTimeout(flushOfflineLogs, 2000);
  });
}
