import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
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
  Check,
  Clock,
  CheckCheck,
  AlertCircle,
  Info,
  Grid3X3,
  Truck,
  AlertTriangle,
  Receipt,
  Trash2,
  Database,
  Settings,
  UserCheck,
  RefreshCw,
  Bot
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useNavigate, useLocation } from 'react-router-dom';
import { useCart } from './CartProvider';
import { useRole, ROLES } from '../hooks/useRole';
import { useNotifications } from '../hooks/useNotifications';
import { OfflineStatusBar, SyncButton } from '../offline';
import ProfileModal from './ProfileModal';
import UnifiedSyncModal from './UnifiedSyncModal';
import MichuAssistantModal from './MichuAssistantModal';

const pageTitles = {
  '/': { title: 'Dashboard', subtitle: 'Monitoreo activo de flujos de caja', icon: LayoutDashboard },
  '/pos': { title: 'Punto de Venta', subtitle: 'Sistema de cobro y gestion de ventas', icon: ShoppingCart },
  '/inventario': { title: 'Inventario', subtitle: 'Control de stock y productos', icon: Package },
  '/entradas': { title: 'Entradas de Mercancía', subtitle: 'Recepción y registro de compras', icon: ArrowLeftRight },
  '/compras': { title: 'Compras', subtitle: 'Gestión de órdenes y compras', icon: ArrowLeftRight },
  '/traslados': { title: 'Traslados', subtitle: 'Movimiento de stock entre sedes', icon: Truck },
  '/mermas': { title: 'Mermas y Ajustes', subtitle: 'Control de pérdidas y bajas de producto', icon: AlertTriangle },
  '/usuarios': { title: 'Usuarios y Permisos', subtitle: 'Administración de personal y accesos', icon: Users },
  '/nexus': { title: 'Nexus Node', subtitle: 'Arquitectura y topología nodal del negocio', icon: Grid3X3 },
  '/historial': { title: 'Historial', subtitle: 'Registro general de operaciones', icon: History },
  '/historial/ventas': { title: 'Historial de Ventas', subtitle: 'Auditoría de tickets y cobros', icon: Receipt },
  '/historial/traslados': { title: 'Historial de Traslados y Entradas', subtitle: 'Registro de transferencias y recepciones', icon: ArrowLeftRight },
  '/historial/mermas': { title: 'Historial de Mermas', subtitle: 'Auditoría de bajas y ajustes', icon: Trash2 },
  '/configuracion': { title: 'Configuración', subtitle: 'Ajustes del sistema y preferencias', icon: Settings },
  '/admin/migracion': { title: 'Migración y Backups', subtitle: 'Gestión de datos y bases legadas', icon: Database },
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

// Icono según tipo de notificación
const notificationIcons = {
  session_pending: { icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/20' },
  session_approved: { icon: Check, color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
  low_stock: { icon: AlertCircle, color: 'text-rose-400', bg: 'bg-rose-500/20' },
  default: { icon: Info, color: 'text-blue-400', bg: 'bg-blue-500/20' }
};

// Formatear tiempo relativo
const formatRelativeTime = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const diff = Math.floor((now - date) / 1000); // segundos
  
  if (diff < 60) return 'Hace un momento';
  if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} h`;
  return `Hace ${Math.floor(diff / 86400)} d`;
};

export function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentInventory } = useCart();
  const { currentRole, userName, changeRole, getRoleInfo, ROLES: RolesList } = useRole();
  const { notifications, unreadCount, markAsRead, markAllAsRead, isOnline } = useNotifications();
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [assistantModalOpen, setAssistantModalOpen] = useState(false);

  const currentPage = pageTitles[location.pathname] || pageTitles['/'];
  const PageIcon = currentPage.icon;
  
  const inventoryLabel = inventoryLabels[currentInventory] || currentInventory.toUpperCase();
  const roleInfo = getRoleInfo();
  const RoleIcon = roleIcons[currentRole] || User;

  const handleRoleChange = (roleId) => {
    const names = {
      [ROLES.OWNER.id]: 'Dueno',
      [ROLES.ADMIN.id]: 'Administrador', 
      [ROLES.SELLER.id]: 'Vendedor'
    };
    changeRole(roleId, names[roleId]);
    setRoleDropdownOpen(false);
  };

  const handleNotificationClick = (notification) => {
    if (!notification.is_read) {
      markAsRead(notification.id);
    }
    
    // Navegar según el tipo de notificación
    if (notification.type === 'session_pending') {
      navigate('/historial');
    }
    
    setNotificationsOpen(false);
  };

  const handleMarkAllRead = (e) => {
    e.stopPropagation();
    markAllAsRead();
  };

  const isNexus = location.pathname.startsWith('/nexus');

  return (
    <header className={cn(
      "flex flex-col lg:flex-row lg:items-center justify-between gap-3 lg:gap-4",
      isNexus ? "mb-2 lg:mb-3" : "mb-6 lg:mb-8"
    )}>
      {/* Top Mobile Bar / Title Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 pl-12 lg:pl-0">
          <div className="flex items-center gap-2 lg:gap-3 mb-1">
            <div className="w-1.5 h-1.5 lg:w-2 lg:h-2 rounded-full bg-cyan-400 flex-shrink-0" />
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

        {/* Action icons en móvil alineados a la derecha del header */}
        <div className="flex lg:hidden items-center gap-2">
          {/* Botón Sincronizar Móvil */}
          <button
            onClick={() => setSyncModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/20 active:scale-95 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Sincronizar</span>
          </button>
        </div>
      </div>

      {/* Right Side - Actions & Dropdowns */}
      <div className="flex items-center justify-end gap-2 lg:gap-3">
        {/* Offline Status Bar (Desktop) */}
        <div className="hidden lg:block">
          <OfflineStatusBar />
        </div>
        
        {/* Botón Asistente MichuSourcing */}
        <motion.button
          onClick={() => setAssistantModalOpen(true)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/30 text-pink-300 text-xs font-semibold transition-all shadow-sm"
          title="Asistente de Abastecimiento y Soporte"
        >
          <Bot className="w-4 h-4 text-pink-400" />
          <span className="hidden sm:inline">MichuSourcing</span>
        </motion.button>

        {/* Sync Button Unificado (Desktop) */}
        <div className="hidden md:block">
          <button
            onClick={() => setSyncModalOpen(true)}
            className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-semibold shadow-md shadow-blue-600/25 active:scale-95 transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Sincronizar</span>
          </button>
        </div>
        {/* Notifications - Solo para Admin/Dueno */}
        {(currentRole === ROLES.ADMIN.id || currentRole === ROLES.OWNER.id) && (
          <div className="relative">
            <motion.button
              onClick={() => {
                setNotificationsOpen(!notificationsOpen);
                setRoleDropdownOpen(false);
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={cn(
                "relative p-2 lg:p-2.5 rounded-xl transition-colors",
                isOnline ? "bg-secondary/50 hover:bg-secondary" : "bg-slate-800/50 opacity-60"
              )}
              title={isOnline ? "Notificaciones" : "Sin conexión al servidor"}
            >
              <Bell className="w-4 h-4 lg:w-5 lg:h-5 text-muted-foreground" />
              {/* Badge de no leídas (solo si hay conexión) */}
              {isOnline && unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
              {/* Indicador offline */}
              {!isOnline && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-slate-500" />
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
                  className="fixed sm:absolute right-2 sm:right-0 top-16 sm:top-full sm:mt-2 w-[calc(100vw-1rem)] sm:w-96 max-w-sm bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden"
                >
                  <div className="p-3 border-b border-slate-800 flex items-center justify-between">
                    <h3 className="font-semibold text-sm">Notificaciones</h3>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                      >
                        <CheckCheck className="w-3 h-3" />
                        Marcar todo
                      </button>
                    )}
                  </div>
                  
                  <div className="max-h-80 overflow-y-auto custom-scrollbar">
                    {!isOnline ? (
                      <div className="p-8 text-center">
                        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center mx-auto mb-2">
                          <span className="w-2 h-2 rounded-full bg-slate-500" />
                        </div>
                        <p className="text-sm text-muted-foreground">Sin conexión al servidor</p>
                        <p className="text-xs text-slate-500 mt-1">Las notificaciones se actualizarán cuando vuelva la conexión</p>
                      </div>
                    ) : notifications.length === 0 ? (
                      <div className="p-8 text-center">
                        <Bell className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">No hay notificaciones</p>
                      </div>
                    ) : (
                      notifications.map((notification) => {
                        const config = notificationIcons[notification.type] || notificationIcons.default;
                        const Icon = config.icon;
                        
                        return (
                          <button
                            key={notification.id}
                            onClick={() => handleNotificationClick(notification)}
                            className={cn(
                              'w-full text-left p-3 hover:bg-slate-800/50 transition-colors border-b border-slate-800/50 last:border-0',
                              !notification.is_read && 'bg-slate-800/20'
                            )}
                          >
                            <div className="flex items-start gap-3">
                              <div className={cn(
                                'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                                config.bg
                              )}>
                                <Icon className={cn('w-4 h-4', config.color)} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={cn(
                                  'text-sm',
                                  notification.is_read ? 'text-slate-300' : 'text-white font-medium'
                                )}>
                                  {notification.title}
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                  {notification.message}
                                </p>
                                <p className="text-[10px] text-slate-500 mt-1">
                                  {formatRelativeTime(notification.created_at)}
                                </p>
                              </div>
                              {!notification.is_read && (
                                <div className="w-2 h-2 rounded-full bg-cyan-400 mt-1.5 flex-shrink-0" />
                              )}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Role & User Profile Dropdown */}
        <div className="relative">
          <motion.button
            onClick={() => {
              setRoleDropdownOpen(!roleDropdownOpen);
              setNotificationsOpen(false);
            }}
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
                className="fixed sm:absolute right-2 sm:right-0 top-16 sm:top-full sm:mt-2 w-[calc(100vw-1rem)] sm:w-56 max-w-xs bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden"
              >
                <div className="p-3 border-b border-slate-800 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Cambiar Rol</p>
                  <button
                    type="button"
                    onClick={() => {
                      setRoleDropdownOpen(false);
                      setProfileOpen(true);
                    }}
                    className="text-[11px] text-cyan-400 hover:text-cyan-300 font-medium hover:underline flex items-center gap-1"
                  >
                    <User className="w-3 h-3" />
                    <span>Mi Perfil</span>
                  </button>
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
                    Cambiar rol recargara la pagina
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>


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

      {/* Modal de Mi Perfil */}
      <ProfileModal 
        isOpen={profileOpen} 
        onClose={() => setProfileOpen(false)} 
      />

      {/* Centro Unificado de Sincronización */}
      <UnifiedSyncModal
        isOpen={syncModalOpen}
        onClose={() => setSyncModalOpen(false)}
        isOnline={isOnline}
      />

      {/* Asistente MichuSourcing */}
      <MichuAssistantModal
        isOpen={assistantModalOpen}
        onClose={() => setAssistantModalOpen(false)}
      />
    </header>
  );
}
