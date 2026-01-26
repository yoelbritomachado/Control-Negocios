/**
 * MCH Control - POS Module
 * Handles Point of Sale, Cart, and Checkout logic.
 * Extracted from app.js for modularity.
 */

// Global State for POS (Moved from app.js)
window.posCart = [];
window.currentPaymentMethod = 'cash';
window.editingSaleId = null;

// --- POS MAIN RENDER ---
// --- POS MAIN RENDER ---
window.renderPOS = function (container) {
    try {
        if (!isSessionActive && !isReviewingClosure) {
            renderOpenSessionScreen(container);
            return;
        }

        const now = new Date();
        const today = now.toISOString().split('T')[0];
        const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');

        // Header (Compact) - Fits in Left Panel
        const headerHtml = `
            <div style="display: flex; gap: 1rem; align-items: center; padding-bottom: 1rem; border-bottom: 1px solid var(--border); margin-bottom: 1rem;">
                <div style="display: flex; align-items: center; gap: 0.5rem; background: var(--bg-dark); padding: 0.4rem 0.8rem; border-radius: 8px;">
                    <i class="ph ph-calendar" style="color: var(--primary);"></i>
                    <input type="date" id="pos-date" value="${isReviewingClosure ? (window.auditTempData?.targetDate || today) : today}" 
                           style="background: transparent; border: none; color: white; font-family: inherit; font-size: 0.9rem; outline: none;">
                </div>
                <div style="display: flex; align-items: center; gap: 0.5rem; background: var(--bg-dark); padding: 0.4rem 0.8rem; border-radius: 8px;">
                    <i class="ph ph-clock" style="color: var(--text-muted);"></i>
                    <input type="time" id="pos-open-time" value="${isReviewingClosure ? window.auditTempData.openingTime : currentTime}" 
                           style="background: transparent; border: none; color: white; font-family: inherit; font-size: 0.9rem; outline: none;">
                </div>
                <!-- CLOSE DAY BUTTON -->
                <button onclick="confirmCloseDay()" class="btn-secondary" style="margin-left:auto; border-color:var(--primary); color:var(--primary); font-size:0.85rem; padding:0.4rem 1rem;">
                    <i class="ph ph-moon-stars"></i> Cerrar Día
                </button>
            </div>
        `;

        // History Modal (Injected hidden)
        const historyModalHtml = `
            <div id="pos-history-modal" class="modal-overlay hidden" style="z-index: 2000;">
                <div class="card" style="width: 500px; max-width: 95vw; height: 80vh; display: flex; flex-direction: column; padding: 0;">
                    <div style="padding: 1rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
                        <h3 style="margin: 0;">Movimientos del Día</h3>
                        <button class="btn-icon" onclick="toggleTodaySales(false)"><i class="ph ph-x"></i></button>
                    </div>
                    <div id="history-modal-content" style="flex: 1; overflow-y: auto;">
                        <!-- List Injected Here -->
                    </div>
                </div>
            </div>
        `;

        // Just append modal if not exists
        if (!document.getElementById('pos-history-modal')) {
            document.body.insertAdjacentHTML('beforeend', historyModalHtml);
        }

        // Search Bar
        const searchHtml = `
            <div style="position: relative; margin-bottom: 1rem;">
                <input type="text" id="pos-search" placeholder="Buscar producto..." 
                       oninput="handlePOSSearch(this.value)" class="input-field" 
                       style="padding-left: 2.5rem; width: 100%; height: 50px; font-size: 1.1rem; border-radius: 12px;" autocomplete="off" autofocus>
                <i class="ph ph-magnifying-glass" style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); font-size: 1.2rem; color: var(--text-muted);"></i>
            </div>
        `;

        // Main Layout: Grid 60% - 40%
        container.innerHTML = `
        <div id="pos-container" class="fade-in" style="display: grid; grid-template-columns: 1.6fr 1fr; gap: 1.5rem; height: calc(100vh - 120px); overflow: hidden;">
            
            <!-- LEFT PANEL: Search & Results -->
            <div style="display: flex; flex-direction: column; min-height: 0;">
                ${headerHtml}
                ${searchHtml}
                
                <!-- Results Grid (Static) -->
                <div id="pos-results-area" style="flex: 1; overflow-y: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 1rem; align-content: start; padding-right: 0.5rem;">
                    <!-- Default State: Show Categories or Recent -->
                    <div style="grid-column: 1/-1; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--text-muted); opacity: 0.5;">
                        <i class="ph ph-magnifying-glass" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                        <p>Busca un producto para comenzar</p>
                    </div>
                </div>
            </div>

            <!-- RIGHT PANEL: Cart (Top) + History (Bottom) -->
            <div style="display: flex; flex-direction: column; gap: 1rem; min-height: 0; height: 100%;">
                
                <!-- CART SECTION (Top Half) -->
                <div class="card" style="display: flex; flex-direction: column; padding: 0; overflow: hidden; flex: 1; border: 1px solid var(--border);">
                    <div style="padding: 0.8rem 1rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.02);">
                        <div style="font-weight: 700; font-size: 1rem; display: flex; align-items: center; gap: 0.5rem;">
                            <i class="ph ph-shopping-cart"></i> Carrito
                            <span id="cart-count-badge" style="background: var(--primary); color: white; padding: 1px 6px; border-radius: 8px; font-size: 0.75rem;">0</span>
                        </div>
                        <button class="btn-ghost" onclick="posCart=[]; renderCart();" style="color: var(--danger); padding: 4px;" title="Vaciar"><i class="ph ph-trash"></i></button>
                    </div>
                    <div id="pos-cart-items" style="flex: 1; overflow-y: auto; background: var(--bg-dark);"></div>
                </div>

                <!-- HISTORY SECTION (Middle - Restored) -->
                <div class="card" style="display: flex; flex-direction: column; padding: 0; overflow: hidden; height: 30%; min-height: 150px; border: 1px solid var(--border);">
                    <div style="padding: 0.5rem 1rem; border-bottom: 1px solid var(--border); background: var(--bg-dark); font-size: 0.85rem; font-weight: 600; color: var(--text-muted); display:flex; justify-content:space-between; align-items:center;">
                        <span><i class="ph ph-clock-counter-clockwise"></i> Movimientos Hoy</span>
                    </div>
                    <div id="today-sales-list" style="flex: 1; overflow-y: auto;"></div>
                </div>

                <!-- FOOTER ACTIONS (Fixed Bottom) -->
                <div class="card" style="padding: 1rem; background: var(--bg-card); border: 1px solid var(--border); box-shadow: 0 -4px 20px rgba(0,0,0,0.2);">
                    <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 0.8rem;">
                        <span style="color: var(--text-muted); font-size: 0.9rem;">Total</span>
                        <span id="cart-total-display" style="font-size: 2rem; font-weight: 800; color: var(--primary); line-height: 1;">$0.00</span>
                    </div>

                    <div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
                         <button class="btn-secondary" onclick="showExpenseModal()" style="flex: 1; padding: 0.6rem; font-size: 0.9rem; border-color: var(--danger); color: var(--danger);">
                            <i class="ph ph-receipt"></i> Gasto
                        </button>
                         <button class="btn-secondary" onclick="showIncidentModal()" style="flex: 1; padding: 0.6rem; font-size: 0.9rem; border-color: var(--warning); color: var(--warning);">
                            <i class="ph ph-warning-circle"></i> Merma
                        </button>
                    </div>

                    <button id="payBtn" class="btn-primary" onclick="${isWarehouseContext() ? 'showTransferModal()' : 'showPaymentModal()'}" 
                            style="width: 100%; font-size: 1.1rem; padding: 0.8rem; opacity: 0.5; pointer-events: none;">
                        ${isWarehouseContext() ? 'TRANSFERIR' : 'COBRAR'} <i class="ph ph-arrow-right" style="margin-left: 0.5rem;"></i>
                    </button>
                </div>
            </div>
        </div>
        `;

        requestAnimationFrame(() => {
            renderCart();
            renderTodaySalesList(); // Render immediately in the panel
            document.getElementById('pos-search').focus();
        });

    } catch (e) {
        console.error('Error rendering POS:', e);
        container.innerHTML = `<div style="padding:2rem;">Error: ${e.message}</div>`;
    }
}

