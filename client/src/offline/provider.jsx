/**
 * Miss Chulerías - Provider Offline-First para React
 * Proporciona el contexto de offline a toda la aplicación
 */

import React, { createContext, useState, useEffect, useCallback } from 'react';
import { getOfflineDatabase } from './database';
import { getSyncManager } from './sync';

export const OfflineContext = createContext(null);

export function OfflineProvider({ children }) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const [lastSync, setLastSync] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [dbStats, setDbStats] = useState(null);
  const [error, setError] = useState(null);

  // Referencias a las instancias singleton
  const [db, setDb] = useState(null);
  const [syncManager, setSyncManager] = useState(null);

  /**
   * Inicializa el sistema offline
   */
  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      try {
        console.log('[OfflineProvider] Inicializando sistema offline...');
        
        // Inicializar base de datos
        const database = getOfflineDatabase();
        await database.initialize();
        if (!isMounted) return;
        setDb(database);

        // Inicializar sync manager
        const sync = getSyncManager();
        await sync.initialize();
        if (!isMounted) return;
        setSyncManager(sync);

        // Registrar callbacks de sincronización
        sync.onSync((status) => {
          if (!isMounted) return;
          
          setSyncStatus(status.status);
          setIsSyncing(status.status === 'started');
          
          if (status.status === 'completed') {
            updateStats();
          }
        });

        sync.onOnline(() => {
          if (isMounted) setIsOnline(true);
        });

        sync.onOffline(() => {
          if (isMounted) setIsOnline(false);
        });

        // Estado inicial
        setIsOnline(navigator.onLine);
        setIsInitialized(true);
        
        // Cargar estadísticas iniciales
        updateStats();
        
        console.log('[OfflineProvider] Sistema offline inicializado');
      } catch (err) {
        // Silenciar errores de inicialización - la app funciona sin offline
        console.log('[OfflineProvider] Modo offline no disponible, usando modo online-only');
        if (isMounted) {
          setIsInitialized(true); // Marcar como inicializado para no bloquear la UI
          setIsOnline(navigator.onLine);
        }
      }
    };

    init();

    // Listeners de conectividad
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      isMounted = false;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  /**
   * Actualiza las estadísticas de la base de datos
   */
  const updateStats = useCallback(async () => {
    if (!db) return;

    try {
      const stats = await db.getStats();
      setDbStats(stats);
      setPendingCount(stats.pendingSales || 0);
      setLastSync(stats.lastSync);
    } catch (err) {
      console.error('[OfflineProvider] Error actualizando stats:', err);
    }
  }, [db]);

  /**
   * Fuerza una sincronización manual
   */
  const syncNow = useCallback(async () => {
    if (!syncManager || !isOnline) {
      return { success: false, reason: !isOnline ? 'offline' : 'not_initialized' };
    }

    const result = await syncManager.forceSync();
    await updateStats();
    return result;
  }, [syncManager, isOnline, updateStats]);

  /**
   * Verifica si hay operaciones pendientes
   */
  const hasPendingOperations = useCallback(() => {
    return pendingCount > 0;
  }, [pendingCount]);

  /**
   * Obtiene el estado de conexión como texto
   */
  const getConnectionStatus = useCallback(() => {
    if (!isInitialized) return 'initializing';
    if (isOnline) {
      return isSyncing ? 'syncing' : 'online';
    }
    return hasPendingOperations() ? 'offline_with_pending' : 'offline';
  }, [isInitialized, isOnline, isSyncing, hasPendingOperations]);

  const contextValue = {
    // Estados
    isInitialized,
    isOnline,
    isSyncing,
    syncStatus,
    lastSync,
    pendingCount,
    dbStats,
    error,
    connectionStatus: getConnectionStatus(),

    // Instancias (para uso avanzado)
    db,
    syncManager,

    // Acciones
    syncNow,
    updateStats,
    hasPendingOperations,
    getConnectionStatus
  };

  return (
    <OfflineContext.Provider value={contextValue}>
      {children}
    </OfflineContext.Provider>
  );
}

export default OfflineProvider;
