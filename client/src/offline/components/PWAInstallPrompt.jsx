/**
 * Componente de prompt para instalar la PWA
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, Smartphone, MoreVertical } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export function PWAInstallPrompt() {
  const { isInstallable, isInstalled, hasNativePrompt, promptInstall, dismissInstall } = usePWAInstall();
  const [showManualGuide, setShowManualGuide] = useState(false);

  if (!isInstallable || isInstalled) return null;

  const handleInstallClick = async () => {
    const res = await promptInstall();
    if (res?.manual) {
      setShowManualGuide(true);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 50 }}
        className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50"
      >
        <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center flex-shrink-0">
              <Smartphone className="w-6 h-6 text-white" />
            </div>
            
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-white">
                Instalar Miss Chulerías
              </h3>
              <p className="text-sm text-slate-400 mt-1">
                Instalá la app para abrir directo en pantalla completa y trabajar sin conexión.
              </p>
              
              {showManualGuide ? (
                <div className="mt-3 p-2.5 bg-slate-800 rounded-xl text-xs text-slate-300 border border-slate-700">
                  <p className="font-medium text-pink-400 mb-1">Para completar la instalación:</p>
                  <p>Tocá los <strong>3 puntos (⋮)</strong> arriba a la derecha de Chrome y seleccioná <strong>"Instalar aplicación"</strong> o <strong>"Agregar a pantalla principal"</strong>.</p>
                </div>
              ) : (
                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={handleInstallClick}
                    className="flex items-center gap-2 px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-lg font-medium transition-colors text-sm"
                  >
                    <Download className="w-4 h-4" />
                    Instalar
                  </button>
                  <button
                    onClick={dismissInstall}
                    className="px-4 py-2 text-slate-400 hover:text-white transition-colors text-sm"
                  >
                    Ahora no
                  </button>
                </div>
              )}
            </div>
            
            <button
              onClick={dismissInstall}
              className="p-1 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Indicadores de beneficios */}
          <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-slate-800">
            <div className="text-center">
              <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center mx-auto mb-1">
                <span className="w-2 h-2 rounded-full bg-green-500" />
              </div>
              <p className="text-[10px] text-slate-400">Acceso rápido</p>
            </div>
            <div className="text-center">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center mx-auto mb-1">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
              </div>
              <p className="text-[10px] text-slate-400">Funciona offline</p>
            </div>
            <div className="text-center">
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center mx-auto mb-1">
                <span className="w-2 h-2 rounded-full bg-purple-500" />
              </div>
              <p className="text-[10px] text-slate-400">Sin descargas</p>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default PWAInstallPrompt;
