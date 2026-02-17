import React, { useState, useEffect } from 'react';
import { FaEdit, FaTrash, FaTag } from 'react-icons/fa';
import { Package2 } from 'lucide-react';
import ProductThumbnail from './ProductThumbnail';

const ProductTable = ({ products, onEdit, onDelete, setViewGallery, settings, isDarkMode }) => {
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

  // Helper to format currency value dynamically
  const getDynamicCost = (product) => {
    switch (primaryCurrency) {
      case 'USD': return product.cost_usd;
      case 'EUR': return (product.cost_mn / (settings?.RATE_EUR_MN || 590));
      case 'MXN': return product.cost_mx;
      default: return product.cost_mx;
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
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
              <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Producto</th>
              <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Stock</th>
              <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Venta Final</th>
              <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Costo {primaryCurrency}</th>
              <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Costo MN</th>
              <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Margen</th>
              {canEdit && <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Acciones</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {products.map((product) => (
              <tr
                key={product.id}
                style={getRowStyle(product.label_color)}
                className="transition-colors hover:bg-black/5 dark:hover:bg-white/5"
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-4">
                    <ProductThumbnail
                      product={product}
                      onClick={(images, idx) => setViewGallery({ images, index: idx })}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                         <p className="font-bold text-gray-900 dark:text-white text-sm">{product.name}</p>
                         {product.label_color && product.label_color !== 'none' && (
                           <FaTag className={`text-xs ${
                             product.label_color === 'red' ? 'text-red-500' :
                             product.label_color === 'blue' ? 'text-blue-500' :
                             product.label_color === 'green' ? 'text-emerald-500' :
                             product.label_color === 'yellow' ? 'text-amber-500' :
                             product.label_color === 'purple' ? 'text-purple-500' : ''
                           }`} />
                         )}
                      </div>
                      
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${product.quantity > 5
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : product.quantity > 0
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                      : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                    {product.quantity}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    ${(product.actual_sale_price || product.sale_price_manual || 0).toFixed(2)}
                  </span>
                  {product.sale_price_manual > 0 && (
                    <span className="block text-[9px] text-gray-400 uppercase font-bold tracking-wide mt-0.5">Manual</span>
                  )}
                </td>
                <td className="px-6 py-4 text-right font-mono text-sm text-indigo-600 dark:text-indigo-400 font-medium">
                  ${(getDynamicCost(product) || 0).toFixed(2)}
                </td>
                <td className="px-6 py-4 text-right font-mono text-sm text-gray-600 dark:text-gray-400">
                  ${(product.cost_mn || 0).toFixed(2)}
                </td>
                <td className="px-6 py-4 text-right font-mono text-xs text-gray-500 dark:text-gray-500 font-medium">
                  {product.margin_percent || 0}%
                </td>
                {canEdit && (
                  <td className="px-6 py-4 text-center">
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => onEdit(product)}
                        className="p-2 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <FaEdit size={16} />
                      </button>
                      <button
                        onClick={() => onDelete(product.id)}
                        className="p-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Eliminar"
                      >
                        <FaTrash size={16} />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ProductTable;
