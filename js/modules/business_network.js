/**
 * MCH Control - Business Network Editor
 * Node-based visual editor for Business <-> User relationships.
 * Stack: SVG (Wires) + HTML (Nodes) + JS (Logic)
 */

window.networkEditorState = {
    nodes: [],
    connections: [],
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    isDraggingCanvas: false,
    isDraggingNode: false,
    draggedNodeId: null,
    startX: 0,
    startY: 0,
    connectionStyle: 'step',
    selectedNodeId: null
};

// ... (Toolbar remains same) ...

function renderNodes() {
    const container = document.getElementById('network-nodes');
    if (!container) return;

    container.innerHTML = window.networkEditorState.nodes.map(node => {
        let color = '#444';
        let icon = 'ph-square';
        let label = node.id;

        // Cubrefranco Detection
        const incomingConnections = window.networkEditorState.connections.filter(c => c.to === node.id).length;
        const isCubrefranco = node.type === 'user' && node.data.role === 'seller' && incomingConnections >= 2;
        const isSelected = window.networkEditorState.selectedNodeId === node.id;

        switch (node.type) {
            case 'warehouse': color = 'var(--primary)'; icon = 'ph-warehouse'; label = node.data.name; break;
            case 'business': color = 'var(--success)'; icon = 'ph-storefront'; label = node.data.name; break;
            case 'user':
                color = '#8b5cf6';
                icon = 'ph-user-gear';
                label = node.data.name;

                if (isCubrefranco) {
                    color = '#f59e0b';
                    icon = 'ph-users-three';
                }
                break;
            case 'company': color = '#f59e0b'; icon = 'ph-buildings'; label = node.data.name; break;
            default: label = node.data.name || node.id;
        }

        // Selected Style: Red/Orange Border (DaVinci Style)
        const borderStyle = isSelected ? 'border: 2px solid #ff4d4f; box-shadow: 0 0 0 4px rgba(255, 77, 79, 0.2);' : `border-top: 4px solid ${color}; ${isCubrefranco ? 'box-shadow: 0 0 15px rgba(245, 158, 11, 0.4); border-color: #f59e0b;' : ''}`;

        return `
            <div class="network-node" id="${node.id}" 
                 style="transform: translate(${node.x}px, ${node.y}px); ${borderStyle}"
                 onmousedown="handleNodeMouseDown(event, '${node.id}')"
                 ondblclick="editNodeName('${node.id}')">
                
                <div class="node-header" style="${isCubrefranco ? 'background: rgba(245, 158, 11, 0.1);' : ''}; display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <i class="ph ${icon}" style="color: ${color}"></i>
                        <span>${label}</span>
                    </div>
                </div>
                
                <div class="node-ports">
                    <!-- Input Port -->
                    <div class="port port-in" onmouseup="completeConnection(event, '${node.id}')"></div>
                    <!-- Output Port -->
                    <div class="port port-out" onmousedown="startConnectionDrag(event, '${node.id}')"></div>
                </div>

                <div style="font-size: 0.75rem; color: #888; margin-top: 5px;">
                    ${node.type === 'business' ? 'PUNTO DE VENTA' : (node.type === 'warehouse' ? 'ALMACÉN' : (node.type === 'company' ? 'EMPRESA' : (isCubrefranco ? 'CUBREFRANCO' : node.type.toUpperCase())))}
                </div>
            </div>
        `;
    }).join('');
}

// ... (renderConnections, etc) ...

// --- Interaction Handlers ---

window.handleCanvasMouseDown = function (e) {
    if (e.target.closest('.network-node')) return;

    // Click on empty space = Deselect
    window.networkEditorState.selectedNodeId = null;
    renderNodes();

    window.networkEditorState.isDraggingCanvas = true;
    window.networkEditorState.startX = e.clientX - window.networkEditorState.offsetX;
    window.networkEditorState.startY = e.clientY - window.networkEditorState.offsetY;
    document.getElementById('network-viewport').style.cursor = 'grabbing';
}

window.handleNodeMouseDown = function (e, nodeId) {
    e.stopPropagation();

    // Select Node
    window.networkEditorState.selectedNodeId = nodeId;
    renderNodes(); // Re-render to show selection border

    window.networkEditorState.isDraggingNode = true;
    window.networkEditorState.draggedNodeId = nodeId;
}