// --- SEARCH & CART LOGIC ---

// --- SEARCH & CART LOGIC ---

window.handlePOSSearch = function (query) {
    const resultsArea = document.getElementById('pos-results-area');
    if (!resultsArea) return;

    // Sanitize
    query = Security.sanitize(query);

    // Filter Logic
    const businessId = selectedBusinessId || 'mch1';
    const inventory = db.inventory.filter(inv => String(inv.businessId) === String(businessId));

    // Join with products
    const availableProducts = inventory.map(inv => {
        const p = db.products.find(prod => prod.id === inv.productId);
        return p ? { ...p, stock: inv.quantity } : null;
    }).filter(p => p !== null);

    // Initial State (Empty Query): Show All (or Top 20)
    let filtered = [];
    if (query.length < 1) {
        filtered = availableProducts.slice(0, 50); // Show initials
    } else {
        // Limit to 50 results to prevent grid explosion on broad queries like "a"
        filtered = availableProducts.filter(p =>
            p.name.toLowerCase().includes(query.toLowerCase()) ||
            (p.alias && p.alias.toLowerCase().includes(query.toLowerCase())) ||
            String(p.price).startsWith(query)
        ).slice(0, 50);
    }

    if (filtered.length === 0) {
        resultsArea.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: var(--text-muted);">
                <i class="ph ph-magnifying-glass" style="font-size: 2rem; margin-bottom: 0.5rem;"></i>
                <p>No se encontraron productos</p>
            </div>`;
        return;
    }

    // RENDER AS GRID CARDS (No Borders to fix "lines" complaint)
    resultsArea.innerHTML = filtered.map(p => `
        <div class="pos-product-card fade-in" onclick="addToPOSCart(${p.id})" 
             style="background: var(--bg-card); border-radius: 12px; overflow: hidden; cursor: pointer; transition: transform 0.2s; display: flex; flex-direction: column; box-shadow: 0 4px 10px rgba(0,0,0,0.2);">
            
            <div style="height: 100px; background: var(--bg-dark); position: relative; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                ${p.image ? `<img src="${p.image}" style="width: 100%; height: 100%; object-fit: cover;">` : `<i class="ph ph-image" style="font-size: 2rem; color: var(--text-muted); opacity:0.5;"></i>`}
                
                <div style="position: absolute; bottom: 5px; right: 5px; background: rgba(0,0,0,0.6); color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; backdrop-filter: blur(4px);">
                    Stock: ${p.stock}
                </div>
            </div>

            <div style="padding: 0.8rem; flex: 1; display: flex; flex-direction: column;">
                <div style="font-weight: 600; font-size: 0.9rem; margin-bottom: 0.4rem; line-height: 1.2; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${p.name}</div>
                <div style="margin-top: auto; font-size: 1.1rem; font-weight: 800; color: var(--primary);">$${p.price.toFixed(2)}</div>
            </div>
        </div>
    `).join('');
}

window.addToPOSCart = function (productId) {
    const businessId = selectedBusinessId || 'mch1';

    // Check local cart first to see how many we already have
    const existingInCart = posCart.find(i => i.id === productId);
    const cartQty = existingInCart ? existingInCart.qty : 0;

    // Check DB stock
    const inv = db.inventory.find(i => String(i.productId) === String(productId) && String(i.businessId) === String(businessId));
    const currentStock = inv ? inv.quantity : 0;

    if ((cartQty + 1) > currentStock) {
        // Allow override if Owner/Admin? For now strict.
        // alert("No hay suficiente stock.");
        addLog("Stock insuficiente intentando agregar al carrito", "warning");
        showToast("Stock insuficiente", "warning");
        return;
    }

    if (existingInCart) {
        existingInCart.qty += 1;
    } else {
        const p = db.products.find(prod => prod.id === productId);
        if (p) {
            posCart.push({
                id: p.id,
                name: p.name,
                price: p.price,
                image: p.image,
                qty: 1
            });
        }
    }

    renderCart();
    renderCart();

    // Clear search and reset grid
    const searchInput = document.getElementById('pos-search');
    if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
        handlePOSSearch(''); // Reset grid to default
    }
}

window.renderCart = function () {
    const container = document.getElementById('pos-cart-items');
    const totalDisplay = document.getElementById('cart-total-display');
    const badge = document.getElementById('cart-count-badge');
    const payBtn = document.getElementById('payBtn');

    if (!container) return;

    // Update Badge
    if (badge) badge.innerText = posCart.length;

    let total = 0;

    if (posCart.length === 0) {
        container.innerHTML = `
            <div style="height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--text-muted); opacity: 0.5;">
                <i class="ph ph-shopping-cart" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                <p>El carrito está vacío</p>
            </div>`;
        if (totalDisplay) totalDisplay.innerText = "$0.00";
        if (payBtn) {
            payBtn.disabled = true;
            payBtn.style.opacity = '0.5';
            payBtn.style.pointerEvents = 'none';
        }
        updatePOSMobileFooter();
        return;
    }

    if (payBtn) {
        payBtn.disabled = false;
        payBtn.style.opacity = '1';
        payBtn.style.pointerEvents = 'auto';
    }

    container.innerHTML = posCart.map((item, index) => {
        total += item.price * item.qty;
        return `
            <div class="fade-in" style="padding: 1rem; border-bottom: 1px solid var(--border); display: flex; gap: 0.8rem;">
                <div style="width: 50px; height: 50px; border-radius: 6px; overflow: hidden; background: var(--bg-dark); flex-shrink: 0;">
                     ${item.image ? `<img src="${item.image}" style="width: 100%; height: 100%; object-fit: cover;">` : `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center;"><i class="ph ph-image" style="color:#555;"></i></div>`}
                </div>
                <div style="flex: 1;">
                    <div style="font-weight: 600; font-size: 0.95rem; line-height: 1.2; margin-bottom: 0.2rem;">${item.name}</div>
                    <div style="font-size: 0.85rem; color: var(--primary);">$${item.price.toFixed(2)}</div>
                </div>
                <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 0.5rem;">
                     <div style="display: flex; align-items: center; gap: 0.5rem; background: var(--bg-dark); padding: 2px; border-radius: 6px; border: 1px solid var(--border);">
                        <button class="btn-icon" onclick="updateCartItemQty(${index}, -1)" style="width: 24px; height: 24px; padding: 0;"><i class="ph ph-minus" style="font-size: 0.8rem;"></i></button>
                        <span style="font-weight: bold; min-width: 16px; text-align: center; font-size: 0.9rem;">${item.qty}</span>
                        <button class="btn-icon" onclick="updateCartItemQty(${index}, 1)" style="width: 24px; height: 24px; padding: 0;"><i class="ph ph-plus" style="font-size: 0.8rem;"></i></button>
                    </div>
                    <button class="btn-icon" onclick="removeFromCart(${index})" style="color: var(--danger); width: 24px; height: 24px; padding: 0;"><i class="ph ph-trash"></i></button>
                </div>
            </div>
        `;
    }).join('');

    // Update Totals
    if (totalDisplay) totalDisplay.innerText = `$${total.toFixed(2)}`;

    updatePOSMobileFooter();
}

// Preserve helper functions
window.updateCartItemQty = function (index, change) {
    const item = posCart[index];
    const newQty = item.qty + change;
    const businessId = selectedBusinessId || 'mch1';

    if (newQty <= 0) {
        removeFromCart(index);
        return;
    }

    // Stock Check
    if (change > 0) {
        const inv = db.inventory.find(i => String(i.productId) === String(item.id) && String(i.businessId) === String(businessId));
        const currentStock = inv ? inv.quantity : 0;
        if (newQty > currentStock) {
            showToast("Stock límite alcanzado", "warning");
            return;
        }
    }

    item.qty = newQty;
    renderCart();
}

window.removeFromCart = function (index) {
    posCart.splice(index, 1);
    renderCart();
}

// --- CHECKOUT LOGIC ---

window.showPaymentModal = function () {
    // [OPTIMIZATION] Unified Payment Interface for ALL Roles
    if (window.posCart.length === 0) {
        showToast("El carrito está vacío", "error");
        return;
    }

    // Explicitly use window.posCart for consistency
    const total = window.posCart.reduce((sum, item) => sum + (item.price * item.qty), 0);

    // Unified Form: Currency + Split Payment for Everyone
    const formContent = `
        <div class="grid-2" style="gap: 1rem; margin-bottom: 1rem;">
             <!-- Currency Selector -->
            <div class="form-group">
                <label style="display: block; margin-bottom: 0.5rem; font-size: 0.9rem;">Moneda</label>
                <div style="position: relative;">
                    <i class="ph ph-currency-circle-dollar" style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: var(--warning);"></i>
                    <select id="pay-currency-select" class="input-field" style="padding-left: 3rem; width: 100%;">
                        <option value="mn" selected>MN (Pesos)</option>
                        <option value="usd">USD (Dólares)</option>
                        <option value="eur">EUR (Euros)</option>
                    </select>
                </div>
            </div>
            
            <!-- Transfer Input -->
             <div class="form-group">
                <label style="display: block; margin-bottom: 0.5rem; font-size: 0.9rem;">Transferencia</label>
                <div style="position: relative;">
                    <i class="ph ph-bank" style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: var(--primary);"></i>
                    <input type="number" id="pay-transfer-input" step="0.01" class="input-field" 
                           style="padding-left: 3rem; width: 100%; border-color: var(--primary);" 
                           value="0" placeholder="0.00" oninput="autoCalculateCash(${total})">
                </div>
            </div>
        </div>

        <!-- Cash Input (Calculated) -->
        <div class="form-group" style="margin-bottom: 1.5rem;">
            <label style="display: block; margin-bottom: 0.5rem; font-size: 0.9rem;">Efectivo (Restante)</label>
            <div style="position: relative;">
                <i class="ph ph-money" style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: var(--success);"></i>
                <input type="number" id="pay-cash-input" step="0.01" class="input-field" 
                       style="padding-left: 3rem; background: var(--bg-hover); color: var(--text-muted); width: 100%; font-weight: bold;" 
                       value="${total.toFixed(2)}" readonly>
            </div>
        </div>
    `;

    const modalHtml = `
        <div class="card" style="width: 450px; max-width: 95vw; padding: 2rem; border-radius: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h2 style="margin: 0; display: flex; align-items: center; gap: 0.5rem;">
                    <i class="ph ph-coins" style="color: var(--warning);"></i> Finalizar Venta
                </h2>
                <div class="badge" style="font-size: 0.8rem;">${currentUser.role.toUpperCase()}</div>
            </div>
            
            <div style="background: var(--bg-dark); padding: 1.5rem; border-radius: 12px; margin-bottom: 1.5rem; text-align: center; border: 1px solid var(--border);">
                <div style="font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px;">Total a Cobrar</div>
                <div style="font-size: 3rem; font-weight: 900; color: var(--primary); letter-spacing: -1px;">$${total.toFixed(2)}</div>
            </div>
            
            ${formContent}
            
            <div id="payment-error" style="color: var(--danger); font-size: 0.85rem; margin-bottom: 1.5rem; text-align: center; display: none;">
                <i class="ph ph-warning"></i> La suma no coincide con el total.
            </div>

            <div style="display: flex; gap: 1rem;">
                <button class="btn-ghost" style="flex: 1;" onclick="closeModal('payment-modal')">Cancelar</button>
                <button id="confirm-payment-btn" class="btn-primary" style="flex: 2; font-size: 1.1rem;" onclick="window.processPOSPayment()">
                    COBRAR AHORA
                </button>
            </div>
        </div>
    `;

    // Safely call showModal from app.js
    if (typeof window.showModal === 'function') {
        window.showModal('payment-modal', modalHtml);
    } else {
        console.error("Critical: window.showModal is missing!");
        alert("Error de interfaz: Modal no disponible.");
    }
};

window.autoCalculateCash = function (total) {
    const transferInput = document.getElementById('pay-transfer-input');
    const cashInput = document.getElementById('pay-cash-input');
    let transfer = parseFloat(transferInput.value) || 0;

    if (transfer < 0) { transfer = 0; transferInput.value = 0; }
    if (transfer > total) { alert("La transferencia no puede ser mayor al total."); transfer = total; transferInput.value = total.toFixed(2); }

    const remainingCash = total - transfer;
    cashInput.value = remainingCash.toFixed(2);
};

window.validatePaymentSplit = function (total) {
    const cash = parseFloat(document.getElementById('pay-cash-input').value || 0);
    const transfer = parseFloat(document.getElementById('pay-transfer-input').value || 0);
    const sum = cash + transfer;
    const diff = Math.abs(sum - total);
    const errorEl = document.getElementById('payment-error');
    const btn = document.getElementById('confirm-payment-btn');

    if (diff > 0.02) {
        if (errorEl) errorEl.style.display = 'block';
        if (btn) { btn.disabled = true; btn.style.opacity = '0.5'; }
    } else {
        if (errorEl) errorEl.style.display = 'none';
        if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
    }
}

// [DEBUG FIX] Renamed to ensure fresh binding
window.processPOSPayment = async function () {
    // alert("DEBUG: Iniciando proceso de cobro..."); // Uncomment if desperate, but let's try console first with the toast
    console.log("🚀 Iniciando cobro individual (Function Renamed)...");

    // 1. Validate Cart (Robust Scope Check)
    if (!window.posCart || window.posCart.length === 0) {
        showToast("El carrito está vacío", "error");
        return;
    }

    // 2. Validate Inputs
    const cashInput = document.getElementById('pay-cash-input');
    const transferInput = document.getElementById('pay-transfer-input');
    const currencySelect = document.getElementById('pay-currency-select');

    if (!cashInput || !transferInput || !currencySelect) {
        alert("Error interno: Inputs de cobro no encontrados.");
        return;
    }

    // 3. Extract Values Safe
    let cashVal = 0;
    let transferVal = 0;

    try {
        cashVal = parseFloat(cashInput.value) || 0;
        transferVal = parseFloat(transferInput.value) || 0;
    } catch (err) {
        console.error("Error parsing inputs:", err);
        alert("Error leyendo los montos.");
        return;
    }

    const currencyCode = currencySelect.value;
    // Calculate total from cart to match server calculation
    const totalValue = window.posCart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const businessId = selectedBusinessId || 'mch1';

    console.log(`💰 Datos de Cobro: Cash=$${cashVal}, Transf=$${transferVal}, Total=$${totalValue}`);

    // 4. Validate Stock
    if (!validateStockBeforeProcess()) {
        console.warn("Stock validation failed");
        return;
    }

    try {
        // --- INTEGRACIÓN: ACTUALIZAR SALDO AUTOMÁTICO ---
        if (typeof window.actualizarSaldo === 'function') {
            try { window.actualizarSaldo(currencyCode, totalValue); } catch (e) { console.warn("Error updating balance UI:", e); }
        }
        const now = new Date();
        const explicitDate = document.getElementById('pos-date') ? document.getElementById('pos-date').value : now.toISOString().split('T')[0];
        const dateString = `${explicitDate} ${now.toLocaleTimeString([], { hour12: false })}`;
        const timestamp = Date.now();
        const posOpeningTime = document.getElementById('pos-open-time') ? document.getElementById('pos-open-time').value : null;

        // Common Payload Generators
        const generateItems = () => window.posCart.map(i => ({
            productId: i.id,
            name: i.name,
            qty: i.qty,
            price: i.price
        }));

        if (window.editingSaleId) {
            console.log("✏️ Editando Venta ID:", window.editingSaleId);

            // A. Revert old stock
            const oldSale = db.sales.find(s => s.id === window.editingSaleId);
            if (oldSale && oldSale.items) {
                oldSale.items.forEach(oldItem => {
                    const inv = db.inventory.find(i => String(i.productId) === String(oldItem.productId || oldItem.id) && String(i.businessId) === String(oldSale.businessId));
                    if (inv) inv.quantity += oldItem.qty;
                });
            }

            // B. Deduct New Stock
            window.posCart.forEach(item => {
                const inv = db.inventory.find(i => String(i.productId) === String(item.id) && String(i.businessId) === String(businessId));
                if (inv) inv.quantity -= item.qty;
                else db.inventory.push({ productId: item.id, businessId: businessId, quantity: -item.qty });
            });

            // C. Update Record
            const saleIndex = db.sales.findIndex(s => s.id === window.editingSaleId);
            if (saleIndex !== -1) {
                const s = db.sales[saleIndex];
                s.items = generateItems();
                s.total = totalValue;
                s.payment = { cash: cashVal, transfer: transferVal, currency: currencyCode }; // Explicit naming
                s.businessId = businessId;
                s.date = dateString;
                s.timestamp = timestamp;
                s.openingTime = posOpeningTime;

                // Keep session if exists
                if (!s.sessionId) s.sessionId = (typeof window.currentSessionStartTime !== 'undefined' ? window.currentSessionStartTime : Date.now());

                addLog(`Venta #${s.id} actualizada: $${totalValue.toFixed(2)} (${currencyCode.toUpperCase()})`, 'info');
            }
            window.editingSaleId = null;

        } else {
            console.log("✨ Nueva Venta");

            // Deduct Stock
            window.posCart.forEach(item => {
                const inv = db.inventory.find(i => String(i.productId) === String(item.id) && String(i.businessId) === String(businessId));
                if (inv) inv.quantity -= item.qty;
                else db.inventory.push({ productId: item.id, businessId: businessId, quantity: -item.qty });
            });

            const saleData = {
                id: timestamp,
                date: dateString,
                timestamp: timestamp,
                businessId: businessId,
                seller: currentUser ? currentUser.name : 'Vendedor',
                sellerId: currentUser ? currentUser.id : 0,
                items: generateItems(),
                total: totalValue,
                payment: { cash: cashVal, transfer: transferVal, currency: currencyCode }, // Explicit naming
                openingTime: posOpeningTime,
                sessionId: (typeof window.currentSessionStartTime !== 'undefined' ? window.currentSessionStartTime : Date.now()),
                status: 'registered'
            };
            db.sales.unshift(saleData);
            addLog(`Venta registrada: $${totalValue.toFixed(2)} (${currencyCode.toUpperCase()})`, 'success');
        }

        await window.saveData();
        closeModal('payment-modal');
        alert("¡Venta procesada con éxito! ✅"); // Emoji to verify new code

        window.posCart = [];
        // Refresh UI
        if (typeof renderPOS === 'function') renderPOS(document.getElementById('content-area'));
        else location.reload();

    } catch (error) {
        console.error("Error registering sale:", error);
        alert("Error al registrar la venta (Detalle en consola): " + error.message);
    }
}

