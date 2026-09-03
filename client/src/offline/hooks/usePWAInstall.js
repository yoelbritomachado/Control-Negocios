/**
 * Hook para manejar la instalación de la PWA
 */

import { useState, useEffect, useCallback } from 'react';

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Verificar si ya está instalada o corriendo como PWA / Standalone
    const isStandalone = 
      window.matchMedia('(display-mode: standalone)').matches || 
      window.matchMedia('(display-mode: fullscreen)').matches ||
      window.navigator.standalone === true ||
      document.referrer.includes('android-app://');

    if (isStandalone) {
      setIsInstalled(true);
      setIsInstallable(false);
      return;
    }

    // Si el usuario ya la instaló o cerró el aviso en este dispositivo, no insistir
    const alreadyInstalled = localStorage.getItem('pwa_installed_confirmed');
    const dismissed = localStorage.getItem('pwa_prompt_dismissed') || sessionStorage.getItem('pwa_prompt_dismissed');
    if (alreadyInstalled || dismissed) {
      setIsInstallable(false);
      return;
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
      localStorage.setItem('pwa_installed_confirmed', 'true');
      localStorage.removeItem('pwa_prompt_dismissed');
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
    localStorage.setItem('pwa_prompt_dismissed', 'true');
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
