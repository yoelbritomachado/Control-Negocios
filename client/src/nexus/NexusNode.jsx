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
  onDelete
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

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      whileHover={{ scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      style={{
        background: `linear-gradient(135deg, ${typeConfig.bgColor} 0%, rgba(15, 23, 42, 0.95) 100%)`,
        borderColor: isConnectingFrom ? '#3b82f6' : isSelected ? typeConfig.color : typeConfig.borderColor,
        boxShadow: isConnectingFrom
          ? '0 0 30px #3b82f680, 0 10px 40px rgba(0,0,0,0.4)'
          : isSelected 
            ? `0 0 20px ${typeConfig.color}40, 0 4px 20px rgba(0,0,0,0.3)`
            : `0 4px 15px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.05)`
      }}
      className={`
        relative w-[260px] min-h-[160px] rounded-xl cursor-grab active:cursor-grabbing
        border-2 transition-all duration-200
        ${isSelected ? 'ring-2 ring-offset-2 ring-offset-slate-900' : ''}
        ${isConnectingFrom ? 'animate-pulse' : ''}
      `}
    >
      {/* Connection Point - INPUT (top center) */}
      <div 
        className="absolute -top-[5px] left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-slate-500 border-2 border-slate-800 z-30"
        title="Punto de entrada"
      />
      
      {/* Connection Point - OUTPUT (bottom center) */}
      <div 
        className="absolute -bottom-[5px] left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full border-2 border-slate-800 z-30 cursor-crosshair hover:scale-125 transition-transform shadow-lg"
        style={{ backgroundColor: typeConfig.color }}
        onMouseDown={(e) => onConnectionStart?.(e, node)}
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
            <h3 className="font-semibold text-white text-sm leading-tight truncate max-w-[140px]">
              {node.name || typeConfig.label}
            </h3>
            <p className="text-[10px] text-slate-400">{typeConfig.label}</p>
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
            className="p-1 rounded hover:bg-white/10 transition-colors"
          >
            <MoreVertical size={14} className="text-slate-400" />
          </button>
        </div>
      </div>

      {/* Dropdown Menu */}
      {showMenu && (
        <motion.div
          ref={menuRef}
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-10 right-2 z-50 bg-slate-800 rounded-lg shadow-xl border border-slate-700 py-1 min-w-[100px]"
        >
          <button
            onClick={(e) => { e.stopPropagation(); onDelete?.(); setShowMenu(false); }}
            className="w-full px-3 py-1.5 text-left text-xs text-red-400 hover:bg-slate-700 hover:text-red-300 transition-colors flex items-center gap-2"
          >
            <Trash2 size={12} />
            Eliminar
          </button>
        </motion.div>
      )}

      {/* Description */}
      <div className="px-3 py-2">
        <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
          {node.description || typeConfig.description}
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="px-3 pb-3">
        <div className="grid grid-cols-2 gap-1.5">
          {Object.entries(node.metrics || {}).slice(0, 4).map(([key, value]) => (
            <div 
              key={key}
              className="bg-slate-800/50 rounded-md px-2 py-1.5 border border-slate-700/50"
            >
              <p className="text-[9px] text-slate-500 uppercase tracking-wider truncate">
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
          <span className="text-xs font-medium text-blue-400 bg-slate-900/90 px-3 py-1.5 rounded-full shadow-lg">
            Suelta sobre otro nodo
          </span>
        </div>
      )}
    </motion.div>
  );
});

NexusNode.displayName = 'NexusNode';

export default NexusNode;
