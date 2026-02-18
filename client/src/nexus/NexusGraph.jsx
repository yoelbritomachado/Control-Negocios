import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { NODE_TYPES, VISUAL_CONFIG } from './nexus.types';

export const NexusGraph = ({ 
  nodes, 
  connections,
  selectedNodeId,
  onNodeClick 
}) => {
  // Generar path de conexión entre dos puntos
  const generatePath = (start, end) => {
    const midY = (start.y + end.y) / 2;
    return `M ${start.x} ${start.y} C ${start.x} ${midY}, ${end.x} ${midY}, ${end.x} ${end.y}`;
  };

  // Calcular posiciones de conexión
  const getConnectionPoints = (parent, child) => {
    const nodeWidth = VISUAL_CONFIG.nodeWidth;
    const nodeHeight = VISUAL_CONFIG.nodeHeight;

    return {
      start: {
        x: parent.position.x + nodeWidth / 2,
        y: parent.position.y + nodeHeight
      },
      end: {
        x: child.position.x + nodeWidth / 2,
        y: child.position.y
      }
    };
  };

  // Calcular todas las conexiones
  const connectionPaths = useMemo(() => {
    const paths = [];
    
    connections.forEach(conn => {
      const parent = nodes.find(n => n.id === conn.parentId);
      const child = nodes.find(n => n.id === conn.childId);
      
      if (parent && child) {
        const { start, end } = getConnectionPoints(parent, child);
        const parentType = NODE_TYPES[parent.type?.toUpperCase()];
        
        paths.push({
          id: `${parent.id}-${child.id}`,
          d: generatePath(start, end),
          color: parentType?.color || VISUAL_CONFIG.connectionColor,
          isSelected: selectedNodeId === parent.id || selectedNodeId === child.id
        });
      }
    });

    return paths;
  }, [nodes, connections, selectedNodeId]);

  // Grid pattern
  const gridPattern = `
    <pattern id="grid" width="${VISUAL_CONFIG.gridSize}" height="${VISUAL_CONFIG.gridSize}" patternUnits="userSpaceOnUse">
      <circle cx="1" cy="1" r="1" fill="${VISUAL_CONFIG.gridColor}" />
    </pattern>
  `;

  return (
    <svg 
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
    >
      <defs>
        <pattern 
          id="nexusGrid" 
          width={VISUAL_CONFIG.gridSize} 
          height={VISUAL_CONFIG.gridSize} 
          patternUnits="userSpaceOnUse"
        >
          <circle 
            cx={VISUAL_CONFIG.gridSize / 2} 
            cy={VISUAL_CONFIG.gridSize / 2} 
            r="0.5" 
            fill={VISUAL_CONFIG.gridColor}
          />
        </pattern>
        
        {/* Gradient for connections */}
        <linearGradient id="connectionGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(148, 163, 184, 0.5)" />
          <stop offset="100%" stopColor="rgba(148, 163, 184, 0.1)" />
        </linearGradient>
        
        {/* Glow filter for selected connections */}
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      {/* Grid Background */}
      <rect width="100%" height="100%" fill="url(#nexusGrid)" />

      {/* Connection Lines */}
      {connectionPaths.map((path, index) => (
        <motion.path
          key={path.id}
          d={path.d}
          fill="none"
          stroke={path.isSelected ? path.color : 'url(#connectionGradient)'}
          strokeWidth={path.isSelected ? 3 : VISUAL_CONFIG.connectionStrokeWidth}
          strokeLinecap="round"
          filter={path.isSelected ? 'url(#glow)' : undefined}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ 
            duration: 0.8, 
            delay: index * 0.1,
            ease: "easeOut"
          }}
        />
      ))}

      {/* Animated data flow dots on selected connections */}
      {connectionPaths.filter(p => p.isSelected).map((path) => (
        <motion.circle
          key={`flow-${path.id}`}
          r="4"
          fill={path.color}
          filter="url(#glow)"
        >
          <motion.animateMotion
            dur="2s"
            repeatCount="indefinite"
            path={path.d}
          />
        </motion.circle>
      ))}
    </svg>
  );
};

// Componente para mini-mapa
export const NexusMinimap = ({ 
  nodes, 
  viewport, 
  onNavigate,
  isDark = true
}) => {
  const scale = 0.15;
  const padding = 10;

  const bounds = useMemo(() => {
    if (nodes.length === 0) return { minX: 0, minY: 0, maxX: 1000, maxY: 800 };
    
    const xs = nodes.map(n => n.position.x);
    const ys = nodes.map(n => n.position.y);
    
    return {
      minX: Math.min(...xs) - 100,
      minY: Math.min(...ys) - 100,
      maxX: Math.max(...xs) + VISUAL_CONFIG.nodeWidth + 100,
      maxY: Math.max(...ys) + VISUAL_CONFIG.nodeHeight + 100
    };
  }, [nodes]);

  const width = (bounds.maxX - bounds.minX) * scale + padding * 2;
  const height = (bounds.maxY - bounds.minY) * scale + padding * 2;

  return (
    <div className={`absolute bottom-4 right-4 backdrop-blur-sm rounded-lg border p-2 shadow-2xl transition-colors duration-300 ${isDark ? 'bg-slate-900/90 border-slate-700' : 'bg-white/90 border-slate-200'}`}>
      <div className={`text-[10px] mb-1 text-center transition-colors duration-300 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Vista General</div>
      <svg 
        width={width} 
        height={height}
        className="cursor-pointer"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = (e.clientX - rect.left - padding) / scale + bounds.minX;
          const y = (e.clientY - rect.top - padding) / scale + bounds.minY;
          onNavigate?.({ x, y });
        }}
      >
        {/* Background */}
        <rect 
          width={width} 
          height={height} 
          fill={isDark ? "rgba(15, 23, 42, 0.5)" : "rgba(241, 245, 249, 0.5)"}
          rx="4"
        />

        {/* Nodes */}
        {nodes.map(node => {
          const typeConfig = NODE_TYPES[node.type?.toUpperCase()];
          const x = (node.position.x - bounds.minX) * scale + padding;
          const y = (node.position.y - bounds.minY) * scale + padding;
          const w = VISUAL_CONFIG.nodeWidth * scale;
          const h = VISUAL_CONFIG.nodeHeight * scale;

          return (
            <rect
              key={node.id}
              x={x}
              y={y}
              width={w}
              height={h}
              rx="2"
              fill={typeConfig?.color || '#64748b'}
              opacity={0.8}
            />
          );
        })}

        {/* Viewport indicator */}
        {viewport && (
          <rect
            x={(viewport.x - bounds.minX) * scale + padding}
            y={(viewport.y - bounds.minY) * scale + padding}
            width={viewport.width * scale}
            height={viewport.height * scale}
            fill="none"
            stroke={isDark ? "white" : "#1e293b"}
            strokeWidth="1"
            strokeDasharray="2,2"
            opacity="0.5"
          />
        )}
      </svg>
    </div>
  );
};

export default NexusGraph;
