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
    X
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useCart } from './CartProvider';
import { Database } from 'lucide-react';

const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/', category: 'general' },
    { id: 'pos', label: 'Punto de Venta', icon: ShoppingCart, path: '/pos', category: 'operations' },
    { id: 'inventory', label: 'Inventario', icon: Package, path: '/entradas', category: 'management' },
    { id: 'purchases', label: 'Compras', icon: ArrowLeftRight, path: '/compras', category: 'management' },
    { id: 'history', label: 'Historial', icon: History, path: '/historial', category: 'management' },
    { id: 'users', label: 'Usuarios', icon: Users, path: '/usuarios', category: 'management' },
];

const adminMenuItems = [
    { id: 'migration', label: 'Migración', icon: Database, path: '/admin/migracion', category: 'admin' },
    // Historial Legacy deshabilitado temporalmente
    // { id: 'legacy-history', label: 'Historial Legacy', icon: History, path: '/admin/historial-legacy', category: 'admin' },
];

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
    const location = useLocation();
    const isMobile = useIsMobile();
    
    // Usar el contexto global del carrito para el inventario
    const { currentInventory, setCurrentInventory } = useCart();
    
    // Obtener usuario actual
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'owner';

    // Obtener el label del inventario actual
    const currentInventoryLabel = inventories.find(i => i.id === currentInventory)?.label || currentInventory.toUpperCase();

    // Cerrar menú móvil al cambiar de ruta
    useEffect(() => {
        setIsMobileOpen(false);
    }, [location.pathname]);

    const handleInventoryChange = (inventoryId) => {
        setCurrentInventory(inventoryId);
        setIsInventoryOpen(false);
        // Recargar la página para aplicar cambios en todas las vistas
        window.location.reload();
    };

    // Botón de hamburguesa para móvil (renderizado fuera del sidebar)
    const MobileMenuButton = () => (
        <button
            onClick={() => setIsMobileOpen(!isMobileOpen)}
            className={cn(
                'lg:hidden fixed top-4 left-4 z-[60] p-3 rounded-xl transition-all duration-300',
                isDark 
                    ? 'bg-slate-800/90 border border-white/10 text-white' 
                    : 'bg-white/90 border border-black/10 text-slate-900',
                'backdrop-blur-md shadow-lg'
            )}
        >
            {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
    );

    return (
        <>
            <MobileMenuButton />
            
            {/* Overlay para cerrar al hacer click fuera en móvil */}
            <AnimatePresence>
                {isMobile && isMobileOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsMobileOpen(false)}
                        className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
                    />
                )}
            </AnimatePresence>

            <motion.aside
                initial={{ x: -100, opacity: 0 }}
                animate={{ 
                    x: isMobile ? (isMobileOpen ? 0 : -280) : 0, 
                    opacity: 1 
                }}
                transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                className={cn(
                    'fixed left-0 top-0 h-screen z-50 flex flex-col transition-all duration-500',
                    isCollapsed && !isMobile ? 'w-20' : 'w-72',
                    isMobile && 'shadow-2xl'
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
                {/* Logo Section */}
                <div className="p-6 flex items-center justify-between">
                    <motion.div
                        className="flex items-center gap-3"
                        animate={{ opacity: (isCollapsed && !isMobile) ? 0 : 1 }}
                    >
                        <div className="relative">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/30">
                                <TrendingUp className="w-5 h-5 text-white" />
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-background" />
                        </div>
                        {!(isCollapsed && !isMobile) && (
                            <div>
                                <h1 className="font-bold text-lg tracking-tight">BizControl</h1>
                                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
                                    Premium System
                                </p>
                            </div>
                        )}
                    </motion.div>

                    {/* Botón colapsar solo visible en desktop */}
                    {!isMobile && (
                        <button
                            onClick={() => setIsCollapsed(!isCollapsed)}
                            className="p-2 rounded-lg hover:bg-secondary transition-colors"
                        >
                            {isCollapsed ? (
                                <ChevronRight className="w-4 h-4" />
                            ) : (
                                <ChevronLeft className="w-4 h-4" />
                            )}
                        </button>
                    )}
                </div>

                {/* Inventory Selector */}
                <div className="px-3 mb-2">
                    <div className="relative">
                        <button
                            onClick={() => !(isCollapsed && !isMobile) && setIsInventoryOpen(!isInventoryOpen)}
                            className={cn(
                                'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300',
                                'bg-gradient-to-r from-violet-500/10 to-purple-500/10 border border-violet-500/20',
                                'hover:border-violet-500/40 text-left group'
                            )}
                        >
                            <div className="p-1.5 rounded-lg bg-violet-500/20 text-violet-400 group-hover:text-violet-300 transition-colors">
                                <Building2 className="w-5 h-5" />
                            </div>

                            {!(isCollapsed && !isMobile) && (
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

                        {/* Dropdown Menu */}
                        {!(isCollapsed && !isMobile) && (
                            <motion.div
                                initial={false}
                                animate={{
                                    height: isInventoryOpen ? 'auto' : 0,
                                    opacity: isInventoryOpen ? 1 : 0
                                }}
                                className="overflow-hidden"
                            >
                                <div className="mt-1 p-1 rounded-xl bg-secondary/30 border border-white/5 backdrop-blur-md space-y-0.5">
                                    {inventories.map((inventory) => (
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
                                            <span>{inventory.label}</span>
                                            {currentInventory === inventory.id && (
                                                <Check className="w-3.5 h-3.5" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
                    {/* General Section */}
                    <div>
                        {!(isCollapsed && !isMobile) && (
                            <p className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                                General
                            </p>
                        )}
                        {menuItems.filter(item => item.category === 'general').map((item) => (
                            <NavLink
                                key={item.id}
                                to={item.path}
                                onClick={() => isMobile && setIsMobileOpen(false)}
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
                                        {!(isCollapsed && !isMobile) && (
                                            <span className="font-medium text-sm">{item.label}</span>
                                        )}
                                        {isActive && !(isCollapsed && !isMobile) && (
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

                    {/* Operations Section */}
                    <div>
                        {!(isCollapsed && !isMobile) && (
                            <p className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                                Operaciones
                            </p>
                        )}
                        {menuItems.filter(item => item.category === 'operations').map((item) => (
                            <NavLink
                                key={item.id}
                                to={item.path}
                                onClick={() => isMobile && setIsMobileOpen(false)}
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
                                        {!(isCollapsed && !isMobile) && (
                                            <span className="font-medium text-sm">{item.label}</span>
                                        )}
                                    </>
                                )}
                            </NavLink>
                        ))}
                    </div>

                    {/* Management Section */}
                    <div>
                        {!(isCollapsed && !isMobile) && (
                            <p className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                                Gestión
                            </p>
                        )}
                        {menuItems.filter(item => item.category === 'management').map((item) => (
                            <NavLink
                                key={item.id}
                                to={item.path}
                                onClick={() => isMobile && setIsMobileOpen(false)}
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
                                        {!(isCollapsed && !isMobile) && (
                                            <span className="font-medium text-sm">{item.label}</span>
                                        )}
                                    </>
                                )}
                            </NavLink>
                        ))}
                    </div>
                    
                    {/* Admin Section - Solo para admin/owner */}
                    {isAdmin && (
                        <div className="mt-6">
                            {!(isCollapsed && !isMobile) && (
                                <p className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                                    Administración
                                </p>
                            )}
                            {adminMenuItems.map((item) => (
                                <NavLink
                                    key={item.id}
                                    to={item.path}
                                    onClick={() => isMobile && setIsMobileOpen(false)}
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
                                            {!(isCollapsed && !isMobile) && (
                                                <span className="font-medium text-sm">{item.label}</span>
                                            )}
                                        </>
                                    )}
                                </NavLink>
                            ))}
                        </div>
                    )}
                </nav>

                {/* Bottom Section */}
                <div className="p-4 border-t border-border/50 space-y-3">
                    {/* Theme Toggle */}
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
                        {!(isCollapsed && !isMobile) && (
                            <span className="font-medium text-sm">
                                {isDark ? 'Modo Oscuro' : 'Modo Claro'}
                            </span>
                        )}
                    </motion.button>

                    {/* Settings */}
                    <NavLink
                        to="/configuracion"
                        onClick={() => isMobile && setIsMobileOpen(false)}
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
                                {!(isCollapsed && !isMobile) && (
                                    <span className="font-medium text-sm">Configuración</span>
                                )}
                            </>
                        )}
                    </NavLink>
                </div>
            </motion.aside>
        </>
    );
}
