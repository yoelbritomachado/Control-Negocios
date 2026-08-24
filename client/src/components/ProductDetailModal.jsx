import React from 'react';
import { motion } from 'framer-motion';
import { X, Package, Tag, DollarSign, Store, Image as ImageIcon, BarChart2 } from 'lucide-react';
import ProductThumbnail from './ProductThumbnail';

export default function ProductDetailModal({
  product,
  isOpen,
  onClose,
  currentInventory,
  onViewGallery,
  isSeller = false
}) {
  if (!isOpen || !product) return null;

  const stockCurrent = (product.inventory && product.inventory[currentInventory] !== undefined)
    ? product.inventory[currentInventory]
    : (product.quantity ?? product.total_quantity ?? 0);

  const totalStock = product.total_quantity ?? (
    product.inventory 
      ? Object.values(product.inventory).reduce((a, b) => Number(a) + Number(b), 0) 
      : stockCurrent
  );

  const salePrice = product.actual_sale_price ?? product.sale_price_manual ?? 0;
  const images = (Array.isArray(product.images) && product.images.length > 0)
    ? product.images
    : (product.image ? [product.image] : []);

  const labelColors = {
    red: { label: 'Roja', bg: 'bg-red-500/20 text-red-400 border-red-500/30' },
    blue: { label: 'Azul', bg: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    green: { label: 'Verde', bg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
    yellow: { label: 'Amarilla', bg: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
    purple: { label: 'Morada', bg: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
    none: { label: 'Sin etiqueta', bg: 'bg-slate-700/50 text-slate-400 border-slate-600' }
  };

  const currentLabel = labelColors[product.label_color] || labelColors.none;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl relative flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-4 sm:p-5 border-b border-slate-800 bg-slate-900/80 sticky top-0 z-10">
          <div className="flex items-center gap-2 text-cyan-400">
            <BarChart2 className="w-5 h-5" />
            <h3 className="font-bold text-base sm:text-lg text-white">Detalles del Producto</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          {/* Main Info with Photo */}
          <div className="flex items-start gap-4">
            <div className="relative group">
              <ProductThumbnail
                product={product}
                onClick={(validImgs, idx) => {
                  if (onViewGallery) onViewGallery({ images: validImgs, index: idx });
                }}
                sizeClass="w-24 h-24 sm:w-28 sm:h-28"
              />
              <button
                type="button"
                onClick={() => {
                  if (onViewGallery && images.length > 0) onViewGallery({ images, index: 0 });
                }}
                className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white rounded-lg transition-opacity"
                title="Ver fotos a pantalla completa"
              >
                <ImageIcon className="w-6 h-6 drop-shadow" />
              </button>
            </div>

            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-white text-base sm:text-lg leading-tight break-words">
                {product.name}
              </h4>
              <p className="text-xs text-slate-400 font-mono mt-1">
                Código: <span className="text-slate-300 font-semibold">{product.code || 'Sin código'}</span>
              </p>
              {product.label_color && product.label_color !== 'none' && (
                <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 mt-2 rounded-full text-xs font-medium border ${currentLabel.bg}`}>
                  <Tag className="w-3 h-3" />
                  <span>{currentLabel.label}</span>
                </div>
              )}
            </div>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* Price */}
            <div className="p-3.5 bg-slate-800/60 rounded-xl border border-slate-700/60">
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                <span>Precio de Venta</span>
              </div>
              <div className="text-xl sm:text-2xl font-mono font-black text-emerald-400">
                ${Number(salePrice).toFixed(2)}
              </div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Moneda Nacional (MN)</span>
            </div>

            {/* Current Sede Stock */}
            <div className="p-3.5 bg-slate-800/60 rounded-xl border border-slate-700/60">
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                <Store className="w-3.5 h-3.5 text-cyan-400" />
                <span>Stock en {currentInventory ? currentInventory.toUpperCase() : 'Sede'}</span>
              </div>
              <div className={`text-xl sm:text-2xl font-mono font-black ${
                stockCurrent > 5 ? 'text-emerald-400' : stockCurrent > 0 ? 'text-amber-400' : 'text-rose-400'
              }`}>
                {stockCurrent}
              </div>
              <span className="text-[10px] text-slate-400">
                {stockCurrent > 5 ? 'Disponible' : stockCurrent > 0 ? 'Stock Bajo' : 'Agotado'}
              </span>
            </div>
          </div>

          {/* Detailed Stock per Inventory */}
          {product.inventory && (
            <div className="p-3.5 bg-slate-800/40 rounded-xl border border-slate-700/40">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-cyan-400" />
                Disponibilidad por Sede
              </p>
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2 bg-slate-800/80 rounded-lg text-center border border-slate-700/50">
                  <span className="text-[10px] text-slate-400 uppercase block font-semibold">Almacén</span>
                  <span className="font-mono font-bold text-sm text-cyan-400">{product.inventory['alm'] ?? 0}</span>
                </div>
                <div className="p-2 bg-slate-800/80 rounded-lg text-center border border-slate-700/50">
                  <span className="text-[10px] text-slate-400 uppercase block font-semibold">MCH 1</span>
                  <span className="font-mono font-bold text-sm text-emerald-400">{product.inventory['mch1'] ?? 0}</span>
                </div>
                <div className="p-2 bg-slate-800/80 rounded-lg text-center border border-slate-700/50">
                  <span className="text-[10px] text-slate-400 uppercase block font-semibold">MCH 2</span>
                  <span className="font-mono font-bold text-sm text-amber-400">{product.inventory['mch2'] ?? 0}</span>
                </div>
              </div>
              <div className="mt-2 text-right text-[11px] text-slate-400">
                Stock Total Global: <strong className="text-white font-mono">{totalStock}</strong> unidades
              </div>
            </div>
          )}

          {/* Description if present */}
          {product.description && (
            <div className="p-3.5 bg-slate-800/40 rounded-xl border border-slate-700/40">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Descripción</p>
              <p className="text-xs sm:text-sm text-slate-300 whitespace-pre-line leading-relaxed">
                {product.description}
              </p>
            </div>
          )}

          {/* Photos Action */}
          {images.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (onViewGallery) onViewGallery({ images, index: 0 });
              }}
              className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-cyan-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-sm"
            >
              <ImageIcon className="w-4 h-4" />
              <span>Ver todas las fotos ({images.length}) a pantalla completa</span>
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/80 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors"
          >
            Cerrar
          </button>
        </div>
      </motion.div>
    </div>
  );
}
