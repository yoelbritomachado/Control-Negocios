import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  History,
  Crown,
  Shield,
  ShoppingBag,
  Check
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useNavigate, useLocation } from 'react-router-dom';
import { useCart } from './CartProvider';
import { useRole, ROLES } from '../hooks/useRole';

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

// Icono según rol
const roleIcons = {
  [ROLES.OWNER.id]: Crown,
  [ROLES.ADMIN.id]: Shield,
  [ROLES.SELLER.id]: ShoppingBag
};

// Color de fondo según rol
const roleBgColors = {
  [ROLES.OWNER.id]: 'from-amber-500 to-orange-600',
  [ROLES.ADMIN.id]: 'from-violet-500 to-purple-600',
  [ROLES.SELLER.id]: 'from-emerald-500 to-teal-600'
};

export function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentInventory } = useCart();
  const { currentRole, userName, changeRole, getRoleInfo, ROLES: RolesList } = useRole();
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const currentPage = pageTitles[location.pathname] || pageTitles['/'];
  const PageIcon = currentPage.icon;
  
  const inventoryLabel = inventoryLabels[currentInventory] || currentInventory.toUpperCase();
  const roleInfo = getRoleInfo();
  const RoleIcon = roleIcons[currentRole] || User;

  const handleRoleChange = (roleId) => {
    const names = {
      [ROLES.OWNER.id]: 'Dueño',
      [ROLES.ADMIN.id]: 'Administrador', 
      [ROLES.SELLER.id]: 'Vendedor'
    };
    changeRole(roleId, names[roleId]);
    setRoleDropdownOpen(false);
  };

  // Contador de notificaciones (simulado por ahora)
  const notificationCount = currentRole === ROLES.ADMIN.id || currentRole === ROLES.OWNER.id ? 2 : 0;

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
        {/* Notifications - Solo para Admin/Dueño */}
        {(currentRole === ROLES.ADMIN.id || currentRole === ROLES.OWNER.id) && (
          <div className="relative">
            <motion.button
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="relative p-2 lg:p-2.5 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors"
            >
              <Bell className="w-4 h-4 lg:w-5 lg:h-5 text-muted-foreground" />
              {notificationCount > 0 && (
                <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                  {notificationCount}
                </span>
              )}
            </motion.button>
            
            {/* Dropdown de Notificaciones */}
            <AnimatePresence>
              {notificationsOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 w-80 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden"
                >
                  <div className="p-3 border-b border-slate-800">
                    <h3 className="font-semibold text-sm">Notificaciones</h3>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    <div className="p-3 hover:bg-slate-800/50 cursor-pointer border-b border-slate-800/50">
                      <div className="flex items-start gap-2">
                        <div className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium">Sesión pendiente de revisión</p>
                          <p className="text-xs text-muted-foreground mt-0.5">El vendedor envió una sesión para cerrar</p>
                          <p className="text-[10px] text-muted-foreground mt-1">Hace 5 minutos</p>
                        </div>
                      </div>
                    </div>
                    <div className="p-3 hover:bg-slate-800/50 cursor-pointer">
                      <div className="flex items-start gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium">Stock bajo</p>
                          <p className="text-xs text-muted-foreground mt-0.5">3 productos están por debajo del mínimo</p>
                          <p className="text-[10px] text-muted-foreground mt-1">Hace 1 hora</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Role & User Profile Dropdown */}
        <div className="relative">
          <motion.button
            onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
            whileHover={{ scale: 1.02 }}
            className={cn(
              'flex items-center gap-2 lg:gap-3 p-1.5 lg:p-2 pl-2 lg:pl-3 pr-2 lg:pr-3 rounded-xl',
              'bg-secondary/50 hover:bg-secondary transition-colors'
            )}
          >
            <div className={cn(
              'w-7 h-7 lg:w-8 lg:h-8 rounded-lg bg-gradient-to-br flex items-center justify-center flex-shrink-0',
              roleBgColors[currentRole] || roleBgColors[ROLES.ADMIN.id]
            )}>
              <RoleIcon className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-white" />
            </div>
            <div className="hidden sm:block min-w-0 text-left">
              <p className="text-sm font-medium truncate">{userName}</p>
              <p className={cn('text-xs hidden lg:block', roleInfo.color)}>
                {roleInfo.label}
              </p>
            </div>
            <ChevronDown className={cn(
              'w-4 h-4 text-muted-foreground hidden sm:block transition-transform',
              roleDropdownOpen && 'rotate-180'
            )} />
          </motion.button>

          {/* Dropdown de Roles */}
          <AnimatePresence>
            {roleDropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-2 w-56 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden"
              >
                <div className="p-3 border-b border-slate-800">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Cambiar Rol</p>
                </div>
                
                {Object.values(RolesList).map((role) => {
                  const Icon = roleIcons[role.id];
                  const isActive = currentRole === role.id;
                  
                  return (
                    <button
                      key={role.id}
                      onClick={() => handleRoleChange(role.id)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-800/50 transition-colors text-left',
                        isActive && 'bg-slate-800/30'
                      )}
                    >
                      <div className={cn(
                        'w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center',
                        roleBgColors[role.id]
                      )}>
                        <Icon className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          'text-sm font-medium',
                          isActive ? role.color : 'text-foreground'
                        )}>
                          {role.label}
                        </p>
                      </div>
                      {isActive && (
                        <Check className={cn('w-4 h-4', role.color)} />
                      )}
                    </button>
                  );
                })}
                
                <div className="p-2 border-t border-slate-800 bg-slate-900/50">
                  <p className="text-[10px] text-muted-foreground text-center">
                    Cambiar rol recargará la página
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

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

      {/* Backdrop para cerrar dropdowns */}
      {(roleDropdownOpen || notificationsOpen) && (
        <div 
          className="fixed inset-0 z-40"
          onClick={() => {
            setRoleDropdownOpen(false);
            setNotificationsOpen(false);
          }}
        />
      )}
    </motion.header>
  );
}