// Global Keyboard Handler for Deletion
window.addEventListener('keydown', async (e) => {
    // Only if a node is selected
    if (!window.networkEditorState.selectedNodeId) return;

    // Check Key
    if (e.key === 'Delete' || e.key === 'Backspace') {
        const nodeId = window.networkEditorState.selectedNodeId;

        // Confirm? (Maybe optional for power users, but safer to keep for now)
        // DaVinci just deletes. User said "deshacer" implies undo/delete.
        // Let's make it instant but with a Toast to be "Pro".

        window.networkEditorState.nodes = window.networkEditorState.nodes.filter(n => n.id !== nodeId);
        window.networkEditorState.connections = window.networkEditorState.connections.filter(c => c.from !== nodeId && c.to !== nodeId);
        window.networkEditorState.selectedNodeId = null;

        renderNodes();
        renderConnections();
        showToast("Nodo eliminado", "info");
    }
});
window.renderBusinessNetwork = function (container) {
    if (!container) return;

    // Initialize Data if empty OR if migration needed
    const db = window.db || {};

    // [MIGRATION] Force Layout Update for v1.5 Structure
    if (!db.networkLayoutVersion || db.networkLayoutVersion < 2) {
        console.log("♻️ Migrating Network Layout to v2 (Default Structure)");
        initializeDefaultLayout(db);
        db.networkLayoutVersion = 2;
        window.saveData();
    }

    if (!db.networkLayout || db.networkLayout.length === 0) {
        initializeDefaultLayout(db);
    }

    // Load State
    window.networkEditorState.nodes = [...db.networkLayout];
    // Generate Virtual Connections based on relationships implies (e.g. Manager -> Business)
    // For this version, we store connections explicitly or deduce them. 
    // Let's deduce them for simplicity: If a User is 'manager' of Business, connect them.
    // Actually, let's keep it visual-first. Connections in DB.
    window.networkEditorState.connections = db.networkConnections || [];

    container.innerHTML = `
        <div style="height: 100%; display: flex; flex-direction: column; background: #1a1b1e; overflow: hidden; position: relative;">
            
            <!-- Toolbar -->
            <div style="padding: 1rem; background: var(--bg-card); border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; z-index: 100;">
                <h3 style="margin: 0;">🗺️ Mapa de Red Operativa</h3>
                <div style="display: flex; gap: 0.5rem;">
                    <button class="btn-secondary" onclick="toggleConnectionStyle()" id="btn-line-style">🔀 Líneas: Rectas</button>
                    <button class="btn-secondary" onclick="autoLayoutNetwork()">⚡ Auto-Distribución</button>
                    <button class="btn-primary" onclick="saveNetworkLayout()">💾 Guardar Distribución</button>
                </div>
            </div>

            <div style="flex: 1; display: flex; overflow: hidden;">
                
                <!-- 🎨 Creation Palette -->
                <div class="network-palette" style="width: 250px; background: var(--bg-card); border-right: 1px solid var(--border); padding: 1rem; overflow-y: auto; z-index: 50;">
                    <h4 style="margin-top: 0; color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px;">Estructura</h4>
                    
                    <div class="palette-item" draggable="true" ondragstart="handlePaletteDragStart(event, 'company')">
                        <i class="ph ph-buildings" style="color: #f59e0b;"></i> Empresa
                    </div>
                    <div class="palette-item" draggable="true" ondragstart="handlePaletteDragStart(event, 'warehouse')">
                        <i class="ph ph-warehouse" style="color: var(--primary);"></i> Almacén
                    </div>
                    <div class="palette-item" draggable="true" ondragstart="handlePaletteDragStart(event, 'business')">
                        <i class="ph ph-storefront" style="color: var(--success);"></i> Punto de Venta
                    </div>

                    <h4 style="margin-top: 1.5rem; color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px;">Personal</h4>
                    
                    <div class="palette-item" draggable="true" ondragstart="handlePaletteDragStart(event, 'user-owner')">
                        <i class="ph ph-crown" style="color: #ffd700;"></i> Dueño
                    </div>
                    <div class="palette-item" draggable="true" ondragstart="handlePaletteDragStart(event, 'user-admin')">
                        <i class="ph ph-key" style="color: #8b5cf6;"></i> Administrador
                        <span style="font-size:0.7rem; color: #666; display:block;">Gestor Local</span>
                    </div>
                    <div class="palette-item" draggable="true" ondragstart="handlePaletteDragStart(event, 'user-seller')">
                        <i class="ph ph-tag" style="color: #3b82f6;"></i> Vendedor
                        <span style="font-size:0.7rem; color: #666; display:block;">Cubrefranco Auto</span>
                    </div>
                </div>

                <!-- Canvas Container -->
                <div id="network-viewport" style="flex: 1; position: relative; overflow: hidden; cursor: grab; background: radial-gradient(#2c2d31 1px, transparent 1px) 0 0 / 20px 20px;"
                     onmousedown="handleCanvasMouseDown(event)"
                     onmousemove="handleCanvasMouseMove(event)"
                     onmouseup="handleCanvasMouseUp(event)"
                     onwheel="handleCanvasWheel(event)"
                     ondragover="handleCanvasDragOver(event)"
                     ondrop="handleCanvasDrop(event)">
                     
                    <!-- Transform Container -->
                    <div id="network-canvas" style="transform-origin: 0 0; width: 100%; height: 100%; position: absolute;">
                        
                        <!-- SVG Layer for Wires -->
                        <svg id="network-connections" style="position: absolute; top: 0; left: 0; width: 5000px; height: 5000px; overflow: visible; pointer-events: visibleStroke; z-index: 0;">
                            <defs>
                                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                                    <polygon points="0 0, 10 3.5, 0 7" fill="#666" />
                                </marker>
                            </defs>
                        </svg>
                        
                        <!-- HTML Layer for Nodes -->
                        <div id="network-nodes" style="position: absolute; top:0; left:0; width:100%; height:100%; z-index: 1;"></div>
                    
                    </div>

                    <!-- HUD / Minimap Controls -->
                    <div style="position: absolute; bottom: 20px; right: 20px; display: flex; flex-direction: column; gap: 5px; background: var(--bg-card); padding: 5px; border-radius: 8px; border: 1px solid var(--border);">
                        <button onclick="zoomNetwork(0.1)" class="btn-icon-small"><i class="ph ph-plus"></i></button>
                        <div id="zoom-level" style="text-align: center; font-size: 0.8rem; padding: 2px;">100%</div>
                        <button onclick="zoomNetwork(-0.1)" class="btn-icon-small"><i class="ph ph-minus"></i></button>
                        <button onclick="resetNetworkView()" class="btn-icon-small"><i class="ph ph-arrows-out"></i></button>
                    </div>

                    <!-- 🗑️ Trash Can Drop Zone -->
                    <div id="network-trash" style="position: absolute; bottom: 20px; left: 20px; width: 60px; height: 60px; background: rgba(220, 38, 38, 0.2); border: 2px dashed #ef4444; border-radius: 50%; display: flex; justify-content: center; align-items: center; transition: all 0.2s; z-index: 10;">
                        <i class="ph ph-trash" style="font-size: 24px; color: #ef4444;"></i>
                    </div>

                </div>
            </div>
    `;

    renderNodes();
    renderConnections();
    updateTransform();
};

