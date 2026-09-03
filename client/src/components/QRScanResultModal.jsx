import React from 'react';
import { 
  CheckCircle2, 
  ArrowLeftRight, 
  ShoppingBag, 
  Package, 
  Layers, 
  Calendar, 
  User, 
  FileText, 
  DollarSign, 
  X 
} from 'lucide-react';
import { cn } from '../lib/utils';

/**
 * Modal informativo de confirmación y desglose post-escaneo QR
 * Muestra detalladamente la lista de operaciones, productos, notas y rutas sincronizadas.
 */
export default function QRScanResultModal({ isOpen, onClose, scanResult }) {
  if (!isOpen || !scanResult) return null;

  const { type, data, isOffline = false, count = 1, message = '' } = scanResult;

  const isTransfer = type === 'TRF' || (!type && data?.src && data?.tgt);
  const isSale = type === 'SALE' || (!type && data?.total !== undefined);
  const isBundle = type === 'BUNDLE' || (!type && (data?.sales || data?.transfers));

  const itemsList = isTransfer ? (data?.items || []) : (isSale ? (data?.items || []) : []);
  const totalUnits = itemsList.reduce((acc, it) => acc + (Number(it.qty || it.quantity) || 1), 0);

  const getInventoryLabel = (id) => {
    if (!id) return '-';
    const clean = id.toLowerCase();
    if (clean === 'alm' || clean === 'almacen') return 'Almacén Central';
    if (clean === 'mch1' || clean === 'mch 1') return 'Kiosco MCH 1';
    if (clean === 'mch2' || clean === 'mch 2') return 'Kiosco MCH 2';
    return id.toUpperCase();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header con gradiente */}
        <div className="p-5 bg-gradient-to-r from-slate-900 via-emerald-950/40 to-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
              <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Actualización QR Exitosa</h3>
              <p className="text-xs text-emerald-400 font-medium">
                {isOffline ? '⚡ Guardado localmente en tu dispositivo' : '🟢 Sincronizado con el servidor central'}
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

        {/* Cuerpo con Scroll */}
        <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar flex-1">
          
          {/* Mensaje descriptivo */}
          {message && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-xs text-emerald-300">
              {message}
            </div>
          )}

          {/* Tarjeta de Tipo de Operación */}
          <div className="p-4 bg-slate-800/60 border border-slate-700/70 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isTransfer && <ArrowLeftRight className="w-4 h-4 text-cyan-400" />}
                {isSale && <ShoppingBag className="w-4 h-4 text-pink-400" />}
                {isBundle && <Layers className="w-4 h-4 text-amber-400" />}
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  {isTransfer ? 'Traslado de Mercancía' : isSale ? 'Registro de Venta' : 'Paquete Masivo QR'}
                </span>
              </div>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-700 text-slate-300 font-mono">
                ID: {data?.id || 'N/A'}
              </span>
            </div>

            {/* Metadatos de Traslado */}
            {isTransfer && (
              <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-700/50">
                <div>
                  <span className="text-slate-400 block">Origen:</span>
                  <span className="font-semibold text-slate-200">{getInventoryLabel(data?.src || data?.from_inventory)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Destino:</span>
                  <span className="font-semibold text-cyan-300">{getInventoryLabel(data?.tgt || data?.to_inventory)}</span>
                </div>
              </div>
            )}

            {/* Metadatos de Venta */}
            {isSale && (
              <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-700/50">
                <div>
                  <span className="text-slate-400 block">Vendedor:</span>
                  <span className="font-semibold text-slate-200">{data?.seller || 'Vendedor'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Total Cobrado:</span>
                  <span className="font-bold text-emerald-400">${Number(data?.total || 0).toFixed(2)} CUP</span>
                </div>
              </div>
            )}

            {/* Fecha y Usuario */}
            <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400 pt-1">
              {data?.date && (
                <div className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span>{new Date(data.date).toLocaleString('es-ES')}</span>
                </div>
              )}
              {data?.user && (
                <div className="flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  <span>Emisor: {data.user}</span>
                </div>
              )}
            </div>

            {/* Comentarios / Notas */}
            {(data?.notes || data?.note) && (
              <div className="p-2.5 bg-slate-900/60 border border-slate-700/50 rounded-xl text-xs space-y-1">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1">
                  <FileText className="w-3 h-3 text-amber-400" /> Comentario / Nota:
                </span>
                <p className="text-slate-200 italic">"{data.notes || data.note}"</p>
              </div>
            )}
          </div>

          {/* Desglose de Productos */}
          {itemsList.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300 px-1">
                <span className="flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-cyan-400" />
                  Productos actualizados ({itemsList.length})
                </span>
                <span className="text-slate-400">{totalUnits} unidades totales</span>
              </div>

              <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                {itemsList.map((item, idx) => {
                  const qty = item.qty || item.quantity || 1;
                  const price = item.price || item.sale_price || 0;
                  const cost = item.cost || item.cost_price || 0;

                  return (
                    <div 
                      key={idx}
                      className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/50 flex items-center justify-between text-xs hover:bg-slate-800/70 transition-colors"
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <p className="text-white font-medium truncate">
                          {item.name || item.product_name || `Producto #${item.pid || item.id}`}
                        </p>
                        {item.sku && (
                          <p className="text-[10px] text-slate-400 font-mono">SKU: {item.sku}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-right">
                        <span className="px-2 py-0.5 rounded-lg bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-bold">
                          x{qty}
                        </span>
                        {price > 0 && (
                          <span className="text-slate-300 font-medium">
                            ${(price * qty).toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Desglose para Paquetes Masivos (Bundle) */}
          {isBundle && (
            <div className="p-3 bg-slate-800/40 border border-slate-700/50 rounded-2xl space-y-2 text-xs">
              <span className="font-semibold text-slate-300">Contenido del Paquete:</span>
              <ul className="list-disc list-inside space-y-1 text-slate-400">
                {data?.sales?.length > 0 && (
                  <li><strong className="text-pink-400">{data.sales.length}</strong> Ventas aplicadas al historial.</li>
                )}
                {data?.transfers?.length > 0 && (
                  <li><strong className="text-cyan-400">{data.transfers.length}</strong> Traslados de inventario ingresados.</li>
                )}
              </ul>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/80 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-semibold text-xs shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
          >
            Aceptar y Continuar
          </button>
        </div>

      </div>
    </div>
  );
}