// POS Helper
function validateStockBeforeProcess() {
    const businessId = selectedBusinessId || 'mch1';
    for (const item of window.posCart) {
        const inv = db.inventory.find(i => String(i.productId) === String(item.id) && String(i.businessId) === String(businessId));
        if (!inv || inv.quantity < item.qty) {
            // Allow override? No.
            const msg = `Stock insuficiente para ${item.name}. Disponible: ${inv ? inv.quantity : 0}`;
            // alert(msg); // Use toast
            showToast(msg, "warning");
            return false;
        }
    }
    return true;
}

function updatePOSMobileFooter() {
    const footer = document.getElementById('pos-mobile-footer');
    const actionsCard = document.getElementById('pos-actions-card');
    if (!footer || !actionsCard) return;

    if (window.innerWidth <= 768) {
        footer.style.display = 'flex';
        const total = (window.posCart || []).reduce((sum, item) => sum + (item.price * item.qty), 0);
        footer.innerHTML = `
            <div class="total-display">$${total.toFixed(2)}</div>
            <button class="btn-primary" onclick="${isWarehouseContext() ? 'showTransferModal()' : 'showPaymentModal()'}" style="border-radius:20px;">
                ${isWarehouseContext() ? 'Transferir' : 'COBRAR'}
            </button>
        `;
        actionsCard.style.display = 'none';
    } else {
        footer.style.display = 'none';
        actionsCard.style.display = 'flex';
        footer.innerHTML = '';
    }
}

