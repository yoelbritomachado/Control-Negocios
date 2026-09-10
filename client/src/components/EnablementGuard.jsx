/**
 * Árbol de habilitación post-reset (docs/FASE_ARBOL_HABILITACION.md §3).
 * Gates de VISTA (entry-points ya cubiertos en Sidebar): si se entra por URL
 * directa sin cumplir la condición, se muestra un empty-state amigable
 * (sin crash ni pantalla en blanco).
 *
 * - InventoryGate: requiere inventario activo seleccionado (POS / Productos).
 * - TransferGate: requiere ≥2 inventarios creados (Traslados).
 * Defensivo: el conteo de inventarios viene del server con fallback offline
 * a la caché en localStorage (`mch_inventories_cache`).
 */
import { useEffect, useState } from 'react';
import { Package, Truck, ArrowRight } from 'lucide-react';
import { useCart } from './CartProvider';
import { apiGetInventories } from '../lib/inventories';

const INV_CACHE_KEY = 'mch_inventories_cache';

export const readInventoryCache = () => {
    try {
        const cached = JSON.parse(localStorage.getItem(INV_CACHE_KEY));
        return Array.isArray(cached) ? cached : null;
    } catch (_) { return null; }
};

export const writeInventoryCache = (list) => {
    try { localStorage.setItem(INV_CACHE_KEY, JSON.stringify(list)); } catch (_) { /* noop */ }
};

/** Conteo de inventarios: server primero, caché offline como fallback. */
export function useInventoriesList() {
    const [list, setList] = useState(() => readInventoryCache());
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const data = await apiGetInventories();
                if (!cancelled && Array.isArray(data)) {
                    setList(data);
                    writeInventoryCache(data);
                }
            } catch (_) { /* offline: queda la caché */ }
        })();
        return () => { cancelled = true; };
    }, []);
    return list;
}

export function useHasActiveInventory() {
    const { currentInventory } = useCart();
    return !!currentInventory && String(currentInventory).trim() !== '';
}

const EmptyState = ({ icon: _Icon, title, hint, testid }) => (
    <div
        data-testid={testid}
        className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center gap-4"
    >
        <div className="p-5 rounded-2xl bg-secondary/40 border border-border/50">
            <_Icon className="w-10 h-10 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {hint && <p className="text-sm text-muted-foreground max-w-sm">{hint}</p>}
        <p className="text-xs text-muted-foreground/70">
            Usá el selector <strong>«Inventario Activo»</strong> del menú lateral
            <ArrowRight className="w-3.5 h-3.5 inline ml-1 -mt-0.5" />
        </p>
    </div>
);

/** POS / Productos: sin inventario activo → empty-state con CTA al selector. */
export function InventoryGate({ children, feature = 'esta vista' }) {
    const hasInventory = useHasActiveInventory();
    if (hasInventory) return children;
    return (
        <EmptyState
            icon={Package}
            title={`Seleccioná un inventario primero`}
            hint={`${feature} necesita un inventario activo seleccionado para funcionar.`}
            testid="empty-state-no-inventory"
        />
    );
}

/** Traslados: <2 inventarios → empty-state explicativo. */
export function TransferGate({ children }) {
    const list = useInventoriesList();
    const count = Array.isArray(list) ? list.length : null;
    // Defensivo: sin datos ni caché, no bloqueamos (no sabemos el estado real).
    if (count === null || count >= 2) return children;
    return (
        <EmptyState
            icon={Truck}
            title="Necesitás al menos 2 inventarios para trasladar"
            hint={`Ahora tenés ${count} inventario${count === 1 ? '' : 's'} creado${count === 1 ? '' : 's'}. Creá otro desde el menú lateral.`}
            testid="empty-state-transfers"
        />
    );
}
