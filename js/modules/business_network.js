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
    startY: 0
};

// Main Entry Point
window.renderBusinessNetwork = function (container) {
    if (!container) return;

    // Initialize Data if empty
    const db = window.db || {};
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
                    <button class="btn-secondary" onclick="autoLayoutNetwork()">⚡ Auto-Distribución</button>
                    <button class="btn-primary" onclick="saveNetworkLayout()">💾 Guardar Distribución</button>
                </div>
            </div>

            <!-- Canvas Container -->
            <div id="network-viewport" style="flex: 1; position: relative; overflow: hidden; cursor: grab; background: radial-gradient(#2c2d31 1px, transparent 1px) 0 0 / 20px 20px;"
                 onmousedown="handleCanvasMouseDown(event)"
                 onmousemove="handleCanvasMouseMove(event)"
                 onmouseup="handleCanvasMouseUp(event)"
                 onwheel="handleCanvasWheel(event)">
                 
                <!-- Transform Container -->
                <div id="network-canvas" style="transform-origin: 0 0; width: 100%; height: 100%; position: absolute;">
                    
                    <!-- SVG Layer for Wires -->
                    <svg id="network-connections" style="position: absolute; top: 0; left: 0; width: 5000px; height: 5000px; overflow: visible; pointer-events: none; z-index: 0;">
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

            </div>
        </div>
    `;

    renderNodes();
    renderConnections();
    updateTransform();
};

function initializeDefaultLayout(db) {
    const nodes = [];
    let xBase = 100;

    // Add Businesses
    (db.businesses || []).forEach((b, index) => {
        nodes.push({
            id: `biz-${b.id}`,
            type: b.type === 'warehouse' ? 'warehouse' : 'business',
            data: b,
            x: 400,
            y: 100 + (index * 200)
        });
    });

    // Add Key Users (Admin/Owner)
    (db.users || []).forEach((u, index) => {
        if (u.role === 'owner' || u.role === 'admin') {
            nodes.push({
                id: `user-${u.id}`,
                type: 'user',
                data: u,
                x: 100,
                y: 100 + (index * 150)
            });
        }
    });

    db.networkLayout = nodes;
    db.networkConnections = []; // Initialize empty connections
}

function renderNodes() {
    const container = document.getElementById('network-nodes');
    if (!container) return;

    container.innerHTML = window.networkEditorState.nodes.map(node => {
        let color = '#444';
        let icon = 'ph-square';
        let label = node.id;

        switch (node.type) {
            case 'warehouse': color = 'var(--primary)'; icon = 'ph-warehouse'; label = node.data.name; break;
            case 'business': color = 'var(--success)'; icon = 'ph-storefront'; label = node.data.name; break;
            case 'user': color = '#8b5cf6'; icon = 'ph-user-gear'; label = node.data.name; break; // Violet
        }

        return `
            <div class="network-node" id="${node.id}" 
                 style="transform: translate(${node.x}px, ${node.y}px); border-top: 4px solid ${color};"
                 onmousedown="handleNodeMouseDown(event, '${node.id}')">
                
                <div class="node-header">
                    <i class="ph ${icon}" style="color: ${color}"></i>
                    <span>${label}</span>
                </div>
                
                <div class="node-ports">
                    <!-- Input Port -->
                    <div class="port port-in"></div>
                    <!-- Output Port -->
                    <div class="port port-out" onmousedown="startConnectionDrag(event, '${node.id}')"></div>
                </div>

                <div style="font-size: 0.75rem; color: #888; margin-top: 5px;">
                    ${node.type.toUpperCase()}
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
            drawBezier(svg, fromNode, toNode);
        }
    });
}

function drawBezier(svg, nodeA, nodeB) {
    // Port positions (Approximate based on node dimensions 180x100)
    // Output is Right, Input is Left
    const x1 = nodeA.x + 180;
    const y1 = nodeA.y + 40;
    const x2 = nodeB.x;
    const y2 = nodeB.y + 40;

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");

    // Bezier Control Points
    const cp1x = x1 + 100;
    const cp1y = y1;
    const cp2x = x2 - 100;
    const cp2y = y2;

    const d = `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;

    path.setAttribute("d", d);
    path.setAttribute("stroke", "#666");
    path.setAttribute("stroke-width", "2");
    path.setAttribute("fill", "none");
    path.setAttribute("marker-end", "url(#arrowhead)"); // Need to def marker

    svg.appendChild(path);
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
            // Calculate Delta adjusted by Scale
            const deltaX = e.movementX / window.networkEditorState.scale;
            const deltaY = e.movementY / window.networkEditorState.scale;

            node.x += deltaX;
            node.y += deltaY;

            // Update Visuals
            const el = document.getElementById(node.id);
            if (el) el.style.transform = `translate(${node.x}px, ${node.y}px)`;

            // Re-render wires (optimized: could just update specific paths)
            renderConnections();
        }
    }
}

window.handleCanvasMouseUp = function (e) {
    window.networkEditorState.isDraggingCanvas = false;
    window.networkEditorState.isDraggingNode = false;
    window.networkEditorState.draggedNodeId = null;
    document.getElementById('network-viewport').style.cursor = 'grab';
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

console.log('🗺️ Business Network Module Loaded');