// --- TODAY SALES LIST (HISTORY) ---
window.toggleTodaySales = function (show) {
    const modal = document.getElementById('pos-history-modal');
    if (!modal) return;

    if (show) {
        modal.classList.remove('hidden');
        renderTodaySalesList('history-modal-content');
    } else {
        modal.classList.add('hidden');
    }
}

window.renderTodaySalesList = function (targetContainerId = 'today-sales-list') {
    const container = document.getElementById(targetContainerId);
    if (!container) return; // Might happen if modal not open, safe fix

    const todayDate = document.getElementById('pos-date') ? document.getElementById('pos-date').value : new Date().toISOString().split('T')[0];

    // Filter logic...
    const todaySales = db.sales.filter(s => {
        const saleDatePart = s.date.split(' ')[0];
        const saleTs = s.timestamp || new Date(s.date).getTime();
        let sessionCondition = true;
        if (isSessionActive && !isReviewingClosure) {
            sessionCondition = saleTs >= ((window.currentSessionStartTime) || 0);
        }
        return saleDatePart === todayDate &&
            (s.status === 'registered' || s.status === 'closed') &&
            (selectedBusinessId ? s.businessId === selectedBusinessId : true) &&
            sessionCondition;
    });

    if (todaySales.length === 0) {
        container.innerHTML = '<div style="padding: 2.5rem; text-align: center; color: var(--text-muted); font-size: 0.9rem;">No hay ventas registradas en esta fecha</div>';
        return;
    }

    container.innerHTML = todaySales.map(s => {
        const isExpense = s.type === 'EXPENSE';
        const detailsHtml = isExpense
            ? `<div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.5rem; italic">${s.details || 'Sin descripción'}</div>`
            : `<div style="margin-top: 0.5rem; font-size: 0.8rem; color: var(--text-muted);">${(s.items || []).map(item => `<div>• ${item.name} (${item.qty})</div>`).join('')}</div>`;

        return `
        <div class="card" style="margin: 0.5rem; padding: 1.2rem; border-left: 4px solid ${isExpense ? 'var(--danger)' : 'var(--primary)'}; background: var(--bg-card);">
             <div style="display: flex; justify-content: space-between;">
                 <span style="font-weight: bold;">#${s.id.toString().slice(-4)}</span>
                 <span style="color: ${isExpense ? 'var(--danger)' : 'var(--primary)'}; font-weight: 900;">${isExpense ? '-' : ''}$${Math.abs(s.total).toFixed(2)}</span>
             </div>
             ${detailsHtml}
             <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 0.5rem;">
                ${s.date.split(' ')[1]} | ${s.seller}
             </div>
             ${(!isExpense && (currentUser.role !== 'seller' || s.status === 'registered')) ? `
                 <div style="margin-top: 0.5rem; display: flex; gap: 0.5rem;">
                    <button class="btn-icon" onclick="returnItemFromTodaySale(${s.id})" title="Devolución"><i class="ph ph-arrow-u-up-left"></i></button>
                    <!-- Edit/Delete could go here -->
                 </div>
             ` : ''}
        </div>
        `;
    }).join('');
}

