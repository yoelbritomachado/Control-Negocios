/**
 * Hook de integración POS Offline
 * Permite que el POS funcione tanto online como offline de forma transparente
 */

import { useState, useCallback, useEffect } from 'react';
import { useOffline, useCreateSale, useProducts, useBarcodeScan } from './hooks';
import api from '../api';

export function usePOSOffline() {
  const { isOnline, isInitialized } = useOffline();
  const { createSale, loading: creatingSale } = useCreateSale();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  
  // Productos desde la base local (offline-first)
  const { 
    products, 
    loading: loadingProducts, 
    error: productsError 
  } = useProducts(searchTerm, selectedCategory);

  // Escaneo de códigos de barras
  const { 
    scannedProduct, 
    scanBarcode, 
    clearScan, 
    loading: scanning 
  } = useBarcodeScan();

  /**
   * Busca productos (ahora usa la base local)
   */
  const searchProducts = useCallback((term) => {
    setSearchTerm(term);
  }, []);

  /**
   * Filtra por categoría
   */
  const filterByCategory = useCallback((categoryId) => {
    setSelectedCategory(categoryId);
  }, []);

  /**
   * Procesa una venta - funciona online y offline
   */
  const processSale = useCallback(async (saleData) => {
    if (!isInitialized) {
      throw new Error('Sistema offline no inicializado');
    }

    // Si estamos online, intentamos enviar directo al servidor
    if (isOnline) {
      try {
        const response = await api.post('/sales', saleData);
        return {
          success: true,
          online: true,
          data: response.data
        };
      } catch (error) {
        console.warn('[usePOSOffline] Error enviando al servidor, guardando offline:', error);
        // Si falla, caemos al modo offline
      }
    }

    // Modo offline: guardar localmente
    const result = await createSale(saleData);
    
    if (result.success) {
      return {
        success: true,
        online: false,
        offlineId: result.saleId,
        message: 'Venta guardada offline. Se sincronizará cuando haya conexión.'
      };
    }

    return {
      success: false,
      error: result.error || 'Error al guardar la venta'
    };
  }, [isOnline, isInitialized, createSale]);

  /**
   * Obtiene el estado de conexión para mostrar al usuario
   */
  const getStatus = useCallback(() => {
    if (!isInitialized) return { type: 'initializing', message: 'Inicializando...' };
    if (isOnline) return { type: 'online', message: 'En línea' };
    return { type: 'offline', message: 'Modo offline - Las ventas se guardarán localmente' };
  }, [isOnline, isInitialized]);

  return {
    // Estados
    isOnline,
    isInitialized,
    status: getStatus(),
    
    // Productos
    products,
    loadingProducts,
    productsError,
    searchProducts,
    filterByCategory,
    selectedCategory,
    
    // Escaneo
    scannedProduct,
    scanBarcode,
    clearScan,
    scanning,
    
    // Ventas
    processSale,
    creatingSale
  };
}

export default usePOSOffline;
