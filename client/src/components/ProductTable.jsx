import React, { useState, useEffect } from 'react';
import { FaEdit, FaTrash, FaTag } from 'react-icons/fa';
import { Package2 } from 'lucide-react';
import ProductThumbnail from './ProductThumbnail';

const ProductTable = ({ products, currentInventory, onProductUpdated, onEdit, settings }) => {
  const isDarkMode = document.documentElement.classList.contains('dark');
  const primaryCurrency = settings?.PRIMARY_CURRENCY || 'MXN';
  // Siempre permitir editar (sin autenticación)
  const canEdit = true;

  // Helper for label color (Using inline styles for reliability)
  const getRowStyle = (color) => {
    // If no color selected or 'none', return empty
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

  // Helper for card border color
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

  // Helper to format currency value dynamically
  const getDynamicCost = (product) => {
    switch (primaryCurrency) {
      case 'USD': return product.cost_usd;
      case 'EUR': return (product.cost_mn / (settings?.RATE_EUR_MN || 590));
      case 'MXN': return product.cost_mx;
      default: return product.cost_mx;
    }
  };

  // Helper to get stock for current inventory
  const getStock = (product) => {
    return product.inventory?.[currentInventory] || 0;
  };

  const handleDelete = async (productId) => {
    if (!confirm('¿Eliminar este producto? Esta acción no se puede deshacer.')) return;
    try {
      // TODO: Implement delete API call
      onProductUpdated();
    } catch (e) {
      console.error('Error deleting product:', e);
    }
  };

  if (products.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 py-12 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-center">
        <p className="text-gray-500 dark:text-gray-400 font-medium">No hay productos que coincidan con tu búsqueda.</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Vista Móvil: Cards */}
      <div className="md:hidden">
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {products.map((product, index) => {
            const stock = getStock(product);
            const cost = getDynamicCost(product);
            
            return (
              <div
                key={`product-card-${product.id}-${index}`}
                className={`p-4 bg-slate-800/30 hover:bg-slate-800/50 transition-colors border-l-4 ${getCardBorderColor(product.label_color)}`}
              >
                {/* Fila superior: Imagen + Info */}
                <div className="flex items-start gap-3 mb-3">
                  <ProductThumbnail
                    product={product}
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

                {/* Fila del medio: Stock y Precio */}
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
                      ${(product.sale_price_manual || 0).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Fila inferior: Costo (opcional) y Botones */}
                <div className="flex items-center justify-between">
                  <div className="text-xs text-gray-500 dark:text-gray-500">
                    <span className="text-gray-400">Costo:</span>{' '}
                    <span className="font-mono text-indigo-600 dark:text-indigo-400">
                      ${(cost || 0).toFixed(2)}
                    </span>
                    <span className="text-gray-500 ml-1">{primaryCurrency}</span>
                  </div>
                  
                  {canEdit && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onEdit(product)}
                        className="p-2 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <FaEdit size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(product.id)}
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

      {/* Vista Desktop: Tabla */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
              <th className="px-3 sm:px-6 py-3 sm:py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Producto</th>
              <th className="px-3 sm:px-6 py-3 sm:py-4 text-center text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">Stock</th>
              <th className="px-3 sm:px-6 py-3 sm:py-4 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">Precio</th>
              <th className="hidden md:table-cell px-3 sm:px-6 py-3 sm:py-4 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">Costo {primaryCurrency}</th>
              <th className="hidden lg:table-cell px-3 sm:px-6 py-3 sm:py-4 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">Costo MN</th>
              <th className="hidden xl:table-cell px-3 sm:px-6 py-3 sm:py-4 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">Margen</th>
              {canEdit && <th className="px-3 sm:px-6 py-3 sm:py-4 text-center text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Acciones</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {products.map((product, index) => {
              const stock = getStock(product);
              return (
                <tr
                  key={`product-row-${product.id}-${index}`}
                  style={getRowStyle(product.label_color)}
                  className="transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <td className="px-3 sm:px-6 py-3 sm:py-4">
                    <div className="flex items-center gap-2 sm:gap-4">
                      <ProductThumbnail
                        product={product}
                        className="w-10 h-10 sm:w-12 sm:h-12"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <p className="font-bold text-gray-900 dark:text-white text-xs sm:text-sm truncate max-w-[120px] sm:max-w-[200px]">{product.name}</p>
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
                      ${(product.sale_price_manual || 0).toFixed(2)}
                    </span>
                  </td>
                  <td className="hidden md:table-cell px-3 sm:px-6 py-3 sm:py-4 text-right font-mono text-xs sm:text-sm text-indigo-600 dark:text-indigo-400 font-medium">
                    ${(getDynamicCost(product) || 0).toFixed(2)}
                  </td>
                  <td className="hidden lg:table-cell px-3 sm:px-6 py-3 sm:py-4 text-right font-mono text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                    ${(product.cost_mn || 0).toFixed(2)}
                  </td>
                  <td className="hidden xl:table-cell px-3 sm:px-6 py-3 sm:py-4 text-right font-mono text-xs text-gray-500 dark:text-gray-500 font-medium">
                    {product.margin_percent || 0}%
                  </td>
                  {canEdit && (
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-center">
                      <div className="flex justify-center gap-1 sm:gap-2">
                        <button
                          onClick={() => onEdit(product)}
                          className="p-1.5 sm:p-2 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <FaEdit size={14} className="sm:w-4 sm:h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(product.id)}
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
