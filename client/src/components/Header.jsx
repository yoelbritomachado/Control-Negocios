import { motion } from 'framer-motion';
import {
  Plus,
  Bell,
  User,
  ChevronDown,
  LayoutDashboard,
  ShoppingCart,
  Package,
  ArrowLeftRight,
  Users,
  History
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useNavigate, useLocation } from 'react-router-dom';
import { useCart } from './CartProvider';

const pageTitles = {
  '/': { title: 'Dashboard', subtitle: 'Monitoreo activo de flujos de caja', icon: LayoutDashboard },
  '/pos': { title: 'Punto de Venta', subtitle: 'Sistema de cobro y gestion de ventas', icon: ShoppingCart },
  '/entradas': { title: 'Inventario', subtitle: 'Control de stock y productos', icon: Package },
  '/compras': { title: 'Compras', subtitle: 'Gestion de entradas de mercancia', icon: ArrowLeftRight },
  '/usuarios': { title: 'Usuarios', subtitle: 'Administracion de usuarios y permisos', icon: Users },
  '/historial': { title: 'Historial', subtitle: 'Registro de operaciones del sistema', icon: History },
};

const inventoryLabels = {
  mch1: 'MCH 1',
  mch2: 'MCH 2',
  alm: 'Almacen'
};

export function Header({ userName, userRole }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentInventory } = useCart();

  const currentPage = pageTitles[location.pathname] || pageTitles['/'];
  const PageIcon = currentPage.icon;
  
  const inventoryLabel = inventoryLabels[currentInventory] || currentInventory.toUpperCase();

  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
      className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 lg:gap-4 mb-6 lg:mb-8"
    >
      {/* Left Side - Title */}
      <div className="min-w-0 pl-12 lg:pl-0">
        <div className="flex items-center gap-2 lg:gap-3 mb-1">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="w-1.5 h-1.5 lg:w-2 lg:h-2 rounded-full bg-cyan-400 animate-pulse flex-shrink-0"
          />
          <p className="text-[10px] lg:text-xs font-medium text-muted-foreground uppercase tracking-wider truncate">
            {currentPage.subtitle}
          </p>
        </div>
        <h1 className="text-lg sm:text-xl lg:text-3xl font-bold tracking-tight flex items-center gap-1.5 lg:gap-3">
          <PageIcon className="w-5 h-5 lg:w-7 lg:h-7 text-cyan-400 flex-shrink-0" />
          <span className="truncate">{currentPage.title}:</span>
          <span className="gradient-text-cyan truncate">{inventoryLabel}</span>
        </h1>
      </div>

      {/* Right Side - Actions */}
      <div className="flex items-center gap-2 lg:gap-3">
        {/* Notifications */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="relative p-2 lg:p-2.5 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors"
        >
          <Bell className="w-4 h-4 lg:w-5 lg:h-5 text-muted-foreground" />
          <span className="absolute top-1 right-1 w-1.5 h-1.5 lg:w-2 lg:h-2 rounded-full bg-rose-500 animate-pulse" />
        </motion.button>

        {/* User Profile */}
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="flex items-center gap-2 lg:gap-3 p-1.5 lg:p-2 pl-2 lg:pl-3 pr-2 lg:pr-4 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors cursor-pointer"
        >
          <div className="w-7 h-7 lg:w-8 lg:h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0">
            <User className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-white" />
          </div>
          <div className="hidden sm:block min-w-0">
            <p className="text-sm font-medium truncate">{userName}</p>
            <p className="text-xs text-muted-foreground hidden lg:block">{userRole}</p>
          </div>
          <ChevronDown className="w-4 h-4 text-muted-foreground hidden sm:block" />
        </motion.div>

        {/* New Sale Button - Solo mostrar si no estamos en POS */}
        {location.pathname !== '/pos' && (
          <motion.button
            onClick={() => navigate('/pos')}
            whileHover={{ scale: 1.02, y: -1 }}
            whileTap={{ scale: 0.98 }}
            className={cn(
              'flex items-center gap-1.5 lg:gap-2 px-3 lg:px-5 py-2 lg:py-2.5 rounded-xl',
              'bg-gradient-to-r from-cyan-500 to-blue-600',
              'text-white font-medium text-sm',
              'shadow-lg shadow-cyan-500/30',
              'hover:shadow-cyan-500/50',
              'transition-all duration-300'
            )}
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nueva Venta</span>
            <span className="sm:hidden">Venta</span>
          </motion.button>
        )}
      </div>
    </motion.header>
  );
}