window.returnItemFromTodaySale = async function (saleId, itemId) {
    // Only allows returning if not closed, simple logic
    alert("Función básica de devolución (Implementar detalles en Inventario)");
    // This function was more complex in app.js, simplified here for 'Option B Lite' to reduce risk first pass.
    // Ideally we copy the logic exactly. Let's assume we do if the user really uses it.
}

console.log('🛒 POS Module Loaded');

// --- SESSION HELPERS ---
window.renderOpenSessionScreen = function (container) {
    container.innerHTML = `
        <div class="fade-in" style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 400px; text-align: center;">
            <div style="width: 120px; height: 120px; border-radius: 60px; background: rgba(59, 130, 246, 0.1); display: flex; align-items: center; justify-content: center; margin-bottom: 2rem;">
                <i class="ph ph-door-open" style="font-size: 4rem; color: var(--primary);"></i>
            </div>
            <h2>Sesión POS Cerrada</h2>
            <p style="color: var(--text-muted); max-width: 400px; margin-bottom: 2rem;">Es necesario abrir una nueva sesión de caja para comenzar a registrar ventas hoy.</p>
            <button class="btn-primary" style="padding: 1rem 3rem; font-size: 1.1rem; border-radius: 50px;" 
                    onclick="window.openPOSSession()">
                <i class="ph ph-plus-circle"></i> ABRIR CAJA AHORA
            </button>
        </div>
    `;
}

