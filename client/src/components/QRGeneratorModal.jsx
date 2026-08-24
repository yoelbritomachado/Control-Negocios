import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Play, 
  Pause, 
  Copy, 
  Check, 
  QrCode,
  Layers,
  Sparkles,
  Info
} from 'lucide-react';
import { encodeMultiQR } from '../lib/qrOfflineService';

/**
 * Modal generador de QR con soporte para Multi-QR y Carrusel
 */
export default function QRGeneratorModal({ 
  isOpen, 
  onClose, 
  title = 'Código QR Offline', 
  subtitle = 'Escanear desde el otro dispositivo',
  type = 'TRF', 
  payload = null 
}) {
  const [frames, setFrames] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [autoPlay, setAutoPlay] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && payload) {
      try {
        const encodedFrames = encodeMultiQR(type, payload);
        setFrames(encodedFrames);
        setCurrentIndex(0);
        // Si son varios frames, activar autoPlay por defecto a velocidad cómoda
        if (encodedFrames.length > 1) {
          setAutoPlay(true);
        } else {
          setAutoPlay(false);
        }
      } catch (err) {
        console.error('Error generando frames QR:', err);
      }
    }
  }, [isOpen, type, payload]);

  // Manejo del carrusel automático
  useEffect(() => {
    let interval = null;
    if (autoPlay && frames.length > 1) {
      interval = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % frames.length);
      }, 1800); // 1.8 segundos por frame es ideal para cámaras de tablets
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoPlay, frames.length]);

  if (!isOpen || !payload || frames.length === 0) return null;

  const currentFrame = frames[currentIndex] || '';
  const isMulti = frames.length > 1;

  const handlePrev = () => {
    setAutoPlay(false);
    setCurrentIndex((prev) => (prev === 0 ? frames.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setAutoPlay(false);
    setCurrentIndex((prev) => (prev + 1) % frames.length);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(currentFrame);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-gradient-to-tr from-pink-500/20 to-purple-500/20 rounded-xl border border-pink-500/30 text-pink-400">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-wide">{title}</h3>
              <p className="text-xs text-slate-400">{subtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido QR */}
        <div className="p-6 flex flex-col items-center justify-center bg-slate-950/60">
          
          {/* Tarjeta con fondo blanco puro para máximo contraste de escaneo */}
          <div className="p-4 bg-white rounded-2xl shadow-inner flex items-center justify-center border-4 border-pink-500/20">
            <QRCodeSVG
              value={currentFrame}
              size={240}
              level="M"
              includeMargin={false}
            />
          </div>

          {/* Indicador Multi-QR */}
          {isMulti && (
            <div className="mt-4 w-full flex flex-col items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1 bg-pink-500/10 border border-pink-500/30 rounded-full text-pink-400 text-xs font-semibold">
                <Layers className="w-3.5 h-3.5" />
                <span>Fragmento {currentIndex + 1} de {frames.length}</span>
              </div>

              {/* Barra de progreso de frames */}
              <div className="flex gap-1.5 mt-1">
                {frames.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setAutoPlay(false);
                      setCurrentIndex(idx);
                    }}
                    className={`h-1.5 rounded-full transition-all ${
                      idx === currentIndex 
                        ? 'w-6 bg-pink-500' 
                        : 'w-2 bg-slate-700 hover:bg-slate-600'
                    }`}
                  />
                ))}
              </div>

              {/* Controles de navegación */}
              <div className="flex items-center gap-3 mt-2">
                <button
                  onClick={handlePrev}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-colors border border-slate-700"
                  title="Anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setAutoPlay(!autoPlay)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors border ${
                    autoPlay 
                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 hover:bg-amber-500/30' 
                      : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                  }`}
                >
                  {autoPlay ? (
                    <>
                      <Pause className="w-3.5 h-3.5" /> Pausar
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" /> Carrusel
                    </>
                  )}
                </button>
                <button
                  onClick={handleNext}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-colors border border-slate-700"
                  title="Siguiente"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Información y tips */}
          <div className="mt-4 flex items-start gap-2 p-3 bg-slate-800/60 border border-slate-700/50 rounded-xl text-xs text-slate-300 w-full">
            <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <span>
              {isMulti 
                ? 'Apuntá con la cámara del otro dispositivo. La app detectará los fragmentos automáticamente hasta completar el 100%.'
                : 'Apuntá con la cámara del otro dispositivo para transferir los datos al instante sin internet.'}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-900 flex justify-between items-center">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors py-1.5 px-2.5 rounded-lg hover:bg-slate-800"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copiado' : 'Copiar código crudo'}
          </button>
          
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition-colors border border-slate-700"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
}
