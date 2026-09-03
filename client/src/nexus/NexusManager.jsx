import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../components/CartProvider';
import { 
  Plus, ZoomIn, ZoomOut, Maximize2, Minimize2, Grid3X3,
  Crown, Building2, Shield, Package, Store, Users,
  Check, X, AlertCircle, Scan,
  AlignVerticalJustifyCenter, AlignHorizontalJustifyCenter, GitBranch, Minus,
  Archive, RotateCcw, Trash2
} from 'lucide-react';
import { useNexus } from './useNexus';
import { NexusNode } from './NexusNode';
import { NexusMinimap } from './NexusGraph';
import { NODE_TYPES, NODE_STATUS, VISUAL_CONFIG } from './nexus.types';

// Panel de Nodos Archivados / Papelera
const ArchivedNodesPanel = ({ 
  archivedNodes, 
  onRestore, 
  onDeletePermanent, 
  onClose, 
  isDark 
}) => {
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`absolute z-50 top-16 right-4 sm:right-6 w-96 max-w-[calc(100%-2rem)] max-h-[80vh] flex flex-col rounded-2xl border shadow-2xl backdrop-blur-xl overflow-hidden transition-colors ${
        isDark ? 'bg-slate-900/95 border-slate-700 shadow-black/60' : 'bg-white/95 border-slate-200 shadow-slate-400/40'
      }`}
    >
      <div className={`p-4 flex items-center justify-between border-b ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
        <div className="flex items-center gap-2">
          <Archive size={18} className="text-amber-500" />
          <h3 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Nodos Archivados ({archivedNodes.length})
          </h3>
        </div>
        <button onClick={onClose} className={`p-1 rounded-lg ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}>
          <X size={16} />
        </button>
      </div>

      <div className="p-4 flex-1 overflow-y-auto space-y-3 custom-scrollbar">
        {archivedNodes.length === 0 ? (
          <div className="py-8 text-center">
            <Archive size={32} className={`mx-auto mb-2 opacity-30 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              No hay nodos archivados en la papelera
            </p>
          </div>
        ) : (
          archivedNodes.map(node => (
            <div 
              key={node.id}
              className={`p-3 rounded-xl border flex flex-col gap-2.5 transition-colors ${
                isDark ? 'bg-slate-800/60 border-slate-700/70' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                    isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {node.type}
                  </span>
                  <h4 className={`text-sm font-semibold mt-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {node.name}
                  </h4>
                </div>
              </div>

              {confirmDeleteId === node.id ? (
                <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 flex flex-col gap-2">
                  <p className="text-[11px] text-red-500 font-medium text-center">
                    ¿Eliminar definitivamente? Esta acción no se puede deshacer.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onDeletePermanent(node.id)}
                      className="flex-1 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold transition-colors"
                    >
                      Sí, Borrar
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                        isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                      }`}
                    >
                      No
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => onRestore(node.id)}
                    className="flex-1 py-1.5 bg-blue-600/90 hover:bg-blue-500 active:scale-[0.98] text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm"
                    title="Restaurar y regresar al canvas"
                  >
                    <RotateCcw size={13} />
                    Restaurar
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(node.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                      isDark ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-red-100 text-red-600 hover:bg-red-200'
                    }`}
                    title="Eliminar de forma permanente"
                  >
                    <Trash2 size={13} />
                    Eliminar
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
};

// Panel modal arrastrable para agregar nodos
const AddNodePanel = ({ onAdd, onClose, isDark, containerRef }) => {
  const [selectedType, setSelectedType] = useState('vendedor');
  const [name, setName] = useState('');
  const [error, setError] = useState(null);

  // Posición de la ventana emergente dentro del canvas
  const [panelPos, setPanelPos] = useState({ x: 0, y: 0 });
  const [isInitialized, setIsInitialized] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, posX: 0, posY: 0 });

  // Centrar en el canvas del Nexus al abrir
  useEffect(() => {
    const container = containerRef?.current;
    if (container) {
      const rect = container.getBoundingClientRect();
      const initialX = Math.max(16, (rect.width - 340) / 2);
      const initialY = Math.max(16, (rect.height - 420) / 2);
      setPanelPos({ x: initialX, y: initialY });
    } else {
      setPanelPos({ x: 100, y: 100 });
    }
    setIsInitialized(true);
  }, [containerRef]);

  // Manejar arrastre por la barra superior tipo ventana de Windows
  const handleHeaderMouseDown = (e) => {
    if (e.target.closest('button') || e.target.closest('input')) return;
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      posX: panelPos.x,
      posY: panelPos.y
    };
  };

  const handleHeaderTouchStart = (e) => {
    if (e.target.closest('button') || e.target.closest('input')) return;
    const touch = e.touches[0];
    setIsDragging(true);
    dragStartRef.current = {
      mouseX: touch.clientX,
      mouseY: touch.clientY,
      posX: panelPos.x,
      posY: panelPos.y
    };
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => {
      const clientX = e.clientX || e.touches?.[0]?.clientX;
      const clientY = e.clientY || e.touches?.[0]?.clientY;
      if (clientX === undefined || clientY === undefined) return;

      const dx = clientX - dragStartRef.current.mouseX;
      const dy = clientY - dragStartRef.current.mouseY;

      const container = containerRef?.current;
      const bounds = container ? container.getBoundingClientRect() : { width: window.innerWidth, height: window.innerHeight };

      const maxX = Math.max(10, bounds.width - 340);
      const maxY = Math.max(10, bounds.height - 300);

      const newX = Math.min(Math.max(10, dragStartRef.current.posX + dx), maxX);
      const newY = Math.min(Math.max(10, dragStartRef.current.posY + dy), maxY);

      setPanelPos({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleMouseMove, { passive: false });
    window.addEventListener('touchend', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging, containerRef]);

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (!selectedType) {
      setError('Selecciona un tipo de nodo');
      return;
    }
    if (!name.trim()) {
      setError('Ingresa un nombre para el nodo');
      return;
    }

    try {
      onAdd(selectedType, name.trim());
      onClose();
    } catch (err) {
      setError(err.message);
    }
  };

  const allTypes = ['dueño', 'empresa', 'administrador', 'almacén', 'punto_de_venta', 'vendedor'];

  const typeIcons = {
    dueño: Crown,
    empresa: Building2,
    administrador: Shield,
    almacén: Package,
    punto_de_venta: Store,
    vendedor: Users
  };

  if (!isInitialized) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={`absolute z-50 w-80 backdrop-blur-xl rounded-xl border shadow-2xl p-4 transition-colors duration-300 ${isDark ? 'bg-slate-900/95 border-slate-700' : 'bg-white/95 border-slate-200'}`}
      style={{ left: `${panelPos.x}px`, top: `${panelPos.y}px` }}
      onClick={(e) => e.stopPropagation()}
    >
      <div 
        onMouseDown={handleHeaderMouseDown}
        onTouchStart={handleHeaderTouchStart}
        className="flex items-center justify-between mb-4 cursor-move select-none"
        title="Arrastrar"
      >
        <h3 className={`font-semibold transition-colors duration-300 ${isDark ? 'text-white' : 'text-slate-900'}`}>Nuevo Nodo</h3>
        <button onClick={onClose} className={`transition-colors duration-300 ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}>
          <X size={18} />
        </button>
      </div>

      {error && (
        <div className="mb-4 p-2 bg-red-500/20 border border-red-500/50 rounded-lg flex items-center gap-2 text-sm text-red-600">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <div className="space-y-3 mb-4">
        <label className={`text-xs uppercase tracking-wider transition-colors duration-300 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Tipo de nodo</label>
        <div className="grid grid-cols-2 gap-2">
          {allTypes.map(type => {
            const config = NODE_TYPES[type.toUpperCase()];
            const Icon = typeIcons[type];
            
            return (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`p-3 rounded-lg border transition-all ${
                  selectedType === type
                    ? (isDark ? 'border-blue-500 bg-blue-500/20' : 'border-blue-500 bg-blue-500/10')
                    : (isDark ? 'border-slate-700 hover:border-slate-600' : 'border-slate-200 hover:border-slate-300 bg-slate-50')
                }`}
              >
                <Icon 
                  size={20} 
                  style={{ color: config?.color }}
                  className="mx-auto mb-1"
                />
                <span className={`text-[10px] block text-center transition-colors duration-300 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  {config?.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3 mb-4">
        <label className={`text-xs uppercase tracking-wider transition-colors duration-300 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Nombre</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej: Almacén Norte"
          className={`w-full px-3 py-2 border rounded-lg text-sm focus:border-blue-500 focus:outline-none transition-colors duration-300 ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'}`}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit(e);
          }}
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
        >
          <Check size={16} />
          Crear
        </button>
        <button
          onClick={onClose}
          className={`flex-1 py-2 rounded-lg text-sm transition-colors ${isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
        >
          Cancelar
        </button>
      </div>
    </motion.div>
  );
};

// Barra de herramientas
const Toolbar = ({ 
  onZoomIn, onZoomOut, onFitView,
  onAutoLayoutVertical, onAutoLayoutHorizontal,
  showArchive, onToggleArchive, archivedCount,
  showGrid, setShowGrid,
  lineStyle, setLineStyle,
  isFullscreen, toggleFullscreen,
  isDark,
  isConnectingMode,
  setIsConnectingMode
}) => (
  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-2">
    <div className={`backdrop-blur-sm rounded-xl border p-1 sm:p-1.5 shadow-2xl flex items-center gap-0.5 sm:gap-1 transition-colors duration-300 max-w-[95vw] overflow-x-auto custom-scrollbar ${isDark ? 'bg-slate-900/90 border-slate-700' : 'bg-white/90 border-slate-200'}`}>
      {/* Line Style Toggle (Curvas vs Ortogonales / 90 grados) */}
      <button
        onClick={() => setLineStyle(lineStyle === 'curved' ? 'orthogonal' : 'curved')}
        className={`p-1.5 sm:p-2 rounded-lg transition-colors ${lineStyle === 'curved' ? (isDark ? 'text-blue-400 bg-blue-500/20' : 'text-blue-600 bg-blue-500/10') : (isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100')}`}
        title={lineStyle === 'curved' ? 'Líneas curvas (Sinuosas)' : 'Líneas ortogonales (Ángulo recto 90°)'}
      >
        {lineStyle === 'curved' ? <GitBranch size={16} className="sm:w-[18px] sm:h-[18px]" /> : <Minus size={16} className="sm:w-[18px] sm:h-[18px]" />}
      </button>
      
      <div className={`w-px h-4 sm:h-5 mx-0.5 sm:mx-1 transition-colors duration-300 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />
      
      {/* Zoom Controls */}
      <button
        onClick={onZoomIn}
        className={`p-1.5 sm:p-2 rounded-md transition-colors ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}
        title="Acercar (Zoom In)"
      >
        <ZoomIn size={16} className="sm:w-[18px] sm:h-[18px]" />
      </button>
      <button
        onClick={onZoomOut}
        className={`p-1.5 sm:p-2 rounded-md transition-colors ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}
        title="Alejar (Zoom Out)"
      >
        <ZoomOut size={16} className="sm:w-[18px] sm:h-[18px]" />
      </button>
      
      {/* Reencuadrar / Centrar todos los nodos */}
      <button
        onClick={onFitView}
        className={`p-1.5 sm:p-2 rounded-md transition-colors ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}
        title="Reencuadrar y centrar todos los nodos"
      >
        <Scan size={16} className="sm:w-[18px] sm:h-[18px]" />
      </button>

      <div className={`w-px h-4 sm:h-5 mx-0.5 sm:mx-1 transition-colors duration-300 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />

      {/* Auto-layout Vertical */}
      <button
        onClick={onAutoLayoutVertical}
        className={`p-1.5 sm:p-2 rounded-md transition-colors ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}
        title="Organizar nodos verticalmente (Eje Dueño -> Empresa -> Almacén/Admin -> POS -> Vendedores)"
      >
        <AlignVerticalJustifyCenter size={16} className="sm:w-[18px] sm:h-[18px]" />
      </button>

      {/* Auto-layout Horizontal */}
      <button
        onClick={onAutoLayoutHorizontal}
        className={`p-1.5 sm:p-2 rounded-md transition-colors ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}
        title="Organizar nodos horizontalmente (Flujo izquierda a derecha)"
      >
        <AlignHorizontalJustifyCenter size={16} className="sm:w-[18px] sm:h-[18px]" />
      </button>

      <div className={`w-px h-4 sm:h-5 mx-0.5 sm:mx-1 transition-colors duration-300 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />

      {/* Botón Papelera / Archivados */}
      <button
        onClick={onToggleArchive}
        className={`relative p-1.5 sm:p-2 rounded-lg transition-colors ${showArchive ? (isDark ? 'text-amber-400 bg-amber-500/20' : 'text-amber-600 bg-amber-500/10') : (isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100')}`}
        title="Ver nodos archivados / Papelera"
      >
        <Archive size={16} className="sm:w-[18px] sm:h-[18px]" />
        {archivedCount > 0 && (
          <span className="absolute -top-1 -right-1 px-1.5 py-0.2 bg-amber-500 text-slate-950 font-bold rounded-full text-[9px] shadow-sm">
            {archivedCount}
          </span>
        )}
      </button>

      <div className={`w-px h-4 sm:h-5 mx-0.5 sm:mx-1 transition-colors duration-300 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />

      {/* Grid toggle */}
      <button
        onClick={() => setShowGrid(!showGrid)}
        className={`p-1.5 sm:p-2 rounded-lg transition-colors ${showGrid ? (isDark ? 'text-blue-400 bg-blue-500/20' : 'text-blue-600 bg-blue-500/10') : (isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100')}`}
        title={showGrid ? 'Ocultar cuadrícula' : 'Mostrar cuadrícula'}
      >
        <Grid3X3 size={16} className="sm:w-[18px] sm:h-[18px]" />
      </button>
      
      {/* Fullscreen Toggle */}
      <button
        onClick={toggleFullscreen}
        className={`p-1.5 sm:p-2 rounded-lg transition-colors ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}
        title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
      >
        {isFullscreen ? <Minimize2 size={16} className="sm:w-[18px] sm:h-[18px]" /> : <Maximize2 size={16} className="sm:w-[18px] sm:h-[18px]" />}
      </button>
      
      {/* Mobile Connect Mode Toggle */}
      <div className={`w-px h-4 sm:h-5 mx-0.5 sm:mx-1 transition-colors duration-300 sm:hidden ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />
      <button
        onClick={() => setIsConnectingMode?.(!isConnectingMode)}
        className={`p-1.5 sm:p-2 rounded-lg transition-colors sm:hidden ${isConnectingMode ? (isDark ? 'text-blue-400 bg-blue-500/20' : 'text-blue-600 bg-blue-500/10') : (isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100')}`}
        title={isConnectingMode ? 'Cancelar conexión' : 'Modo conectar (móvil)'}
      >
        {isConnectingMode ? <X size={16} className="sm:w-[18px] sm:h-[18px]" /> : <GitBranch size={16} className="sm:w-[18px] sm:h-[18px]" />}
      </button>
    </div>
  </div>
);

export const NexusManager = () => {
  const navigate = useNavigate();
  const { setCurrentInventory } = useCart();
  const {
    nodes,
    archivedNodes,
    selectedNodeId,
    selectedNode,
    stats,
    createNode,
    updateNode,
    deleteNode,
    restoreNode,
    deletePermanent,
    moveNode,
    connectNodes,
    disconnectNode,
    saveNodePositionLocal,
    saveMultipleNodePositionsLocal
  } = useNexus();

  // Estados de zoom y pan con persistencia por dispositivo
  const [zoom, setZoom] = useState(() => {
    try {
      const saved = localStorage.getItem('mch_nexus_viewport_zoom');
      return saved ? parseFloat(saved) : 1;
    } catch (_) { return 1; }
  });
  const [pan, setPan] = useState(() => {
    try {
      const saved = localStorage.getItem('mch_nexus_viewport_pan');
      return saved ? JSON.parse(saved) : { x: 50, y: 50 };
    } catch (_) { return { x: 50, y: 50 }; }
  });

  // Guardar viewport (zoom y pan) en localStorage para este dispositivo
  const saveViewportLocal = useCallback((newPan, newZoom) => {
    try {
      if (newPan) localStorage.setItem('mch_nexus_viewport_pan', JSON.stringify(newPan));
      if (newZoom !== undefined) localStorage.setItem('mch_nexus_viewport_zoom', String(newZoom));
    } catch (_) {}
  }, []);

  const [showGrid, setShowGrid] = useState(true);
  const [showArchive, setShowArchive] = useState(false);
  
  // Detectar tema oscuro/claro
  const [isDark, setIsDark] = useState(() => 
    document.documentElement.classList.contains('dark')
  );
  
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [lineStyle, setLineStyle] = useState('curved'); // 'curved' | 'orthogonal'
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isConnectingMode, setIsConnectingMode] = useState(false); // Modo conexión para móvil
  
  // Estados de interacción
  const [draggingNode, setDraggingNode] = useState(null);
  const [isPanning, setIsPanning] = useState(false);
  const [connectingFrom, setConnectingFrom] = useState(null);
  const [disconnectingFrom, setDisconnectingFrom] = useState(null); // { node, parentId }
  const [tempLine, setTempLine] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  const containerRef = useRef(null);
  const panStart = useRef({ x: 0, y: 0 });
  const lastTouchDistance = useRef(0);

  // TAMAÑOS DEL NODO
  const NODE_WIDTH = 260;
  // Los nodos ahora tienen altura variable según contenido
  // Usamos refs para medir la altura real de cada nodo en el DOM
  const nodeRefs = useRef({});
  const nodeHeights = useRef({});

  // Convertir coordenadas
  const screenToCanvas = (screenX, screenY) => ({
    x: (screenX - pan.x) / zoom,
    y: (screenY - pan.y) / zoom
  });

  // Handlers de zoom
  const handleZoomIn = () => setZoom(z => {
    const nz = Math.min(z * 1.2, 3);
    saveViewportLocal(pan, nz);
    return nz;
  });
  const handleZoomOut = () => setZoom(z => {
    const nz = Math.max(z / 1.2, 0.3);
    saveViewportLocal(pan, nz);
    return nz;
  });
  const handleFitView = useCallback(() => {
    if (nodes.length === 0) {
      setZoom(1);
      setPan({ x: 50, y: 50 });
      saveViewportLocal({ x: 50, y: 50 }, 1);
      return;
    }

    // Obtener dimensiones del contenedor
    const container = containerRef.current;
    if (!container) return;
    
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    
    // Si el contenedor aún no tiene dimensiones reales en el DOM, no calcular para evitar zoom corrupto
    if (containerWidth < 50 || containerHeight < 50) return;
    
    // Calcular bounding box de todos los nodos
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    nodes.forEach(node => {
      const height = getNodeHeight(node.id);
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + NODE_WIDTH);
      maxY = Math.max(maxY, node.position.y + height);
    });
    
    // Padding responsive: en mobile más aire abajo para toolbar y FAB
    const isSmallScreen = containerWidth < 768;
    const paddingX = isSmallScreen ? 20 : 60;
    const paddingTop = isSmallScreen ? 30 : 50;
    const paddingBottom = isSmallScreen ? 110 : 70; // Espacio para la toolbar flotante inferior
    
    minX -= paddingX;
    minY -= paddingTop;
    maxX += paddingX;
    maxY += paddingBottom;
    
    // Calcular dimensiones del bounding box
    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    
    // Calcular zoom para que todo quepa perfectamente pero con límites legibles
    const zoomX = containerWidth / (contentWidth || 1);
    const zoomY = containerHeight / (contentHeight || 1);
    const maxZoomLimit = isSmallScreen ? 1.0 : 1.1;
    // Mínimo de zoom seguro 0.65 para que nunca se renderice enano/ilegible
    const newZoom = Math.max(0.65, Math.min(zoomX, zoomY, maxZoomLimit));
    
    // Calcular pan para centrar el contenido en el viewport
    const contentCenterX = (minX + maxX) / 2;
    const contentCenterY = (minY + maxY) / 2;
    const containerCenterX = containerWidth / 2;
    const containerCenterY = containerHeight / 2;
    
    const newPan = {
      x: containerCenterX - contentCenterX * newZoom,
      y: containerCenterY - contentCenterY * newZoom
    };
    
    setZoom(newZoom);
    setPan(newPan);
    saveViewportLocal(newPan, newZoom);
  }, [nodes, saveViewportLocal]);

  // Si es la primera vez que se abre en este dispositivo (sin posiciones ni viewport previos), auto-encuadrar
  useEffect(() => {
    const hasSavedPositions = localStorage.getItem('mch_nexus_node_positions_v1');
    const hasSavedPan = localStorage.getItem('mch_nexus_viewport_pan');
    if (!hasSavedPositions && !hasSavedPan && nodes.length > 0) {
      const initTimer = setTimeout(() => {
        handleFitView();
      }, 250);
      return () => clearTimeout(initTimer);
    }
  }, [nodes.length, handleFitView]);

  // Auto-layout vertical: Eje central con Dueño -> Empresa -> Almacén -> Puntos de Venta -> Vendedores
  const handleAutoLayoutVertical = useCallback(() => {
    if (nodes.length === 0) return;

    // Clasificar nodos por niveles jerárquicos
    const levels = {
      owner: [],      // Nivel 0: Dueño
      company: [],    // Nivel 1: Empresa
      admin: [],      // Nivel 2: Admin (lateral izquierdo de Almacén)
      warehouse: [],  // Nivel 2: Almacén (eje central)
      pos: [],        // Nivel 3: Puntos de Venta (MCH1, MCH2)
      seller: [],     // Nivel 4: Vendedores
      other: []       // Otros
    };

    nodes.forEach(node => {
      const type = (node.type || '').toLowerCase().replace(/_/g, ' ').replace(/-/g, ' ').trim();
      if (type === 'dueño' || type === 'dueno' || type === 'owner') levels.owner.push(node);
      else if (type === 'empresa' || type === 'company') levels.company.push(node);
      else if (type === 'administrador' || type === 'admin') levels.admin.push(node);
      else if (type === 'almacén' || type === 'almacen' || type === 'warehouse') levels.warehouse.push(node);
      else if (type === 'punto de venta' || type === 'puntodeventa' || type === 'pos' || type === 'kiosco') levels.pos.push(node);
      else if (type === 'vendedor' || type === 'seller') levels.seller.push(node);
      else levels.other.push(node);
    });

    const HORIZONTAL_GAP = 320;
    const VERTICAL_GAP = 240;
    const centerX = 600;
    let currentY = 100;

    const arrangeRow = (nodeList, y, cX = centerX) => {
      if (nodeList.length === 0) return;
      const totalWidth = (nodeList.length - 1) * HORIZONTAL_GAP;
      const startX = cX - totalWidth / 2;
      const posMap = {};
      nodeList.forEach((n, idx) => {
        const newPos = { x: Math.round(startX + idx * HORIZONTAL_GAP), y: Math.round(y) };
        posMap[n.id] = newPos;
        updateNode(n.id, {
          position: newPos
        });
      });
      saveMultipleNodePositionsLocal(posMap);
    };

    // 1. Dueño (Nivel 0)
    const ownerHeight = levels.owner.reduce((max, n) => Math.max(max, getNodeHeight(n.id)), 160);
    arrangeRow(levels.owner, currentY);
    if (levels.owner.length > 0) currentY += ownerHeight + 80;

    // 2. Empresa (Nivel 1)
    const companyHeight = levels.company.reduce((max, n) => Math.max(max, getNodeHeight(n.id)), 160);
    arrangeRow(levels.company, currentY);
    if (levels.company.length > 0) currentY += companyHeight + 80;

    // 3. Admin & Almacén (Nivel 2)
    const level2 = [...levels.admin, ...levels.warehouse];
    const level2Height = level2.reduce((max, n) => Math.max(max, getNodeHeight(n.id)), 220);
    arrangeRow(level2, currentY);
    if (level2.length > 0) currentY += level2Height + 90;

    // 4. Puntos de Venta (Nivel 3: MCH 1, MCH 2)
    const posHeight = levels.pos.reduce((max, n) => Math.max(max, getNodeHeight(n.id)), 200);
    arrangeRow(levels.pos, currentY);
    if (levels.pos.length > 0) currentY += posHeight + 90;

    // 5. Vendedores (Nivel 4: Hijos de POS, ubicados al fondo)
    const sellerHeight = levels.seller.reduce((max, n) => Math.max(max, getNodeHeight(n.id)), 160);
    arrangeRow(levels.seller, currentY);
    if (levels.seller.length > 0) currentY += sellerHeight + 80;

    // 6. Otros
    arrangeRow(levels.other, currentY);

    setTimeout(() => handleFitView(), 150);
  }, [nodes, updateNode, handleFitView]);

  // Auto-layout horizontal: Flujo de izquierda a derecha
  const handleAutoLayoutHorizontal = useCallback(() => {
    if (nodes.length === 0) return;

    const levels = {
      owner: [],
      company: [],
      management: [], // Admin y Almacén
      pos: [],
      seller: [],
      other: []
    };

    nodes.forEach(node => {
      const type = (node.type || '').toLowerCase().replace(/_/g, ' ').replace(/-/g, ' ').trim();
      if (type === 'dueño' || type === 'dueno' || type === 'owner') levels.owner.push(node);
      else if (type === 'empresa' || type === 'company') levels.company.push(node);
      else if (type === 'administrador' || type === 'admin' || type === 'almacén' || type === 'almacen' || type === 'warehouse') levels.management.push(node);
      else if (type === 'punto de venta' || type === 'puntodeventa' || type === 'pos' || type === 'kiosco') levels.pos.push(node);
      else if (type === 'vendedor' || type === 'seller') levels.seller.push(node);
      else levels.other.push(node);
    });

    const HORIZONTAL_GAP = 320;
    const VERTICAL_GAP = 220;
    const centerY = 400;
    let currentX = 100;

    const arrangeColumn = (nodeList, x) => {
      if (nodeList.length === 0) return;
      const totalHeight = (nodeList.length - 1) * VERTICAL_GAP;
      const startY = centerY - totalHeight / 2;
      const posMap = {};
      nodeList.forEach((n, idx) => {
        const newPos = { x: Math.round(x), y: Math.round(startY + idx * VERTICAL_GAP) };
        posMap[n.id] = newPos;
        updateNode(n.id, {
          position: newPos
        });
      });
      saveMultipleNodePositionsLocal(posMap);
    };

    const orderedGroups = [levels.owner, levels.company, levels.management, levels.pos, levels.seller, levels.other];
    orderedGroups.forEach(group => {
      if (group.length > 0) {
        arrangeColumn(group, currentX);
        currentX += HORIZONTAL_GAP;
      }
    });

    setTimeout(() => handleFitView(), 150);
  }, [nodes, updateNode, handleFitView]);

  // FULLSCREEN TOGGLE
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  // TOUCH EVENTS - PAN Y PINCH ZOOM
  const touchStartPos = useRef({ x: 0, y: 0 });
  const touchStartPan = useRef({ x: 0, y: 0 });
  const isTouchPanning = useRef(false);
  
  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      // Pinch zoom
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      lastTouchDistance.current = distance;
    } else if (e.touches.length === 1) {
      // Pan con un dedo
      const touch = e.touches[0];
      touchStartPos.current = { x: touch.clientX, y: touch.clientY };
      touchStartPan.current = { ...pan };
      isTouchPanning.current = true;
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 2) {
      // Pinch zoom
      e.preventDefault();
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const delta = distance / lastTouchDistance.current;
      const newZoom = Math.max(0.3, Math.min(3, zoom * delta));
      const rect = containerRef.current?.getBoundingClientRect();
      const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
      const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
      const zoomRatio = newZoom / zoom;
      
      const newPan = {
        x: centerX - (centerX - pan.x) * zoomRatio,
        y: centerY - (centerY - pan.y) * zoomRatio
      };
      setPan(newPan);
      setZoom(newZoom);
      saveViewportLocal(newPan, newZoom);
      lastTouchDistance.current = distance;
    } else if (e.touches.length === 1 && isTouchPanning.current && !draggingNode) {
      // Pan con un dedo
      e.preventDefault();
      const touch = e.touches[0];
      const dx = touch.clientX - touchStartPos.current.x;
      const dy = touch.clientY - touchStartPos.current.y;
      
      const newPan = {
        x: touchStartPan.current.x + dx,
        y: touchStartPan.current.y + dy
      };
      setPan(newPan);
      saveViewportLocal(newPan, zoom);
    }
  };

  const handleTouchEnd = () => {
    isTouchPanning.current = false;
    setDraggingNode(null);
  };

  const handleAddNode = (type, name) => {
    // Colocar el nuevo nodo en el centro visible actual del canvas
    const container = containerRef.current;
    const containerWidth = container?.clientWidth || 1000;
    const containerHeight = container?.clientHeight || 800;
    const centerPos = screenToCanvas(containerWidth / 2 - 130, containerHeight / 2 - 80);

    createNode(type, null, { 
      name,
      position: { x: Math.round(centerPos.x), y: Math.round(centerPos.y) }
    });
  };

  // Manejo de Doble Clic en un Nodo para navegación directa
  const handleNodeDoubleClick = useCallback((node) => {
    if (!node) return;
    const type = (node.type || '').toLowerCase();
    const nodeId = (node.id || '').toLowerCase();

    // 1. Almacén Central -> Ir a Inventario de Almacén
    if (type === 'almacén' || type === 'almacen' || nodeId.includes('inventory_alm')) {
      setCurrentInventory('alm');
      navigate('/inventario');
      return;
    }

    // 2. Puntos de Venta (MCH1, MCH2, etc.) -> Ir a Inventario de esa sede
    if (type === 'punto_de_venta' || type === 'pos' || nodeId.includes('inventory_mch')) {
      if (nodeId.includes('mch1')) {
        setCurrentInventory('mch1');
      } else if (nodeId.includes('mch2')) {
        setCurrentInventory('mch2');
      }
      navigate('/inventario');
      return;
    }

    // 3. Dueño -> Ir a configurar usuario Dueño
    if (type === 'dueño' || type === 'dueno' || type === 'owner') {
      navigate('/usuarios?role=owner');
      return;
    }

    // 4. Administrador -> Ir a configurar usuario Administrador
    if (type === 'administrador' || type === 'admin') {
      const uId = node.metrics?.userId;
      if (uId) {
        navigate(`/usuarios?edit=${uId}`);
      } else {
        navigate(`/usuarios?name=${encodeURIComponent(node.name || '')}`);
      }
      return;
    }

    // 5. Vendedor / Vendedor Cubrefranco -> Ir a configurar ese Vendedor
    if (type === 'vendedor' || type === 'seller') {
      const uId = node.metrics?.userId;
      if (uId) {
        navigate(`/usuarios?edit=${uId}`);
      } else {
        navigate(`/usuarios?name=${encodeURIComponent(node.name || '')}`);
      }
      return;
    }

    // 6. Empresa -> Neutro / Sin acción por ahora
    if (type === 'empresa' || type === 'company') {
      // Sin acción por ahora
      return;
    }
  }, [navigate, setCurrentInventory]);

  const handleDoubleClick = (e) => {
    if (e.target === containerRef.current || e.target.tagName === 'svg') {
      setShowAddPanel(true);
    }
  };

  const handleMouseDown = (e) => {
    if (e.target === containerRef.current || e.target.tagName === 'svg') {
      setIsPanning(true);
      panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    }
  };

  const handleMouseMove = (e) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const canvasPos = screenToCanvas(mouseX, mouseY);

    if (isPanning) {
      const newPan = {
        x: e.clientX - panStart.current.x,
        y: e.clientY - panStart.current.y
      };
      setPan(newPan);
      saveViewportLocal(newPan, zoom);
    }

    if (draggingNode) {
      updateNode(draggingNode.id, {
        position: {
          x: canvasPos.x - dragOffset.x,
          y: canvasPos.y - dragOffset.y
        }
      });
    }

    // Línea temporal desde el PUNTO DE SALIDA (usa altura real del nodo)
    if (connectingFrom) {
      const parentHeight = getNodeHeight(connectingFrom.id);
      const outputX = connectingFrom.position.x + NODE_WIDTH / 2;
      const outputY = connectingFrom.position.y + parentHeight + 5; // 5px desde el borde inferior real
      setTempLine({
        x1: outputX,
        y1: outputY,
        x2: canvasPos.x,
        y2: canvasPos.y
      });
    }

    // Línea temporal al arrastrar desconexión desde el INPUT
    if (disconnectingFrom) {
      const parentNode = nodes.find(n => n.id === disconnectingFrom.parentId);
      if (parentNode) {
        const parentHeight = getNodeHeight(parentNode.id);
        const outputX = parentNode.position.x + NODE_WIDTH / 2;
        const outputY = parentNode.position.y + parentHeight + 5;
        setTempLine({
          x1: outputX,
          y1: outputY,
          x2: canvasPos.x,
          y2: canvasPos.y
        });
      }
    }
  };

  const handleMouseUp = (e) => {
    setIsPanning(false);
    setDraggingNode(null);
    
    const rect = containerRef.current?.getBoundingClientRect();
    const canvasPos = rect ? screenToCanvas(e.clientX - rect.left, e.clientY - rect.top) : null;
    
    // CASO 1: Conectando desde Output
    if (connectingFrom && !draggingNode && canvasPos) {
      const targetNode = nodes.find(n => {
        if (n.id === connectingFrom.id) return false;
        const nx = n.position.x;
        const ny = n.position.y;
        const nHeight = getNodeHeight(n.id);
        // Margen de tolerancia de 15px alrededor del nodo para facilitar el enganche
        return canvasPos.x >= (nx - 15) && canvasPos.x <= (nx + NODE_WIDTH + 15) &&
               canvasPos.y >= (ny - 15) && canvasPos.y <= (ny + nHeight + 15);
      });

      if (targetNode) {
        try {
          connectNodes(connectingFrom.id, targetNode.id);
        } catch (err) {}
      }
    }

    // CASO 2: Desconectando desde Input (soltar en el vacío desconecta estilo 3ds Max)
    if (disconnectingFrom && !draggingNode && canvasPos) {
      const targetNode = nodes.find(n => {
        const nx = n.position.x;
        const ny = n.position.y;
        const nHeight = getNodeHeight(n.id);
        return canvasPos.x >= nx && canvasPos.x <= nx + NODE_WIDTH &&
               canvasPos.y >= ny && canvasPos.y <= ny + nHeight;
      });

      // Si no cayó sobre el mismo nodo padre ni el mismo hijo (soltó en el vacío o en otro)
      if (!targetNode || targetNode.id !== disconnectingFrom.node.id) {
        disconnectNode(disconnectingFrom.node.id, disconnectingFrom.parentId);
        if (targetNode && targetNode.id !== disconnectingFrom.parentId) {
          // Si lo soltó directamente sobre otro nodo hijo válido, conectarlo a él
          connectNodes(disconnectingFrom.parentId, targetNode.id);
        }
      }
    }
    
    setConnectingFrom(null);
    setDisconnectingFrom(null);
    setTempLine(null);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setConnectingFrom(null);
        setTempLine(null);
        setDraggingNode(null);
        setShowAddPanel(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Agregar wheel listener de forma no pasiva para poder usar preventDefault
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const wheelHandler = (e) => {
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      
      setZoom(prevZoom => {
        const newZoom = Math.max(0.3, Math.min(3, prevZoom * delta));
        const zoomRatio = newZoom / prevZoom;
        
        setPan(prevPan => ({
          x: mouseX - (mouseX - prevPan.x) * zoomRatio,
          y: mouseY - (mouseY - prevPan.y) * zoomRatio
        }));
        
        return newZoom;
      });
    };
    
    container.addEventListener('wheel', wheelHandler, { passive: false });
    return () => container.removeEventListener('wheel', wheelHandler, { passive: false });
  }, []);

  const handleNodeDragStart = (e, node) => {
    e.stopPropagation();
    e.preventDefault();
    
    const clientX = e.clientX || e.touches?.[0]?.clientX;
    const clientY = e.clientY || e.touches?.[0]?.clientY;
    
    const rect = containerRef.current?.getBoundingClientRect();
    const canvasPos = screenToCanvas(clientX - rect.left, clientY - rect.top);
    
    setDragOffset({
      x: canvasPos.x - node.position.x,
      y: canvasPos.y - node.position.y
    });
    setDraggingNode(node);
  };

    // Touch handlers específicos para nodos
    const handleNodeTouchStart = (e, node) => {
      e.stopPropagation();
      handleNodeDragStart(e, node);
    };

    const handleNodeTouchMove = (e) => {
      if (!draggingNode) return;
      e.preventDefault();
      
      const touch = e.touches[0];
      const rect = containerRef.current?.getBoundingClientRect();
      const canvasPos = screenToCanvas(touch.clientX - rect.left, touch.clientY - rect.top);
      
      updateNode(draggingNode.id, {
        position: {
          x: canvasPos.x - dragOffset.x,
          y: canvasPos.y - dragOffset.y
        }
      });
    };

    const handleConnectionStart = (e, node) => {
      e.stopPropagation();
      setDraggingNode(null); // Asegurar que no arrastre el nodo cuando iniciamos conexión
      setConnectingFrom(node);
    };

  // Función para registrar la altura de un nodo
  const registerNodeRef = (id, el) => {
    if (el) {
      nodeRefs.current[id] = el;
      // Medir la altura real del elemento
      const height = el.getBoundingClientRect().height / zoom; // Ajustar por zoom
      nodeHeights.current[id] = height;
    }
  };

  // Obtener la altura real de un nodo (con fallback a 160)
  const getNodeHeight = (nodeId) => {
    return nodeHeights.current[nodeId] || 160;
  };

  // Re-medir alturas cuando cambia el zoom o los nodos
  useEffect(() => {
    Object.entries(nodeRefs.current).forEach(([id, el]) => {
      if (el) {
        const height = el.getBoundingClientRect().height / zoom;
        nodeHeights.current[id] = height;
      }
    });
  }, [zoom, nodes]);

  // Generar path según estilo de línea
  const generatePath = (startX, startY, endX, endY) => {
    if (lineStyle === 'curved') {
      // Curva Bezier suave
      const deltaY = endY - startY;
      const controlY1 = startY + deltaY * 0.5;
      const controlY2 = endY - deltaY * 0.5;
      return `M ${startX} ${startY} C ${startX} ${controlY1}, ${endX} ${controlY2}, ${endX} ${endY}`;
    } else {
      // Líneas ortogonales (90°)
      const midY = (startY + endY) / 2;
      return `M ${startX} ${startY} L ${startX} ${midY} L ${endX} ${midY} L ${endX} ${endY}`;
    }
  };

  // Renderizar conexiones - DESDE PUNTOS EXACTOS EN LOS BORDES (soporta múltiples padres)
  const renderConnections = () => {
    const lines = [];
    nodes.forEach(n => {
      const parentList = n.parentIds?.length ? n.parentIds : (n.parentId ? [n.parentId] : []);
      parentList.forEach(pId => {
        const parent = nodes.find(p => p.id === pId);
        if (!parent) return;

        // Usar alturas reales medidas del DOM
        const parentHeight = getNodeHeight(parent.id);
        const childHeight = getNodeHeight(n.id);

        // PUNTO DE SALIDA (output) - centro del borde inferior del padre
        const startX = parent.position.x + NODE_WIDTH / 2;
        const startY = parent.position.y + parentHeight + 5; // +5px desde borde inferior real
        
        // PUNTO DE ENTRADA (input) - centro del borde superior del hijo  
        const endX = n.position.x + NODE_WIDTH / 2;
        const endY = n.position.y - 5; // -5px desde borde superior
        
        const path = generatePath(startX, startY, endX, endY);
        const parentTypeConfig = NODE_TYPES[parent.type?.toUpperCase()];
        const isChildVendedor = (n.type || '').toLowerCase() === 'vendedor';
        const isCubrefrancoLine = isChildVendedor && (n.parentIds?.length >= 2);
        const lineColor = isCubrefrancoLine ? '#a855f7' : (parentTypeConfig?.color || '#64748b');

        lines.push(
          <g key={`${parent.id}-${n.id}`}>
            {/* Línea animada */}
            <path
              d={path}
              fill="none"
              stroke={lineColor}
              strokeWidth={isCubrefrancoLine ? "2.5" : "2"}
              strokeDasharray={lineStyle === 'curved' ? "8,4" : "none"}
              opacity={isCubrefrancoLine ? "0.9" : "0.7"}
            >
              {lineStyle === 'curved' && (
                <animate
                  attributeName="stroke-dashoffset"
                  from="24"
                  to="0"
                  dur="1s"
                  repeatCount="indefinite"
                />
              )}
            </path>
            {/* Línea de fondo interactiva */}
            <path
              d={path}
              fill="none"
              stroke={lineColor}
              strokeWidth="6"
              opacity="0.05"
              className="hover:opacity-30 transition-opacity"
            />
          </g>
        );
      });
    });
    return lines;
  };

  return (
    <div 
      ref={containerRef}
      className={`relative w-full h-full flex-1 overflow-hidden rounded-2xl border select-none touch-none transition-colors duration-300 ${isDark ? 'bg-slate-950 border-slate-800 shadow-2xl' : 'bg-slate-50 border-slate-200 shadow-xl'}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDoubleClick={handleDoubleClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Grid Background - Grid procedural infinito tipo Figma/Miro/Unity */}
      {showGrid && (
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            // Grid de puntos que cambian según el tema
            backgroundImage: isDark 
              ? `radial-gradient(circle, rgba(71, 85, 105, 0.6) 1px, transparent 1px)`
              : `radial-gradient(circle, rgba(148, 163, 184, 0.4) 1px, transparent 1px)`,
            backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
            // La posición se mueve con el pan (modulo para que sea infinito)
            backgroundPosition: `${pan.x}px ${pan.y}px`,
            zIndex: 0
          }}
        />
      )}

      {/* Canvas Layer */}
      <div
        className="absolute inset-0"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0'
        }}
      >
        {/* SVG para conexiones */}
        <svg className="absolute inset-0 w-[3000px] h-[3000px] pointer-events-auto overflow-visible">
          {renderConnections()}
          
          {/* Línea temporal */}
          {tempLine && (
            <path
              d={`M ${tempLine.x1} ${tempLine.y1} L ${tempLine.x2} ${tempLine.y2}`}
              fill="none"
              stroke="#3b82f6"
              strokeWidth="2"
              strokeDasharray="5,5"
              opacity="0.8"
            >
              <animate
                attributeName="stroke-dashoffset"
                from="10"
                to="0"
                dur="0.5s"
                repeatCount="indefinite"
              />
            </path>
          )}
        </svg>

        {/* Nodos */}
        {nodes.map(node => (
          <div
            key={node.id}
            ref={(el) => registerNodeRef(node.id, el)}
            className="absolute"
            style={{
              left: node.position.x,
              top: node.position.y,
              zIndex: draggingNode?.id === node.id ? 100 : 10
            }}
            onMouseDown={(e) => handleNodeDragStart(e, node)}
          >
            <NexusNode
              node={node}
              isSelected={selectedNodeId === node.id}
              isConnectingFrom={connectingFrom?.id === node.id}
              isConnectingMode={isConnectingMode}
              onConnectionStart={handleConnectionStart}
              onDoubleClick={() => handleNodeDoubleClick(node)}
              onDisconnectStart={(e, targetNode) => {
                e.stopPropagation();
                const pList = targetNode.parentIds?.length ? targetNode.parentIds : (targetNode.parentId ? [targetNode.parentId] : []);
                if (pList.length > 0) {
                  setDisconnectingFrom({ node: targetNode, parentId: pList[pList.length - 1] });
                }
              }}
              onConnectionEnd={(targetNode) => {
                if (connectingFrom && targetNode && connectingFrom.id !== targetNode.id) {
                  try {
                    connectNodes(connectingFrom.id, targetNode.id);
                  } catch (err) {
                    console.error('Error connecting nodes:', err);
                  }
                  setConnectingFrom(null);
                  setTempLine(null);
                  setIsConnectingMode(false);
                }
              }}
              onDelete={() => deleteNode(node.id)}
              onTouchStart={(e) => {
                if (isConnectingMode) {
                  e.stopPropagation();
                  // En modo conexión: primer toque = inicio, segundo toque = fin
                  if (!connectingFrom) {
                    setConnectingFrom(node);
                  } else if (connectingFrom.id !== node.id) {
                    moveNode(node.id, connectingFrom.id);
                    setConnectingFrom(null);
                    setIsConnectingMode(false);
                  }
                } else {
                  handleNodeTouchStart(e, node);
                }
              }}
              onTouchMove={isConnectingMode ? undefined : handleNodeTouchMove}
              onTouchEnd={handleTouchEnd}
              isDark={isDark}
            />
          </div>
        ))}
      </div>

      {/* Floating Action Button (FAB) para Agregar Nodo - Circular con signo + en el centro */}
      <motion.button
        whileHover={{ scale: 1.12 }}
        whileTap={{ scale: 0.92 }}
        onClick={() => {
          setShowAddPanel(true);
        }}
        className={`absolute bottom-16 sm:bottom-4 right-4 z-40 w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center shadow-2xl border backdrop-blur-md transition-all ${
          isDark 
            ? 'bg-blue-600/90 hover:bg-blue-500 text-white border-blue-400/30 shadow-blue-900/40' 
            : 'bg-blue-600 hover:bg-blue-500 text-white border-blue-400 shadow-blue-300/60'
        }`}
        title="Crear un nuevo nodo"
      >
        <Plus size={20} className="sm:w-[22px] sm:h-[22px] stroke-[2.5]" />
      </motion.button>

      {/* UI Overlay */}
      <Toolbar
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFitView={handleFitView}
        onAutoLayoutVertical={handleAutoLayoutVertical}
        onAutoLayoutHorizontal={handleAutoLayoutHorizontal}
        showArchive={showArchive}
        onToggleArchive={() => setShowArchive(prev => !prev)}
        archivedCount={archivedNodes.length}
        showGrid={showGrid}
        setShowGrid={setShowGrid}
        lineStyle={lineStyle}
        setLineStyle={setLineStyle}
        isFullscreen={isFullscreen}
        toggleFullscreen={toggleFullscreen}
        isDark={isDark}
        isConnectingMode={isConnectingMode}
        setIsConnectingMode={setIsConnectingMode}
      />

      {/* Panel de Nodos Archivados */}
      <AnimatePresence>
        {showArchive && (
          <ArchivedNodesPanel
            archivedNodes={archivedNodes}
            onRestore={restoreNode}
            onDeletePermanent={deletePermanent}
            onClose={() => setShowArchive(false)}
            isDark={isDark}
          />
        )}
      </AnimatePresence>

      {/* Mini-map - Oculto en móvil muy pequeño */}
      <div className="hidden sm:block">
        <NexusMinimap
        nodes={nodes}
        viewport={{
          x: -pan.x / zoom,
          y: -pan.y / zoom,
          width: (containerRef.current?.clientWidth || 1000) / zoom,
          height: (containerRef.current?.clientHeight || 800) / zoom
        }}
        onNavigate={(pos) => {
          setPan({ 
            x: -pos.x * zoom + containerRef.current.clientWidth / 2, 
            y: -pos.y * zoom + containerRef.current.clientHeight / 2 
          });
        }}
        isDark={isDark}
      />
      </div>

      {/* Add Node Panel */}
      <AnimatePresence>
        {showAddPanel && (
          <AddNodePanel
            onAdd={handleAddNode}
            onClose={() => setShowAddPanel(false)}
            isDark={isDark}
            containerRef={containerRef}
          />
        )}
      </AnimatePresence>

      {/* Help text - solo visible al conectar */}
      {connectingFrom && (
        <div className={`absolute bottom-20 left-1/2 -translate-x-1/2 z-40 backdrop-blur-sm rounded-full px-4 py-2 text-xs text-center transition-colors duration-300 ${isDark ? 'bg-slate-900/80 text-slate-400' : 'bg-white/80 text-slate-500'}`}>
          Suelta sobre otro nodo • ESC para cancelar
        </div>
      )}

      {/* Cancel connection */}
      {connectingFrom && (
        <button
          onClick={() => {
            setConnectingFrom(null);
            setTempLine(null);
          }}
          className="absolute top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-red-600/90 hover:bg-red-500 text-white rounded-full shadow-xl text-sm font-medium"
        >
          Cancelar conexión
        </button>
      )}
    </div>
  );
};

export default NexusManager;
