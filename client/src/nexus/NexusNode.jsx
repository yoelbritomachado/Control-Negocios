import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Building2, Shield, Package, Users, Wallet,
  CheckCircle2, AlertCircle, XCircle, Settings,
  ChevronDown, ChevronUp, MoreVertical
} from 'lucide-react';
import { NODE_TYPES, NODE_STATUS, NODE_ICONS } from './nexus.types';

// Mapa de iconos
const ICON_MAP = {
  Building2,
  Shield,
  Package,
  Users,
  Wallet
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
  isExpanded = false,
  isConnecting = false,
  onSelect,
  onExpand,
  onEdit,
  onDelete,
  style
}) => {
  const [showMenu, setShowMenu] = useState(false);
  
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
      initial={{ opacity: 0, scale: 0.8, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: -20 }}
      whileHover={{ scale: 1.02, y: -4 }}
      transition={{ 
        type: 'spring', 
        stiffness: 300, 
        damping: 25,
        layout: { duration: 0.3 }
      }}
      onClick={() => onSelect?.(node)}
      style={{
        ...style,
        background: `linear-gradient(135deg, ${typeConfig.bgColor} 0%, rgba(15, 23, 42, 0.95) 100%)`,
        borderColor: isConnecting ? '#3b82f6' : isSelected ? typeConfig.color : typeConfig.borderColor,
        boxShadow: isConnecting
          ? '0 0 30px #3b82f660, 0 10px 40px rgba(0,0,0,0.4)'
          : isSelected 
            ? `0 0 30px ${typeConfig.color}40, 0 10px 40px rgba(0,0,0,0.4)`
            : `0 4px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)`
      }}
      className={`
        relative w-[280px] rounded-xl overflow-hidden cursor-pointer select-none
        border-2 transition-all duration-300
        ${isSelected ? 'ring-2 ring-offset-2 ring-offset-slate-900' : ''}
        ${isConnecting ? 'animate-pulse' : ''}
      `}
    >
      {/* Header */}
      <div 
        className="px-4 py-3 flex items-center justify-between"
        style={{ borderBottom: `1px solid ${typeConfig.borderColor}` }}
      >
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ 
              background: `linear-gradient(135deg, ${typeConfig.color}30 0%, ${typeConfig.color}10 100%)`,
              border: `1px solid ${typeConfig.color}40`
            }}
          >
            <IconComponent 
              size={20} 
              style={{ color: typeConfig.color }}
            />
          </div>
          <div>
            <h3 className="font-semibold text-white text-sm leading-tight">
              {node.name || typeConfig.label}
            </h3>
            <p className="text-xs text-slate-400">{typeConfig.label}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <StatusIcon 
            size={18} 
            style={{ color: statusColor }}
            className={node.status === NODE_STATUS.ONLINE ? 'animate-pulse' : ''}
          />
          
          {/* Menu button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="p-1 rounded hover:bg-white/10 transition-colors"
          >
            <MoreVertical size={16} className="text-slate-400" />
          </button>
        </div>
      </div>

      {/* Dropdown Menu */}
      {showMenu && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-14 right-2 z-50 bg-slate-800 rounded-lg shadow-xl border border-slate-700 py-1 min-w-[120px]"
        >
          <button
            onClick={(e) => { e.stopPropagation(); onEdit?.(node); setShowMenu(false); }}
            className="w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
          >
            Editar
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete?.(node); setShowMenu(false); }}
            className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-slate-700 hover:text-red-300 transition-colors"
          >
            Eliminar
          </button>
        </motion.div>
      )}

      {/* Description */}
      <div className="px-4 py-3">
        <p className="text-xs text-slate-400 line-clamp-2">
          {node.description || typeConfig.description}
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="px-4 pb-4">
        <div className={`grid gap-2 ${Object.keys(node.metrics || {}).length > 2 ? 'grid-cols-2' : 'grid-cols-2'}`}>
          {Object.entries(node.metrics || {}).slice(0, 4).map(([key, value], idx) => (
            <div 
              key={key}
              className="bg-slate-800/50 rounded-lg px-3 py-2 border border-slate-700/50"
            >
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                {getMetricLabel(key)}
              </p>
              <p 
                className="text-sm font-bold"
                style={{ color: typeConfig.color }}
              >
                {formatMetric(key, value)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Expand indicator if has children */}
      {node.children?.length > 0 && (
        <div 
          className="px-4 py-2 border-t border-slate-700/50 flex items-center justify-center gap-2 text-xs text-slate-500 hover:bg-white/5 transition-colors"
          onClick={(e) => { e.stopPropagation(); onExpand?.(node); }}
        >
          <span>{node.children.length} nodos hijos</span>
          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      )}

      {/* Connection points */}
      <div 
        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-slate-600 border-2 border-slate-800"
        style={{ borderColor: typeConfig.color }}
      />
      <div 
        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3 h-3 rounded-full border-2 border-slate-800"
        style={{ backgroundColor: typeConfig.color }}
      />
    </motion.div>
  );
});

NexusNode.displayName = 'NexusNode';

export default NexusNode;
