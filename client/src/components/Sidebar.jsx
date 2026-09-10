import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { NavLink, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    ShoppingCart,
    History,
    Package,
    ArrowLeftRight,
    Settings,
    Moon,
    Sun,
    ChevronLeft,
    ChevronRight,
    TrendingUp,
    Users,
    Building2,
    ChevronDown,
    Check,
    Menu,
    X,
    Receipt,
    Trash2,
    AlertTriangle,
    Truck,
    Wallet,
    PackageSearch
    } from 'lucide-react';
import { cn } from '../lib/utils';
import { useCart } from './CartProvider';
import { useRole } from '../hooks/useRole';
import { Database } from 'lucide-react';
import { Grid3X3 } from 'lucide-react';
import { Plus } from 'lucide-react';
import CreateInventoryForm from './CreateInventoryForm';
import CreateCompanyForm from './CreateCompanyForm';
import { apiGetCompanies } from '../lib/companies';
import { apiGetInventories } from '../lib/inventories';
import { writeInventoryCache } from './EnablementGuard';

/**
 * Fase Empresas (docs/FASE_EMPRESAS_SELECTOR.md) — TODO multi-empresa-nexus:
 * - Selector "Empresa" ENCIMA de "Inventario Activo" (Sidebar desktop + mobile).
 * - La empresa activa vive en localStorage (`mch_active_company`), default Miss Chulerías.
 * - Al cambiar de empresa se refresca la lista de inventarios (?company_id=N) y se limpia
 *   el inventario activo si no pertenece a la nueva empresa (y la cache offline IndexedDB).
 * - NO existe botón de eliminar empresa en ninguna parte (prohibido por Yoe).
 */
const ACTIVE_COMPANY_KEY = 'mch_active_company';
const DEFAULT_COMPANY = { id: 1, name: 'Miss Chulerías', logo: null, is_default: true, inventories_count: 0 };

/** Borra la base offline IndexedDB (cache de inventarios fantasma post-reset). */
const clearOfflineDB = () => {
    try { indexedDB.deleteDatabase('mch_local_db'); } catch (_) { /* noop */ }
};

const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/', category: 'general' },
    { id: 'cash-control', label: 'Control de Efectivo', icon: Wallet, path: '/control-efectivo', category: 'general' },
    { id: 'inventory-value', label: 'Inventario Valorizado', icon: PackageSearch, path: '/inventario-valorizado', category: 'general' },
    { id: 'pos', label: 'Punto de Venta', icon: ShoppingCart, path: '/pos', category: 'operations' },
    { id: 'inventory', label: 'Inventario', icon: Package, path: '/inventario', category: 'management' },
    { id: 'entradas', label: 'Entradas', icon: ArrowLeftRight, path: '/entradas', category: 'management', almacOnly: true },
    { id: 'traslados', label: 'Traslados', icon: Truck, path: '/traslados', category: 'management', adminOnly: true },
    { id: 'mermas', label: 'Mermas', icon: AlertTriangle, path: '/mermas', category: 'management' },
    { id: 'users', label: 'Usuarios', icon: Users, path: '/usuarios', category: 'management', adminOnly: true },
    { id: 'nexus', label: 'NexusNode', icon: Grid3X3, path: '/nexus', category: 'management', adminOnly: true },
];

const historyMenuItems = [
    { id: 'history-sales', label: 'Historial de Ventas', icon: Receipt, path: '/historial/ventas', kioskOnly: true },
    { id: 'history-entradas', label: 'Historial de Traslados y Entradas', icon: ArrowLeftRight, path: '/historial/traslados' },
    { id: 'history-mermas', label: 'Historial de Mermas', icon: Trash2, path: '/historial/mermas' },
];

const adminMenuItems = [
    { id: 'migration', label: 'Migración', icon: Database, path: '/admin/migracion', category: 'admin' },
];

// Fallback offline (sin backend): sedes base conocidas.
// TODO multi-empresa: esta lista deberá filtrarse por la empresa activa
// (inventarios por negocio) cuando exista la entidad EMPRESA.
const inventories = [
    { id: 'mch1', label: 'MCH1' },
    { id: 'mch2', label: 'MCH2' },
    { id: 'alm', label: 'Almacén' },
];



// Hook para detectar si es móvil
function useIsMobile() {
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
    
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    
    return isMobile;
}

