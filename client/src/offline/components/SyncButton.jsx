/**
 * Botón de sincronización manual
 * Permite al usuario forzar una sincronización
 */

import React, { useState } from 'react';
import { useOffline } from '../hooks';
import { RefreshCw, Check, AlertTriangle } from 'lucide-react';

export function SyncButton({ className = '' }) {
  const { isOnline, isSyncing, syncNow, pendingCount, isInitialized } = useOffline();
  const [showResult, setShowResult] = useState(null);
  
  // Si el sistema offline no está inicializado, no mostrar el botón
  if (!isInitialized) {
    return null;
  }

  const handleSync = async () => {
    if (!isOnline || isSyncing) return;

    const result = await syncNow();
    
    setShowResult({
      success: result.success,
      message: result.success 
        ? 'Sincronizado correctamente'
        : (result.reason === 'offline' 
            ? 'Sin conexión' 
            : result.reason === 'not_initialized'
              ? 'Modo offline no disponible'
              : 'Error al sincronizar')
    });

    setTimeout(() => setShowResult(null), 3000);
  };

  if (!isOnline) {
    return (
      <button
        disabled
        className={`
          flex items-center gap-2 px-4 py-2 rounded-lg
          bg-gray-100 text-gray-400 cursor-not-allowed
          ${className}
        `}
      >
        <RefreshCw className="w-4 h-4" />
        <span>Sin conexión</span>
        {pendingCount > 0 && (
          <span className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">
            {pendingCount}
          </span>
        )}
      </button>
    );
  }

  return (
    <button
      onClick={handleSync}
      disabled={isSyncing}
      className={`
        flex items-center gap-2 px-4 py-2 rounded-lg font-medium
        transition-all duration-200
        ${isSyncing 
          ? 'bg-blue-100 text-blue-600 cursor-wait' 
          : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'
        }
        ${showResult?.success ? 'bg-green-600 hover:bg-green-700' : ''}
        ${showResult && !showResult.success ? 'bg-red-600 hover:bg-red-700' : ''}
        ${className}
      `}
    >
      {isSyncing ? (
        <>
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>Sincronizando...</span>
        </>
      ) : showResult ? (
        <>
          {showResult.success ? (
            <Check className="w-4 h-4" />
          ) : (
            <AlertTriangle className="w-4 h-4" />
          )}
          <span>{showResult.message}</span>
        </>
      ) : (
        <>
          <RefreshCw className="w-4 h-4" />
          <span>Sincronizar</span>
          {pendingCount > 0 && (
            <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">
              {pendingCount} pendiente{pendingCount !== 1 ? 's' : ''}
            </span>
          )}
        </>
      )}
    </button>
  );
}

export default SyncButton;