function initializeDefaultLayout(db) {
    const nodes = [
        // Level 1: Owners & Company
        { id: 'node-owner-1', type: 'user', data: { name: 'Dueño YOEL', role: 'owner' }, x: 400, y: 50 },
        { id: 'node-owner-2', type: 'user', data: { name: 'Dueño ARY', role: 'owner' }, x: 800, y: 50 },
        { id: 'node-company-1', type: 'company', data: { name: 'MISS CHULERIAS' }, x: 600, y: 250 },

        // Level 2: Admin
        { id: 'node-admin-1', type: 'user', data: { name: 'Administrador KEILA', role: 'admin' }, x: 300, y: 300 },

        // Level 3: Warehouse
        { id: 'node-warehouse-1', type: 'warehouse', data: { name: 'Almacén MCH' }, x: 800, y: 450 },

        // Level 4: POS
        { id: 'node-pos-1', type: 'business', data: { name: 'MCH 1' }, x: 300, y: 650 },
        { id: 'node-pos-2', type: 'business', data: { name: 'MCH 2' }, x: 900, y: 650 },

        // Level 5: Sellers
        { id: 'node-seller-1', type: 'user', data: { name: 'Vendedor', role: 'seller' }, x: 300, y: 850 },
        { id: 'node-seller-2', type: 'user', data: { name: 'Vendedor', role: 'seller' }, x: 600, y: 850 }, // Cubrefranco
        { id: 'node-seller-3', type: 'user', data: { name: 'Vendedor', role: 'seller' }, x: 1000, y: 850 }
    ];

    const connections = [
        { from: 'node-owner-1', to: 'node-company-1' },
        { from: 'node-owner-2', to: 'node-company-1' },
        { from: 'node-company-1', to: 'node-warehouse-1' },
        { from: 'node-company-1', to: 'node-admin-1' },

        { from: 'node-warehouse-1', to: 'node-pos-1' },
        { from: 'node-warehouse-1', to: 'node-pos-2' },

        { from: 'node-pos-1', to: 'node-seller-1' },
        { from: 'node-pos-1', to: 'node-seller-2' }, // Cubrefranco Link 1
        { from: 'node-pos-2', to: 'node-seller-2' }, // Cubrefranco Link 2
        { from: 'node-pos-2', to: 'node-seller-3' }
    ];

    db.networkLayout = nodes;
    db.networkConnections = connections;
}

