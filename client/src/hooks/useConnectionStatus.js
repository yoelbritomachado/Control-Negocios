/**
 * UI-01: Hook de estado de conexión en tiempo real.
 * Combina navigator.onLine con un heartbeat real contra /api/health,
 * igual que hace OfflineProvider, para detectar cortes aunque el
 * navegador siga reportando 'online'.
 */
import { useState, useEffect } from 'react';

export function useConnectionStatus() {
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    let isMounted = true;

    const checkServerHealth = async () => {
      if (!navigator.onLine) {
        if (isMounted) setIsOnline(false);
        return;
      }
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const res = await fetch('/api/health', { signal: controller.signal });
        clearTimeout(timeoutId);
        if (isMounted) setIsOnline(res.ok);
      } catch (_) {
        if (isMounted) setIsOnline(false);
      }
    };

    const handleOnline = () => checkServerHealth();
    const handleOffline = () => { if (isMounted) setIsOnline(false); };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Heartbeat cada 8 segundos (mismo intervalo que OfflineProvider)
    const interval = setInterval(checkServerHealth, 8000);
    checkServerHealth();

    return () => {
      isMounted = false;
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline };
}

export default useConnectionStatus;
