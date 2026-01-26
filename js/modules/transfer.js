/**
 * MCH Control - Transfer Module
 * Handles Stock Transfers between businesses.
 * [SAFE MODE] Uses window.db explicitly to prevent undefined errors.
 */

window.transferCart = [];

window.renderTransfer = function (container) {
    if (!container) return;
    const db = window.db || {};

    // Default Source: Context or Almacen
    const businessId = selectedBusinessId;

    // Safety check
    const businesses = db.businesses || [];

    // If Global Context (Owner), default to Almacen or first business
    const sourceOptions = businesses.map(b =>
        `<option value="${b.id}" ${businessId === b.id ? 'selected' : ''} ${businessId && businessId !== b.id ? 'disabled' : ''}>${b.name}</option>`
    ).join('');

    // Default Destination: Exclude Source

    const headerHtml = `
        <div class="card" style="margin-bottom: 1rem; padding: 1.5rem;">
            <div style="display: flex; gap: 2rem; align-items: center;">
                <div style="flex: 1;">
                    <label style="display: block; font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.5rem;">Origen (Desde)</label>
                    <select id="transfer-source" class="input-field" style="width: 100%;" onchange="updateTransferDestOptions(); window.transferCart=[]; renderTransferCart();">
                        ${!businessId ? `<option value="" disabled selected>Seleccione Origen</option>` : ''}
                        ${businesses.map(b => `<option value="${b.id}" ${businessId === b.id ? 'selected' : ''}>${b.name}</option>`).join('')}
                    </select>
                </div>
                <div style="font-size: 2rem; color: var(--text-muted); padding-top: 1rem;">
                    <i class="ph ph-arrow-right"></i>
                </div>
                <div style="flex: 1;">
                    <label style="display: block; font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.5rem;">Destino (Hacia)</label>
                    <select id="transfer-dest" class="input-field" style="width: 100%;">
                        <option value="" disabled selected>Seleccione Destino</option>
                    </select>
                </div>
            </div>
        </div>
    `;

    const searchHtml = `
        <div class="card search-container-card" style="margin-bottom: 1rem;">
            <div class="search-bar">
                <input type="text" id="transfer-search" placeholder="Buscar producto para transferir..." 
                       oninput="handleTransferSearch(this.value)" class="input-field" style="padding-left: 3rem;" autocomplete="off">
                <i class="ph ph-magnifying-glass" style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: var(--text-muted);"></i>
                <div id="transfer-results" class="pos-results"></div>
            </div>
        </div>
    `;

    container.innerHTML = `
        <div class="fade-in pos-container" style="display: grid; grid-template-columns: 1fr 450px; gap: 1.5rem; height: calc(100vh - 150px);">
            <!-- Left: Search & Cart -->
            <div style="display: flex; flex-direction: column; min-height: 0; gap: 1rem;">
                ${headerHtml}
                ${searchHtml}
                
                <div class="card" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; padding: 0;">
                     <div style="padding: 1rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
                        <h3 style="margin: 0;"><i class="ph ph-package"></i> Items a Transferir</h3>
                        <button class="btn-ghost" onclick="window.transferCart=[]; renderTransferCart();" style="color: var(--danger);"><i class="ph ph-trash"></i></button>
                    </div>
                    <div id="transfer-cart-items" style="flex: 1; overflow-y: auto;"></div>
                </div>
            </div>

            <!-- Right: Summary & Action -->
            <div style="display: flex; flex-direction: column; gap: 1.5rem; min-height: 0;">
                <div class="card" style="padding: 1.5rem;">
                    <h3>Resumen del Traslado</h3>
                    <div id="transfer-summary" style="margin: 1rem 0; font-size: 1.1rem; color: var(--text-muted);">
                        0 items seleccionados
                    </div>
                    <div class="alert alert-info" style="font-size: 0.85rem; margin-bottom: 1rem;">
                        <i class="ph ph-info"></i> El stock se descontará del Origen inmediatamente y quedará "En Tránsito" hasta que el Destino lo apruebe.
                    </div>
                    <button id="btn-process-transfer" class="btn-primary" style="width: 100%; height: 60px;" onclick="processTransferRequest()" disabled>
                        <i class="ph ph-paper-plane-right"></i> ENVIAR TRASLADO
                    </button>
                </div>
                
                 <!-- Recent Transfers List -->
                 <div class="card" style="flex: 1; overflow-y: auto;">
                    <h3>Traslados Recientes</h3>
                    <div id="recent-transfers-list"></div>
                 </div>
            </div>
        </div>
    `;

    updateTransferDestOptions();
    renderTransferCart();
    renderRecentTransfers();
};

