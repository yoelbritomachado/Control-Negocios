import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, ZoomIn, ZoomOut, Maximize2, Grid3X3,
  Building2, Package, Users, Wallet, Shield,
  X, Check, AlertCircle, ArrowLeft
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useNexus } from './useNexus';
import { NexusNode } from './NexusNode';
import { NexusGraph, NexusMinimap } from './NexusGraph';
import { NODE_TYPES, NODE_STATUS } from './nexus.types';

// Panel de control para agregar nodos
const AddNodePanel = ({ onAdd, onClose, parentNode }) => {
  const [selectedType, setSelectedType] = useState(null);
  const [name, setName] = useState('');
  const [error, setError] = useState(null);

  const availableTypes = parentNode 
    ? NODE_TYPES[parentNode.type?.toUpperCase()]?.allowedChildren || []
    : ['empresa'];

  const handleSubmit = () => {
    if (!selectedType) {
      setError('Selecciona un tipo de nodo');
      return;
    }
    if (!name.trim()) {
      setError('Ingresa un nombre');
      return;
    }

    try {
      onAdd(selectedType, name);
      onClose();
    } catch (e) {
      setError(e.message);
    }
  };

  const typeIcons = {
    empresa: Building2,
    administrador: Shield,
    inventario: Package,
    vendedor: Users,
    caja: Wallet
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="fixed left-4 bottom-4 z-50 w-80 bg-slate-900/95 backdrop-blur-xl rounded-xl border border-slate-700 shadow-2xl p-4"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-white">
          {parentNode ? `Agregar a ${parentNode.name}` : 'Nueva Empresa'}
        </h3>
        <button onClick={onClose} className="text-slate-400 hover:text-white">
          <X size={18} />
        </button>
      </div>

      {error && (
        <div className="mb-4 p-2 bg-red-500/20 border border-red-500/50 rounded-lg flex items-center gap-2 text-sm text-red-400">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <div className="space-y-3 mb-4">
        <label className="text-xs text-slate-400 uppercase tracking-wider">Tipo de nodo</label>
        <div className="grid grid-cols-3 gap-2">
          {availableTypes.map(type => {
            const config = NODE_TYPES[type.toUpperCase()];
            const Icon = typeIcons[type];
            
            return (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`p-3 rounded-lg border transition-all ${
                  selectedType === type
                    ? 'border-blue-500 bg-blue-500/20'
                    : 'border-slate-700 hover:border-slate-600'
                }`}
              >
                <Icon 
                  size={20} 
                  style={{ color: config?.color }}
                  className="mx-auto mb-1"
                />
                <span className="text-[10px] text-slate-300 block text-center">
                  {config?.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3 mb-4">
        <label className="text-xs text-slate-400 uppercase tracking-wider">Nombre</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej: Almacén Norte"
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-blue-500 focus:outline-none"
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
          className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition-colors"
        >
          Cancelar
        </button>
      </div>
    </motion.div>
  );
};

// Barra de herramientas
const Toolbar = ({ onZoomIn, onZoomOut, onFitView, showGrid, setShowGrid }) => (
  <div className="absolute top-4 right-4 z-40 flex flex-col gap-2">
    <div className="bg-slate-900/90 backdrop-blur-sm rounded-lg border border-slate-700 p-1 shadow-xl">
      <button
        onClick={onZoomIn}
        className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
        title="Acercar"
      >
        <ZoomIn size={18} />
      </button>
      <button
        onClick={onZoomOut}
        className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
        title="Alejar"
      >
        <ZoomOut size={18} />
      </button>
      <button
        onClick={onFitView}
        className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
        title="Ajustar vista"
      >
        <Maximize2 size={18} />
      </button>
      <button
        onClick={() => setShowGrid(!showGrid)}
        className={`p-2 rounded-md transition-colors ${showGrid ? 'text-blue-400 bg-blue-500/20' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
        title="Mostrar grid"
      >
        <Grid3X3 size={18} />
      </button>
    </div>
  </div>
);

// Header con estadísticas
const NexusHeader = ({ stats }) => (
  <div className="absolute top-4 left-40 z-40 bg-slate-900/90 backdrop-blur-sm rounded-xl border border-slate-700 p-4 shadow-xl">
    <div className="flex items-center gap-3 mb-3">
      <div className="p-2 bg-gradient-to-br from-blue-500/20 to-purple-500/10 rounded-lg border border-blue-500/30">
        <Grid3X3 className="w-5 h-5 text-blue-400" />
      </div>
      <div>
        <h1 className="text-lg font-bold text-white">NexusNode</h1>
        <p className="text-xs text-slate-400">Gestión Empresarial Nodal</p>
      </div>
    </div>
    
    <div className="flex gap-4 text-xs">
      <div className="text-center">
        <p className="text-slate-500 uppercase tracking-wider">Nodos</p>
        <p className="text-lg font-bold text-white">{stats.total}</p>
      </div>
      <div className="text-center">
        <p className="text-slate-500 uppercase tracking-wider">Online</p>
        <p className="text-lg font-bold text-emerald-400">{stats.online}</p>
      </div>
      <div className="text-center">
        <p className="text-slate-500 uppercase tracking-wider">Offline</p>
        <p className="text-lg font-bold text-red-400">{stats.offline}</p>
      </div>
    </div>
  </div>
);

export const NexusManager = () => {
  const navigate = useNavigate();
  const {
    nodes,
    nodeTree,
    selectedNodeId,
    selectedNode,
    expandedNodes,
    stats,
    createNode,
    updateNode,
    deleteNode,
    selectNode,
    toggleExpand,
    getChildren
  } = useNexus();

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [showGrid, setShowGrid] = useState(true);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [addPanelParent, setAddPanelParent] = useState(null);
  
  const containerRef = useRef(null);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  // Calcular conexiones
  const connections = nodes
    .filter(n => n.parentId)
    .map(n => ({ parentId: n.parentId, childId: n.id }));

  // Handlers
  const handleZoomIn = () => setZoom(z => Math.min(z * 1.2, 3));
  const handleZoomOut = () => setZoom(z => Math.max(z / 1.2, 0.3));
  const handleFitView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleAddNode = (type, name) => {
    createNode(type, addPanelParent?.id || null, { 
      name,
      position: addPanelParent 
        ? { 
            x: addPanelParent.position.x + (getChildren(addPanelParent.id).length * 300),
            y: addPanelParent.position.y + 200
          }
        : { x: 400, y: 50 }
    });
  };

  const handleMouseDown = (e) => {
    if (e.target === containerRef.current) {
      isDragging.current = true;
      dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging.current) {
      setPan({
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y
      });
    }
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  // Renderizar nodos recursivamente
  const renderNodes = (nodeList, level = 0) => {
    return nodeList.map(node => (
      <motion.div
        key={node.id}
        className="absolute"
        style={{
          left: node.position.x,
          top: node.position.y,
          zIndex: 10 + level
        }}
        layoutId={node.id}
      >
        <NexusNode
          node={node}
          isSelected={selectedNodeId === node.id}
          isExpanded={expandedNodes.has(node.id)}
          onSelect={selectNode}
          onExpand={toggleExpand}
          onEdit={(n) => console.log('Edit:', n)}
          onDelete={deleteNode}
        />
      </motion.div>
    ));
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-screen bg-slate-950 overflow-hidden cursor-grab active:cursor-grabbing"
    >
      {/* Back Button */}
      <button
        onClick={() => navigate('/')}
        className="absolute top-4 left-4 z-50 flex items-center gap-2 px-4 py-2 bg-slate-800/90 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-colors"
      >
        <ArrowLeft size={18} />
        <span className="text-sm">Volver al Sistema</span>
      </button>
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Grid Background */}
      {showGrid && (
        <div 
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `
              radial-gradient(circle, rgba(148,163,184,0.1) 1px, transparent 1px)
            `,
            backgroundSize: '20px 20px',
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`
          }}
        />
      )}

      {/* Graph Layer */}
      <div
        className="absolute inset-0"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0'
        }}
      >
        <NexusGraph
          nodes={nodes}
          connections={connections}
          selectedNodeId={selectedNodeId}
        />
        
        {/* Nodes */}
        <AnimatePresence>
          {renderNodes(nodes)}
        </AnimatePresence>
      </div>

      {/* UI Overlay */}
      <NexusHeader stats={stats} />
      
      <Toolbar
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFitView={handleFitView}
        showGrid={showGrid}
        setShowGrid={setShowGrid}
      />

      {/* Mini-map */}
      <NexusMinimap
        nodes={nodes}
        viewport={{
          x: -pan.x / zoom,
          y: -pan.y / zoom,
          width: (containerRef.current?.clientWidth || 1000) / zoom,
          height: (containerRef.current?.clientHeight || 800) / zoom
        }}
        onNavigate={(pos) => {
          setPan({ x: -pos.x * zoom + containerRef.current.clientWidth / 2, y: -pos.y * zoom + containerRef.current.clientHeight / 2 });
        }}
      />

      {/* Add Node Button */}
      <button
        onClick={() => {
          setAddPanelParent(selectedNode);
          setShowAddPanel(true);
        }}
        className="absolute left-4 bottom-4 z-50 p-4 bg-blue-600 hover:bg-blue-500 text-white rounded-full shadow-xl hover:shadow-2xl transition-all hover:scale-110"
      >
        <Plus size={24} />
      </button>

      {/* Add Node Panel */}
      <AnimatePresence>
        {showAddPanel && (
          <AddNodePanel
            onAdd={handleAddNode}
            onClose={() => setShowAddPanel(false)}
            parentNode={addPanelParent}
          />
        )}
      </AnimatePresence>

      {/* Selected Node Info */}
      <AnimatePresence>
        {selectedNode && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-4 right-20 z-40 bg-slate-900/95 backdrop-blur-xl rounded-xl border border-slate-700 p-4 shadow-xl max-w-xs"
          >
            <h4 className="font-semibold text-white mb-1">{selectedNode.name}</h4>
            <p className="text-xs text-slate-400 mb-3">{selectedNode.description}</p>
            
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setAddPanelParent(selectedNode);
                  setShowAddPanel(true);
                }}
                className="flex-1 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded-lg text-xs font-medium transition-colors"
              >
                + Agregar hijo
              </button>
              <button
                onClick={() => deleteNode(selectedNode.id)}
                className="flex-1 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-xs font-medium transition-colors"
              >
                Eliminar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NexusManager;
