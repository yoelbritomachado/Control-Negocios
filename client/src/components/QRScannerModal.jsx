import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { 
  X, 
  Camera, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  Layers, 
  Sparkles,
  Zap
} from 'lucide-react';
import { MultiQRReceiver } from '../lib/qrOfflineService';

/**
 * Modal escáner de QR con cámara y soporte de acumulación Multi-QR
 */
export default function QRScannerModal({ 
  isOpen, 
  onClose, 
  onScanSuccess, 
  title = 'Escanear Código QR', 
  expectedType = null 
}) {
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  const [chunkStatus, setChunkStatus] = useState({ current: 0, total: 1 });
  const [isFinished, setIsFinished] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);

  const scannerRef = useRef(null);
  const receiverRef = useRef(new MultiQRReceiver());
  const qrRegionId = 'html5qr-code-full-region';

  // Sonido y vibración de confirmación
  const triggerHapticSuccess = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([80, 50, 80]);
    }
  };

  useEffect(() => {
    if (isOpen) {
      receiverRef.current.reset();
      setProgress(0);
      setChunkStatus({ current: 0, total: 1 });
      setIsFinished(false);
      setError(null);

      // Iniciar cámara con Html5Qrcode tras montaje
      const timer = setTimeout(() => {
        startCamera();
      }, 300);

      return () => {
        clearTimeout(timer);
        stopCamera();
      };
    } else {
      stopCamera();
    }
  }, [isOpen]);

  const startCamera = async () => {
    try {
      if (scannerRef.current) {
        await stopCamera();
      }

      const html5QrCode = new Html5Qrcode(qrRegionId);
      scannerRef.current = html5QrCode;

      const config = {
        fps: 15,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
      };

      await html5QrCode.start(
        { facingMode: 'environment' }, // Cámara trasera preferente
        config,
        (decodedText) => {
          handleDecodedText(decodedText);
        },
        () => {
          // Frame sin QR, no hacer nada para no saturar consola
        }
      );
      setCameraActive(true);
    } catch (err) {
      console.error('Error al iniciar cámara QR:', err);
      setError('No se pudo acceder a la cámara. Verificá los permisos de tu navegador.');
      setCameraActive(false);
    }
  };

  const stopCamera = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (err) {
        console.warn('Error deteniendo cámara:', err);
      }
      scannerRef.current = null;
      setCameraActive(false);
    }
  };

  const handleDecodedText = (text) => {
    if (isFinished) return;

    const res = receiverRef.current.feed(text);

    if (res.error) {
      setError(res.error);
      setTimeout(() => setError(null), 3000);
      return;
    }

    if (expectedType && res.type && res.type !== expectedType) {
      setError(`Código incorrecto: se esperaba tipo ${expectedType} pero se leyó ${res.type}`);
      setTimeout(() => setError(null), 3000);
      return;
    }

    setProgress(res.progress || 0);
    setChunkStatus({ current: res.current || 1, total: res.total || 1 });

    if (res.isComplete) {
      setIsFinished(true);
      triggerHapticSuccess();
      stopCamera();
      if (onScanSuccess) {
        onScanSuccess(res.data, res.type);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-gradient-to-tr from-cyan-500/20 to-blue-500/20 rounded-xl border border-cyan-500/30 text-cyan-400">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-wide">{title}</h3>
              <p className="text-xs text-slate-400">
                {chunkStatus.total > 1 
                  ? `Recibiendo fragmento ${chunkStatus.current} de ${chunkStatus.total}`
                  : 'Enfocá el código QR del otro dispositivo'}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewport de Cámara */}
        <div className="relative p-6 flex flex-col items-center justify-center bg-slate-950 min-h-[320px]">
          
          <div 
            id={qrRegionId} 
            className="w-full max-w-[280px] aspect-square rounded-2xl overflow-hidden border-2 border-cyan-500/40 bg-black flex items-center justify-center shadow-lg relative"
          />

          {/* Overlay de estado Multi-QR */}
          {chunkStatus.total > 1 && (
            <div className="mt-4 w-full flex flex-col gap-1.5 px-2">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-slate-300 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-pink-400" />
                  Progreso de Escaneo Multi-QR
                </span>
                <span className="text-pink-400 font-bold">{progress}%</span>
              </div>
              <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                <div 
                  className="h-full bg-gradient-to-r from-pink-500 to-purple-500 transition-all duration-300 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-400 text-center mt-0.5">
                Mantené la cámara enfocada mientras pasa el carrusel de QRs
              </p>
            </div>
          )}

          {/* Mensaje de Error */}
          {error && (
            <div className="mt-3 flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 w-full animate-shake">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Mensaje de Éxito */}
          {isFinished && (
            <div className="mt-3 flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 w-full">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>¡Datos leídos y verificados con éxito!</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-900 flex justify-between items-center">
          <button
            onClick={startCamera}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors py-1.5 px-2.5 rounded-lg hover:bg-slate-800"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reiniciar Cámara
          </button>
          
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition-colors border border-slate-700"
          >
            Cancelar
          </button>
        </div>

      </div>
    </div>
  );
}
