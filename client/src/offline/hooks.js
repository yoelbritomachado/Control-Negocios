/**
 * Miss Chulerías - Hooks React para Offline-First
 * Facilita el uso del sistema offline en componentes React
 */

import { useState, useEffect, useCallback, useContext } from 'react';
import { OfflineContext } from './provider';
import { getOfflineDatabase } from './database';
import { v4 as uuidv4 } from 'uuid';

/**
 * Hook principal para acceder al contexto offline
 */
export function useOffline() {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOffline debe usarse dentro de OfflineProvider');
  }
  return context;
}

/**
 * Hook para consultar productos (con búsqueda local)
 */
export function useProducts(searchTerm = '', categoryId = null) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { isInitialized } = useOffline();

  useEffect(() => {
    if (!isInitialized) return;

    const fetchProducts = async () => {
      try {
        setLoading(true);
        const db = getOfflineDatabase();
        
        let sql = 'SELECT * FROM products WHERE is_active = 1';
        const params = [];

        if (categoryId) {
          sql += ' AND category_id = ?';
          params.push(categoryId);
        }

        if (searchTerm) {
          sql += ' AND (name LIKE ? OR barcode LIKE ? OR sku LIKE ?)';
          const searchPattern = `%${searchTerm}%`;
          params.push(searchPattern, searchPattern, searchPattern);
        }

        sql += ' ORDER BY name ASC';

        const results = await db.all(sql, params);
        setProducts(results);
      } catch (err) {
        console.error('[useProducts] Error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [isInitialized, searchTerm, categoryId]);

  return { products, loading, error };
}

/**
 * Hook para obtener un producto específico
 */
export function useProduct(productId) {
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { isInitialized } = useOffline();

  useEffect(() => {
    if (!isInitialized || !productId) return;

    const fetchProduct = async () => {
      try {
        setLoading(true);
        const db = getOfflineDatabase();
        const result = await db.get('SELECT * FROM products WHERE id = ?', [productId]);
        setProduct(result);
      } catch (err) {
        console.error('[useProduct] Error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [isInitialized, productId]);

  return { product, loading, error };
}

/**
 * Hook para buscar producto por código de barras
 */
export function useBarcodeScan() {
  const [scannedProduct, setScannedProduct] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { isInitialized } = useOffline();

  const scanBarcode = useCallback(async (barcode) => {
    if (!isInitialized || !barcode) return null;

    try {
      setLoading(true);
      setError(null);
      const db = getOfflineDatabase();
      
      const result = await db.get(
        'SELECT * FROM products WHERE barcode = ? AND is_active = 1',
        [barcode]
      );

      setScannedProduct(result);
      return result;
    } catch (err) {
      console.error('[useBarcodeScan] Error:', err);
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [isInitialized]);

  const clearScan = useCallback(() => {
    setScannedProduct(null);
    setError(null);
  }, []);

  return { scannedProduct, loading, error, scanBarcode, clearScan };
}

/**
 * Hook para gestionar categorías
 */
export function useCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { isInitialized } = useOffline();

  useEffect(() => {
    if (!isInitialized) return;

    const fetchCategories = async () => {
      try {
        setLoading(true);
        const db = getOfflineDatabase();
        const results = await db.all(
          'SELECT * FROM categories WHERE is_active = 1 ORDER BY name ASC'
        );
        setCategories(results);
      } catch (err) {
        console.error('[useCategories] Error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, [isInitialized]);

  return { categories, loading, error };
}

/**
 * Hook para crear una venta offline
 */
export function useCreateSale() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { isInitialized } = useOffline();

  const createSale = useCallback(async (saleData) => {
    if (!isInitialized) {
      throw new Error('Base de datos offline no inicializada');
    }

    setLoading(true);
    setError(null);

    try {
      const db = getOfflineDatabase();
      const saleId = uuidv4();
      const now = new Date().toISOString();

      await db.beginTransaction();

      try {
        // Insertar la venta
        await db.run(
          `INSERT INTO sales (
            id, customer_id, inventory_id, user_id, subtotal, tax_amount,
            discount_amount, total, payment_method, payment_amount, payment_change,
            status, notes, created_at, sync_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            saleId,
            saleData.customer_id || null,
            saleData.inventory_id || 1,
            saleData.user_id || null,
            saleData.subtotal,
            saleData.tax_amount || 0,
            saleData.discount_amount || 0,
            saleData.total,
            saleData.payment_method || 'cash',
            saleData.payment_amount || saleData.total,
            saleData.payment_change || 0,
            'completed',
            saleData.notes || null,
            now,
            'pending'
          ]
        );

        // Insertar items
        for (const item of saleData.items) {
          const itemId = uuidv4();
          await db.run(
            `INSERT INTO sale_items (
              id, sale_id, product_id, quantity, unit_price, discount_percent, total_price
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              itemId,
              saleId,
              item.product_id,
              item.quantity,
              item.unit_price,
              item.discount_percent || 0,
              item.total_price
            ]
          );

          // Actualizar stock local (opcional, para mantener consistencia)
          await db.run(
            'UPDATE products SET stock = stock - ? WHERE id = ?',
            [item.quantity, item.product_id]
          );
        }

        await db.commit();

        console.log('[useCreateSale] Venta creada offline:', saleId);
        return { success: true, saleId };
      } catch (err) {
        await db.rollback();
        throw err;
      }
    } catch (err) {
      console.error('[useCreateSale] Error:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [isInitialized]);

  return { createSale, loading, error };
}

/**
 * Hook para obtener estadísticas del sistema offline
 */
export function useOfflineStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const { isInitialized, syncManager } = useOffline();

  useEffect(() => {
    if (!isInitialized) return;

    const fetchStats = async () => {
      try {
        setLoading(true);
        
        const [dbStats, syncStats] = await Promise.all([
          getOfflineDatabase().getStats(),
          syncManager.getSyncStats()
        ]);

        setStats({
          ...dbStats,
          ...syncStats
        });
      } catch (err) {
        console.error('[useOfflineStats] Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();

    // Actualizar cada 10 segundos
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, [isInitialized, syncManager]);

  return { stats, loading };
}

/**
 * Hook para crear compra offline
 */
export function useCreatePurchase() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { isInitialized } = useOffline();

  const createPurchase = useCallback(async (purchaseData) => {
    if (!isInitialized) {
      throw new Error('Base de datos offline no inicializada');
    }

    setLoading(true);
    setError(null);

    try {
      const db = getOfflineDatabase();
      const purchaseId = uuidv4();
      const now = new Date().toISOString();

      await db.beginTransaction();

      try {
        await db.run(
          `INSERT INTO purchases (
            id, supplier_id, inventory_id, user_id, subtotal, tax_amount,
            discount_amount, total, payment_method, payment_status, status,
            notes, order_date, created_at, sync_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            purchaseId,
            purchaseData.supplier_id || null,
            purchaseData.inventory_id || 1,
            purchaseData.user_id || null,
            purchaseData.subtotal,
            purchaseData.tax_amount || 0,
            purchaseData.discount_amount || 0,
            purchaseData.total,
            purchaseData.payment_method || 'cash',
            purchaseData.payment_status || 'pending',
            purchaseData.status || 'pending',
            purchaseData.notes || null,
            purchaseData.order_date || now,
            now,
            'pending'
          ]
        );

        for (const item of purchaseData.items) {
          const itemId = uuidv4();
          await db.run(
            `INSERT INTO purchase_items (
              id, purchase_id, product_id, product_name, quantity,
              unit_price, total_price
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              itemId,
              purchaseId,
              item.product_id || null,
              item.product_name || null,
              item.quantity,
              item.unit_price,
              item.total_price
            ]
          );
        }

        await db.commit();
        return { success: true, purchaseId };
      } catch (err) {
        await db.rollback();
        throw err;
      }
    } catch (err) {
      console.error('[useCreatePurchase] Error:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [isInitialized]);

  return { createPurchase, loading, error };
}

/**
 * Hook para crear traslado offline
 */
export function useCreateTransfer() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { isInitialized } = useOffline();

  const createTransfer = useCallback(async (transferData) => {
    if (!isInitialized) {
      throw new Error('Base de datos offline no inicializada');
    }

    setLoading(true);
    setError(null);

    try {
      const db = getOfflineDatabase();
      const transferId = uuidv4();
      const now = new Date().toISOString();

      await db.beginTransaction();

      try {
        await db.run(
          `INSERT INTO transfers (
            id, from_inventory_id, to_inventory_id, user_id, status,
            notes, sent_at, created_at, sync_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            transferId,
            transferData.from_inventory_id,
            transferData.to_inventory_id,
            transferData.user_id || null,
            transferData.status || 'pending',
            transferData.notes || null,
            transferData.sent_at || now,
            now,
            'pending'
          ]
        );

        for (const item of transferData.items) {
          const itemId = uuidv4();
          await db.run(
            `INSERT INTO transfer_items (
              id, transfer_id, product_id, quantity, notes
            ) VALUES (?, ?, ?, ?, ?)`,
            [itemId, transferId, item.product_id, item.quantity, item.notes || null]
          );

          // Descontar del inventario origen
          await db.run(
            'UPDATE products SET stock = stock - ? WHERE id = ?',
            [item.quantity, item.product_id]
          );
        }

        await db.commit();
        return { success: true, transferId };
      } catch (err) {
        await db.rollback();
        throw err;
      }
    } catch (err) {
      console.error('[useCreateTransfer] Error:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [isInitialized]);

  return { createTransfer, loading, error };
}

/**
 * Hook para crear merma offline
 */
export function useCreateMerma() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { isInitialized } = useOffline();

  const createMerma = useCallback(async (mermaData) => {
    if (!isInitialized) {
      throw new Error('Base de datos offline no inicializada');
    }

    setLoading(true);
    setError(null);

    try {
      const db = getOfflineDatabase();
      const mermaId = uuidv4();
      const now = new Date().toISOString();

      await db.run(
        `INSERT INTO mermas (
          id, product_id, inventory_id, quantity, reason, notes,
          user_id, created_at, sync_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          mermaId,
          mermaData.product_id,
          mermaData.inventory_id || null,
          mermaData.quantity,
          mermaData.reason,
          mermaData.notes || null,
          mermaData.user_id || null,
          now,
          'pending'
        ]
      );

      // Descontar del stock
      await db.run(
        'UPDATE products SET stock = stock - ? WHERE id = ?',
        [mermaData.quantity, mermaData.product_id]
      );

      return { success: true, mermaId };
    } catch (err) {
      console.error('[useCreateMerma] Error:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [isInitialized]);

  return { createMerma, loading, error };
}

/**
 * Hook para obtener ventas locales pendientes
 */
export function usePendingSales() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const { isInitialized } = useOffline();

  useEffect(() => {
    if (!isInitialized) return;

    const fetchSales = async () => {
      try {
        setLoading(true);
        const db = getOfflineDatabase();
        const results = await db.all(
          `SELECT s.*, 
            (SELECT COUNT(*) FROM sale_items si WHERE si.sale_id = s.id) as item_count
          FROM sales s
          ORDER BY s.created_at DESC`
        );
        setSales(results);
      } catch (err) {
        console.error('[usePendingSales] Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSales();
  }, [isInitialized]);

  return { sales, loading };
}
