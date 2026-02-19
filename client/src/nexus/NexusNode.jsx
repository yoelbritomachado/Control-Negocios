import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Crown, Building2, Shield, Package, Users, Store,
  CheckCircle2, AlertCircle, XCircle, Settings,
  MoreVertical, Trash2
} from 'lucide-react';
import { NODE_TYPES, NODE_STATUS } from './nexus.types';

// Mapa de iconos
const ICON_MAP = {
  Crown,
  Building2,
  Shield,
  Package,
  Users,
  Store
};

// Mapa de estados
const STATUS_ICONS = {
  [NODE_STATUS.ONLINE]: { icon: CheckCircle2, color: '#10b981' },
  [NODE_STATUS.OFFLINE]: { icon: XCircle, color: '#ef4444' },
  [NODE_STATUS.WARNING]: { icon: AlertCircle, color: '#f59e0b' },
  [NODE_STATUS.MAINTENANCE]: { icon: Settings, color: '#6b7280' }
};

export const NexusNode = React.memo(({
  node,
  isSelected = false,
  isConnectingFrom = false,
  onConnectionStart,
  onDelete,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  isDark = true
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);
  
  // Cerrar menu al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };
    
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMenu]);
  
  const typeConfig = NODE_TYPES[node.type?.toUpperCase()] || NODE_TYPES.EMPRESA;
  const StatusIcon = STATUS_ICONS[node.status]?.icon || CheckCircle2;
  const statusColor = STATUS_ICONS[node.status]?.color || '#10b981';
  const IconComponent = ICON_MAP[typeConfig.icon] || Building2;

  // Formatear valores de métricas
  const formatMetric = (key, value) => {
    if (typeof value === 'number') {
      if (key.toLowerCase().includes('ventas') || key.toLowerCase().includes('efectivo')) {
        return `$${value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value}`;
      }
      return value.toString();
    }
    return value;
  };

  // Obtener etiqueta de métrica
  const getMetricLabel = (key) => {
    const labels = {
      sucursales: 'SUCURSALES',
      empleados: 'EMPLEADOS',
      ingresos: 'INGRESOS',
      acceso: 'ACCESO',
      nivel: 'NIVEL',
      productos: 'PRODUCTOS',
      stockBajo: 'STOCK BAJO',
      capacidad: 'CAPACIDAD',
      pedidos: 'PEDIDOS',
      activos: 'ACTIVOS',
      ventasHoy: 'VENTAS HOY',
      clientes: 'CLIENTES',
      abiertas: 'ABIERTAS',
      ventas: 'VENTAS',
      efectivo: 'EFECTIVO',
      transacciones: 'TRANS.'
    };
    return labels[key] || key.toUpperCase();
  };

  // Colores de fondo según tema
  const bgGradient = isDark 
    ? `linear-gradient(135deg, ${typeConfig.bgColor} 0%, rgba(15, 23, 42, 0.95) 100%)`
    : `linear-gradient(135deg, ${typeConfig.bgColor} 0%, rgba(255, 255, 255, 0.95) 100%)`;
  
  const shadowStyle = isConnectingFrom
    ? '0 0 30px #3b82f680, 0 10px 40px rgba(0,0,0,0.4)'
    : isSelected 
      ? `0 0 20px ${typeConfig.color}40, 0 4px 20px rgba(0,0,0,0.3)`
      : isDark 
        ? `0 4px 15px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.05)`
        : `0 4px 15px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.8)`;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      whileHover={{ scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      style={{
        background: bgGradient,
        borderColor: isConnectingFrom ? '#3b82f6' : isSelected ? typeConfig.color : typeConfig.borderColor,
        boxShadow: shadowStyle
      }}
      className={`
        relative w-[260px] min-h-[160px] rounded-xl cursor-grab active:cursor-grabbing
        border-2 transition-all duration-200 touch-none
        ${isSelected ? (isDark ? 'ring-2 ring-offset-2 ring-offset-slate-900' : 'ring-2 ring-offset-2 ring-offset-white') : ''}
        ${isConnectingFrom ? 'animate-pulse' : ''}
      `}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Connection Point - INPUT (top center) */}
      <div 
        className={`absolute -top-[5px] left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full border-2 z-30 transition-colors duration-300 ${isDark ? 'bg-slate-500 border-slate-800' : 'bg-slate-400 border-white'}`}
        title="Punto de entrada"
      />
      
      {/* Connection Point - OUTPUT (bottom center) */}
      <div 
        className={`absolute -bottom-[5px] left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full border-2 z-30 cursor-crosshair hover:scale-125 transition-transform shadow-lg touch-none ${isDark ? 'border-slate-800' : 'border-white'}`}
        style={{ backgroundColor: typeConfig.color }}
        onMouseDown={(e) => onConnectionStart?.(e, node)}
        onTouchStart={(e) => {
          e.stopPropagation();
          onConnectionStart?.(e, node);
        }}
        title="Arrastra para conectar a otro nodo"
      />

      {/* Header */}
      <div 
        className="px-3 py-2.5 flex items-center justify-between"
        style={{ borderBottom: `1px solid ${typeConfig.borderColor}` }}
      >
        <div className="flex items-center gap-2.5">
          <div 
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ 
              background: `linear-gradient(135deg, ${typeConfig.color}30 0%, ${typeConfig.color}10 100%)`,
              border: `1px solid ${typeConfig.color}40`
            }}
          >
            <IconComponent 
              size={16} 
              style={{ color: typeConfig.color }}
            />
          </div>
          <div className="min-w-0">
            <h3 className={`font-semibold text-sm leading-tight truncate max-w-[140px] transition-colors duration-300 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {node.name || typeConfig.label}
            </h3>
            <p className={`text-[10px] transition-colors duration-300 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{typeConfig.label}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <StatusIcon 
            size={16} 
            style={{ color: statusColor }}
            className={node.status === NODE_STATUS.ONLINE ? 'animate-pulse' : ''}
          />
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            onTouchStart={(e) => e.stopPropagation()}
            className={`p-1 rounded transition-colors duration-300 touch-manipulation ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}
          >
            <MoreVertical size={14} className={`transition-colors duration-300 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
          </button>
        </div>
      </div>

      {/* Dropdown Menu */}
      {showMenu && (
        <motion.div
          ref={menuRef}
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className={`absolute top-10 right-2 z-50 rounded-lg shadow-xl border py-1 min-w-[100px] transition-colors duration-300 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}
        >
          <button
            onClick={(e) => { e.stopPropagation(); onDelete?.(); setShowMenu(false); }}
            className={`w-full px-3 py-1.5 text-left text-xs transition-colors flex items-center gap-2 ${isDark ? 'text-red-400 hover:bg-slate-700 hover:text-red-300' : 'text-red-500 hover:bg-slate-100 hover:text-red-600'}`}
          >
            <Trash2 size={12} />
            Eliminar
          </button>
        </motion.div>
      )}

      {/* Description */}
      <div className="px-3 py-2">
        <p className={`text-[11px] line-clamp-2 leading-relaxed transition-colors duration-300 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
          {node.description || typeConfig.description}
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="px-3 pb-3">
        <div className="grid grid-cols-2 gap-1.5">
          {Object.entries(node.metrics || {}).slice(0, 4).map(([key, value]) => (
            <div 
              key={key}
              className={`rounded-md px-2 py-1.5 border transition-colors duration-300 ${isDark ? 'bg-slate-800/50 border-slate-700/50' : 'bg-slate-100/50 border-slate-200/50'}`}
            >
              <p className={`text-[9px] uppercase tracking-wider truncate transition-colors duration-300 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                {getMetricLabel(key)}
              </p>
              <p 
                className="text-xs font-bold truncate"
                style={{ color: typeConfig.color }}
              >
                {formatMetric(key, value)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Connection hint overlay */}
      {isConnectingFrom && (
        <div className="absolute inset-0 bg-blue-500/10 flex items-center justify-center pointer-events-none rounded-xl">
          <span className={`text-xs font-medium text-blue-500 px-3 py-1.5 rounded-full shadow-lg transition-colors duration-300 ${isDark ? 'bg-slate-900/90' : 'bg-white/90'}`}>
            Suelta sobre otro nodo
          </span>
        </div>
      )}
    </motion.div>
  );
});

NexusNode.displayName = 'NexusNode';

export default NexusNode;