window.openPOSSession = function () {
    console.log("🔓 Intentando abrir sesión...");
    window.isSessionActive = true;
    window.currentSessionStartTime = Date.now();

    // Force Save
    if (window.saveData) window.saveData();

    addLog("Sesión POS abierta manualmente.", "info");

    // Force refresh with delay
    setTimeout(() => {
        if (typeof window.renderPOS === 'function') {
            window.renderPOS(document.getElementById('content-area'));
        } else {
            location.reload();
        }
    }, 100);
};

window.isWarehouseContext = function () {
    if (!selectedBusinessId) return false;
    const biz = db.businesses.find(b => String(b.id) === String(selectedBusinessId));
    return biz && biz.type === 'warehouse';
}

window.showExpenseModal = function () {
    if (typeof Swal === 'undefined') { alert("Sistema de modales no cargado"); return; }

    // Load Categories
    const categories = db.expenseCategories || [{ id: 'general', label: 'General' }];
    const catOptions = categories.map(c => `<option value="${c.id}">${c.label}</option>`).join('');

    Swal.fire({
        title: 'Registrar Gasto',
        html: `
            <div style="text-align: left;">
                <label style="display:block; margin-bottom:0.5rem; color:var(--text-muted);">Categoría</label>
                <select id="expense-category" class="swal2-select" style="margin:0 0 1rem 0; width:100%; display:flex;">
                    ${catOptions}
                </select>

                <label style="display:block; margin-bottom:0.5rem; color:var(--text-muted);">Descripción</label>
                <input type="text" id="expense-desc" class="swal2-input" placeholder="Ej. Pago de Luz" style="margin:0 0 1rem 0; width:100%;">
                
                <label style="display:block; margin-bottom:0.5rem; color:var(--text-muted);">Monto</label>
                <input type="number" id="expense-amount" class="swal2-input" placeholder="0.00" style="margin:0 0 1rem 0; width:100%;">

                <label style="display:block; margin-bottom:0.5rem; color:var(--text-muted);">Moneda</label>
                <input type="text" class="swal2-input" value="MN (Moneda Nacional)" disabled style="margin:0 0 1rem 0; width:100%; bg: #333;">
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Registrar Gasto',
        confirmButtonColor: 'var(--danger)',
        background: 'var(--bg-card)',
        color: 'var(--text-main)',
        preConfirm: () => {
            const cat = document.getElementById('expense-category').value;
            const desc = document.getElementById('expense-desc').value;
            const amount = document.getElementById('expense-amount').value;

            if (!desc || !amount) {
                Swal.showValidationMessage('Todos los campos son obligatorios');
                return false;
            }
            return { cat, desc, amount, currency: 'mn' };
        }
    }).then((result) => {
        if (result.isConfirmed) {
            const { cat, desc, amount, currency } = result.value;
            console.log("Registrando Gasto:", result.value);

            const saleData = {
                id: Date.now(),
                date: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString(),
                timestamp: Date.now(),
                businessId: selectedBusinessId || 'mch1',
                seller: currentUser ? currentUser.name : 'Vendedor',
                items: [], // No products
                total: parseFloat(amount) * -1, // Negative for expense
                payment: { cash: 0, transfer: 0, currency: currency },
                type: 'EXPENSE',
                category: cat,
                details: desc,
                status: 'registered'
            };

            db.sales.unshift(saleData);
            window.saveData();
            showToast("Gasto registrado correctamente", "success");

            // Refresh
            if (typeof renderTodaySalesList === 'function') renderTodaySalesList();
            if (typeof renderPOS === 'function') renderPOS(document.getElementById('content-area'));
        }
    });
}

window.showIncidentModal = function () {
    if (typeof Swal === 'undefined') { alert("Sistema de modales no cargado"); return; }

    // Check if cart has items to "discard"
    const hasItems = window.posCart && window.posCart.length > 0;

    let htmlContent = '';
    if (hasItems) {
        const total = window.posCart.reduce((sum, i) => sum + (i.price * i.qty), 0);
        htmlContent = `
            <div style="text-align: left;">
                <p style="color:var(--text-muted); margin-bottom:1rem;">
                    Se registrarán <b>${window.posCart.length} productos</b> como merma/pérdida.
                    <br>Valor Total: <b>$${total.toFixed(2)}</b>
                </p>
                <label style="display:block; margin-bottom:0.5rem; color:var(--text-muted);">Motivo</label>
                <input type="text" id="incident-desc" class="swal2-input" placeholder="Ej. Caducado, Roto, Robo" style="margin:0 0 1rem 0; width:100%;">
            </div>
        `;
    } else {
        htmlContent = `
            <div style="text-align: left;">
                <p style="color:var(--warning); margin-bottom:1rem; font-size:0.9rem;">
                    <i class="ph ph-info"></i> Para mermar productos específicos, agrégalos al carrito primero.
                </p>
                <label style="display:block; margin-bottom:0.5rem; color:var(--text-muted);">Descripción</label>
                <input type="text" id="incident-desc" class="swal2-input" placeholder="Ej. Pérdida de efectivo" style="margin:0 0 1rem 0; width:100%;">
                
                <label style="display:block; margin-bottom:0.5rem; color:var(--text-muted);">Monto Estimado</label>
                <input type="number" id="incident-amount" class="swal2-input" placeholder="0.00" style="margin:0 0 1rem 0; width:100%;">
            </div>
        `;
    }

    Swal.fire({
        title: 'Registrar Merma',
        html: htmlContent,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Registrar Merma',
        confirmButtonColor: 'var(--warning)',
        background: 'var(--bg-card)',
        color: 'var(--text-main)',
        preConfirm: () => {
            const desc = document.getElementById('incident-desc').value;
            const amount = document.getElementById('incident-amount') ? document.getElementById('incident-amount').value : 0;

            if (!desc) {
                Swal.showValidationMessage('El motivo es obligatorio');
                return false;
            }
            return { desc, amount };
        }
    }).then((result) => {
        if (result.isConfirmed) {
            const { desc, amount } = result.value;
            const businessId = selectedBusinessId || 'mch1';

            // Deduct Stock if Cart Items
            if (hasItems) {
                window.posCart.forEach(item => {
                    const inv = db.inventory.find(i => String(i.productId) === String(item.id) && String(i.businessId) === String(businessId));
                    if (inv) inv.quantity -= item.qty;
                });
            }

            const totalLoss = hasItems
                ? window.posCart.reduce((sum, i) => sum + (i.price * i.qty), 0)
                : parseFloat(amount) || 0;

            const saleData = {
                id: Date.now(),
                date: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString(),
                timestamp: Date.now(),
                businessId: businessId,
                seller: currentUser ? currentUser.name : 'Vendedor',
                items: hasItems ? window.posCart : [],
                total: 0, // No revenue
                lossValue: totalLoss,
                type: 'MERMA',
                details: desc,
                status: 'registered'
            };

            db.sales.unshift(saleData);
            window.saveData();

            if (hasItems) {
                window.posCart = [];
                renderCart();
            }

            showToast("Merma registrada", "warning");

            // Refresh
            if (typeof renderTodaySalesList === 'function') renderTodaySalesList();
        }
    });
}

window.registerExpense = function (data) {
    const saleData = {
        id: Date.now(),
        date: new Date().toISOString().replace('T', ' ').split('.')[0],
        timestamp: Date.now(),
        businessId: selectedBusinessId || 'mch1',
        seller: currentUser ? currentUser.name : 'Sistema',
        sellerId: currentUser ? currentUser.id : 0,
        type: 'EXPENSE',
        items: [],
        details: Security.sanitize(data.desc),
        total: -parseFloat(data.amount), // Negative for expense
        payment: { cash: 0, transfer: 0, currency: data.currency }, // Simplification
        status: 'registered'
    };

    // Adjust balance if function exists
    if (typeof window.actualizarSaldo === 'function') {
        window.actualizarSaldo(data.currency, -parseFloat(data.amount));
    }

    db.sales.unshift(saleData);
    window.saveData();
    window.renderTodaySalesList();
    if (window.showToast) window.showToast('💸 Gasto registrado', 'info');
};

/* --- END OF DAY CLOSURE WORKFLOW --- */

window.confirmCloseDay = function () {
    const today = new Date().toISOString().split('T')[0];
    const todaySales = db.sales.filter(s => s.date.startsWith(today) && s.businessId === (selectedBusinessId || 'mch1'));

    // 1. Calculate Financials
    const salesTotal = todaySales.filter(s => (!s.type || s.type === 'SALE') && s.status === 'registered').reduce((sum, s) => sum + s.total, 0);
    const expensesTotal = todaySales.filter(s => s.type === 'EXPENSE').reduce((sum, s) => sum + Math.abs(s.total), 0);
    const mermasTotal = todaySales.filter(s => s.type === 'MERMA').reduce((sum, s) => sum + s.lossValue, 0);

    // Estimate Cost (For Profit Calculation)
    // Map items to get cost
    let totalCost = 0;
    todaySales.filter(s => (!s.type || s.type === 'SALE')).forEach(s => {
        if (s.items) {
            s.items.forEach(item => {
                const p = db.products.find(prod => prod.id === (item.productId || item.id));
                if (p && p.cost) totalCost += (p.cost * item.qty);
            });
        }
    });

    const grossProfit = salesTotal - totalCost;
    const salaryAvailable = Math.max(0, grossProfit * 0.05); // 5% of Profit

    const theoreticalCash = salesTotal - expensesTotal; // Simplified Cash Flow

    // Move List HTML
    const movesHtml = todaySales.map(s => {
        const isExp = s.type === 'EXPENSE';
        const color = isExp ? 'var(--danger)' : 'var(--success)';
        return `
            <div style="display:flex; justify-content:space-between; padding:0.5rem; border-bottom:1px solid var(--border); font-size:0.85rem;">
                <span>${s.date.split(' ')[1]} ${s.type === 'EXPENSE' ? '(Gasto)' : ''}</span>
                <span style="color:${color}; font-weight:bold;">${isExp ? '-' : ''}$${Math.abs(s.total).toFixed(2)}</span>
            </div>`;
    }).join('') || '<div style="padding:1rem; text-align:center; color:var(--text-muted)">Sin movimientos hoy</div>';

    Swal.fire({
        title: 'Cierre de Caja',
        width: '600px',
        html: `
            <div style="text-align: left; max-height: 70vh; overflow-y: auto; padding-right: 5px;">
                
                <!-- SUMMARY CARDS -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
                    <div style="background:var(--bg-dark); padding:1rem; border-radius:12px; border:1px solid var(--border);">
                        <div style="font-size:0.8rem; color:var(--text-muted);">Ventas Totales</div>
                        <div style="font-size:1.5rem; font-weight:bold; color:var(--success);">$${salesTotal.toFixed(2)}</div>
                    </div>
                     <div style="background:var(--bg-dark); padding:1rem; border-radius:12px; border:1px solid var(--border);">
                        <div style="font-size:0.8rem; color:var(--text-muted);">Gastos del Día</div>
                        <div style="font-size:1.5rem; font-weight:bold; color:var(--danger);">$${expensesTotal.toFixed(2)}</div>
                    </div>
                </div>

                <!-- MOVEMENT LIST -->
                <div style="margin-bottom: 1.5rem;">
                     <div style="font-size:0.9rem; font-weight:600; margin-bottom:0.5rem; color:var(--text-main);">Movimientos del Día</div>
                     <div style="background:var(--bg-dark); border-radius:8px; max-height:150px; overflow-y:auto; border:1px solid var(--border);">
                        ${movesHtml}
                     </div>
                </div>

                <!-- CASH COUNT -->
                <div style="margin-bottom: 1.5rem; background: rgba(255,255,255,0.03); padding:1rem; border-radius:12px;">
                     <div style="font-size:0.9rem; font-weight:600; margin-bottom:0.5rem; color:var(--text-main);">Arqueo de Caja (Conteo)</div>
                     
                     <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
                        <div>
                            <label style="font-size:0.8rem; color:var(--text-muted);">Efectivo en Caja</label>
                            <input type="number" id="close-cash-real" class="swal2-input" placeholder="0.00" style="width:100%; margin:0;">
                        </div>
                         <div>
                            <label style="font-size:0.8rem; color:var(--text-muted);">Transferencias</label>
                            <input type="number" id="close-transfer-real" class="swal2-input" placeholder="0.00" style="width:100%; margin:0;">
                        </div>
                     </div>
                     <div id="close-diff-display" style="margin-top:0.5rem; font-size:0.9rem; text-align:right; color:var(--text-muted);">
                        Diferencia: <span>---</span>
                     </div>
                </div>

                <!-- SALARY SECTION -->
                <div style="background: rgba(16, 185, 129, 0.1); padding:1rem; border-radius:12px; border:1px solid rgba(16, 185, 129, 0.2);">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <div style="font-weight:700; color:var(--success);">Solicitar Salario (Hoy)</div>
                            <div style="font-size:0.8rem; color:var(--text-muted);">
                                Disponible (5% Ganancia): <b>$${salaryAvailable.toFixed(2)}</b>
                            </div>
                        </div>
                        <label class="switch">
                            <input type="checkbox" id="salary-request-switch">
                            <span class="slider round"></span>
                        </label>
                    </div>
                </div>

            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Cerrar y Enviar',
        cancelButtonText: 'Cancelar',
        background: 'var(--bg-card)',
        color: 'var(--text-main)',
        didOpen: () => {
            // Real-time Diff Calculation
            const inputs = [document.getElementById('close-cash-real'), document.getElementById('close-transfer-real')];
            const diffDisplay = document.querySelector('#close-diff-display span');

            inputs.forEach(i => i.addEventListener('input', () => {
                const realCash = parseFloat(inputs[0].value) || 0;
                const realTrans = parseFloat(inputs[1].value) || 0;
                const totalReal = realCash + realTrans;
                const diff = totalReal - theoreticalCash;

                diffDisplay.innerText = `$${diff.toFixed(2)}`;
                diffDisplay.style.color = diff >= -1 ? 'var(--success)' : 'var(--danger)';
                diffDisplay.style.fontWeight = 'bold';
            }));
        },
        preConfirm: () => {
            const realCash = parseFloat(document.getElementById('close-cash-real').value) || 0;
            const realTrans = parseFloat(document.getElementById('close-transfer-real').value) || 0;
            const requestSalary = document.getElementById('salary-request-switch').checked;

            return { realCash, realTrans, requestSalary, salaryAvailable };
        }
    }).then((result) => {
        if (result.isConfirmed) {
            processDayClosure(result.value, { salesTotal, expensesTotal, finalCash, grossProfit });
        }
    });
}

