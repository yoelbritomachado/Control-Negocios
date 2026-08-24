/**
 * Hook para manejar la instalación de la PWA
 */

import { useState, useEffect, useCallback } from 'react';

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Verificar si ya está instalada
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // Si no está en standalone, mostrar el prompt siempre en navegadores móviles/escritorio
    const dismissed = sessionStorage.getItem('pwa_prompt_dismissed');
    if (!dismissed) {
      setIsInstallable(true);
    }

    // Escuchar el evento nativo beforeinstallprompt si el navegador lo dispara
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    // Escuchar cuando la app se instala
    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsInstallable(false);
      setIsInstalled(true);
      sessionStorage.removeItem('pwa_prompt_dismissed');
      console.log('[PWA] App instalada correctamente');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setIsInstallable(false);
        return { success: true };
      } else {
        return { success: false, error: 'Instalación cancelada' };
      }
    }
    return { success: false, manual: true };
  }, [deferredPrompt]);

  const dismissInstall = useCallback(() => {
    sessionStorage.setItem('pwa_prompt_dismissed', 'true');
    setIsInstallable(false);
  }, []);

  return {
    isInstallable,
    isInstalled,
    hasNativePrompt: !!deferredPrompt,
    promptInstall,
    dismissInstall
  };
}

export default usePWAInstall;
