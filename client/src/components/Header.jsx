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
  Users
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
      className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8"
    >
      {/* Left Side - Title */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"
          />
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {currentPage.subtitle}
          </p>
        </div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <PageIcon className="w-7 h-7 text-cyan-400" />
          <span>{currentPage.title}:</span>
          <span className="gradient-text-cyan">{inventoryLabel}</span>
        </h1>
      </div>

      {/* Right Side - Actions */}
      <div className="flex items-center gap-3">
        {/* Notifications */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="relative p-2.5 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors"
        >
          <Bell className="w-5 h-5 text-muted-foreground" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
        </motion.button>

        {/* User Profile */}
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="flex items-center gap-3 p-2 pl-3 pr-4 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors cursor-pointer"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <User className="w-4 h-4 text-white" />
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium">{userName}</p>
            <p className="text-xs text-muted-foreground">{userRole}</p>
          </div>
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </motion.div>

        {/* New Sale Button - Solo mostrar si no estamos en POS */}
        {location.pathname !== '/pos' && (
          <motion.button
            onClick={() => navigate('/pos')}
            whileHover={{ scale: 1.02, y: -1 }}
            whileTap={{ scale: 0.98 }}
            className={cn(
              'flex items-center gap-2 px-5 py-2.5 rounded-xl',
              'bg-gradient-to-r from-cyan-500 to-blue-600',
              'text-white font-medium text-sm',
              'shadow-lg shadow-cyan-500/30',
              'hover:shadow-cyan-500/50',
              'transition-all duration-300'
            )}
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Venta</span>
          </motion.button>
        )}
      </div>
    </motion.header>
  );
}