window.updateTransferDestOptions = function () {
    const sourceSelect = document.getElementById('transfer-source');
    const destSelect = document.getElementById('transfer-dest');
    if (!sourceSelect || !destSelect) return;

    if (!window.db || !window.db.businesses) return;

    const sourceId = sourceSelect.value;
    const currentDest = destSelect.value;

    destSelect.innerHTML = `<option value="" disabled ${!currentDest ? 'selected' : ''}>Seleccione Destino</option>` +
        (window.db.businesses || [])
            .filter(b => b.id !== sourceId)
            .map(b => `<option value="${b.id}" ${currentDest === b.id ? 'selected' : ''}>${b.name}</option>`)
            .join('');
};

window.handleTransferSearch = function (query) {
    const results = document.getElementById('transfer-results');
    const sourceId = document.getElementById('transfer-source').value;
    const db = window.db || {};

    if (!results) return;

    if (!sourceId) {
        results.style.display = 'none';
        return;
    }

    // Sanitize check
    if (typeof Security !== 'undefined' && Security.sanitize) {
        query = Security.sanitize(query);
    }

    if (!query || query.length < 1) {
        results.style.display = 'none';
        return;
    }

    // Filter Inventory for Source Business
    const inventory = (db.inventory || []).filter(inv => String(inv.businessId) === String(sourceId));

    // Map to Products
    const available = inventory.map(inv => {
        // Use loose equality or String conversion to be safe like in modern parts of the app
        const p = (db.products || []).find(prod => String(prod.id) === String(inv.productId));
        return p ? { ...p, stock: inv.quantity } : null;
    }).filter(p => p !== null); // Removing p.stock > 0 to match POS behavior (show 0 stock items)

    // Apply Search Query (Name, Alias, Price) - Matching POS Logic
    const filtered = available.filter(p =>
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        (p.alias && p.alias.toLowerCase().includes(query.toLowerCase())) ||
        String(p.price).startsWith(query)
    );

    if (filtered.length === 0) {
        results.innerHTML = '<div style="padding: 1rem; color: var(--text-muted); text-align: center;">No se encontraron productos.</div>';
        results.style.display = 'block';
        return;
    }

    results.innerHTML = filtered.map(p => `
        <div class="pos-search-item" onclick="addToTransferCart(${p.id})" style="padding: 10px; cursor: pointer; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 10px;">
            <div style="width: 40px; height: 40px; border-radius: 4px; overflow: hidden; background: var(--bg-dark); display: flex; align-items: center; justify-content: center; border: 1px solid var(--border);">
                ${p.image ? `<img src="${p.image}" style="width: 100%; height: 100%; object-fit: cover;">` : `<i class="ph ph-image" style="font-size: 1.2rem; color: var(--text-muted);"></i>`}
            </div>
            <div>
                <div style="font-weight: bold;">${p.name}</div>
                <div style="font-size: 0.8rem; color: var(--text-muted);">$${p.price.toFixed(2)} | Stock: ${p.stock}</div>
            </div>
        </div>
    `).join('');
    results.style.display = 'block';
};

window.addToTransferCart = function (productId) {
    const sourceId = document.getElementById('transfer-source').value;
    const db = window.db || {};

    const existing = window.transferCart.find(i => i.id === productId);
    const cartQty = existing ? existing.qty : 0;

    const inv = (db.inventory || []).find(i => String(i.productId) === String(productId) && String(i.businessId) === String(sourceId));
    if (!inv || (cartQty + 1) > inv.quantity) {
        showToast("Stock insuficiente en origen", "warning");
        return;
    }

    if (existing) {
        existing.qty++;
    } else {
        const p = (db.products || []).find(prod => prod.id === productId);
        if (p) {
            window.transferCart.push({
                id: p.id,
                name: p.name,
                image: p.image,
                qty: 1
            });
        }
    }

    renderTransferCart();
    document.getElementById('transfer-search').value = '';
    document.getElementById('transfer-results').style.display = 'none';
    document.getElementById('transfer-search').focus();
};

