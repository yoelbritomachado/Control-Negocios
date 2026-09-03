import api, { fetchProducts } from '../api';
import {
  getPendingSales,
  getPendingTransfers,
  markSaleSynced,
  markTransferSynced,
  saveProductsLocal,
  saveNexusNodesLocal,
  saveUsersLocal,
  getPendingCounts
} from './localDB';

let isSyncInProgress = false;
const listeners = new Set();

export function subscribeSyncEvents(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function notifySync(event) {
  listeners.forEach(cb => {
    try {
      cb(event);
    } catch (e) {
      console.error('[AutoSync] Error notificando listener:', e);
    }
  });
}

/**
 * Ejecuta la sincronización completa de operaciones pendientes con el backend central
 */
export async function performFullSync(silent = true) {
  if (isSyncInProgress) return { running: true };
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { skipped: true, reason: 'offline' };
  }

  isSyncInProgress = true;
  notifySync({ type: 'start', silent });

  let salesUploaded = 0;
  let transfersUploaded = 0;
  let errors = [];

  try {
    // 1. Sincronizar ventas offline pendientes
    const pendingSales = await getPendingSales();
    for (const sale of pendingSales) {
      try {
        // Sanitizar items para asegurar que tengan formato válido
        const sanitizedItems = (sale.items || []).map(item => ({
          id: item.product_id || item.id,
          product_id: item.product_id || item.id,
          name: item.name || 'Producto',
          code: item.code || '',
          barcode: item.barcode || '',
          quantity: Number(item.quantity) || 1,
          sale_price_manual: Number(item.sale_price_manual || item.price || item.unit_price) || 0,
          cost_mn: Number(item.cost_mn || item.cost) || 0
        }));

        const res = await api.post('/sales', {
          items: sanitizedItems,
          total: Number(sale.total) || 0,
          paymentMethod: sale.payment_method || sale.method || 'cash',
          amountReceived: Number(sale.amount_received) || 0,
          change: Number(sale.change) || 0,
          inventoryId: sale.inventory_id || sale.inventoryId || 'mch1',
          cashAmount: Number(sale.cash_amount || sale.cashAmount) || 0,
          transferAmount: Number(sale.transfer_amount || sale.transferAmount) || 0,
          isOfflineSync: true,
          offlineId: sale.local_id
        }, { timeout: 7000 });

        if (res.data?.success) {
          await markSaleSynced(sale.local_id, res.data.saleId);
          salesUploaded++;
        } else {
          const errMsg = res.data?.error || 'Respuesta no exitosa del servidor';
          errors.push(`${sale.local_id}: ${errMsg}`);
        }
      } catch (err) {
        const errMsg = err?.response?.data?.error || err.message;
        console.warn(`[AutoSync] Error subiendo venta ${sale.local_id}:`, errMsg);
        errors.push(`${sale.local_id}: ${errMsg}`);
      }
    }

    // 2. Sincronizar traslados offline pendientes (si los hay)
    const pendingTransfers = await getPendingTransfers();
    for (const trf of pendingTransfers) {
      try {
        let res;
        // Si el traslado ya fue recibido localmente (por QR o contingencia offline), usar el endpoint de importación QR
        if (trf.status === 'received' || trf.is_received) {
          res = await api.post('/transfers/qr-import', {
            qrData: trf,
            action: 'apply'
          }, { timeout: 7000 });
        } else {
          // Si es un traslado nuevo originado en este dispositivo
          const payload = {
            source_inventory: trf.source_inventory || trf.src || trf.from_inventory || 'alm',
            target_inventory: trf.target_inventory || trf.tgt || trf.to_inventory || 'mch1',
            items: (trf.items || []).map(it => ({
              product_id: it.product_id || it.pid || it.id,
              quantity: Number(it.quantity || it.qty || 1)
            })),
            notes: trf.notes || trf.note || '',
            isOfflineSync: true,
            offlineId: trf.local_id
          };
          res = await api.post('/transfers', payload, { timeout: 7000 });
        }

        if (res.data?.success) {
          await markTransferSynced(trf.local_id);
          transfersUploaded++;
        } else {
          const errMsg = res.data?.error || 'Respuesta no exitosa al sincronizar traslado';
          errors.push(`Traslado ${trf.local_id}: ${errMsg}`);
        }
      } catch (err) {
        const errMsg = err?.response?.data?.error || err.message;
        console.warn(`[AutoSync] Error subiendo traslado ${trf.local_id}:`, errMsg);
        errors.push(`Traslado ${trf.local_id}: ${errMsg}`);
      }
    }

    // 3. Subir logs de telemetría y diagnósticos pendientes
    try {
      await flushOfflineLogs();
    } catch (_) {}

    // 4. Precachear datos maestros para uso 100% offline (Catálogo, Usuarios, Nexus y sus imágenes)
    try {
      const [prodsRes, usersRes, nexusRes] = await Promise.allSettled([
        fetchProducts(''),
        api.get('/users'),
        api.get('/nexus/nodes?active=true')
      ]);
      if (prodsRes.status === 'fulfilled' && Array.isArray(prodsRes.value)) {
        await saveProductsLocal(prodsRes.value);
        // Pre-cargar imágenes de productos en caché del Service Worker
        if ('caches' in window) {
          const imgCache = await caches.open('images-cache');
          for (const p of prodsRes.value.slice(0, 50)) {
            const imgUrl = p.image_url || p.image || (Array.isArray(p.images) ? p.images[0] : null);
            if (imgUrl && typeof imgUrl === 'string' && !imgUrl.startsWith('data:')) {
              const fullUrl = imgUrl.startsWith('http') ? imgUrl : (imgUrl.startsWith('/') ? imgUrl : `/${imgUrl}`);
              imgCache.add(fullUrl).catch(() => {});
            }
          }
        }
      }
      if (usersRes.status === 'fulfilled' && Array.isArray(usersRes.value?.data)) {
        await saveUsersLocal(usersRes.value.data);
        // Pre-cargar avatares de usuarios en caché
        if ('caches' in window) {
          const imgCache = await caches.open('images-cache');
          for (const u of usersRes.value.data) {
            if (u.avatar_url && typeof u.avatar_url === 'string' && !u.avatar_url.startsWith('data:')) {
              const fullUrl = u.avatar_url.startsWith('http') ? u.avatar_url : (u.avatar_url.startsWith('/') ? u.avatar_url : `/${u.avatar_url}`);
              imgCache.add(fullUrl).catch(() => {});
            }
          }
        }
      }
      if (nexusRes.status === 'fulfilled' && Array.isArray(nexusRes.value?.data)) {
        await saveNexusNodesLocal(nexusRes.value.data);
      }
    } catch (_) {}

    const counts = await getPendingCounts();
    notifySync({
      type: 'complete',
      salesUploaded,
      transfersUploaded,
      counts,
      errors,
      silent
    });

    return {
      success: errors.length === 0,
      salesUploaded,
      transfersUploaded,
      errors,
      remainingPending: counts.totalPending
    };
  } catch (globalErr) {
    console.error('[AutoSync] Error crítico en auto-sincronización:', globalErr);
    notifySync({ type: 'error', error: globalErr, silent });
    return { success: false, error: globalErr.message };
  } finally {
    isSyncInProgress = false;
  }
}

