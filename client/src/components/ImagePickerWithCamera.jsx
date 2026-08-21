import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, RefreshCw, X, Check, Image as ImageIcon, VideoOff, Upload, Trash2, Crop as CropIcon, ZoomIn } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Cropper from 'react-easy-crop';
import { cn } from '../lib/utils';
import { getAdaptiveImageUrl } from '../lib/imageUtils';

// Helper para crear imagen y obtener Blob recortado
const createImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = url;
  });

async function getCroppedImg(imageSrc, pixelCrop) {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) return null;

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob);
    }, 'image/jpeg', 0.92);
  });
}

/**
 * ImagePickerWithCamera
 * Componente unificado para carga de imágenes con:
 * - Selección de archivo o cámara en vivo.
 * - Reencuadre y zoom interactivo (Cropper) antes de subir.
 * - Soporte adaptativo de conexión y optimización visual.
 */
export default function ImagePickerWithCamera({
  label,
  subLabel,
  value,
  onChange,
  onRemove,
  type = 'media', // 'dni_front', 'dni_back', 'avatar'
  aspectRatio = 'video', // 'video' (carnet ~16:10 / 1.58), 'square' (avatar 1:1)
  uploadApiEndpoint = '/users/upload-media'
}) {
  const [uploading, setUploading] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);

  // Estados de Crop / Reencuadre
  const [tempImageForCrop, setTempImageForCrop] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const isAvatar = aspectRatio === 'square' || type === 'avatar';
  const cropAspect = isAvatar ? 1 : 1.58; // Proporción tarjeta carnet 85.6mm x 53.98mm ~ 1.58

  // Detener cámara
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  // Iniciar cámara
  const startCamera = async (deviceId = null) => {
    setCameraError(null);
    stopCamera();

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Tu navegador o dispositivo no soporta acceso directo a la cámara.');
      }

      const constraints = {
        video: deviceId 
          ? { deviceId: { exact: deviceId } } 
          : { facingMode: { ideal: isAvatar ? 'user' : 'environment' } },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(e => console.warn('Video play error:', e));
      }

      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevs = allDevices.filter(d => d.kind === 'videoinput');
      setDevices(videoDevs);
      if (!deviceId && videoDevs.length > 0) {
        setSelectedDeviceId(videoDevs[0].deviceId);
      }
    } catch (err) {
      console.error('Camera error:', err);
      setCameraError(err.message || 'No se pudo acceder a la cámara. Revisa los permisos.');
    }
  };

  useEffect(() => {
    if (cameraOpen) {
      startCamera(selectedDeviceId);
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [cameraOpen, selectedDeviceId]);

  // Capturar frame del video y abrir Cropper
  const takeSnapshot = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    stopCamera();
    setCameraOpen(false);
    
    // Abrir modal de reencuadre
    setTempImageForCrop(dataUrl);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  };

  const onCropComplete = useCallback((croppedArea, pixels) => {
    setCroppedAreaPixels(pixels);
  }, []);

  // Guardar recorte y subir
  const handleCropSaveAndUpload = async () => {
    try {
      if (!tempImageForCrop || !croppedAreaPixels) return;
      setUploading(true);
      const croppedBlob = await getCroppedImg(tempImageForCrop, croppedAreaPixels);
      const file = new File([croppedBlob], `crop_${type}_${Date.now()}.jpg`, { type: 'image/jpeg' });
      
      setTempImageForCrop(null);
      await uploadFile(file);
    } catch (e) {
      console.error('Error aplicando recorte:', e);
      alert('No se pudo procesar el recorte de la imagen.');
    } finally {
      setUploading(false);
    }
  };

  // Subir archivo al servidor
  const uploadFile = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);

      const res = await window.fetch(`http://localhost:3002/api${uploadApiEndpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: formData
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al subir la imagen');

      onChange(data.url);
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Por favor selecciona un archivo de imagen válido.');
        return;
      }
      // Cargar en cropper para reencuadre
      const objectUrl = URL.createObjectURL(file);
      setTempImageForCrop(objectUrl);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      e.target.value = '';
    }
  };

  const displayImageUrl = getAdaptiveImageUrl(value);

  return (
    <div className="w-full">
      {/* 1. MODO AVATAR / FOTO DE PERFIL */}
      {isAvatar ? (
        <div className="flex flex-col sm:flex-row items-center gap-5 p-4 rounded-2xl bg-slate-800/40 border border-slate-700/60">
          {/* Avatar Circular */}
          <div className="relative group flex-shrink-0">
            <div className="w-24 h-24 rounded-full overflow-hidden bg-slate-900 border-2 border-slate-700 shadow-inner flex items-center justify-center">
              {uploading ? (
                <RefreshCw className="w-6 h-6 text-cyan-400 animate-spin" />
              ) : value ? (
                <img 
                  src={displayImageUrl} 
                  alt={label}
                  className="w-full h-full object-cover"
                />
              ) : (
                <ImageIcon className="w-8 h-8 text-slate-600" />
              )}
            </div>

            {value && onRemove && (
              <button
                type="button"
                onClick={onRemove}
                className="absolute -top-1 -right-1 p-1 bg-rose-600 hover:bg-rose-500 text-white rounded-full shadow-lg transition-transform hover:scale-110"
                title="Eliminar foto"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Textos y Acciones */}
          <div className="flex-1 text-center sm:text-left space-y-2">
            <div>
              <h4 className="text-sm font-bold text-white">{label}</h4>
              {subLabel && <p className="text-xs text-slate-400 mt-0.5">{subLabel}</p>}
            </div>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
              <button
                type="button"
                onClick={() => setCameraOpen(true)}
                disabled={uploading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 border border-cyan-500/40 text-xs font-semibold shadow-sm transition-all"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Usar Cámara</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 text-xs font-semibold shadow-sm transition-all"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Subir Foto</span>
              </button>

              {value && (
                <button
                  type="button"
                  onClick={() => {
                    const fullSrc = value.startsWith('http') ? value : `http://localhost:3002${value.startsWith('/') ? '' : '/'}${value}`;
                    setTempImageForCrop(fullSrc);
                    setCrop({ x: 0, y: 0 });
                    setZoom(1);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 text-xs font-semibold shadow-sm transition-all"
                >
                  <CropIcon className="w-3.5 h-3.5" />
                  <span>Reencuadrar</span>
                </button>
              )}

              {value && onRemove && (
                <button
                  type="button"
                  onClick={onRemove}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-rose-400 hover:bg-rose-500/10 text-xs transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Quitar</span>
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* 2. MODO DOCUMENTO / CARNET DE IDENTIDAD (Rectangular y estilizado) */
        <div className="rounded-2xl bg-slate-800/40 border border-slate-700/60 overflow-hidden flex flex-col">
          {/* Header de la tarjeta del carnet */}
          <div className="px-4 py-3 bg-slate-800/70 border-b border-slate-700/60 flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-white tracking-wide">{label}</h4>
              {subLabel && <p className="text-[11px] text-slate-400 mt-0.5">{subLabel}</p>}
            </div>

            {value && onRemove && (
              <button
                type="button"
                onClick={onRemove}
                className="text-xs text-rose-400 hover:text-rose-300 hover:underline flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                <span>Borrar</span>
              </button>
            )}
          </div>

          {/* Cuerpo de la tarjeta / Preview */}
          <div className="p-4 flex flex-col items-center justify-center min-h-[160px] bg-slate-900/30">
            {uploading ? (
              <div className="flex flex-col items-center gap-2 text-cyan-400 py-6">
                <RefreshCw className="w-7 h-7 animate-spin" />
                <span className="text-xs font-medium">Subiendo y optimizando imagen...</span>
              </div>
            ) : value ? (
              <div className="relative w-full rounded-xl overflow-hidden border border-slate-700 group bg-black/40 flex items-center justify-center">
                <img 
                  src={displayImageUrl} 
                  alt={label}
                  className="w-full h-44 object-contain"
                />
                <div className="absolute inset-0 bg-slate-950/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-wrap items-center justify-center gap-2 p-2">
                  <button
                    type="button"
                    onClick={() => {
                      const fullSrc = value.startsWith('http') ? value : `http://localhost:3002${value.startsWith('/') ? '' : '/'}${value}`;
                      setTempImageForCrop(fullSrc);
                      setCrop({ x: 0, y: 0 });
                      setZoom(1);
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg transition-transform hover:scale-105"
                  >
                    <CropIcon className="w-4 h-4" />
                    <span>Reencuadrar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCameraOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-white text-xs font-bold shadow-lg transition-transform hover:scale-105"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Tomar Otra</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold shadow-lg transition-transform hover:scale-105"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Cambiar Archivo</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center text-center py-4 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500 shadow-sm">
                  <ImageIcon className="w-6 h-6" />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCameraOpen(true)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 border border-cyan-500/40 text-xs font-semibold shadow-sm transition-all"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Tomar Foto</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 text-xs font-semibold shadow-sm transition-all"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Subir Archivo</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Input nativo oculto */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Modal de Cámara en Vivo */}
      <AnimatePresence>
        {cameraOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
                <div className="flex items-center gap-2">
                  <Camera className="w-5 h-5 text-cyan-400" />
                  <h3 className="text-sm font-bold text-white">Capturar: {label}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setCameraOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="relative bg-black flex items-center justify-center min-h-[300px] max-h-[60vh] overflow-hidden">
                {cameraError ? (
                  <div className="p-6 text-center text-rose-400 flex flex-col items-center gap-2">
                    <VideoOff className="w-8 h-8" />
                    <p className="text-xs">{cameraError}</p>
                    <button
                      type="button"
                      onClick={() => startCamera(selectedDeviceId)}
                      className="mt-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs"
                    >
                      Reintentar
                    </button>
                  </div>
                ) : (
                  <>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    {/* Guía visual */}
                    <div className={cn(
                      "absolute inset-0 border-2 border-dashed border-cyan-400/50 pointer-events-none flex items-center justify-center",
                      isAvatar ? "m-12 rounded-full" : "m-6 rounded-2xl"
                    )}>
                      <span className="bg-black/60 px-3 py-1 rounded-full text-[10px] text-cyan-300 backdrop-blur-sm">
                        Encuadra {label} aquí
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Controles de Disparo */}
              <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between gap-4">
                {devices.length > 1 ? (
                  <select
                    value={selectedDeviceId || ''}
                    onChange={(e) => setSelectedDeviceId(e.target.value)}
                    className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-xl px-2.5 py-2 focus:outline-none focus:border-cyan-500 max-w-[150px] truncate"
                  >
                    {devices.map((d, i) => (
                      <option key={d.deviceId || i} value={d.deviceId}>
                        {d.label || `Cámara ${i + 1}`}
                      </option>
                    ))}
                  </select>
                ) : <div />}

                <button
                  type="button"
                  onClick={takeSnapshot}
                  disabled={!!cameraError}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-bold shadow-lg shadow-cyan-500/25 transition-all disabled:opacity-50"
                >
                  <Camera className="w-4 h-4" />
                  <span>Capturar Foto</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCameraOpen(false)}
                  className="px-3 py-2 rounded-xl text-xs text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Reencuadre y Zoom (Cropper) */}
      <AnimatePresence>
        {tempImageForCrop && (
          <div className="fixed inset-0 z-[110] bg-black/90 backdrop-blur-md flex flex-col">
            {/* Header */}
            <div className="p-4 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <CropIcon className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-bold">Ajustar y Reencuadrar {label}</h3>
              </div>
              <button
                type="button"
                onClick={() => setTempImageForCrop(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Canvas de Crop */}
            <div className="relative flex-1 bg-black overflow-hidden">
              <Cropper
                image={tempImageForCrop}
                crop={crop}
                zoom={zoom}
                aspect={cropAspect}
                cropShape={isAvatar ? 'round' : 'rect'}
                showGrid={true}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
              />
            </div>

            {/* Barra de Controles y Zoom */}
            <div className="bg-slate-950/95 p-5 border-t border-slate-800 flex flex-col gap-4">
              <div className="flex items-center gap-4 max-w-md mx-auto w-full">
                <ZoomIn className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span className="text-xs font-semibold text-slate-300">Zoom</span>
                <input
                  type="range"
                  value={zoom}
                  min={1}
                  max={3.5}
                  step={0.05}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-full accent-indigo-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
                <span className="text-xs font-mono text-slate-400 min-w-[32px]">
                  {zoom.toFixed(1)}x
                </span>
              </div>

              <div className="flex justify-between items-center gap-4 max-w-md mx-auto w-full pt-1">
                <button
                  type="button"
                  onClick={() => setTempImageForCrop(null)}
                  className="flex-1 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold text-xs transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCropSaveAndUpload}
                  disabled={uploading}
                  className="flex-1 py-2.5 px-4 bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-400 hover:to-blue-500 text-white rounded-xl font-bold text-xs shadow-lg shadow-indigo-500/25 transition-all flex justify-center items-center gap-2"
                >
                  {uploading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  <span>{uploading ? 'Guardando...' : 'Aplicar y Guardar'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
