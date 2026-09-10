/**
 * Reset de Fábrica REAL — utilidades de frontend.
 * Contrato con el backend (espec docs/FASE_RESET_MULTIEMPRESA.md):
 *   GET  /api/backups/last → { date } (404 si el backend aún no lo tiene)
 *   POST /api/factory-reset { backup: bool, confirm: 'RESET' } →
 *        { ok, backup_created, backup_name, deleted: { tabla: filas } }
 * TODO multi-empresa: cuando exista la entidad EMPRESA, el reset deberá recibir
 *   un scope de empresa (resetear TODO lo de una empresa o todas). Por ahora el
 *   reset es global (una sola empresa: Miss Chulerías).
 */

const API_URL = import.meta.env.VITE_API_URL || '/api';

const getAuthHeaders = () => {
    const token = localStorage.getItem('session_token') || localStorage.getItem('token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
};

/**
 * Fecha del último backup. Defensivo: si el backend responde 404 o falla,
 * devolvemos null (la UI muestra "no hay registro de backups") y no crashea.
 */
export const fetchLastBackupDate = async () => {
    try {
        const res = await fetch(`${API_URL}/backups/last`, { headers: getAuthHeaders() });
        if (res.ok) {
            const data = await res.json();
            if (data?.date) return data.date;
        }
        // Fallback al endpoint de listado ya existente (por si /backups/last aún no existe)
        const resList = await fetch(`${API_URL}/backup/list`, { headers: getAuthHeaders() });
        if (resList.ok) {
            const list = await resList.json();
            if (Array.isArray(list) && list.length > 0 && list[0].created_at) {
                return list[0].created_at;
            }
        }
        return null;
    } catch (_) {
        return null;
    }
};

/**
 * Ejecuta el reset de fábrica contra el backend.
 * Devuelve { ok, backup_created, backup_name, deleted } o lanza Error con mensaje claro.
 */
export const performFactoryReset = async ({ backup }) => {
    let res;
    try {
        res = await fetch(`${API_URL}/factory-reset`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({ backup: !!backup, confirm: 'RESET' })
        });
    } catch (_) {
        throw new Error('No se pudo contactar al backend. Probá de nuevo cuando haya conexión.');
    }
    if (res.status === 404) {
        throw new Error('Backend sin soporte aún');
    }
    if (!res.ok) {
        let msg = `Error del backend (HTTP ${res.status})`;
        try {
            const errData = await res.json();
            if (errData?.error) msg = errData.error;
        } catch (_) { /* cuerpo no JSON */ }
        throw new Error(msg);
    }
    const data = await res.json().catch(() => ({}));
    return {
        ok: data.ok !== false,
        backup_created: !!data.backup_created,
        backup_name: data.backup_name || null,
        deleted: data.deleted || {}
    };
};

/**
 * Cierre de sesión local TOTAL post-reset:
 * - limpia token/datos de sesión y estado de UI (localStorage)
 * - borra la base offline (IndexedDB mch_local_db)
 * - desregistra el Service Worker y limpia caches (PWA)
 * Conserva mch_device_id y mch_saved_email (para volver a entrar rápido como dueño).
 */
export const clearLocalSession = async () => {
    const KEEP = new Set(['mch_device_id', 'mch_saved_email']);
    const removeKeys = [];
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && !KEEP.has(k)) removeKeys.push(k);
        }
    } catch (_) { /* storage inaccesible */ }
    removeKeys.forEach(k => {
        try { localStorage.removeItem(k); } catch (_) {}
    });

    // IndexedDB offline (SQLite/WASM + colas de sync)
    try { indexedDB.deleteDatabase('mch_local_db'); } catch (_) {}
    try { indexedDB.deleteDatabase('mch_offline_db'); } catch (_) {}

    // Service Worker + caches de la PWA
    try {
        if ('caches' in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map(k => caches.delete(k)));
        }
    } catch (_) {}
    try {
        if (navigator.serviceWorker) {
            const regs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(regs.map(r => r.unregister()));
        }
    } catch (_) {}
};

/** Resumen legible de lo borrado: "Ventas: 120 · Productos: 45 · ..." */
export const formatDeletedSummary = (deleted) => {
    if (!deleted || typeof deleted !== 'object') return '';
    const LABELS = {
        sales: 'Ventas',
        sales_items: 'Ítems de venta',
        sessions: 'Sesiones de caja',
        purchases: 'Compras',
        transfers: 'Traslados',
        losses: 'Mermas',
        products: 'Productos',
        inventory: 'Existencias',
        inventories: 'Inventarios',
        expenses: 'Gastos',
        cash_movements: 'Movimientos de efectivo',
        deliveries: 'Entregas de efectivo',
        external_income: 'Ingresos externos',
        physical_counts: 'Conteos físicos',
        salaries: 'Salarios/pagos',
        notifications: 'Notificaciones',
        price_changes: 'Cambios de precio',
        users: 'Usuarios'
    };
    const parts = Object.entries(deleted)
        .filter(([, n]) => typeof n === 'number')
        .map(([k, n]) => `${LABELS[k] || k}: ${n}`);
    return parts.join(' · ');
};