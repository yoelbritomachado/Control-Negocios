/**
 * Barra de estado de conexión offline
 * Muestra el estado actual de la conexión y sincronización
 */

import React from 'react';
import { useOffline } from '../hooks';
import { Wifi, WifiOff, RefreshCw, CloudCheck, AlertCircle } from 'lucide-react';

export function OfflineStatusBar() {
  const { 
    isOnline, 
    isSyncing, 
    pendingCount, 
    lastSync, 
    connectionStatus 
  } = useOffline();

  const getStatusConfig = () => {
    switch (connectionStatus) {
      case 'initializing':
        return {
          icon: <RefreshCw className="w-4 h-4 animate-spin" />,
          text: 'Inicializando...',
          className: 'bg-yellow-500/20 text-yellow-700 border-yellow-500/30'
        };
      case 'online':
        return {
          icon: <CloudCheck className="w-4 h-4" />,
          text: 'Conectado',
          className: 'bg-green-500/20 text-green-700 border-green-500/30'
        };
      case 'syncing':
        return {
          icon: <RefreshCw className="w-4 h-4 animate-spin" />,
          text: 'Sincronizando...',
          className: 'bg-blue-500/20 text-blue-700 border-blue-500/30'
        };
      case 'offline_with_pending':
        return {
          icon: <AlertCircle className="w-4 h-4" />,
          text: `Offline · ${pendingCount} pendiente${pendingCount !== 1 ? 's' : ''}`,
          className: 'bg-orange-500/20 text-orange-700 border-orange-500/30'
        };
      case 'offline':
        return {
          icon: <WifiOff className="w-4 h-4" />,
          text: 'Sin conexión',
          className: 'bg-red-500/20 text-red-700 border-red-500/30'
        };
      default:
        return {
          icon: <Wifi className="w-4 h-4" />,
          text: 'Desconocido',
          className: 'bg-gray-500/20 text-gray-700 border-gray-500/30'
        };
    }
  };

  const config = getStatusConfig();

  const formatLastSync = () => {
    if (!lastSync) return 'Nunca';
    const date = new Date(lastSync);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Hace un momento';
    if (diff < 3600000) return `Hace ${Math.floor(diff / 60000)} min`;
    if (diff < 86400000) return `Hace ${Math.floor(diff / 3600000)}h`;
    return date.toLocaleDateString();
  };

  return (
    <div className={`
      flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium
      border ${config.className} transition-all duration-300
    `}>
      {config.icon}
      <span>{config.text}</span>
      {lastSync && isOnline && !isSyncing && (
        <span className="opacity-70">· Sync: {formatLastSync()}</span>
      )}
    </div>
  );
}

export default OfflineStatusBar;