function renderNodes() {
    const container = document.getElementById('network-nodes');
    if (!container) return;

    container.innerHTML = window.networkEditorState.nodes.map(node => {
        let color = '#444';
        let icon = 'ph-square';
        let label = node.id;

        // Identify Incoming Connections
        const incoming = window.networkEditorState.connections.filter(c => c.to === node.id);

        // Cubrefranco Detection
        const isCubrefranco = node.type === 'user' && node.data.role === 'seller' && incoming.length >= 2;

        let inputPortsHtml = '';

        // 1. Existing Connections (Dedicated Ports)
        incoming.forEach((conn, index) => {
            // We use the CONNECTION ID (or index) to identify which port this is
            // For simplicity, we'll rely on the connection object reference or index matching
            // Ideally connections should have IDs. For now, we use index in the filter array.

            inputPortsHtml += `
                <div class="port port-in existing-connection" 
                     style="background: #ef4444; border-color: #ef4444;"
                     title="Desconectar"
                     onmousedown="startConnectionDragFromInput(event, '${node.id}', ${index})">
                </div>
             `;
        });

        // 2. Main Input Port (For NEW connections)
        inputPortsHtml += `
            <div class="port port-in main-input" 
                 title="Conectar aquí"
                 onmouseup="completeConnection(event, '${node.id}')">
            </div>
        `;

        switch (node.type) {
            case 'warehouse': color = 'var(--primary)'; icon = 'ph-warehouse'; label = node.data.name; break;
            case 'business': color = 'var(--success)'; icon = 'ph-storefront'; label = node.data.name; break;
            case 'user':
                color = '#8b5cf6'; // Default Violet
                icon = 'ph-user-gear';
                label = node.data.name;

                if (isCubrefranco) {
                    color = '#f59e0b'; // Amber/Orange
                    icon = 'ph-users-three'; // Multi-user icon
                }
                break;
            case 'company': color = '#f59e0b'; icon = 'ph-buildings'; label = node.data.name; break;
            default: label = node.data.name || node.id;
        }

        return `
            <div class="network-node" id="${node.id}" 
                 style="transform: translate(${node.x}px, ${node.y}px); border-top: 4px solid ${color}; ${isCubrefranco ? 'box-shadow: 0 0 15px rgba(245, 158, 11, 0.4); border-color: #f59e0b;' : ''}"
                 onmousedown="handleNodeMouseDown(event, '${node.id}')"
                 ondblclick="editNodeName('${node.id}')">
                
                <div class="node-header" style="${isCubrefranco ? 'background: rgba(245, 158, 11, 0.1);' : ''}; display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <i class="ph ${icon}" style="color: ${color}"></i>
                        <span>${label}</span>
                    </div>
                </div>
                
                <div class="node-ports" style="align-items: flex-start;">
                    <!-- Input Ports Stack -->
                    <div style="display: flex; flex-direction: column; gap: 8px; margin-left: -10px;">
                        ${inputPortsHtml}
                    </div>

                    <!-- Output Port -->
                    <div class="port port-out" onmousedown="startConnectionDrag(event, '${node.id}')"></div>
                </div>

                <div style="font-size: 0.75rem; color: #888; margin-top: 5px;">
                    ${node.type === 'business' ? 'PUNTO DE VENTA' : (node.type === 'warehouse' ? 'ALMACÉN' : (node.type === 'company' ? 'EMPRESA' : (isCubrefranco ? 'CUBREFRANCO' : node.type.toUpperCase())))}
                </div>
            </div>
        `;
    }).join('');
}

function renderConnections() {
    const svg = document.getElementById('network-connections');
    if (!svg) return;

    // Clear existing
    svg.innerHTML = '';

    window.networkEditorState.connections.forEach(conn => {
        const fromNode = window.networkEditorState.nodes.find(n => n.id === conn.from);
        const toNode = window.networkEditorState.nodes.find(n => n.id === conn.to);

        if (fromNode && toNode) {
            drawConnection(svg, fromNode, toNode, conn);
        }
    });
}

// NEW: Detach connection by dragging from SPECIFIC Input Port
window.startConnectionDragFromInput = function (e, nodeId, connIndex) {
    if (e) e.stopPropagation();

    // Find matching connection
    // We need to match the logic in renderNodes:
    // It filters "connections.filter(c => c.to === nodeId)"
    // And uses the index of THAT filtered array.

    const incoming = window.networkEditorState.connections.filter(c => c.to === nodeId);
    if (connIndex < 0 || connIndex >= incoming.length) return;

    const connToDetach = incoming[connIndex];

    // Find actual index in global array to remove
    const globalIndex = window.networkEditorState.connections.indexOf(connToDetach);
    if (globalIndex === -1) return;

    window.networkEditorState.connections.splice(globalIndex, 1);

    // Start dragging "new" connection from the original source
    const sourceNode = window.networkEditorState.nodes.find(n => n.id === connToDetach.from);
    if (sourceNode) {
        window.networkEditorState.isDraggingConnection = true;
        window.networkEditorState.connectionSourceDetails = {
            nodeId: connToDetach.from,
            x: sourceNode.x + 180,
            y: sourceNode.y + 40
        };
    }

    renderConnections();
    renderNodes(); // Update ports
    createTempLine();
}