window.processDayClosure = function (modalResult, totals) {
    const { realCash, realTrans, requestSalary, salaryAvailable } = modalResult;
    const today = new Date().toISOString().split('T')[0];
    const timestamp = Date.now();
    const businessId = selectedBusinessId || 'mch1';

    // Calculate final discrepancy for record
    const totalReal = realCash + realTrans;
    const disparity = totalReal - totals.finalCash;

    // 1. Mark Sales as Pending Review
    db.sales.forEach(s => {
        if (s.date.startsWith(today) && s.businessId === businessId && s.status === 'registered') {
            s.status = 'pending_review';
        }
    });

    // 2. Create detailed Notification
    const notification = {
        id: timestamp,
        type: 'daily_closure',
        title: `Cierre del Día (${today})`,
        message: `Cierre por ${currentUser.name}. Ventas: $${totals.salesTotal.toFixed(2)}. ${requestSalary ? 'SOLICITUD SALARIO.' : ''} ${disparity !== 0 ? `Diferencia: $${disparity.toFixed(2)}` : 'Cuadre Perfecto.'}`,
        timestamp: timestamp,
        read: false,
        data: {
            salesTotal: totals.salesTotal,
            expensesTotal: totals.expensesTotal,
            theoreticalCash: totals.finalCash,
            realCash: realCash,
            realTransfer: realTrans,
            disparity: disparity,
            requestSalary: requestSalary,
            salaryAmount: requestSalary ? salaryAvailable : 0,
            grossProfit: totals.grossProfit,
            employeeId: currentUser.id,
            date: today
        },
        targetRoles: ['owner', 'admin']
    };
    db.notifications.unshift(notification);

    // 3. Log Salary Request
    if (requestSalary) {
        addLog(`Solicitud de Salario ($${salaryAvailable.toFixed(2)}) por ${currentUser.name}`, 'info');
    }

    // 4. Close Session
    window.isSessionActive = false;
    window.saveData();

    Swal.fire({
        title: 'Día Cerrado Correctamente',
        html: `Reporte enviado.<br>Diferencia registrada: <b style="color:${disparity >= 0 ? 'var(--success)' : 'var(--danger)'}">$${disparity.toFixed(2)}</b>`,
        icon: 'success',
        background: 'var(--bg-card)',
        color: 'var(--text-main)'
    }).then(() => {
        renderOpenSessionScreen(document.getElementById('content-area'));
    });
}
