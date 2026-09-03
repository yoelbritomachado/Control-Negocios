import React, { useState, useEffect } from 'react';
import { 
  RefreshCw, 
  Wifi, 
  WifiOff, 
  QrCode, 
  Camera, 
  Upload, 
  Download, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  ArrowRight,
  Sparkles,
  Layers
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api, { fetchProducts } from '../api';
import { 
  getPendingSales, 
  getPendingTransfers, 
  markSaleSynced, 
  markTransferSynced, 
  saveProductsLocal, 
  getPendingCounts,
  clearAllPendingOperations,
  deletePendingSale,
  savePendingSale,
  savePendingTransfer,
  applyLocalTransferStock
} from '../lib/localDB';
import QRGeneratorModal from './QRGeneratorModal';
import QRScannerModal from './QRScannerModal';
import QRScanResultModal from './QRScanResultModal';
import {
  encodeMultiQR,
  prepareSaleQRPayload, 
  prepareTransferQRPayload 
} from '../lib/qrOfflineService';
import { performFullSync, subscribeSyncEvents } from '../lib/autoSyncEngine';
import { recordLog } from '../lib/telemetryLogger';

export default function UnifiedSyncModal({ isOpen, onClose, isOnline, onSyncComplete }) {
  const [activeTab, setActiveTab] = useState('auto'); // 'auto' | 'qr_export' | 'qr_import'
  const [loading, setLoading] = useState(false);
  const [pendingStats, setPendingStats] = useState({ salesCount: 0, transfersCount: 0, totalPending: 0 });
  const [pendingSalesList, setPendingSalesList] = useState([]);
  const [statusMessage, setStatusMessage] = useState(null);
  
  // Modales de QR
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrPayload, setQrPayload] = useState(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanResultDetails, setScanResultDetails] = useState(null);

  const loadPending = async () => {
    try {
      const counts = await getPendingCounts();
      setPendingStats(counts);
      const sales = await getPendingSales();
      setPendingSalesList(sales || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleClearAll = async () => {
    if (window.confirm('¿Deseas descartar todas las operaciones pendientes locales? (Usar solo si ya fueron asentadas o son pruebas)')) {
      await clearAllPendingOperations();
      await loadPending();
      setStatusMessage({ type: 'info', text: 'Operaciones locales pendientes descartadas.' });
    }
  };

  const handleDeleteOne = async (localId) => {
    await deletePendingSale(localId);
    await loadPending();
  };

  useEffect(() => {
    if (isOpen) {
      loadPending();
      setStatusMessage(null);
    }
  }, [isOpen]);

  useEffect(() => {
    const unsubscribe = subscribeSyncEvents((event) => {
      if (event.type === 'complete' || event.type === 'start') {
        loadPending();
      }
    });
    return () => unsubscribe();
  }, []);

  if (!isOpen) return null;

  // --- SINCRONIZACIÓN AUTOMÁTICA POR INTERNET / RED ---
  const handleInternetSync = async () => {
    setLoading(true);
    setStatusMessage({ type: 'info', text: 'Sincronizando operaciones con el servidor...' });

    try {
      const result = await performFullSync(false);
      await loadPending();

      if (result.success && (result.salesUploaded > 0 || result.transfersUploaded > 0)) {
        setStatusMessage({
          type: 'success',
          text: `¡Sincronización exitosa! ${result.salesUploaded} venta(s) y ${result.transfersUploaded} traslado(s) subidos. Catálogo actualizado.`
        });
      } else if (result.success && result.salesUploaded === 0 && result.transfersUploaded === 0 && result.remainingPending === 0) {
        setStatusMessage({
          type: 'success',
          text: `¡Todo sincronizado! No quedan operaciones pendientes. Catálogo actualizado.`
        });
      } else {
        const detail = (result.errors && result.errors.length > 0) ? ` Errores: ${result.errors.join(' | ')}` : '';
        setStatusMessage({
          type: 'danger',
          text: `Error en sincronización: ${result.error || 'Algunas operaciones no pudieron subirse.'}${detail}`
        });
      }

      if (onSyncComplete) onSyncComplete();
    } catch (err) {
      setStatusMessage({
        type: 'danger',
        text: 'Error al conectar con el servidor: ' + (err.response?.data?.error || err.message)
      });
    } finally {
      setLoading(false);
    }
  };

  // --- GENERAR PAQUETE GLOBAL QR (PANTALLA A PANTALLA) ---
  const handleGenerateGlobalQR = async () => {
    setLoading(true);
    try {
      const pendingSales = await getPendingSales();
      const pendingTransfers = await getPendingTransfers();

      if (pendingSales.length === 0 && pendingTransfers.length === 0) {
        setStatusMessage({
          type: 'warning',
          text: 'No tenés operaciones offline pendientes para transmitir por QR.'
        });
        setLoading(false);
        return;
      }

      const bundle = {
        type: 'MCH_BUNDLE',
        created_at: new Date().toISOString(),
        sales: pendingSales.map(s => ({
          id: s.local_id,
          total: s.total,
          method: s.payment_method,
          cash: s.cash_amount,
          transfer: s.transfer_amount,
          items: (s.items || []).map(i => ({
            id: i.product_id || i.id,
            qty: i.quantity,
            price: i.sale_price_manual || i.price
          }))
        })),
        transfers: pendingTransfers
      };

      const payload = encodeMultiQR('BUNDLE', bundle);
      setQrPayload(payload);
      setQrModalOpen(true);
    } catch (err) {
      console.error(err);
      setStatusMessage({ type: 'danger', text: 'Error empaquetando datos QR: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  // --- PROCESAR ESCANEO DE PAQUETE QR ---
  const handleScanSuccess = async (scannedData, rawType = null) => {
    setScannerOpen(false);
    setLoading(true);
    setStatusMessage({ type: 'info', text: 'Procesando paquete QR recibido...' });

    try {
      // Normalizar tipo y datos (soporta tanto (data, type) como ({type, data}))
      let type = rawType || scannedData?.type;
      let data = scannedData?.data !== undefined ? scannedData.data : scannedData;

      // Si aún no detectó el tipo por metadata, inferirlo por la estructura del objeto
      if (!type) {
        if (data?.sales || data?.transfers) type = 'BUNDLE';
        else if (data?.src && data?.tgt && data?.items) type = 'TRF';
        else if (data?.total !== undefined && (data?.seller || data?.method || data?.code)) type = 'SALE';
      }

      recordLog('info', 'QR_UNIFIED_SCAN_DETECTED', `Procesando QR de tipo ${type}`, { type, data });

      if (type === 'BUNDLE') {
        const { sales = [], transfers = [] } = data || {};
        let count = 0;

        for (const s of sales) {
          try {
            await api.post('/sales/qr-import', { qrData: s, action: 'apply' }, { timeout: 2500 });
            count++;
          } catch (e) {
            // Si está offline o da timeout, guardarlo en la base local del móvil
            await savePendingSale(s);
            count++;
          }
        }

        for (const t of transfers) {
          try {
            await api.post('/transfers/qr-import', { qrData: t, action: 'apply' }, { timeout: 2500 });
            count++;
          } catch (e) {
            const trfRecord = {
              ...t,
              status: 'received',
              is_received: true
            };
            await savePendingTransfer(trfRecord);
            await applyLocalTransferStock(trfRecord, true);
            count++;
          }
        }

        setScanResultDetails({
          type: 'BUNDLE',
          data,
          count,
          isOffline: !navigator.onLine,
          message: `¡Paquete QR absorbido con éxito! Se procesaron ${count} operaciones.`
        });
      } else if (type === 'TRF') {
        try {
          const res = await api.post('/transfers/qr-import', { qrData: data, action: 'apply' }, { timeout: 2500 });
          setScanResultDetails({
            type: 'TRF',
            data,
            isOffline: false,
            message: `¡Traslado QR recibido en servidor! ${res.data?.message || 'Inventario actualizado.'}`
          });
        } catch (netErr) {
          console.warn('[QR] Backend no disponible, guardando traslado en base local:', netErr.message);
          const trfRecord = {
            ...data,
            status: 'received',
            is_received: true
          };
          await savePendingTransfer(trfRecord);
          await applyLocalTransferStock(trfRecord, true);
          setScanResultDetails({
            type: 'TRF',
            data: trfRecord,
            isOffline: true,
            message: '⚠️ Modo Offline: Traslado QR absorbido localmente en tu dispositivo. Tu stock y este historial ya fueron actualizados.'
          });
        }
      } else if (type === 'SALE') {
        try {
          const res = await api.post('/sales/qr-import', { qrData: data, action: 'apply' }, { timeout: 2500 });
          setScanResultDetails({
            type: 'SALE',
            data,
            isOffline: false,
            message: `¡Venta QR recibida en servidor! ${res.data?.message || 'Registrada en el sistema.'}`
          });
        } catch (netErr) {
          console.warn('[QR] Backend no disponible, guardando venta en base local:', netErr.message);
          await savePendingSale(data);
          setScanResultDetails({
            type: 'SALE',
            data,
            isOffline: true,
            message: '⚠️ Modo Offline: Venta QR absorbida y guardada localmente en tu dispositivo.'
          });
        }
      } else {
        throw new Error('Formato de QR no reconocido');
      }

      if (onSyncComplete) onSyncComplete();
    } catch (err) {
      recordLog('error', 'QR_UNIFIED_SCAN_ERROR', 'Error al procesar QR', { error: err.message, scannedData });
      setStatusMessage({
        type: 'danger',
        text: 'Error aplicando los datos del QR: ' + (err.response?.data?.error || err.message)
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-slate-900 via-blue-950/40 to-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <RefreshCw className={loading ? "w-5 h-5 text-white animate-spin" : "w-5 h-5 text-white"} />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Centro de Sincronización</h3>
              <p className="text-xs text-slate-400">
                {isOnline ? '🟢 En línea con el servidor central' : '🟠 Sin conexión (Modo Cuba Offline)'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido Principal */}
        <div className="p-6 space-y-5">
          {/* Tarjeta de Resumen de Pendientes */}
          <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/80 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Operaciones Locales
              </span>
              <p className="text-xl font-bold text-white">
                {pendingStats.totalPending}{' '}
                <span className="text-sm font-normal text-slate-400">pendientes de asentar</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-xl text-xs bg-pink-500/10 border border-pink-500/30 text-pink-400 font-medium">
                {pendingStats.salesCount} Ventas
              </span>
              <span className="px-2.5 py-1 rounded-xl text-xs bg-blue-500/10 border border-blue-500/30 text-blue-400 font-medium">
                {pendingStats.transfersCount} Traslados
              </span>
              {pendingStats.totalPending > 0 && (
                <button
                  onClick={handleClearAll}
                  className="px-2.5 py-1 rounded-xl text-xs bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-all font-medium active:scale-95 ml-1"
                  title="Descartar pendientes si ya fueron registradas manualmente"
                >
                  Limpiar cola local
                </button>
              )}
            </div>
          </div>

          {/* Mensajes de feedback */}
          {statusMessage && (
            <div className={`p-4 rounded-2xl border flex items-center gap-3 text-sm ${
              statusMessage.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' :
              statusMessage.type === 'danger' ? 'bg-rose-500/10 border-rose-500/30 text-rose-300' :
              statusMessage.type === 'warning' ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' :
              'bg-blue-500/10 border-blue-500/30 text-blue-300'
            }`}>
              {statusMessage.type === 'success' && <CheckCircle2 className="w-5 h-5 shrink-0" />}
              {statusMessage.type === 'danger' && <AlertTriangle className="w-5 h-5 shrink-0" />}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* Lista detallada de pendientes si los hay */}
          {pendingSalesList.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Detalle de Ventas Pendientes
              </span>
              <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                {pendingSalesList.map((s) => (
                  <div key={s.local_id} className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/40 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-semibold text-white">Total: ${Number(s.total || 0).toLocaleString()} <span className="text-slate-400 font-normal">({s.items?.length || 0} items)</span></p>
                      <p className="text-[10px] text-slate-400">{s.local_id} • {s.payment_method || s.method || 'efectivo'}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteOne(s.local_id)}
                      className="px-2 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-colors text-[10px]"
                      title="Eliminar esta venta local"
                    >
                      Descartar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Botón Principal Inteligente */}
          {isOnline ? (
            <button
              onClick={handleInternetSync}
              disabled={loading}
              className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.99] text-white font-bold flex items-center justify-center gap-3 shadow-lg shadow-blue-500/25 transition-all disabled:opacity-50"
            >
              <RefreshCw className={loading ? "w-5 h-5 animate-spin" : "w-5 h-5"} />
              <span>{loading ? 'Sincronizando con Servidor...' : 'Sincronizar Ahora por Internet'}</span>
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-slate-400 font-medium text-center">
                Sincronizá pantalla a pantalla directamente con la cámara y códigos QR:
              </p>
              
              <div className="grid grid-cols-2 gap-3">
                {/* Transmitir QR */}
                <button
                  onClick={handleGenerateGlobalQR}
                  disabled={loading}
                  className="p-4 rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-700 hover:from-indigo-500 hover:to-blue-600 text-white flex flex-col items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 text-center transition-all active:scale-95"
                >
                  <QrCode className="w-7 h-7 text-indigo-200" />
                  <span className="text-sm font-bold">Transmitir Cambios</span>
                  <span className="text-[11px] text-indigo-200/80">Generar Código QR</span>
                </button>

                {/* Recibir / Escanear QR */}
                <button
                  onClick={() => setScannerOpen(true)}
                  disabled={loading}
                  className="p-4 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white flex flex-col items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 text-center transition-all active:scale-95"
                >
                  <Camera className="w-7 h-7 text-emerald-200" />
                  <span className="text-sm font-bold">Recibir Cambios</span>
                  <span className="text-[11px] text-emerald-200/80">Abrir Escáner de Cámara</span>
                </button>
              </div>
            </div>
          )}

          {/* Opciones Secundarias si está online pero quiere usar QR */}
          {isOnline && (
            <div className="pt-2 border-t border-slate-800/80 flex justify-between items-center text-xs">
              <span className="text-slate-400">¿Operar sin internet?</span>
              <div className="flex gap-2">
                <button
                  onClick={handleGenerateGlobalQR}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                >
                  Emitir QR
                </button>
                <button
                  onClick={() => setScannerOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                >
                  Escanear QR
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Generador QR */}
        <QRGeneratorModal
          isOpen={qrModalOpen}
          onClose={() => setQrModalOpen(false)}
          title="Paquete Global de Sincronización"
          subtitle="Mostrá este código al otro dispositivo para asentar los datos"
          type="BUNDLE"
          payload={qrPayload}
        />

        {/* Modal Escáner QR */}
        <QRScannerModal
          isOpen={scannerOpen}
          onClose={() => setScannerOpen(false)}
          onScanSuccess={handleScanSuccess}
          title="Escanear Código de Sincronización"
          subtitle="Apuntá a la pantalla del otro dispositivo"
        />

        {/* Modal de Desglose y Resumen Detallado Post-Escaneo */}
        <QRScanResultModal
          isOpen={!!scanResultDetails}
          onClose={() => setScanResultDetails(null)}
          scanResult={scanResultDetails}
        />
      </div>
    </div>
  );
}