function createTempLine() {
    const svg = document.getElementById('network-connections');
    let tempLine = document.getElementById('temp-connection-line');
    if (!tempLine) {
        tempLine = document.createElementNS("http://www.w3.org/2000/svg", "path");
        tempLine.setAttribute("id", "temp-connection-line");
        tempLine.setAttribute("stroke", "#666");
        tempLine.setAttribute("stroke-width", "2");
        tempLine.setAttribute("stroke-dasharray", "5,5");
        tempLine.setAttribute("fill", "none");
        svg.appendChild(tempLine);
    }
}

function drawConnection(svg, nodeA, nodeB, connData) {
    // Port positions
    const x1 = nodeA.x + 180;
    const y1 = nodeA.y + 40;

    // Destination Port Logic:
    // Find index among incoming connections to nodeB
    const incoming = window.networkEditorState.connections.filter(c => c.to === nodeB.id);
    const index = incoming.indexOf(connData);

    // Calculate Y Offset
    // Header is approx 40px?
    // Ports start at top of .node-ports container.
    // .node-ports is below header. Header ~40px.
    // Port Vertical Spacing: 16px (height) + 8px (gap) = 24px

    // Base Y for first port: nodeB.y + 70 (approx offset for padding/header)
    const portHeight = 24;
    let y2 = nodeB.y + 70 + (index * portHeight);

    const x2 = nodeB.x; // Left edge
    // Actually, x2 should be slightly inside? No, left edge is fine if port sticks out -18px.
    // Line should go to x=0 relative to node.

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");

    let d = '';

    if (window.networkEditorState.connectionStyle === 'bezier') {
        const cp1x = x1 + 100;
        const cp1y = y1;
        const cp2x = x2 - 100;
        const cp2y = y2;
        d = `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;
    } else {
        // Orthogonal
        const midX = (x1 + x2) / 2;
        // Step logic: Horizontal -> Vertical -> Horizontal
        // But for multiple inputs, we want clean separation at destination.
        // Enhance Step: Go to midX, then Y2, then X2.
        d = `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;
    }

    path.setAttribute("d", d);
    path.setAttribute("stroke", "#666");
    path.setAttribute("stroke-width", "3");
    path.setAttribute("fill", "none");
    path.setAttribute("marker-end", "url(#arrowhead)");
    path.setAttribute("cursor", "pointer");

    // Deletion Handler
    path.onclick = (e) => {
        e.stopPropagation();
    };
    path.ondblclick = (e) => {
        e.stopPropagation();
        deleteConnection(connData);
    };

    path.onmouseover = () => path.setAttribute("stroke", "var(--primary)");
    path.onmouseout = () => path.setAttribute("stroke", "#666");

    svg.appendChild(path);
}

window.deleteConnection = async function (connData) {
    const confirm = await Swal.fire({
        title: '¿Eliminar Conexión?',
        text: "Se desconectará el flujo operativo.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sí, desconectar',
        background: '#16191f',
        color: '#fff'
    });

    if (confirm.isConfirmed) {
        window.networkEditorState.connections = window.networkEditorState.connections.filter(c => c !== connData);
        renderConnections();
        showToast("Conexión eliminada", "info");
    }
}

window.toggleConnectionStyle = function () {
    window.networkEditorState.connectionStyle = window.networkEditorState.connectionStyle === 'bezier' ? 'step' : 'bezier';
    document.getElementById('btn-line-style').innerText = window.networkEditorState.connectionStyle === 'bezier' ? '🔀 Líneas: Curvas' : '🔀 Líneas: Rectas';
    renderConnections();
}

// --- Interaction Handlers ---

window.handleCanvasMouseDown = function (e) {
    if (e.target.closest('.network-node')) return; // Let Node handler take it

    window.networkEditorState.isDraggingCanvas = true;
    window.networkEditorState.startX = e.clientX - window.networkEditorState.offsetX;
    window.networkEditorState.startY = e.clientY - window.networkEditorState.offsetY;
    document.getElementById('network-viewport').style.cursor = 'grabbing';
}