window.renderTransferCart = function () {
    const container = document.getElementById('transfer-cart-items');
    if (!container) return;

    if (window.transferCart.length === 0) {
        container.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--text-muted);">Carrito vacío</div>';
        const docBtn = document.getElementById('btn-process-transfer');
        if (docBtn) docBtn.disabled = true;
        const msg = document.getElementById('transfer-summary');
        if (msg) msg.innerText = '0 items seleccionados';
        return;
    }

    document.getElementById('btn-process-transfer').disabled = false;
    document.getElementById('transfer-summary').innerText = `${window.transferCart.reduce((acc, i) => acc + i.qty, 0)} items seleccionados`;

    container.innerHTML = window.transferCart.map((item, index) => `
        <div style="display: flex; align-items: center; gap: 1rem; padding: 1rem; border-bottom: 1px solid var(--border);">
            <div style="flex: 1; font-weight: bold;">${item.name}</div>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                <button class="btn-icon" onclick="updateTransferQty(${index}, -1)"><i class="ph ph-minus"></i></button>
                <input type="number" class="input-field" value="${item.qty}" 
                       onchange="manualTransferQty(${index}, this.value)"
                       style="width: 60px; text-align: center; padding: 0.25rem;">
                <button class="btn-icon" onclick="updateTransferQty(${index}, 1)"><i class="ph ph-plus"></i></button>
            </div>
            <button class="btn-icon" style="color: var(--danger);" onclick="window.transferCart.splice(${index}, 1); renderTransferCart();"><i class="ph ph-trash"></i></button>
        </div>
    `).join('');
};

window.manualTransferQty = function (index, value) {
    const item = window.transferCart[index];
    const sourceId = document.getElementById('transfer-source').value;
    const db = window.db || {};
    let newQty = parseInt(value);

    if (isNaN(newQty) || newQty < 1) newQty = 1;

    // Validate Stock
    const inv = (db.inventory || []).find(i => String(i.productId) === String(item.id) && String(i.businessId) === String(sourceId));
    if (!inv || newQty > inv.quantity) {
        showToast(`Stock insuficiente (Máx: ${inv ? inv.quantity : 0})`, "warning");
        renderTransferCart(); // Reset to valid value (or old value if we didn't update item.qty yet)
        return;
    }

    item.qty = newQty;
    renderTransferCart();
};

window.updateTransferQty = function (index, delta) {
    const item = window.transferCart[index];
    const sourceId = document.getElementById('transfer-source').value;
    const db = window.db || {};
    const newQty = item.qty + delta;

    if (newQty <= 0) {
        window.transferCart.splice(index, 1);
    } else {
        if (delta > 0) {
            const inv = (db.inventory || []).find(i => String(i.productId) === String(item.id) && String(i.businessId) === String(sourceId));
            if (!inv || newQty > inv.quantity) {
                showToast("Stock límite alcanzado", "warning");
                return;
            }
        }
        item.qty = newQty;
    }
    renderTransferCart();
};

window.processTransferRequest = async function () {
    const sourceId = document.getElementById('transfer-source').value;
    const destId = document.getElementById('transfer-dest').value;
    const db = window.db || {};

    if (!sourceId || !destId) {
        alert("Seleccione origen y destino");
        return;
    }

    if (window.transferCart.length === 0) return;

    if (!confirm(`¿Confirmar traslado de ${window.transferCart.length} productos de ${sourceId} a ${destId}?`)) return;

    const timestamp = Date.now();

    // 1. Deduct from Source Immediately
    window.transferCart.forEach(item => {
        const inv = (db.inventory || []).find(i => String(i.productId) === String(item.id) && String(i.businessId) === String(sourceId));
        if (inv) inv.quantity -= item.qty;
    });

    // 2. Create Transfer Record
    const transfer = {
        id: timestamp,
        date: new Date().toLocaleString(),
        timestamp: timestamp,
        sourceId: sourceId,
        destId: destId,
        items: [...window.transferCart],
        status: 'pending_approval',
        createdBy: currentUser.name
    };

    if (!db.transfers) db.transfers = [];
    db.transfers.unshift(transfer);

    // 3. Create Notification
    if (!db.notifications) db.notifications = [];
    db.notifications.push({
        id: Date.now() + 1,
        type: 'transfer_request',
        title: 'Mercancía Entrante',
        message: `Traslado pendiente desde ${(db.businesses || []).find(b => b.id === sourceId)?.name}.`,
        targetRole: 'seller',
        targetBusinessId: destId,
        transferId: timestamp,
        status: 'pending'
    });

    await window.saveData();

    window.transferCart = [];
    renderTransferCart();
    renderRecentTransfers();
    showToast("Traslado iniciado. Pendiente de recepción.", "success");
    addLog(`Traslado iniciado #${timestamp}: ${sourceId} -> ${destId}`);
};

