import React, { useState, useEffect } from 'react';
import { FaEdit, FaTrash, FaTag } from 'react-icons/fa';
import ProductThumbnail from './ProductThumbnail';

const ProductTable = ({
  products,
  currentInventory,
  onProductUpdated,
  onEdit,
  onDelete,
  setViewGallery,
  settings,
  isDarkMode = true,
  currentUser,
  selectedProductIds = [],
  onSelectProduct,
  viewMode = 'list'
}) => {
  const primaryCurrency = settings?.PRIMARY_CURRENCY || 'MXN';
  const canEdit = true;

  const getRowStyle = (color) => {
    if (!color || color === 'none') return {};

    switch (color) {
      case 'red': 
        return { backgroundColor: isDarkMode ? 'rgba(127, 29, 29, 0.4)' : '#fee2e2', borderLeft: '6px solid #ef4444' };
      case 'blue': 
        return { backgroundColor: isDarkMode ? 'rgba(30, 58, 138, 0.4)' : '#dbeafe', borderLeft: '6px solid #3b82f6' };
      case 'green': 
        return { backgroundColor: isDarkMode ? 'rgba(6, 78, 59, 0.4)' : '#d1fae5', borderLeft: '6px solid #10b981' };
      case 'yellow': 
        return { backgroundColor: isDarkMode ? 'rgba(120, 53, 15, 0.4)' : '#fef3c7', borderLeft: '6px solid #f59e0b' };
      case 'purple': 
        return { backgroundColor: isDarkMode ? 'rgba(88, 28, 135, 0.4)' : '#f3e8ff', borderLeft: '6px solid #a855f7' };
      default: 
        return { borderLeft: '6px solid transparent' };
    }
  };

  const getCardBorderColor = (color) => {
    if (!color || color === 'none') return 'border-gray-200 dark:border-gray-700';
    
    switch (color) {
      case 'red': return 'border-red-400 dark:border-red-500';
      case 'blue': return 'border-blue-400 dark:border-blue-500';
      case 'green': return 'border-emerald-400 dark:border-emerald-500';
      case 'yellow': return 'border-amber-400 dark:border-amber-500';
      case 'purple': return 'border-purple-400 dark:border-purple-500';
      default: return 'border-gray-200 dark:border-gray-700';
    }
  };

  const getDynamicCost = (product) => {
    switch (primaryCurrency) {
      case 'USD': return product.cost_usd ?? (product.cost_mx / (settings?.RATE_MXN_USD || 19));
      case 'EUR': return (product.cost_mn / (settings?.RATE_EUR_MN || 590));
      case 'MXN': return product.cost_mx ?? 0;
      default: return product.cost_mx ?? 0;
    }
  };

  const getStock = (product) => {
    if (currentInventory && product.inventory && product.inventory[currentInventory] !== undefined) {
      return product.inventory[currentInventory];
    }
    return product.quantity ?? product.total_quantity ?? 0;
  };

  const handleDelete = async (productId) => {
    if (!confirm('¿Eliminar este producto? Esta acción no se puede deshacer.')) return;
    try {
      if (onDelete) {
        await onDelete(productId);
      }
      if (onProductUpdated) {
        onProductUpdated();
      }
    } catch (e) {
      console.error('Error deleting product:', e);
    }
  };

  if (products.length === 0) {
    return (
      <div className="bg-card/40 dark:bg-gray-800/60 py-12 rounded-xl border border-dashed border-border text-center">
        <p className="text-muted-foreground font-medium">No hay productos que coincidan con tu búsqueda.</p>
      </div>
    );
  }

  if (viewMode === 'grid') {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
        {products.map((product) => {
          const isSelected = selectedProductIds.includes(product.id);
          const labelStyle = getRowStyle(product.label_color);
          const stock = getStock(product);
          const salePrice = product.actual_sale_price ?? product.sale_price_manual ?? 0;

          return (
            <div
              key={product.id}
              style={labelStyle}
              onClick={(e) => {
                if (onSelectProduct) {
                  e.stopPropagation();
                  onSelectProduct(product.id);
                }
              }}
              className={`group cursor-pointer bg-white dark:bg-gray-800/90 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-lg transition-all overflow-hidden ${
                isSelected ? 'ring-2 ring-blue-500 border-blue-400 dark:border-blue-500 bg-blue-500/10' : ''
              }`}
            >
              <div className="relative p-3 pb-0">
                <ProductThumbnail
                  product={product}
                  onClick={(images, idx) => setViewGallery && setViewGallery({ images, index: idx })}
                  sizeClass="w-full aspect-square"
                  emptyClass="text-sm"
                />

                {product.label_color && product.label_color !== 'none' && (
                  <div className="absolute top-5 left-5 bg-black/60 text-white rounded-full p-1.5 shadow-md">
                    <FaTag className="text-xs" />
                  </div>
                )}
              </div>

              <div className="p-3 space-y-2">
                <p className="font-black text-gray-900 dark:text-white text-sm leading-tight line-clamp-2 min-h-[2.5rem]" title={product.name}>
                  {product.name}
                </p>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-gray-100 dark:bg-gray-900/50 rounded-lg p-2">
                    <p className="text-gray-400 font-bold uppercase text-[9px]">Stock</p>
                    <p className={`font-mono font-black ${
                      stock > 5
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : stock > 0
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-red-600 dark:text-red-400'
                    }`}>{stock}</p>
                  </div>
                  <div className="bg-gray-100 dark:bg-gray-900/50 rounded-lg p-2">
                    <p className="text-gray-400 font-bold uppercase text-[9px]">Venta</p>
                    <p className="font-mono font-black text-emerald-600 dark:text-emerald-400">
                      ${Number(salePrice).toFixed(2)}
                    </p>
                  </div>
                </div>

                {canEdit && (
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); onEdit(product); }}
                      className="flex-1 flex items-center justify-center gap-1.5 p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 dark:text-blue-300 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 rounded-xl transition-colors font-bold text-xs"
                      title="Editar"
                    >
                      <FaEdit size={13} /> Editar
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(product.id); }}
                      className="flex items-center justify-center p-2 text-red-600 bg-red-50 hover:bg-red-100 dark:text-red-300 dark:bg-red-900/20 dark:hover:bg-red-900/40 rounded-xl transition-colors"
                      title="Eliminar"
                    >
                      <FaTrash size={13} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="md:hidden">
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {products.map((product, index) => {
            const isSelected = selectedProductIds.includes(product.id);
            const stock = getStock(product);
            const cost = getDynamicCost(product);
            const salePrice = product.actual_sale_price ?? product.sale_price_manual ?? 0;
            
            return (
              <div
                key={`product-card-${product.id}-${index}`}
                onClick={(e) => {
                  if (onSelectProduct) {
                    e.stopPropagation();
                    onSelectProduct(product.id);
                  }
                }}
                className={`p-4 transition-colors border-l-4 ${getCardBorderColor(product.label_color)} ${
                  isSelected ? 'bg-blue-500/10 dark:bg-blue-900/30' : 'bg-slate-800/30 hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-start gap-3 mb-3">
                  <ProductThumbnail
                    product={product}
                    onClick={(images, idx) => setViewGallery && setViewGallery({ images, index: idx })}
                    className="w-14 h-14 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2">
                      <h3 className="font-bold text-gray-900 dark:text-white text-sm leading-tight line-clamp-2">
                        {product.name}
                      </h3>
                      {product.label_color && product.label_color !== 'none' && (
                        <FaTag className={`text-xs flex-shrink-0 mt-0.5 ${
                          product.label_color === 'red' ? 'text-red-500' :
                          product.label_color === 'blue' ? 'text-blue-500' :
                          product.label_color === 'green' ? 'text-emerald-500' :
                          product.label_color === 'yellow' ? 'text-amber-500' :
                          product.label_color === 'purple' ? 'text-purple-500' : ''
                        }`} />
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5">
                      {product.code || 'Sin código'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Stock:</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${stock > 5
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                      : stock > 0
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                        : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                      {stock}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Precio:</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                      ${Number(salePrice).toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    <span>Costo:</span>{' '}
                    <span className="font-mono text-indigo-600 dark:text-indigo-400">
                      ${Number(cost || 0).toFixed(2)}
                    </span>
                    <span className="text-gray-500 ml-1">{primaryCurrency}</span>
                  </div>
                  
                  {canEdit && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); onEdit(product); }}
                        className="p-2 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <FaEdit size={16} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(product.id); }}
                        className="p-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Eliminar"
                      >
                        <FaTrash size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
              <th className="px-3 sm:px-6 py-3 sm:py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Producto</th>
              <th className="px-3 sm:px-6 py-3 sm:py-4 text-center text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">Stock</th>
              <th className="px-3 sm:px-6 py-3 sm:py-4 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">Venta Final</th>
              <th className="hidden md:table-cell px-3 sm:px-6 py-3 sm:py-4 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">Costo {primaryCurrency}</th>
              <th className="hidden lg:table-cell px-3 sm:px-6 py-3 sm:py-4 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">Costo MN</th>
              <th className="hidden xl:table-cell px-3 sm:px-6 py-3 sm:py-4 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">Margen</th>
              {canEdit && <th className="px-3 sm:px-6 py-3 sm:py-4 text-center text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Acciones</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {products.map((product, index) => {
              const isSelected = selectedProductIds.includes(product.id);
              const stock = getStock(product);
              const salePrice = product.actual_sale_price ?? product.sale_price_manual ?? 0;
              const costDynamic = getDynamicCost(product);
              const costMN = product.cost_mn ?? 0;
              const margin = product.margin_percent ?? 0;

              return (
                <tr
                  key={`product-row-${product.id}-${index}`}
                  style={getRowStyle(product.label_color)}
                  onClick={(e) => {
                    if (onSelectProduct) {
                      e.stopPropagation();
                      onSelectProduct(product.id);
                    }
                  }}
                  className={`transition-colors cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 ${
                    isSelected ? 'bg-blue-50 dark:bg-blue-900/30 ring-2 ring-inset ring-blue-400 dark:ring-blue-500' : ''
                  }`}
                >
                  <td className="px-3 sm:px-6 py-3 sm:py-4">
                    <div className="flex items-center gap-2 sm:gap-4">
                      <ProductThumbnail
                        product={product}
                        onClick={(images, idx) => setViewGallery && setViewGallery({ images, index: idx })}
                        className="w-10 h-10 sm:w-12 sm:h-12"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <p className="font-bold text-gray-900 dark:text-white text-xs sm:text-sm truncate max-w-[120px] sm:max-w-[240px]">{product.name}</p>
                          {product.label_color && product.label_color !== 'none' && (
                            <FaTag className={`text-xs flex-shrink-0 ${
                              product.label_color === 'red' ? 'text-red-500' :
                              product.label_color === 'blue' ? 'text-blue-500' :
                              product.label_color === 'green' ? 'text-emerald-500' :
                              product.label_color === 'yellow' ? 'text-amber-500' :
                              product.label_color === 'purple' ? 'text-purple-500' : ''
                            }`} />
                          )}
                        </div>
                        <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 font-mono truncate">
                          {product.code || 'Sin código'}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${stock > 5
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                      : stock > 0
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                        : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                      {stock}
                    </span>
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 text-right">
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs sm:text-sm">
                      ${Number(salePrice).toFixed(2)}
                    </span>
                    {(product.sale_price_manual ?? 0) > 0 && (
                      <span className="block text-[9px] text-gray-400 uppercase font-bold tracking-wide mt-0.5">Manual</span>
                    )}
                  </td>
                  <td className="hidden md:table-cell px-3 sm:px-6 py-3 sm:py-4 text-right font-mono text-xs sm:text-sm text-indigo-600 dark:text-indigo-400 font-medium">
                    ${Number(costDynamic).toFixed(2)}
                  </td>
                  <td className="hidden lg:table-cell px-3 sm:px-6 py-3 sm:py-4 text-right font-mono text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                    ${Number(costMN).toFixed(2)}
                  </td>
                  <td className="hidden xl:table-cell px-3 sm:px-6 py-3 sm:py-4 text-right font-mono text-xs text-gray-500 dark:text-gray-500 font-medium">
                    {Number(margin).toFixed(1)}%
                  </td>
                  {canEdit && (
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-center">
                      <div className="flex justify-center gap-1 sm:gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); onEdit(product); }}
                          className="p-1.5 sm:p-2 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <FaEdit size={14} className="sm:w-4 sm:h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(product.id); }}
                          className="p-1.5 sm:p-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Eliminar"
                        >
                          <FaTrash size={14} className="sm:w-4 sm:h-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ProductTable;
