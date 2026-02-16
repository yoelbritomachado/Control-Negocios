import { useState } from 'react';
import { motion } from 'framer-motion';
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
    Check
} from 'lucide-react';
import { cn } from '../lib/utils';

const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/', category: 'general' },
    { id: 'pos', label: 'Punto de Venta', icon: ShoppingCart, path: '/pos', category: 'operations' },
    { id: 'inventory', label: 'Inventario', icon: Package, path: '/entradas', category: 'management' },
    { id: 'purchases', label: 'Compras', icon: ArrowLeftRight, path: '/compras', category: 'management' },
    { id: 'users', label: 'Usuarios', icon: Users, path: '/usuarios', category: 'management' },
];

export function Sidebar({ isDark, toggleTheme }) {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [selectedInventory, setSelectedInventory] = useState('MCH1');
    const [isInventoryOpen, setIsInventoryOpen] = useState(false);
    const location = useLocation();

    const inventories = [
        { id: 'MCH1', label: 'MCH1' },
        { id: 'MCH2', label: 'MCH2' },
        { id: 'Almacen', label: 'Almacén' },
    ];

    return (
        <motion.aside
            initial={{ x: -100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
            className={cn(
                'fixed left-0 top-0 h-screen z-50 flex flex-col transition-all duration-500',
                isCollapsed ? 'w-20' : 'w-72'
            )}
            style={{
                background: isDark
                    ? 'linear-gradient(180deg, rgba(15, 23, 42, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%)'
                    : 'linear-gradient(180deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 250, 252, 0.98) 100%)',
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
                    animate={{ opacity: isCollapsed ? 0 : 1 }}
                >
                    <div className="relative">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/30">
                            <TrendingUp className="w-5 h-5 text-white" />
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-background" />
                    </div>
                    {!isCollapsed && (
                        <div>
                            <h1 className="font-bold text-lg tracking-tight">BizControl</h1>
                            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
                                Premium System
                            </p>
                        </div>
                    )}
                </motion.div>

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
            </div>

            {/* Inventory Selector */}
            <div className="px-3 mb-2">
                <div className="relative">
                    <button
                        onClick={() => !isCollapsed && setIsInventoryOpen(!isInventoryOpen)}
                        className={cn(
                            'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300',
                            'bg-gradient-to-r from-violet-500/10 to-purple-500/10 border border-violet-500/20',
                            'hover:border-violet-500/40 text-left group'
                        )}
                    >
                        <div className="p-1.5 rounded-lg bg-violet-500/20 text-violet-400 group-hover:text-violet-300 transition-colors">
                            <Building2 className="w-5 h-5" />
                        </div>

                        {!isCollapsed && (
                            <>
                                <div className="flex-1 overflow-hidden">
                                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                                        Inventario
                                    </p>
                                    <p className="text-sm font-semibold truncate text-foreground">
                                        {inventories.find(i => i.id === selectedInventory)?.label}
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
                                {inventories.map((inventory) => (
                                    <button
                                        key={inventory.id}
                                        onClick={() => {
                                            setSelectedInventory(inventory.id);
                                            setIsInventoryOpen(false);
                                        }}
                                        className={cn(
                                            'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors',
                                            selectedInventory === inventory.id
                                                ? 'bg-violet-500/20 text-violet-400'
                                                : 'hover:bg-white/5 text-muted-foreground hover:text-foreground'
                                        )}
                                    >
                                        <span>{inventory.label}</span>
                                        {selectedInventory === inventory.id && (
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
                                        'w-5 h-5 transition-colors',
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

                {/* Operations Section */}
                <div>
                    {!isCollapsed && (
                        <p className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                            Operaciones
                        </p>
                    )}
                    {menuItems.filter(item => item.category === 'operations').map((item) => (
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
                                        'w-5 h-5 transition-colors',
                                        isActive && 'text-cyan-400'
                                    )} />
                                    {!isCollapsed && (
                                        <span className="font-medium text-sm">{item.label}</span>
                                    )}
                                </>
                            )}
                        </NavLink>
                    ))}
                </div>

                {/* Management Section */}
                <div>
                    {!isCollapsed && (
                        <p className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                            Gestión
                        </p>
                    )}
                    {menuItems.filter(item => item.category === 'management').map((item) => (
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
                                        'w-5 h-5 transition-colors',
                                        isActive && 'text-cyan-400'
                                    )} />
                                    {!isCollapsed && (
                                        <span className="font-medium text-sm">{item.label}</span>
                                    )}
                                </>
                            )}
                        </NavLink>
                    ))}
                </div>
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
                    <div className="relative">
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

                {/* Settings */}
                <motion.button
                    whileHover={{ x: 4 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-all duration-300"
                >
                    <Settings className="w-5 h-5" />
                    {!isCollapsed && <span className="font-medium text-sm">Configuración</span>}
                </motion.button>
            </div>
        </motion.aside>
    );
}