window.renderRecentTransfers = function () {
    const container = document.getElementById('recent-transfers-list');
    if (!container) return;
    const db = window.db || {};

    const allTransfers = db.transfers || [];

    // Split Lists
    const pending = allTransfers.filter(t => t.status === 'pending_approval');
    const history = allTransfers
        .filter(t => t.status !== 'pending_approval')
        .slice(0, 10); // Show last 10 completed

    const renderCard = (t) => {
        const sourceName = (db.businesses || []).find(b => b.id === t.sourceId)?.name || t.sourceId;
        const destName = (db.businesses || []).find(b => b.id === t.destId)?.name || t.destId;

        let statusColor = 'var(--warning)';
        let statusText = 'Pendiente';
        if (t.status === 'completed') { statusColor = 'var(--success)'; statusText = 'Completado'; }
        if (t.status === 'rejected') { statusColor = 'var(--danger)'; statusText = 'Rechazado'; }

        return `
            <div class="card" style="padding: 1rem; margin-bottom: 0.5rem; border-left: 3px solid ${statusColor};">
                <div style="display: flex; justify-content: space-between;">
                    <div style="font-weight: bold;">${sourceName} ➝ ${destName}</div>
                    <div style="font-size: 0.8rem; color: ${statusColor}; font-weight: bold;">${statusText}</div>
                </div>
                <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.5rem;">
                    ${t.items.length} items · ${t.date} · Por: ${t.createdBy}
                    ${t.receivedBy ? `<br><span style="color: var(--success);">Recibido por: ${t.receivedBy} (${t.receivedDate})</span>` : ''}
                </div>
            </div>
        `;
    };

    let html = '';

    // Section: Pending
    if (pending.length > 0) {
        html += `<h4 style="margin: 1rem 0 0.5rem 0; color: var(--warning);">Pendientes de Aprobación</h4>`;
        html += pending.map(renderCard).join('');
    } else {
        html += `<div style="padding: 1rem; color: var(--text-muted); font-size: 0.9rem; font-style: italic;">No hay traslados pendientes.</div>`;
    }

    // Section: History
    html += `<h4 style="margin: 1.5rem 0 0.5rem 0; color: var(--text-muted); border-top: 1px solid var(--border); padding-top: 1rem;">Historial de Traslados</h4>`;
    if (history.length > 0) {
        html += history.map(renderCard).join('');
    } else {
        html += `<div style="padding: 1rem; color: var(--text-muted); font-size: 0.9rem;">No hay historial reciente.</div>`;
    }

    container.innerHTML = html;
};

console.log('🚚 Transfer Module Loaded (SAFE)');