export function Sidebar({ isDark, toggleTheme }) {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const [isInventoryOpen, setIsInventoryOpen] = useState(false);
    const [isCompanyOpen, setIsCompanyOpen] = useState(false);
    const [dynamicInventories, setDynamicInventories] = useState(null);
        const [showCreateInventory, setShowCreateInventory] = useState(false);
        const [showCreateCompany, setShowCreateCompany] = useState(false);
        const location = useLocation();
    const isMobile = useIsMobile();

    const { currentInventory, setCurrentInventory } = useCart();
    const { isAdmin } = useRole();

    // --- Estado de empresa activa (Fase Empresas) — TODO multi-empresa-nexus ---
    const [companies, setCompanies] = useState([]); // [] = aún sin datos; null = backend sin soporte
    const [companiesUnsupported, setCompaniesUnsupported] = useState(false);
    const [activeCompany, setActiveCompanyState] = useState(() => {
        try {
            const saved = JSON.parse(localStorage.getItem(ACTIVE_COMPANY_KEY));
            return saved?.id ? saved : DEFAULT_COMPANY;
        } catch (_) { return DEFAULT_COMPANY; }
    });
    const setActiveCompany = (company) => {
        const c = company || DEFAULT_COMPANY;
        setActiveCompanyState(c);
        try { localStorage.setItem(ACTIVE_COMPANY_KEY, JSON.stringify(c)); } catch (_) { /* noop */ }
    };
    const [companyLoadFailed, setCompanyLoadFailed] = useState(false);

    // Cargar empresas al montar. Defensivo: 404 → solo CTA "+ Crear empresa".
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const list = await apiGetCompanies();
                if (cancelled) return;
                setCompanies(list);
                setCompaniesUnsupported(false);
                // Si hay empresa activa guardada que ya no existe, volver al default.
                if (list.length > 0 && !list.some(c => String(c.id) === String(activeCompany.id))) {
                    const def = list.find(c => c.is_default) || list[0];
                    setActiveCompany(def);
                }
            } catch (err) {
                if (cancelled) return;
                if (String(err?.message || '').includes('sin soporte')) {
                    setCompaniesUnsupported(true);
                } else {
                    setCompanyLoadFailed(true);
                }
            }
        })();
        return () => { cancelled = true; };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // --- Inventario activo: fetch con company_id (Fase Empresas) ---
        // Antes: solo fallback estático MCH1/MCH2/Almacén (cache offline fantasma post-reset).
        // Árbol habilitación (C): SOLO pasamos company_id si la empresa activa existe
        // realmente en el server (companies fetch). El DEFAULT local {id:1} no cuenta
        // cuando la DB está en 0 empresas — sino el GET filtra por empresa inexistente
        // y devuelve [], ocultando inventarios SUELTOS (company_id NULL) que sí existen.
        const realActiveCompanyId = companies.some(c => String(c.id) === String(activeCompany?.id))
            ? activeCompany.id
            : null;

        useEffect(() => {
            let cancelled = false;
            (async () => {
                try {
                    const data = await apiGetInventories(realActiveCompanyId);
                    if (cancelled) return;
                    if (Array.isArray(data)) {
                        const mapped = data.map(i => ({
                            id: i.id,
                            label: i.name || i.code || String(i.id),
                            company_id: i.company_id ?? i.companyId ?? null
                        }));
                        setDynamicInventories(mapped);
                        writeInventoryCache(mapped);
                        // Lista vacía (post-reset): limpiar cache offline para no mostrar sedes fantasma.
                        if (data.length === 0) clearOfflineDB();
                    }
                } catch (_) {
                    // Offline / sin soporte: dejamos el fallback estático (comportamiento previo).
                }
            })();
            return () => { cancelled = true; };
        }, [realActiveCompanyId]);

    // Lista de inventarios: si el backend/devolvió una lista, la usamos (post-reset viene []);
    // si nunca hubo respuesta (offline sin caché), usamos el fallback estático.
    const list = dynamicInventories || inventories;
    const listIsEmpty = Array.isArray(dynamicInventories) && dynamicInventories.length === 0;

    // --- Árbol de habilitación post-reset (docs/FASE_ARBOL_HABILITACION.md §3) ---
    // Defensivo: derivamos gates del estado REAL del server; si no hay datos,
    // usamos fallback offline (caché localStorage) antes de asumir algo.
    const hasActiveInventory = !!currentInventory && String(currentInventory).trim() !== '';
    const canSell = hasActiveInventory;             // POS / Productos: sin activo → gated
    const canTransfer = Array.isArray(list) && list.length >= 2; // Traslados: ≥2 inventarios (spec §3)

    // FIX BUG flechita (espec §6): alternar colapso SIEMPRE con update funcional
    // (el valor previo puede quedar stale si React agrupa updates rápido).
    const toggleCollapsed = () => setIsCollapsed(prev => !prev);

    const currentInventoryLabel = (list.find(i => i.id === currentInventory)?.label) || String(currentInventory || '').toUpperCase();

    useEffect(() => {
        setIsMobileOpen(false);
    }, [location.pathname]);

    const handleInventoryChange = (inventoryId) => {
            setCurrentInventory(inventoryId);
            setIsInventoryOpen(false);
        };

        // Al crear un inventario desde el '+': agregarlo a la lista y seleccionarlo como activo (espec §2)
        const handleInventoryCreated = (created, fallbackName) => {
            const item = {
                id: created?.id,
                label: created?.name || created?.code || fallbackName,
                company_id: created?.company_id ?? created?.companyId ?? activeCompany?.id ?? null
            };
            setDynamicInventories(prev => {
                const base = Array.isArray(prev) ? prev : [];
                const next = [...base.filter(i => i.id !== item.id), item];
                writeInventoryCache(next);
                return next;
            });
            if (item.id) {
                // Auto-seleccionar como activo (espec árbol habilitación §2):
                // sincroniza localStorage + estado global vía CartProvider.
                setCurrentInventory(item.id);
                setIsInventoryOpen(false);
            }
        };

    /**
     * Cambio de empresa (Fase Empresas §2):
     * 1) persistir empresa activa (estado + localStorage)
     * 2) refrescar inventarios (?company_id=N) — el useEffect de arriba lo hace
     * 3) limpiar inventario activo si no pertenece a la nueva empresa
     * 4) limpiar cache offline (IndexedDB) para evitar sedes fantasma de otra empresa
     */
    const handleCompanyChange = (company) => {
        if (!company) return;
        setActiveCompany(company);
        setIsCompanyOpen(false);
        setIsInventoryOpen(false);
        const belongs = Array.isArray(dynamicInventories) && dynamicInventories.some(i => i.id === currentInventory && String(i.company_id) === String(company.id));
        if (company.id !== activeCompany?.id && !belongs) {
                    setCurrentInventory(''); // limpiar activo (no null: el label hace .toUpperCase())
                }
                clearOfflineDB();
            };

    // Empresa creada desde el '+': seleccionarla como activa (spec §B)
    const handleCompanyCreated = async (created, fallbackName) => {
        const company = {
            id: created?.id ?? created?.company?.id ?? `local_${Date.now()}`,
            name: created?.name || created?.company?.name || fallbackName,
            logo: created?.logo || created?.company?.logo || null,
            is_default: false,
            inventories_count: 0
        };
        setCompanies(prev => [...(Array.isArray(prev) ? prev : []), company]);
        handleCompanyChange(company);
        // Reintentar carga real desde backend (por si el POST devolvió shape distinto)
        try {
            const list2 = await apiGetCompanies();
            if (Array.isArray(list2) && list2.length > 0) setCompanies(list2);
        } catch (_) { /* defensivo */ }
    };

    return (
        <>
            {/* Botón de hamburguesa para móvil */}
            <button
                onClick={() => setIsMobileOpen(true)}
                className={cn(
                    'lg:hidden fixed top-[max(1rem,env(safe-area-inset-top))] left-[max(1rem,env(safe-area-inset-left))] z-[60] p-3 rounded-xl transition-all duration-300',
                    isMobileOpen ? 'opacity-0 pointer-events-none' : 'opacity-100',
                    isDark 
                        ? 'bg-slate-800/90 border border-white/10 text-white' 
                        : 'bg-white/90 border border-black/10 text-slate-900',
                    'backdrop-blur-md shadow-lg'
                )}
            >
                <Menu className="w-5 h-5" />
            </button>
            
            {/* Overlay para móvil */}
            <AnimatePresence>
                {isMobile && isMobileOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsMobileOpen(false)}
                        className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[90]"
                    />
                )}
            </AnimatePresence>

            {/* Sidebar Desktop - Siempre visible */}
            <aside
                className={cn(
                    'hidden lg:flex fixed left-0 top-0 h-screen z-50 flex-col transition-all duration-500',
                    isCollapsed ? 'w-20' : 'w-72'
                )}
                style={{
                    background: isDark
                        ? 'linear-gradient(180deg, rgba(15, 23, 42, 0.98) 0%, rgba(15, 23, 42, 0.99) 100%)'
                        : 'linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 250, 252, 0.99) 100%)',
                    backdropFilter: 'blur(20px)',
                    borderRight: isDark
                        ? '1px solid rgba(255, 255, 255, 0.05)'
                        : '1px solid rgba(0, 0, 0, 0.05)'
                }}
            >
                {/* Logo Section Desktop */}
                <div className="p-5 flex items-center justify-between">
                    <motion.div
                        className="flex items-center gap-3"
                        animate={{ opacity: isCollapsed ? 0 : 1 }}
                    >
                        <div className="relative shrink-0">
                            <img 
                                src="/icons/icon-192x192.png" 
                                alt="Miss Chulerías" 
                                className="w-10 h-10 rounded-xl object-contain shadow-md shadow-pink-500/20 bg-slate-900/50 border border-pink-500/20"
                            />
                            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-background" />
                        </div>
                        {!isCollapsed && (
                            <div className="flex flex-col">
                                <div className="flex items-baseline gap-1.5 leading-none">
                                    <span className="font-brand-hand text-2xl font-bold text-pink-500 drop-shadow-[0_0_8px_rgba(236,72,153,0.3)] tracking-wide">
                                        Miss
                                    </span>
                                    <span className="font-brand-formal text-base font-extrabold tracking-tight text-foreground uppercase">
                                        Chulerías
                                    </span>
                                </div>
                                <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold mt-1">
                                    CRM
                                </p>
                            </div>
                        )}
                    </motion.div>

                    <button
                        onClick={toggleCollapsed}
                        className="p-2 rounded-lg hover:bg-secondary transition-colors"
                    >
                        {isCollapsed ? (
                            <ChevronRight className="w-4 h-4" />
                        ) : (
                            <ChevronLeft className="w-4 h-4" />
                        )}
                    </button>
                </div>

                {/* Company Selector Desktop — ENCIMA de "Inventario Activo" (Fase Empresas) */}
                {/* Árbol habilitación (A): 0 empresas → SOLO CTA "+ Crear empresa" (sin lista). */}
                <div className="px-3 mb-2">
                    <div className="relative" data-testid="company-selector">
                        <button
                            onClick={() => !isCollapsed && setIsCompanyOpen(!isCompanyOpen)}
                            className={cn(
                                'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300',
                                'bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20',
                                'hover:border-emerald-500/40 text-left group'
                            )}
                            data-testid="company-selector-toggle"
                        >
                            <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 group-hover:text-emerald-300 transition-colors shrink-0">
                                <Building2 className="w-5 h-5" />
                            </div>

                            {!isCollapsed && (
                                <>
                                    <div className="flex-1 overflow-hidden">
                                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                                            Empresa
                                        </p>
                                        <p className="text-sm font-semibold truncate text-foreground">
                                            {companies.length === 0 && !companyLoadFailed ? 'Sin empresa' : (activeCompany?.name || DEFAULT_COMPANY.name)}
                                        </p>
                                    </div>
                                    <ChevronDown className={cn(
                                        "w-4 h-4 text-muted-foreground transition-transform duration-300",
                                        isCompanyOpen && "rotate-180"
                                    )} />
                                </>
                            )}
                        </button>

                        {!isCollapsed && (
                            <motion.div
                                initial={false}
                                animate={{
                                    height: isCompanyOpen ? 'auto' : 0,
                                    opacity: isCompanyOpen ? 1 : 0
                                }}
                                className="overflow-hidden"
                            >
                                <div className="mt-1 p-1 rounded-xl bg-secondary/30 border border-white/5 backdrop-blur-md space-y-0.5" data-testid="company-list">
                                    {/* Regla Yoe: NUNCA botón de eliminar empresa aquí (ni en ninguna parte del selector). */}
                                    {!companiesUnsupported && companies.length === 0 && !companyLoadFailed && (
                                        <div className="px-3 py-3 text-center space-y-2" data-testid="empty-companies">
                                            <p className="text-xs text-muted-foreground">Sin empresas — creá la primera</p>
                                        </div>
                                    )}
                                    {companies.map((company) => (
                                        <button
                                            key={String(company.id)}
                                            onClick={() => handleCompanyChange(company)}
                                            data-testid={`company-option-${company.id}`}
                                            className={cn(
                                                'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
                                                String(activeCompany?.id) === String(company.id)
                                                    ? 'bg-emerald-500/20 text-emerald-400'
                                                    : 'hover:bg-white/5 text-muted-foreground hover:text-foreground'
                                            )}
                                        >
                                            {company.logo ? (
                                                <img src={company.logo} alt="" className="w-5 h-5 rounded object-contain shrink-0" />
                                            ) : (
                                                <Building2 className="w-4 h-4 shrink-0 opacity-60" />
                                            )}
                                            <span className="truncate flex-1 text-left">{company.name}</span>
                                            {String(activeCompany?.id) === String(company.id) && (
                                                <Check className="w-3.5 h-3.5" />
                                            )}
                                        </button>
                                    ))}
                                    {/* CTA "+ Crear empresa": SIEMPRE visible al final del despliegue (spec §2) */}
                                    <button
                                        onClick={() => setShowCreateCompany(true)}
                                        data-testid="create-company-button"
                                        className="w-full flex items-center justify-center gap-2 px-3 py-2 mt-1 rounded-lg border border-dashed border-emerald-500/30 text-emerald-400 text-sm hover:bg-emerald-500/10 hover:border-emerald-500/50 transition-colors"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Crear empresa
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </div>
                </div>

                {/* Inventory Selector Desktop */}
                {/* Árbol habilitación (B): 0 inventarios → toggle DESHABILITADO (gris + tooltip
                    "Creá un inventario primero"), pero el '+' SIEMPRE habilitado (dentro del
                    despliegue y en el empty-state). */}
                <div className="px-3 mb-2">
                    <div className="relative">
                        <button
                            onClick={() => { if (listIsEmpty) { setIsInventoryOpen(true); return; } !isCollapsed && setIsInventoryOpen(!isInventoryOpen); }}
                            title={listIsEmpty ? 'Creá un inventario primero' : undefined}
                            aria-disabled={listIsEmpty}
                            data-testid="inventory-selector-toggle"
                            data-disabled={listIsEmpty ? 'true' : 'false'}
                            className={cn(
                                'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300',
                                'bg-gradient-to-r from-violet-500/10 to-purple-500/10 border border-violet-500/20',
                                'hover:border-violet-500/40 text-left group',
                                listIsEmpty && 'opacity-40 grayscale cursor-not-allowed hover:border-violet-500/20'
                            )}
                        >
                            <div className="p-1.5 rounded-lg bg-violet-500/20 text-violet-400 group-hover:text-violet-300 transition-colors">
                                <Building2 className="w-5 h-5" />
                            </div>

                            {!isCollapsed && (
                                <>
                                    <div className="flex-1 overflow-hidden">
                                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                                            Inventario Activo
                                        </p>
                                        <p className="text-sm font-semibold truncate text-foreground">
                                            {currentInventoryLabel}
                                        </p>
                                    </div>
                                    <ChevronDown className={cn(
                                        "w-4 h-4 text-muted-foreground transition-transform duration-300",
                                        isInventoryOpen && "rotate-180"
                                    )} />
                                </>
                            )}
                        </button>

                        {!isCollapsed && (
                            <motion.div
                                initial={false}
                                animate={{
                                    height: isInventoryOpen ? 'auto' : 0,
                                    opacity: isInventoryOpen ? 1 : 0
                                }}
                                className="overflow-hidden"
                            >
                                <div className="mt-1 p-1 rounded-xl bg-secondary/30 border border-white/5 backdrop-blur-md space-y-0.5">
                                                                    {listIsEmpty && (
                                                                        <div className="px-3 py-3 text-center space-y-2" data-testid="empty-inventories">
                                                                            <p className="text-xs text-muted-foreground">Sin inventarios — creá el primero</p>
                                                                            <button
                                                                                onClick={() => setShowCreateInventory(true)}
                                                                                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-violet-500/20 border border-violet-500/30 text-violet-300 text-sm font-semibold hover:bg-violet-500/30 transition-colors"
                                                                            >
                                                                                <Plus className="w-4 h-4" />
                                                                                Crear inventario
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                    {list.map((inventory) => (
                                                                        <button
                                                                            key={inventory.id}
                                                                            onClick={() => handleInventoryChange(inventory.id)}
                                                                            className={cn(
                                                                                'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors',
                                                                                currentInventory === inventory.id
                                                                                    ? 'bg-violet-500/20 text-violet-400'
                                                                                    : 'hover:bg-white/5 text-muted-foreground hover:text-foreground'
                                                                            )}
                                                                        >
                                                                            <span className="flex items-center gap-2 min-w-0">
                                                                                <span className="truncate">{inventory.label}</span>
                                                                                {/* Árbol habilitación (C): inventario suelto → badge gris "Sin empresa" */}
                                                                                {inventory.company_id == null && (
                                                                                    <span data-testid="badge-sin-empresa" className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-medium bg-slate-500/20 text-muted-foreground border border-slate-500/30">Sin empresa</span>
                                                                                )}
                                                                            </span>
                                                                            {currentInventory === inventory.id && (
                                                                                <Check className="w-3.5 h-3.5" />
                                                                            )}
                                                                        </button>
                                                                    ))}
                                                                    {/* Botón '+' para crear inventario nuevo (espec §2) */}
                                                                    <button
                                                                        onClick={() => setShowCreateInventory(true)}
                                                                        data-testid="create-inventory-button"
                                                                        className="w-full flex items-center justify-center gap-2 px-3 py-2 mt-1 rounded-lg border border-dashed border-violet-500/30 text-violet-400 text-sm hover:bg-violet-500/10 hover:border-violet-500/50 transition-colors"
                                                                    >
                                                                        <Plus className="w-4 h-4" />
                                                                        Nuevo inventario
                                                                    </button>
                                                                </div>
                            </motion.div>
                        )}
                    </div>
                </div>

                {/* Navigation Desktop */}
                <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
                    <div>
                        {!isCollapsed && (
                            <p className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                                General
                            </p>
                        )}
                        {menuItems.filter(item => item.category === 'general').map((item) => (
                            <NavLink
                                key={item.id}
                                to={item.path}
                                className={({ isActive }) => cn(
                                    'w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 mb-1',
                                    isActive
                                        ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/10 text-cyan-400 border border-cyan-500/30'
                                        : 'hover:bg-secondary/80 text-muted-foreground hover:text-foreground'
                                )}
                            >
                                {({ isActive }) => (
                                    <>
                                        <item.icon className={cn(
                                            'w-5 h-5 transition-colors flex-shrink-0',
                                            isActive && 'text-cyan-400'
                                        )} />
                                        {!isCollapsed && (
                                            <span className="font-medium text-sm">{item.label}</span>
                                        )}
                                        {isActive && !isCollapsed && (
                                            <motion.div
                                                layoutId="activeIndicator"
                                                className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-400"
                                            />
                                        )}
                                    </>
                                )}
                            </NavLink>
                        ))}
                    </div>

                    <div>
                        {!isCollapsed && (
                            <p className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                                Operaciones
                            </p>
                        )}
                        {menuItems.filter(item => item.category === 'operations' && (item.id !== 'pos' || currentInventory !== 'alm')).map((item) => {
                            // Árbol habilitación (D): POS/ventas requiere inventario activo.
                            const locked = item.id === 'pos' && !canSell;
                            return (
                            <NavLink
                                key={item.id}
                                to={item.path}
                                title={locked ? 'Seleccioná un inventario primero' : undefined}
                                aria-disabled={locked || undefined}
                                data-testid={`nav-${item.id}`}
                                data-locked={locked ? 'true' : 'false'}
                                onClick={(e) => { if (locked) { e.preventDefault(); } }}
                                className={({ isActive }) => cn(
                                    'w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 mb-1',
                                    isActive
                                        ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/10 text-cyan-400 border border-cyan-500/30'
                                        : 'hover:bg-secondary/80 text-muted-foreground hover:text-foreground',
                                    locked && 'opacity-40 grayscale cursor-not-allowed hover:bg-transparent'
                                )}
                            >
                                {({ isActive }) => (
                                    <>
                                        <item.icon className={cn(
                                            'w-5 h-5 transition-colors flex-shrink-0',
                                            isActive && 'text-cyan-400'
                                        )} />
                                        {!isCollapsed && (
                                            <span className="font-medium text-sm">{item.label}</span>
                                        )}
                                    </>
                                )}
                            </NavLink>
                            );
                        })}
                    </div>

                    <div>
                        {!isCollapsed && (
                            <p className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                                Gestión
                            </p>
                        )}
                        {menuItems.filter(item => item.category === 'management' && (!item.adminOnly || isAdmin) && (!item.almacOnly || currentInventory === 'alm')).map((item) => {
                            // Árbol habilitación (D): Inventario/Productos requiere inventario activo;
                            // Traslados requiere ≥2 inventarios. Usuarios SIEMPRE habilitado.
                            const locked = (item.id === 'inventory' && !canSell) || (item.id === 'traslados' && !canTransfer);
                            const lockedMsg = item.id === 'traslados' ? 'Necesitás al menos 2 inventarios para trasladar' : 'Seleccioná un inventario primero';
                            return (
                            <NavLink
                                key={item.id}
                                to={item.path}
                                onClick={() => { if (locked) { return; } isMobile && setIsMobileOpen(false); }}
                                title={locked ? lockedMsg : undefined}
                                aria-disabled={locked || undefined}
                                data-testid={`nav-${item.id}`}
                                data-locked={locked ? 'true' : 'false'}
                                onClickCapture={(e) => { if (locked) { e.preventDefault(); } }}
                                className={({ isActive }) => cn(
                                    'w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 mb-1',
                                    isActive
                                        ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/10 text-cyan-400 border border-cyan-500/30'
                                        : 'hover:bg-secondary/80 text-muted-foreground hover:text-foreground',
                                    locked && 'opacity-40 grayscale cursor-not-allowed hover:bg-transparent'
                                )}
                            >
                                {({ isActive }) => (
                                    <>
                                        <item.icon className={cn(
                                            'w-5 h-5 transition-colors flex-shrink-0',
                                            isActive && 'text-cyan-400'
                                        )} />
                                        {!isCollapsed && (
                                            <span className="font-medium text-sm">{item.label}</span>
                                        )}
                                    </>
                                )}
                            </NavLink>
                            );
                        })}
                    </div>

                    {/* Historiales Section */}
                    <div className="mt-6">
                        {!isCollapsed && (
                            <p className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                                Historiales
                            </p>
                        )}
                        {historyMenuItems.filter(item => !item.kioskOnly || currentInventory !== 'alm').map((item) => (
                            <NavLink
                                key={item.id}
                                to={item.path}
                                onClick={() => isMobile && setIsMobileOpen(false)}
                                className={({ isActive }) => cn(
                                    'w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 mb-1',
                                    isActive
                                        ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/10 text-amber-400 border border-amber-500/30'
                                        : 'hover:bg-secondary/80 text-muted-foreground hover:text-foreground'
                                )}
                            >
                                {({ isActive }) => (
                                    <>
                                        <item.icon className={cn(
                                            'w-5 h-5 transition-colors flex-shrink-0',
                                            isActive && 'text-amber-400'
                                        )} />
                                        {!isCollapsed && (
                                            <span className="font-medium text-sm">{item.label}</span>
                                        )}
                                    </>
                                )}
                            </NavLink>
                        ))}
                    </div>
                    
                    {isAdmin && (
                        <div className="mt-6">
                            {!isCollapsed && (
                                <p className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                                    Administración
                                </p>
                            )}
                            {adminMenuItems.map((item) => (
                                <NavLink
                                    key={item.id}
                                    to={item.path}
                                    className={({ isActive }) => cn(
                                        'w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 mb-1',
                                        isActive
                                            ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/10 text-purple-400 border border-purple-500/30'
                                            : 'hover:bg-secondary/80 text-muted-foreground hover:text-foreground'
                                    )}
                                >
                                    {({ isActive }) => (
                                        <>
                                            <item.icon className={cn(
                                                'w-5 h-5 transition-colors flex-shrink-0',
                                                isActive && 'text-purple-400'
                                            )} />
                                            {!isCollapsed && (
                                                <span className="font-medium text-sm">{item.label}</span>
                                            )}
                                        </>
                                    )}
                                </NavLink>
                            ))}
                        </div>
                    )}
                </nav>

                {/* Bottom Section Desktop */}
                <div className="p-4 border-t border-border/50 space-y-3">
                    <motion.button
                        onClick={toggleTheme}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className={cn(
                            'w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300',
                            'hover:bg-secondary/80'
                        )}
                    >
                        <div className="relative flex-shrink-0">
                            <motion.div
                                animate={{ rotate: isDark ? 0 : 180, opacity: isDark ? 1 : 0 }}
                                transition={{ duration: 0.3 }}
                                className="absolute inset-0"
                            >
                                <Moon className="w-5 h-5 text-purple-400" />
                            </motion.div>
                            <motion.div
                                animate={{ rotate: isDark ? -180 : 0, opacity: isDark ? 0 : 1 }}
                                transition={{ duration: 0.3 }}
                            >
                                <Sun className="w-5 h-5 text-amber-500" />
                            </motion.div>
                        </div>
                        {!isCollapsed && (
                            <span className="font-medium text-sm">
                                {isDark ? 'Modo Oscuro' : 'Modo Claro'}
                            </span>
                        )}
                    </motion.button>

                    <NavLink
                        to="/configuracion"
                        className={({ isActive }) => cn(
                            'w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300',
                            isActive
                                ? 'bg-gradient-to-r from-violet-500/20 to-purple-500/10 text-violet-400 border border-violet-500/30'
                                : 'hover:bg-secondary/80 text-muted-foreground hover:text-foreground'
                        )}
                    >
                        {({ isActive }) => (
                            <>
                                <Settings className={cn(
                                    'w-5 h-5 flex-shrink-0',
                                    isActive && 'text-violet-400'
                                )} />
                                {!isCollapsed && (
                                    <span className="font-medium text-sm">Configuración</span>
                                )}
                            </>
                        )}
                    </NavLink>
                </div>
            </aside>

            {/* Sidebar Mobile - Solo visible cuando está abierto */}
            <AnimatePresence>
                {isMobile && isMobileOpen && (
                    <motion.aside
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                        className="lg:hidden fixed inset-y-0 left-0 h-[100dvh] max-h-[100dvh] min-h-0 w-[min(85vw,320px)] max-w-[calc(100vw-env(safe-area-inset-left)-env(safe-area-inset-right))] z-[100] flex flex-col overflow-hidden shadow-2xl"
                        style={{
                            background: isDark
                                ? 'linear-gradient(180deg, rgba(15, 23, 42, 0.98) 0%, rgba(15, 23, 42, 0.99) 100%)'
                                : 'linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 250, 252, 0.99) 100%)',
                            backdropFilter: 'blur(20px)',
                            borderRight: isDark
                                ? '1px solid rgba(255, 255, 255, 0.05)'
                                : '1px solid rgba(0, 0, 0, 0.05)'
                        }}
                    >
                        {/* Logo Section Mobile */}
                        <div className="shrink-0 px-4 py-3 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="relative shrink-0">
                                    <img 
                                        src="/icons/icon-192x192.png" 
                                        alt="Miss Chulerías" 
                                        className="w-10 h-10 rounded-xl object-contain shadow-md shadow-pink-500/20 bg-slate-900/50 border border-pink-500/20"
                                    />
                                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-background" />
                                </div>
                                <div className="flex flex-col">
                                    <div className="flex items-baseline gap-1.5 leading-none">
                                        <span className="font-brand-hand text-2xl font-bold text-pink-500 drop-shadow-[0_0_8px_rgba(236,72,153,0.3)] tracking-wide">
                                            Miss
                                        </span>
                                        <span className="font-brand-formal text-base font-extrabold tracking-tight text-foreground uppercase">
                                            Chulerías
                                        </span>
                                    </div>
                                    <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold mt-1">
                                        CRM
                                    </p>
                                </div>
                            </div>

                            <button
                                onClick={() => setIsMobileOpen(false)}
                                className={cn(
                                    "p-2.5 rounded-xl transition-all duration-200",
                                    isDark 
                                        ? "hover:bg-white/10 bg-white/5" 
                                        : "hover:bg-black/10 bg-black/5"
                                )}
                                aria-label="Cerrar menú"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Company Selector Mobile — ENCIMA de "Inventario Activo" (Fase Empresas) */}
                        <div className="shrink-0 px-3 mb-2">
                            <div className="relative" data-testid="company-selector-mobile">
                                <button
                                    onClick={() => setIsCompanyOpen(!isCompanyOpen)}
                                    className={cn(
                                        'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300',
                                        'bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20',
                                        'hover:border-emerald-500/40 text-left group'
                                    )}
                                >
                                    <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 group-hover:text-emerald-300 transition-colors shrink-0">
                                        <Building2 className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                                            Empresa
                                        </p>
                                        <p className="text-sm font-semibold truncate text-foreground">
                                            {companies.length === 0 && !companyLoadFailed ? 'Sin empresa' : (activeCompany?.name || DEFAULT_COMPANY.name)}
                                        </p>
                                    </div>
                                    <ChevronDown className={cn(
                                        "w-4 h-4 text-muted-foreground transition-transform duration-300",
                                        isCompanyOpen && "rotate-180"
                                    )} />
                                </button>

                                <motion.div
                                    initial={false}
                                    animate={{
                                        height: isCompanyOpen ? 'auto' : 0,
                                        opacity: isCompanyOpen ? 1 : 0
                                    }}
                                    className="overflow-hidden"
                                >
                                    <div className="mt-1 p-1 rounded-xl bg-secondary/30 border border-white/5 backdrop-blur-md space-y-0.5">
                                        {/* Regla Yoe: NUNCA botón de eliminar empresa. */}
                                        {!companiesUnsupported && companies.length === 0 && !companyLoadFailed && (
                                            <div className="px-3 py-3 text-center">
                                                <p className="text-xs text-muted-foreground">Sin empresas — creá la primera</p>
                                            </div>
                                        )}
                                        {companies.map((company) => (
                                            <button
                                                key={String(company.id)}
                                                onClick={() => handleCompanyChange(company)}
                                                className={cn(
                                                    'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
                                                    String(activeCompany?.id) === String(company.id)
                                                        ? 'bg-emerald-500/20 text-emerald-400'
                                                        : 'hover:bg-white/5 text-muted-foreground hover:text-foreground'
                                                )}
                                            >
                                                {company.logo ? (
                                                    <img src={company.logo} alt="" className="w-5 h-5 rounded object-contain shrink-0" />
                                                ) : (
                                                    <Building2 className="w-4 h-4 shrink-0 opacity-60" />
                                                )}
                                                <span className="truncate flex-1 text-left">{company.name}</span>
                                                {String(activeCompany?.id) === String(company.id) && (
                                                    <Check className="w-3.5 h-3.5" />
                                                )}
                                            </button>
                                        ))}
                                        {/* CTA "+ Crear empresa": SIEMPRE visible al final (spec §2) */}
                                        <button
                                            onClick={() => setShowCreateCompany(true)}
                                            className="w-full flex items-center justify-center gap-2 px-3 py-2 mt-1 rounded-lg border border-dashed border-emerald-500/30 text-emerald-400 text-sm hover:bg-emerald-500/10 hover:border-emerald-500/50 transition-colors"
                                        >
                                            <Plus className="w-4 h-4" />
                                            Crear empresa
                                        </button>
                                    </div>
                                </motion.div>
                            </div>
                        </div>

                        {/* Inventory Selector Mobile */}
                        <div className="shrink-0 px-3 mb-2">
                            <div className="relative">
                                <button
                                    onClick={() => { if (listIsEmpty) { setIsInventoryOpen(true); return; } setIsInventoryOpen(!isInventoryOpen); }}
                                    title={listIsEmpty ? 'Creá un inventario primero' : undefined}
                                    aria-disabled={listIsEmpty}
                                    data-testid="inventory-selector-toggle-mobile"
                                    data-disabled={listIsEmpty ? 'true' : 'false'}
                                    className={cn(
                                        'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300',
                                        'bg-gradient-to-r from-violet-500/10 to-purple-500/10 border border-violet-500/20',
                                        'hover:border-violet-500/40 text-left group',
                                        listIsEmpty && 'opacity-40 grayscale cursor-not-allowed hover:border-violet-500/20'
                                    )}
                                >
                                    <div className="p-1.5 rounded-lg bg-violet-500/20 text-violet-400 group-hover:text-violet-300 transition-colors">
                                        <Building2 className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                                            Inventario Activo
                                        </p>
                                        <p className="text-sm font-semibold truncate text-foreground">
                                            {currentInventoryLabel}
                                        </p>
                                    </div>
                                    <ChevronDown className={cn(
                                        "w-4 h-4 text-muted-foreground transition-transform duration-300",
                                        isInventoryOpen && "rotate-180"
                                    )} />
                                </button>

                                <motion.div
                                    initial={false}
                                    animate={{
                                        height: isInventoryOpen ? 'auto' : 0,
                                        opacity: isInventoryOpen ? 1 : 0
                                    }}
                                    className="overflow-hidden"
                                >
                                    <div className="mt-1 p-1 rounded-xl bg-secondary/30 border border-white/5 backdrop-blur-md space-y-0.5">
                                                                        {listIsEmpty && (
                                                                            <div className="px-3 py-3 text-center space-y-2" data-testid="empty-inventories">
                                                                                <p className="text-xs text-muted-foreground">Sin inventarios — creá el primero</p>
                                                                                <button
                                                                                    onClick={() => setShowCreateInventory(true)}
                                                                                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-violet-500/20 border border-violet-500/30 text-violet-300 text-sm font-semibold hover:bg-violet-500/30 transition-colors"
                                                                                >
                                                                                    <Plus className="w-4 h-4" />
                                                                                    Crear inventario
                                                                                </button>
                                                                            </div>
                                                                        )}
                                                                        {list.map((inventory) => (
                                                                            <button
                                                                                key={inventory.id}
                                                                                onClick={() => handleInventoryChange(inventory.id)}
                                                                                className={cn(
                                                                                    'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors',
                                                                                    currentInventory === inventory.id
                                                                                        ? 'bg-violet-500/20 text-violet-400'
                                                                                        : 'hover:bg-white/5 text-muted-foreground hover:text-foreground'
                                                                                )}
                                                                            >
                                                                                <span className="flex items-center gap-2 min-w-0">
                                                                                    <span className="truncate">{inventory.label}</span>
                                                                                    {/* Árbol habilitación (C): inventario suelto → badge "Sin empresa" */}
                                                                                    {inventory.company_id == null && (
                                                                                        <span data-testid="badge-sin-empresa-mobile" className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-medium bg-slate-500/20 text-muted-foreground border border-slate-500/30">Sin empresa</span>
                                                                                    )}
                                                                                </span>
                                                                                {currentInventory === inventory.id && (
                                                                                    <Check className="w-3.5 h-3.5" />
                                                                                )}
                                                                            </button>
                                                                        ))}
                                                                        {/* Botón '+' para crear inventario nuevo (espec §2) */}
                                                                        <button
                                                                            onClick={() => setShowCreateInventory(true)}
                                                                            data-testid="create-inventory-button"
                                                                            className="w-full flex items-center justify-center gap-2 px-3 py-2 mt-1 rounded-lg border border-dashed border-violet-500/30 text-violet-400 text-sm hover:bg-violet-500/10 hover:border-violet-500/50 transition-colors"
                                                                        >
                                                                            <Plus className="w-4 h-4" />
                                                                            Nuevo inventario
                                                                        </button>
                                                                    </div>
                                </motion.div>
                            </div>
                        </div>

                        {/* Navigation Mobile */}
                        <nav className="flex-1 min-h-0 px-3 py-2 space-y-3 overflow-y-auto overscroll-contain">
                            <div>
                                <p className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                                    General
                                </p>
                                {menuItems.filter(item => item.category === 'general').map((item) => (
                                    <NavLink
                                        key={item.id}
                                        to={item.path}
                                        onClick={() => setIsMobileOpen(false)}
                                        className={({ isActive }) => cn(
                                            'w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 mb-1',
                                            isActive
                                                ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/10 text-cyan-400 border border-cyan-500/30'
                                                : 'hover:bg-secondary/80 text-muted-foreground hover:text-foreground'
                                        )}
                                    >
                                        {({ isActive }) => (
                                            <>
                                                <item.icon className={cn(
                                                    'w-5 h-5 transition-colors flex-shrink-0',
                                                    isActive && 'text-cyan-400'
                                                )} />
                                                <span className="font-medium text-sm">{item.label}</span>
                                                {isActive && (
                                                    <motion.div
                                                        layoutId="activeIndicatorMobile"
                                                        className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-400"
                                                    />
                                                )}
                                            </>
                                        )}
                                    </NavLink>
                                ))}
                            </div>

                            <div>
                                <p className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                                    Operaciones
                                </p>
                                {menuItems.filter(item => item.category === 'operations' && (item.id !== 'pos' || currentInventory !== 'alm')).map((item) => {
                                    // Árbol habilitación (D): POS requiere inventario activo.
                                    const locked = item.id === 'pos' && !canSell;
                                    return (
                                    <NavLink
                                        key={item.id}
                                        to={item.path}
                                        onClick={(e) => { if (locked) { e.preventDefault(); return; } setIsMobileOpen(false); }}
                                        title={locked ? 'Seleccioná un inventario primero' : undefined}
                                        aria-disabled={locked || undefined}
                                        data-testid={`nav-${item.id}-mobile`}
                                        data-locked={locked ? 'true' : 'false'}
                                        className={({ isActive }) => cn(
                                            'w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 mb-1',
                                            isActive
                                                ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/10 text-cyan-400 border border-cyan-500/30'
                                                : 'hover:bg-secondary/80 text-muted-foreground hover:text-foreground',
                                            locked && 'opacity-40 grayscale cursor-not-allowed hover:bg-transparent'
                                        )}
                                    >
                                        {({ isActive }) => (
                                            <>
                                                <item.icon className={cn(
                                                    'w-5 h-5 transition-colors flex-shrink-0',
                                                    isActive && 'text-cyan-400'
                                                )} />
                                                <span className="font-medium text-sm">{item.label}</span>
                                            </>
                                        )}
                                    </NavLink>
                                    );
                                })}
                            </div>

                            <div>
                                <p className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                                    Gestión
                                </p>
                                {menuItems.filter(item => item.category === 'management' && (!item.adminOnly || isAdmin) && (!item.almacOnly || currentInventory === 'alm')).map((item) => {
                                    // Árbol habilitación (D): Inventario requiere activo; Traslados ≥2. Usuarios SIEMPRE habilitado.
                                    const locked = (item.id === 'inventory' && !canSell) || (item.id === 'traslados' && !canTransfer);
                                    const lockedMsg = item.id === 'traslados' ? 'Necesitás al menos 2 inventarios para trasladar' : 'Seleccioná un inventario primero';
                                    return (
                                    <NavLink
                                        key={item.id}
                                        to={item.path}
                                        onClick={(e) => { if (locked) { e.preventDefault(); return; } setIsMobileOpen(false); }}
                                        title={locked ? lockedMsg : undefined}
                                        aria-disabled={locked || undefined}
                                        data-testid={`nav-${item.id}-mobile`}
                                        data-locked={locked ? 'true' : 'false'}
                                        className={({ isActive }) => cn(
                                            'w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 mb-1',
                                            isActive
                                                ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/10 text-cyan-400 border border-cyan-500/30'
                                                : 'hover:bg-secondary/80 text-muted-foreground hover:text-foreground',
                                            locked && 'opacity-40 grayscale cursor-not-allowed hover:bg-transparent'
                                        )}
                                    >
                                        {({ isActive }) => (
                                            <>
                                                <item.icon className={cn(
                                                    'w-5 h-5 transition-colors flex-shrink-0',
                                                    isActive && 'text-cyan-400'
                                                )} />
                                                <span className="font-medium text-sm">{item.label}</span>
                                            </>
                                        )}
                                    </NavLink>
                                    );
                                })}
                            </div>

                            {/* Historiales Mobile */}
                            <div>
                                <p className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                                    Historiales
                                </p>
                                {historyMenuItems.filter(item => !item.kioskOnly || currentInventory !== 'alm').map((item) => (
                                    <NavLink
                                        key={item.id}
                                        to={item.path}
                                        onClick={() => setIsMobileOpen(false)}
                                        className={({ isActive }) => cn(
                                            'w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 mb-1',
                                            isActive
                                                ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/10 text-amber-400 border border-amber-500/30'
                                                : 'hover:bg-secondary/80 text-muted-foreground hover:text-foreground'
                                        )}
                                    >
                                        {({ isActive }) => (
                                            <>
                                                <item.icon className={cn(
                                                    'w-5 h-5 transition-colors flex-shrink-0',
                                                    isActive && 'text-amber-400'
                                                )} />
                                                <span className="font-medium text-sm">{item.label}</span>
                                            </>
                                        )}
                                    </NavLink>
                                ))}
                            </div>
                            
                            {isAdmin && (
                                <div className="mt-6">
                                    <p className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                                        Administración
                                    </p>
                                    {adminMenuItems.map((item) => (
                                        <NavLink
                                            key={item.id}
                                            to={item.path}
                                            onClick={() => setIsMobileOpen(false)}
                                            className={({ isActive }) => cn(
                                                'w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 mb-1',
                                                isActive
                                                    ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/10 text-purple-400 border border-purple-500/30'
                                                    : 'hover:bg-secondary/80 text-muted-foreground hover:text-foreground'
                                            )}
                                        >
                                            {({ isActive }) => (
                                                <>
                                                    <item.icon className={cn(
                                                        'w-5 h-5 transition-colors flex-shrink-0',
                                                        isActive && 'text-purple-400'
                                                    )} />
                                                    <span className="font-medium text-sm">{item.label}</span>
                                                </>
                                            )}
                                        </NavLink>
                                    ))}
                                </div>
                            )}
                        </nav>

                        {/* Bottom Section Mobile */}
                        <div className="shrink-0 px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] border-t border-border/50 space-y-2">
                            <motion.button
                                onClick={toggleTheme}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className={cn(
                                    'w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-300',
                                    'hover:bg-secondary/80'
                                )}
                            >
                                <div className="relative flex-shrink-0">
                                    <motion.div
                                        animate={{ rotate: isDark ? 0 : 180, opacity: isDark ? 1 : 0 }}
                                        transition={{ duration: 0.3 }}
                                        className="absolute inset-0"
                                    >
                                        <Moon className="w-5 h-5 text-purple-400" />
                                    </motion.div>
                                    <motion.div
                                        animate={{ rotate: isDark ? -180 : 0, opacity: isDark ? 0 : 1 }}
                                        transition={{ duration: 0.3 }}
                                    >
                                        <Sun className="w-5 h-5 text-amber-500" />
                                    </motion.div>
                                </div>
                                <span className="font-medium text-sm">
                                    {isDark ? 'Modo Oscuro' : 'Modo Claro'}
                                </span>
                            </motion.button>

                            <NavLink
                                to="/configuracion"
                                onClick={() => setIsMobileOpen(false)}
                                className={({ isActive }) => cn(
                                    'w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-300',
                                    isActive
                                        ? 'bg-gradient-to-r from-violet-500/20 to-purple-500/10 text-violet-400 border border-violet-500/30'
                                        : 'hover:bg-secondary/80 text-muted-foreground hover:text-foreground'
                                )}
                            >
                                {({ isActive }) => (
                                    <>
                                        <Settings className={cn(
                                            'w-5 h-5 flex-shrink-0',
                                            isActive && 'text-violet-400'
                                        )} />
                                        <span className="font-medium text-sm">Configuración</span>
                                    </>
                                )}
                            </NavLink>
                        </div>
                    </motion.aside>
                )}
            </AnimatePresence>

                        {/* Modal: crear empresa nueva (Fase Empresas §B) */}
                                            <CreateCompanyForm
                                                open={showCreateCompany}
                                                onClose={() => setShowCreateCompany(false)}
                                                onCreated={handleCompanyCreated}
                                            />
                                            {/* Modal: crear inventario nuevo (espec §2) */}
                                            <CreateInventoryForm
                                                open={showCreateInventory}
                                                onClose={() => setShowCreateInventory(false)}
                                                onCreated={handleInventoryCreated}
                                        companyId={realActiveCompanyId}
                                            />
                                            </>
                                        );
            }