let autoSyncInitialized = false;

// Triggers an immediate non-blocking sync attempt
export function triggerImmediateSync(reason = 'manual') {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  performFullSync(true).catch(e => console.warn(`[AutoSync] Error en sync (${reason}):`, e));
}

/**
 * Inicializa el observador global de red y polling automático
 */
export function initAutoSyncEngine() {
  if (autoSyncInitialized || typeof window === 'undefined') return;
  autoSyncInitialized = true;

  console.log('[AutoSyncEngine] Motor de sincronización automática activado con detección rápida');

  // 1. Sincronizar de inmediato al detectar 'online'
  window.addEventListener('online', () => {
    console.log('[AutoSyncEngine] Evento online detectado: sincronizando de inmediato...');
    triggerImmediateSync('event:online');
  });

  // 2. Sincronizar de inmediato cuando el usuario regresa o desbloquea la app (visibilidad/enfoque)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && navigator.onLine) {
      console.log('[AutoSyncEngine] Pestaña visible: verificando pendientes...');
      triggerImmediateSync('event:visible');
    }
  });

  window.addEventListener('focus', () => {
    if (navigator.onLine) {
      triggerImmediateSync('event:focus');
    }
  });

  // 3. Polling adaptativo rápido: cada 6 segundos si hay pendientes, cada 20s si está en reposo
  setInterval(async () => {
    if (!navigator.onLine) return;
    try {
      const counts = await getPendingCounts();
      if (counts.totalPending > 0) {
        console.log(`[AutoSyncEngine] Polling detectó ${counts.totalPending} operaciones pendientes. Sincronizando...`);
        await performFullSync(true);
      }
    } catch (_) {}
  }, 6000);

  // 4. Intento inmediato al cargar la app
  setTimeout(() => {
    if (navigator.onLine) {
      triggerImmediateSync('app:init');
    }
  }, 800);
}
