/**
 * Modal para mostrar operaciones pendientes de sincronización
 */

import React, { useState, useEffect } from 'react';
import { useOffline, usePendingSales } from '../hooks';
import { X, ShoppingCart, Package, ArrowLeftRight, Trash2, Clock } from 'lucide-react';

export function PendingOperationsModal({ isOpen, onClose }) {
  const { pendingCount, syncNow, isSyncing, isOnline } = useOffline();
  const { sales, loading: loadingSales } = usePendingSales();
  const [activeTab, setActiveTab] = useState('sales');

  if (!isOpen) return null;

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const getSyncStatusBadge = (status) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      syncing: 'bg-blue-100 text-blue-800',
      synced: 'bg-green-100 text-green-800',
      error: 'bg-red-100 text-red-800'
    };
    
    const labels = {
      pending: 'Pendiente',
      syncing: 'Sincronizando',
      synced: 'Sincronizado',
      error: 'Error'
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || styles.pending}`}>
        {labels[status] || status}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Operaciones Pendientes</h2>
            <p className="text-sm text-gray-500 mt-1">
              {pendingCount} operación{pendingCount !== 1 ? 'es' : ''} esperando sincronización
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isOnline && (
              <button
                onClick={syncNow}
                disabled={isSyncing || pendingCount === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium
                         hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
                         transition-colors"
              >
                {isSyncing ? 'Sincronizando...' : 'Sincronizar Ahora'}
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('sales')}
            className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors
              ${activeTab === 'sales' 
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' 
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
          >
            <ShoppingCart className="w-4 h-4" />
            Ventas
            {sales.filter(s => s.sync_status === 'pending').length > 0 && (
              <span className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">
                {sales.filter(s => s.sync_status === 'pending').length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('purchases')}
            className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors
              ${activeTab === 'purchases' 
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' 
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
          >
            <Package className="w-4 h-4" />
            Compras
          </button>
          <button
            onClick={() => setActiveTab('transfers')}
            className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors
              ${activeTab === 'transfers' 
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' 
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
          >
            <ArrowLeftRight className="w-4 h-4" />
            Traslados
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {activeTab === 'sales' && (
            <>
              {loadingSales ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : sales.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No hay ventas registradas</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sales.map((sale) => (
                    <div 
                      key={sale.id}
                      className={`p-4 rounded-lg border transition-colors
                        ${sale.sync_status === 'pending' 
                          ? 'bg-yellow-50 border-yellow-200' 
                          : sale.sync_status === 'error'
                          ? 'bg-red-50 border-red-200'
                          : 'bg-green-50 border-green-200'
                        }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`
                            p-2 rounded-lg
                            ${sale.sync_status === 'pending' ? 'bg-yellow-100 text-yellow-600' : ''}
                            ${sale.sync_status === 'synced' ? 'bg-green-100 text-green-600' : ''}
                            ${sale.sync_status === 'error' ? 'bg-red-100 text-red-600' : ''}
                          `}>
                            <ShoppingCart className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              Venta #{sale.id.slice(0, 8)}
                            </p>
                            <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatDate(sale.created_at)}
                              </span>
                              <span>{sale.item_count} producto(s)</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-gray-900">
                            {formatCurrency(sale.total)}
                          </p>
                          <div className="mt-1">
                            {getSyncStatusBadge(sale.sync_status)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === 'purchases' && (
            <div className="text-center py-12">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No hay compras pendientes</p>
            </div>
          )}

          {activeTab === 'transfers' && (
            <div className="text-center py-12">
              <ArrowLeftRight className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No hay traslados pendientes</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 rounded-b-xl">
          <p className="text-sm text-gray-500">
            {!isOnline ? (
              <span className="flex items-center gap-2 text-orange-600">
                <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></span>
                Modo offline activo. Las operaciones se sincronizarán cuando haya conexión.
              </span>
            ) : pendingCount > 0 ? (
              <span className="flex items-center gap-2 text-blue-600">
                <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                Hay operaciones pendientes. Presiona "Sincronizar Ahora" para subir los datos.
              </span>
            ) : (
              <span className="flex items-center gap-2 text-green-600">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                Todo sincronizado. El sistema está al día.
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

export default PendingOperationsModal;