window.renderTransferApprovalModal = function (transfer) {
    const db = window.db || {};
    const sourceName = (db.businesses || []).find(b => b.id === transfer.sourceId)?.name || transfer.sourceId;
    const itemsHtml = transfer.items.map(i => `
        <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border); padding: 0.5rem 0;">
            <span>${i.qty} x ${i.name}</span>
            <span>Enviado</span>
        </div>
    `).join('');

    const modalHtml = `
        <div class="card" style="width: 500px; max-width: 95vw; padding: 2rem; border-radius: 12px; border: 1px solid var(--border);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="margin: 0;"><i class="ph ph-arrows-left-right"></i> Recepción de Mercancía</h3>
                <button onclick="closeModal('transfer-approval-modal')" class="btn-ghost" style="color: var(--text-muted);"><i class="ph ph-x" style="font-size: 1.5rem;"></i></button>
            </div>
            
            <div style="background: var(--bg-dark); padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                <div style="font-size: 0.9rem; color: var(--text-muted);">Origen</div>
                <div style="font-weight: bold; font-size: 1.1rem; color: var(--primary);">${sourceName}</div>
                <div style="font-size: 0.8rem; margin-top: 0.5rem;">Fecha: ${transfer.date}</div>
            </div>

            <div style="max-height: 200px; overflow-y: auto; margin-bottom: 2rem;">
                <h4 style="margin-bottom: 0.5rem;">Productos a Recibir</h4>
                ${itemsHtml}
            </div>

            <div style="margin-bottom: 1.5rem;">
                 <label style="display: block; margin-bottom: 0.5rem; font-size: 0.9rem;">Firma Digital (PIN)</label>
                 <input type="password" id="approval-pin" placeholder="Ingrese su PIN para confirmar" class="input-field" 
                        style="width: 100%; text-align: center; letter-spacing: 0.5rem; font-size: 1.2rem;">
            </div>

            <div style="display: flex; gap: 1rem;">
                <button class="btn-ghost" style="flex: 1; color: var(--danger);" onclick="rejectTransfer(${transfer.id})">Rechazar</button>
                <button class="btn-primary" style="flex: 2;" onclick="processTransferApproval(${transfer.id})">
                    <i class="ph ph-check-circle"></i> CONFIRMAR RECEPCIÓN
                </button>
            </div>
        </div>
    `;

    if (window.showModal) window.showModal('transfer-approval-modal', modalHtml);
};

window.processTransferApproval = async function (transferId) {
    const pin = document.getElementById('approval-pin').value;
    const db = window.db || {};
    const transfer = (db.transfers || []).find(t => t.id === Number(transferId));

    if (!transfer) { closeModal('transfer-approval-modal'); return; }

    if (currentUser.pin !== pin) {
        showToast("PIN Incorrecto", "error");
        return;
    }

    const destId = transfer.destId;

    transfer.items.forEach(item => {
        let inv = (db.inventory || []).find(i => String(i.productId) === String(item.id) && String(i.businessId) === String(destId));
        if (inv) {
            inv.quantity += item.qty;
        } else {
            if (!db.inventory) db.inventory = [];
            db.inventory.push({
                productId: item.id,
                businessId: destId,
                quantity: item.qty
            });
        }
    });

    transfer.status = 'completed';
    transfer.receivedBy = currentUser.name;
    transfer.receivedDate = new Date().toLocaleString();

    const notifIndex = (db.notifications || []).findIndex(n => n.transferId === Number(transferId));
    if (notifIndex !== -1) {
        db.notifications.splice(notifIndex, 1);
    }

    await window.saveData();
    closeModal('transfer-approval-modal');
    showToast("Recepción confirmada. Inventario actualizado.", "success");
    addLog(`Traslado #${transferId} recibido en ${destId} por ${currentUser.name}`);

    if (typeof renderDashboard === 'function') renderDashboard();
};

window.rejectTransfer = async function (transferId) {
    if (!confirm("¿Está seguro de que desea RECHAZAR este traslado? El stock será devuelto al origen.")) return;

    const db = window.db || {};
    const transfer = (db.transfers || []).find(t => t.id === Number(transferId));
    if (!transfer) { closeModal('transfer-approval-modal'); return; }

    const sourceId = transfer.sourceId;

    // Refund Stock to Source
    transfer.items.forEach(item => {
        let inv = (db.inventory || []).find(i => String(i.productId) === String(item.id) && String(i.businessId) === String(sourceId));
        if (inv) {
            inv.quantity += item.qty;
        } else {
            // Should not happen if it was just deducted, but for safety:
            if (!db.inventory) db.inventory = [];
            db.inventory.push({
                productId: item.id,
                businessId: sourceId,
                quantity: item.qty
            });
        }
    });

    transfer.status = 'rejected';
    transfer.receivedBy = currentUser.name + ' (Rechazado)';
    transfer.receivedDate = new Date().toLocaleString();

    // Remove Notification
    const notifIndex = (db.notifications || []).findIndex(n => n.transferId === Number(transferId));
    if (notifIndex !== -1) {
        db.notifications.splice(notifIndex, 1);
    }

    await window.saveData();
    closeModal('transfer-approval-modal');
    showToast("Traslado rechazado. Stock devuelto al origen.", "warning");
    addLog(`Traslado #${transferId} RECHAZADO por ${currentUser.name}. Stock devuelto.`);

    if (typeof renderRecentTransfers === 'function') renderRecentTransfers();
};