window.handleCanvasMouseMove = function (e) {
    // Pan Canvas
    if (window.networkEditorState.isDraggingCanvas) {
        e.preventDefault();
        window.networkEditorState.offsetX = e.clientX - window.networkEditorState.startX;
        window.networkEditorState.offsetY = e.clientY - window.networkEditorState.startY;
        updateTransform();
    }

    // Drag Node
    if (window.networkEditorState.isDraggingNode && window.networkEditorState.draggedNodeId) {
        e.preventDefault();
        const node = window.networkEditorState.nodes.find(n => n.id === window.networkEditorState.draggedNodeId);
        if (node) {
            const deltaX = e.movementX / window.networkEditorState.scale;
            const deltaY = e.movementY / window.networkEditorState.scale;
            node.x += deltaX;
            node.y += deltaY;

            const el = document.getElementById(node.id);
            if (el) el.style.transform = `translate(${node.x}px, ${node.y}px)`;

            renderConnections();
        }
    }

    // Drag Connection (Temp Line)
    if (window.networkEditorState.isDraggingConnection) {
        e.preventDefault();
        const tempLine = document.getElementById('temp-connection-line');
        if (tempLine) {
            // Screen to Canvas Coordinates
            const rect = document.getElementById('network-viewport').getBoundingClientRect();
            const mouseX = (e.clientX - rect.left - window.networkEditorState.offsetX) / window.networkEditorState.scale;
            const mouseY = (e.clientY - rect.top - window.networkEditorState.offsetY) / window.networkEditorState.scale;

            const createTempNode = (x, y) => ({ x: x - 20, y: y - 40 }); // Adjust to point tip
            const sourceDummy = createTempNode(window.networkEditorState.connectionSourceDetails.x, window.networkEditorState.connectionSourceDetails.y);

            // Draw dummy bezier
            // We reuse drawBezier logic but for manual path setting
            const x1 = window.networkEditorState.connectionSourceDetails.x;
            const y1 = window.networkEditorState.connectionSourceDetails.y;
            const x2 = mouseX;
            const y2 = mouseY;

            const cp1x = x1 + 100;
            const cp1y = y1;
            const cp2x = x2 - 100;
            const cp2y = y2;

            const d = `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;
            tempLine.setAttribute("d", d);
        }
    }
}

window.handleCanvasMouseUp = function (e) {
    if (window.networkEditorState.isDraggingConnection) {
        cancelConnectionDrag();
    }

    // CHECK TRASH DROP
    if (window.networkEditorState.isDraggingNode && window.networkEditorState.draggedNodeId) {
        const trash = document.getElementById('network-trash');
        if (trash) {
            const trashRect = trash.getBoundingClientRect();
            // Simple logic: dragging over the trash can icon
            // e.clientX is global, trashRect is global
            if (e.clientX >= trashRect.left && e.clientX <= trashRect.right &&
                e.clientY >= trashRect.top && e.clientY <= trashRect.bottom) {

                handleTrashDrop(window.networkEditorState.draggedNodeId);
            }
        }
    }

    window.networkEditorState.isDraggingCanvas = false;
    window.networkEditorState.isDraggingNode = false;
    window.networkEditorState.draggedNodeId = null;
    document.getElementById('network-viewport').style.cursor = 'grab';
}

window.handleTrashDrop = async function (nodeId) {
    const node = window.networkEditorState.nodes.find(n => n.id === nodeId);
    if (!node) return;

    // 1. Strict Disconnect Check
    const hasConnections = window.networkEditorState.connections.some(c => c.from === nodeId || c.to === nodeId);
    if (hasConnections) {
        showToast("⚠️ Debes desconectar el nodo antes de eliminarlo.", "warning");
        return;
    }

    // 2. Type-Specific Logic
    if (node.type === 'business') {
        const { isConfirmed, value } = await Swal.fire({
            title: 'Eliminar Punto de Venta',
            text: "¿Qué hacer con el inventario?",
            icon: 'question',
            input: 'select',
            inputOptions: {
                'return': 'Regresar a Almacén Origen',
                'archive': 'Archivar (Backup)',
                'delete': 'Borrar Todo (Peligroso)'
            },
            showCancelButton: true,
            confirmButtonText: 'Procesar',
            background: '#16191f', color: '#fff'
        });

        if (isConfirmed) {
            // Mock Logic
            showToast(`POS Eliminado: Acción ${value}`, "success");
            confirmDeleteNode(nodeId);
        }
    } else {
        // Normal User / Generic Node
        const confirm = await Swal.fire({
            title: '¿Archivar Usuario?',
            text: "Se guardará el historial de ventas.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, archivar',
            confirmButtonColor: '#d33',
            background: '#16191f', color: '#fff'
        });

        if (confirm.isConfirmed) {
            confirmDeleteNode(nodeId);
        }
    }
}

function confirmDeleteNode(nodeId) {
    // Move to Archive (Mock)
    const node = window.networkEditorState.nodes.find(n => n.id === nodeId);
    const db = window.db || {};
    if (!db.archivedNodes) db.archivedNodes = [];

    db.archivedNodes.push({
        ...node,
        deletedAt: new Date().toISOString(),
        usageStats: 'Mock Usage: 120 hours'
    });

    // Remove from Live
    window.networkEditorState.nodes = window.networkEditorState.nodes.filter(n => n.id !== nodeId);
    window.networkEditorState.selectedNodeId = null;
    renderNodes();
    saveNetworkLayout();
}

window.handleCanvasWheel = function (e) {
    e.preventDefault();
    const zoomSpeed = 0.05;
    const delta = e.deltaY > 0 ? -zoomSpeed : zoomSpeed;
    const newScale = Math.min(Math.max(0.2, window.networkEditorState.scale + delta), 3);

    window.networkEditorState.scale = newScale;
    updateTransform();
}

window.handleNodeMouseDown = function (e, nodeId) {
    e.stopPropagation(); // Stop canvas drag
    window.networkEditorState.isDraggingNode = true;
    window.networkEditorState.draggedNodeId = nodeId;
}

function updateTransform() {
    const canvas = document.getElementById('network-canvas');
    const { offsetX, offsetY, scale } = window.networkEditorState;
    canvas.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
    document.getElementById('zoom-level').innerText = Math.round(scale * 100) + '%';
}

window.zoomNetwork = function (delta) {
    const newScale = Math.min(Math.max(0.2, window.networkEditorState.scale + delta), 3);
    window.networkEditorState.scale = newScale;
    updateTransform();
}

window.resetNetworkView = function () {
    window.networkEditorState.scale = 1;
    window.networkEditorState.offsetX = 0;
    window.networkEditorState.offsetY = 0;
    updateTransform();
}

window.saveNetworkLayout = async function () {
    const db = window.db || {};
    db.networkLayout = window.networkEditorState.nodes;
    db.networkConnections = window.networkEditorState.connections;
    await window.saveData();
    showToast("Distribución de Red Guardada", "success");
}

window.autoLayoutNetwork = function () {
    // Simple Vertical Layout reset
    const nodes = window.networkEditorState.nodes;
    nodes.forEach((node, i) => {
        node.x = 200 + (Math.floor(i / 3) * 300);
        node.y = 100 + ((i % 3) * 200);
    });
    renderNodes();
    renderConnections();
}

window.startConnectionDrag = function (e, nodeId) {
    e.stopPropagation();
    const node = window.networkEditorState.nodes.find(n => n.id === nodeId);
    if (!node) return;

    window.networkEditorState.isDraggingConnection = true;
    window.networkEditorState.connectionSourceDetails = {
        nodeId: nodeId,
        x: node.x + 180, // Port Out X (Approx relative to node)
        y: node.y + 40   // Port Out Y
    };

    // Create Temp Line (Visual feedback)
    createTempLine();
}

// NEW: Detach connection by dragging from Input
window.startConnectionDragFromInput = function (e, nodeId) {
    e.stopPropagation();

    // Find connection entering this node
    const connIndex = window.networkEditorState.connections.findIndex(c => c.to === nodeId);
    if (connIndex === -1) return; // Nothing to detach

    const conn = window.networkEditorState.connections[connIndex];
    const sourceNode = window.networkEditorState.nodes.find(n => n.id === conn.from);

    if (!sourceNode) return;

    // Remove existing connection (Detach)
    window.networkEditorState.connections.splice(connIndex, 1);

    // Start dragging "new" connection from the original source
    window.networkEditorState.isDraggingConnection = true;
    window.networkEditorState.connectionSourceDetails = {
        nodeId: conn.from,
        x: sourceNode.x + 180,
        y: sourceNode.y + 40
    };

    renderConnections(); // Permanent line gone
    createTempLine();    // Temp line appears
}

function createTempLine() {
    const svg = document.getElementById('network-connections');
    let tempLine = document.getElementById('temp-connection-line');
    if (!tempLine) {
        tempLine = document.createElementNS("http://www.w3.org/2000/svg", "path");
        tempLine.setAttribute("id", "temp-connection-line");
        tempLine.setAttribute("stroke", "#666");
        tempLine.setAttribute("stroke-width", "2");
        tempLine.setAttribute("stroke-dasharray", "5,5");
        tempLine.setAttribute("fill", "none");
        svg.appendChild(tempLine);
    }
}

window.completeConnection = function (e, targetNodeId) {
    e.stopPropagation();
    if (!window.networkEditorState.isDraggingConnection) return;

    const sourceId = window.networkEditorState.connectionSourceDetails.nodeId;

    // Prevent self-connection
    if (sourceId === targetNodeId) {
        cancelConnectionDrag();
        return;
    }

    // Check rules:
    // 1. Owner/Admin -> Only to Company
    const fromNode = window.networkEditorState.nodes.find(n => n.id === sourceId);
    const toNode = window.networkEditorState.nodes.find(n => n.id === targetNodeId);

    if (fromNode && (fromNode.type === 'user' && (fromNode.data.role === 'owner' || fromNode.data.role === 'admin'))) {
        if (toNode.type !== 'company') {
            showToast("Admin/Dueño solo se conecta a EMPRESA", "error");
            cancelConnectionDrag();
            return;
        }
    }

    // Check if connection already exists
    const exists = window.networkEditorState.connections.some(c => c.from === sourceId && c.to === targetNodeId);
    if (!exists) {
        window.networkEditorState.connections.push({ from: sourceId, to: targetNodeId });
        renderConnections();
        showToast("Conexión Creada", "success");
    }

    cancelConnectionDrag();
}

function cancelConnectionDrag() {
    window.networkEditorState.isDraggingConnection = false;
    window.networkEditorState.connectionSourceDetails = null;
    const tempLine = document.getElementById('temp-connection-line');
    if (tempLine) tempLine.remove();
}

// --- Drag & Drop for New Nodes ---

window.handlePaletteDragStart = function (e, type) {
    e.dataTransfer.setData('nodeType', type);
    e.dataTransfer.effectAllowed = 'copy';
}

window.handleCanvasDragOver = function (e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
}

window.handleCanvasDrop = function (e) {
    e.preventDefault();
    const type = e.dataTransfer.getData('nodeType');
    if (!type) return;

    // Calculate Drop Position in Canvas Space
    const rect = document.getElementById('network-viewport').getBoundingClientRect();
    const mouseX = (e.clientX - rect.left - window.networkEditorState.offsetX) / window.networkEditorState.scale;
    const mouseY = (e.clientY - rect.top - window.networkEditorState.offsetY) / window.networkEditorState.scale;

    createNewNode(type, mouseX, mouseY);
}

function createNewNode(type, x, y) {
    const defaultData = {
        name: 'Nuevo Nodo',
        description: 'Sin configurar'
    };

    let mappedType = type;
    if (type.startsWith('user-')) {
        mappedType = 'user';
        const role = type.split('-')[1]; // owner, admin, seller
        defaultData.role = role;
        defaultData.name = role === 'owner' ? 'Dueño' : (role === 'admin' ? 'Administrador' : 'Vendedor');
    }

    const newNode = {
        id: `node-${Date.now()}`,
        type: mappedType,
        x: x - 90, // Center approx
        y: y - 50,
        data: { ...defaultData }
    };

    if (type === 'company' || type === 'warehouse' || type === 'business') {
        newNode.data.name = type === 'company' ? 'Nueva Empresa' : (type === 'warehouse' ? 'Nuevo Almacén' : 'Nuevo POS');
        newNode.type = type; // Ensure specific type sticks
    }

    window.networkEditorState.nodes.push(newNode);
    renderNodes();
    showToast(`Nodo creado: ${newNode.data.name}`, "success");

    // Auto-save logic could go here
}

window.editNodeName = async function (nodeId) {
    const node = window.networkEditorState.nodes.find(n => n.id === nodeId);
    if (!node) return;

    const { value: newName } = await Swal.fire({
        title: 'Renombrar Nodo',
        input: 'text',
        inputValue: node.data.name || '',
        showCancelButton: true,
        confirmButtonText: 'Guardar',
        cancelButtonText: 'Cancelar',
        background: '#16191f',
        color: '#fff'
    });

    if (newName) {
        node.data.name = newName;
        renderNodes();
        saveNetworkLayout();
    }
}

window.deleteNode = async function (e, nodeId) {
    if (e) e.stopPropagation();

    const confirm = await Swal.fire({
        title: '¿Eliminar Nodo?',
        text: "Esta acción no se puede deshacer.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sí, eliminar',
        background: '#16191f',
        color: '#fff'
    });

    if (confirm.isConfirmed) {
        window.networkEditorState.nodes = window.networkEditorState.nodes.filter(n => n.id !== nodeId);
        // Also remove connections
        window.networkEditorState.connections = window.networkEditorState.connections.filter(c => c.from !== nodeId && c.to !== nodeId);

        renderNodes();
        renderConnections();
        showToast("Nodo eliminado", "info");
    }
}

console.log('🗺️ Business Network Module Loaded');
