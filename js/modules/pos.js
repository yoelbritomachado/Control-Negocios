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
                <div style="display: flex; align-items: center; gap: 0.5rem; background: var(--bg-dark); padding: 0.6rem 1rem; border-radius: 12px; border: 1px solid var(--border);">
                    <i class="ph ph-calendar" style="color: var(--primary); font-size: 1.1rem;"></i>
                    <input type="date" id="pos-date" value="${isReviewingClosure ? (window.auditTempData?.targetDate || today) : today}" 
                           style="background: transparent; border: none; color: white; font-family: inherit; font-size: 1rem; outline: none; font-weight: 500;">
                </div>
                <div style="display: flex; align-items: center; gap: 0.5rem; background: var(--bg-dark); padding: 0.6rem 1rem; border-radius: 12px; border: 1px solid var(--border);">
                    <i class="ph ph-clock" style="color: var(--text-muted); font-size: 1.1rem;"></i>
                    <input type="time" id="pos-open-time" value="${isReviewingClosure ? window.auditTempData.openingTime : currentTime}" 
                           style="background: transparent; border: none; color: white; font-family: inherit; font-size: 1rem; outline: none; font-weight: 500;">
                </div>
                <!-- CLOSE DAY BUTTON (Enhanced) -->
                <button onclick="confirmCloseDay()" class="btn-secondary" 
                        style="margin-left:auto; border: 1px solid var(--primary); background: rgba(59, 130, 246, 0.1); color: white; font-size: 0.95rem; padding: 0.6rem 1.5rem; border-radius: 12px; transition: all 0.2s; font-weight: 600; display: flex; align-items: center; gap: 0.5rem;">
                    <i class="ph ph-moon-stars" style="color: var(--primary);"></i> Cerrar Día
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

        // Main Layout: Grid structure based on Photoshop Mockup
        // Left Column: Header + Search + Cart (Big)
        // Right Column: History (Top) + Actions/Total (Bottom)
        // RATIO UPDATE: 2.5fr 1fr -> Gives more space to Cart
        container.innerHTML = `
        <div id="pos-container" class="fade-in" style="display: grid; grid-template-columns: 2.5fr 1fr; gap: 2rem; height: calc(100vh - 100px); overflow: hidden; padding: 1rem;">
            
            <!-- LEFT PANEL -->
            <div style="display: flex; flex-direction: column; gap: 1rem; min-height: 0;">
                
                <!-- 1. Header Row -->
                ${headerHtml}

                <!-- 2. Search Bar Area -->
                <div style="position: relative; z-index: 10;">
                    ${searchHtml}
                    <!-- Results Dropdown (Absolute overlay) -->
                    <div id="pos-results-area" style="position: absolute; top: 100%; left: 0; right: 0; background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; max-height: 400px; overflow-y: auto; display: none; box-shadow: 0 10px 40px rgba(0,0,0,0.5);">
                        <!-- List Items Injected Here -->
                    </div>
                </div>
                
                <!-- 3. Cart Area (Dominant) -->
                <div class="card" style="flex: 1; display: flex; flex-direction: column; padding: 0; overflow: hidden; border: 1px solid var(--border); background: var(--bg-card);">
                    <div style="padding: 1rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.02);">
                        <div style="font-weight: 700; font-size: 1.1rem; display: flex; align-items: center; gap: 0.8rem;">
                            <i class="ph ph-shopping-cart"></i> Carrito
                            <span id="cart-count-badge" style="background: var(--primary); color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">0</span>
                        </div>
                        <button class="btn-ghost" onclick="posCart=[]; renderCart();" style="color: var(--danger); opacity: 0.8;" title="Vaciar Carrito"><i class="ph ph-trash"></i></button>
                    </div>
                    
                    <!-- Cart Items List -->
                    <div id="pos-cart-items" style="flex: 1; overflow-y: auto; padding: 0.5rem;"></div>
                </div>
            </div>

            <!-- RIGHT PANEL -->
            <div style="display: flex; flex-direction: column; gap: 1.5rem; min-height: 0;">
                
                <!-- 1. History (Top Right) - EXPANDED to fill available space -->
                <div class="card" style="display: flex; flex-direction: column; padding: 0; overflow: hidden; flex: 1; border: 1px solid var(--border); background: var(--bg-card); border-radius: 20px;">
                    <div style="padding: 1rem; border-bottom: 1px solid var(--border); background: rgba(255,255,255,0.02); font-size: 0.9rem; font-weight: 600; color: var(--text-muted); display:flex; gap: 0.5rem; align-items:center;">
                        <i class="ph ph-clock-counter-clockwise"></i> Movimientos Hoy
                    </div>
                    <div id="today-sales-list" style="flex: 1; overflow-y: auto; padding: 0.5rem;"></div>
                </div>

                <!-- 2. Actions & Total (Bottom Right - Pinned & Compact) -->
                <div class="card" style="display: flex; flex-direction: column; padding: 1.5rem; background: var(--bg-card); border: 1px solid var(--border); border-radius: 20px; box-shadow: 0 -10px 40px rgba(0,0,0,0.1); flex-shrink: 0;">
                    
                    <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 1.2rem;">
                        <span style="color: var(--text-muted); font-size: 1rem;">Total</span>
                        <span id="cart-total-display" style="font-size: 2.8rem; font-weight: 800; color: #ff4081; line-height: 1;">$0.00</span>
                    </div>

                    <div style="display: flex; gap: 0.8rem; margin-bottom: 1rem;">
                         <button class="btn-secondary" onclick="showExpenseModal()" style="flex: 1; padding: 0.8rem; border-color: var(--border); color: var(--text-muted);">
                            <i class="ph ph-receipt"></i> Gasto
                        </button>
                         <button class="btn-secondary" onclick="showIncidentModal()" style="flex: 1; padding: 0.8rem; border-color: var(--border); color: var(--warning);">
                            <i class="ph ph-warning-circle"></i> Merma
                        </button>
                         <button class="btn-secondary" onclick="showCurrencyBuyModal()" style="flex: 1; padding: 0.8rem; border-color: var(--border); color: #85bb65;">
                            <i class="ph ph-currency-circle-dollar"></i> Divisa
                        </button>
                    </div>

                    <button id="payBtn" class="btn-primary" onclick="${isWarehouseContext() ? 'showTransferModal()' : 'showPaymentModal()'}" 
                            style="width: 100%; font-size: 1.2rem; padding: 1rem; border-radius: 12px; background: #ff4081; border: none; font-weight: 700; box-shadow: 0 4px 15px rgba(255, 64, 129, 0.4);">
                        ${isWarehouseContext() ? 'TRANSFERIR' : 'COBRAR'} <i class="ph ph-arrow-right" style="margin-left: 0.5rem;"></i>
                    </button>
                    
                     <!-- Save Button: Hidden by default, toggled in renderCart -->
                     <button id="save-sale-btn" class="btn-secondary" onclick="window.savePendingSale()" 
                             style="width: 100%; margin-top: 0.8rem; border-color: var(--warning); color: var(--warning); font-size: 1rem; padding: 0.8rem; border-radius: 12px; display: none; font-weight: 600;">
                        <i class="ph ph-floppy-disk"></i> GUARDAR VENTA (PENDIENTE)
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

    // RENDER AS LIST (Horizontal Layout requested)
    if (filtered.length > 0) {
         resultsArea.style.display = 'block'; // Show dropdown overlay
    } else {
         resultsArea.style.display = 'none';
         return;
    }

    resultsArea.innerHTML = filtered.map(p => `
        <div class="pos-search-item fade-in" onclick="addToPOSCart(${p.id})" 
             style="display: flex; align-items: center; gap: 1rem; padding: 0.8rem 1rem; border-bottom: 1px solid var(--border); cursor: pointer; transition: background 0.1s;">
            
            <!-- Image (Thumbnail) -->
            <div style="width: 48px; height: 48px; border-radius: 8px; overflow: hidden; background: var(--bg-dark); flex-shrink: 0;">
                ${p.image ? `<img src="${p.image}" style="width: 100%; height: 100%; object-fit: cover;">` : `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center;"><i class="ph ph-image" style="color:var(--text-muted);"></i></div>`}
            </div>

            <!-- Name & Stock -->
            <div style="flex: 1; display:flex; flex-direction:column;">
                <div style="font-weight: 600; font-size: 0.95rem; color: var(--text-main);">${p.name}</div>
                <div style="font-size: 0.8rem; color: var(--text-muted);">Stock: <span style="color:${p.stock > 0 ? 'var(--success)' : 'var(--danger)'}">${p.stock}</span></div>
            </div>

            <!-- Price -->
            <div style="font-size: 1rem; font-weight: 700; color: #ff4081;">
                $${p.price.toFixed(2)}
            </div>

            <!-- Action Icon -->
            <div style="width: 32px; height: 32px; border-radius: 50%; background: rgba(255, 64, 129, 0.1); display: flex; align-items: center; justify-content: center;">
                <i class="ph ph-plus" style="color: #ff4081; font-weight: bold;"></i>
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

    // Clear search and reset grid (HIDE dropdown)
    const searchInput = document.getElementById('pos-search');
    const resultsArea = document.getElementById('pos-results-area');
    if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
        if(resultsArea) resultsArea.style.display = 'none'; // Hide list
    }
}

window.renderCart = function () {
    const container = document.getElementById('pos-cart-items');
    const totalDisplay = document.getElementById('cart-total-display');
    const badge = document.getElementById('cart-count-badge');
    const payBtn = document.getElementById('payBtn');
    const saveBtn = document.getElementById('save-sale-btn');

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
        if (saveBtn) saveBtn.style.display = 'none'; // Hide save button
        updatePOSMobileFooter();
        return;
    }

    if (payBtn) {
        payBtn.disabled = false;
        payBtn.style.opacity = '1';
        payBtn.style.pointerEvents = 'auto';
    }
    if (saveBtn) {
        saveBtn.style.display = 'flex'; // Show save button
        saveBtn.style.justifyContent = 'center';
    }

    container.innerHTML = posCart.map((item, index) => {
        total += item.price * item.qty;
        return `
            <div class="fade-in" style="padding: 1rem; border-bottom: 1px solid var(--border); display: flex; gap: 1rem; align-items: center;">
                
                <!-- Image -->
                <div style="width: 40px; height: 40px; border-radius: 6px; overflow: hidden; background: var(--bg-dark); flex-shrink: 0; opacity: 0.6;">
                     ${item.image ? `<img src="${item.image}" style="width: 100%; height: 100%; object-fit: cover;">` : `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center;"><i class="ph ph-image" style="color:#555;"></i></div>`}
                </div>

                <!-- Info -->
                <div style="flex: 1;">
                    <div style="font-weight: 600; font-size: 0.95rem; margin-bottom: 0.2rem; color: #eee;">${item.name}</div>
                    <div style="font-size: 0.9rem; color: #ff4081; font-weight: 700;">$${item.price.toFixed(2)}</div>
                </div>

                <!-- Controls (Styled per Mockup) -->
                <div style="display: flex; align-items: center; gap: 0.5rem; background: #000; padding: 4px 8px; border-radius: 8px; border: 1px solid var(--border);">
                    <button class="btn-icon" onclick="updateCartItemQty(${index}, -1)" style="width: 20px; height: 20px; padding: 0; color: var(--text-muted); border: none;"><i class="ph ph-minus" style="font-size: 0.8rem;"></i></button>
                    <span style="font-weight: bold; min-width: 20px; text-align: center; font-size: 1rem; color: white;">${item.qty}</span>
                    <button class="btn-icon" onclick="updateCartItemQty(${index}, 1)" style="width: 20px; height: 20px; padding: 0; color: var(--text-muted); border: none;"><i class="ph ph-plus" style="font-size: 0.8rem;"></i></button>
                </div>
                
                <!-- Delete -->
                <button class="btn-icon" onclick="removeFromCart(${index})" style="color: var(--danger); opacity: 0.5; width: 30px; border:none; background:transparent;"><i class="ph ph-trash"></i></button>
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
                s.date = dateString;
                s.timestamp = timestamp;
                s.openingTime = posOpeningTime;
                s.status = 'registered'; // Ensure status is set to registered upon payment (fix for saved sales)

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
            (s.status === 'registered' || s.status === 'closed' || s.status === 'saved') &&
            (selectedBusinessId ? s.businessId === selectedBusinessId : true) &&
            sessionCondition;
    });

    if (todaySales.length === 0) {
        container.innerHTML = '<div style="padding: 2.5rem; text-align: center; color: var(--text-muted); font-size: 0.9rem;">No hay ventas registradas en esta fecha</div>';
        return;
    }

    let html = '';
    todaySales.forEach(s => {
        const isExpense = s.type === 'EXPENSE';
        const isMerma = s.type === 'MERMA';
        const isSaved = s.status === 'saved'; // Check if pending/saved

        let icon = 'ph-check-circle';
        let color = 'var(--success)';

        if (isSaved) { icon = 'ph-clock'; color = 'var(--warning)'; }
        if (isExpense) { icon = 'ph-trend-down'; color = 'var(--danger)'; }
        if (isMerma) { icon = 'ph-trash'; color = 'var(--text-muted)'; }

        html += `
        <div class="sale-item fade-in" style="background: var(--bg-hover); padding: 0.8rem; border-radius: 8px; border-left: 3px solid ${color};">
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.2rem;">
                 <span style="font-weight: 700; font-size: 0.95rem; color:white;">#${s.id}</span>
                 ${isSaved ? 
                    `<span style="font-weight: 700; color: ${color}; font-size: 0.8rem; padding: 2px 6px; border: 1px solid ${color}; border-radius: 4px;">PENDIENTE</span>` 
                    : `<span style="font-weight: 700; color: ${color};">$${isExpense ? '-' : ''}${Math.abs(s.total).toFixed(2)}</span>`
                 }
            </div>
             <div style="font-size: 0.8rem; color: var(--text-muted); display:flex; gap:0.5rem; flex-wrap: wrap;">
                 ${(s.items || []).map(i => `<div>• ${i.name} (${i.qty})</div>`).join('')}
             </div>
             <div style="font-size: 0.75rem; color: rgba(255,255,255,0.4); margin-top: 0.4rem;">
                ${s.date.split(' ')[1]} | ${s.seller || 'Sistema'}  ${isSaved ? '<b style="color:var(--warning)">(GUARDADA)</b>' : ''}
             </div>
             ${(!isExpense && !isMerma && (currentUser.role !== 'seller' || s.status === 'registered' || isSaved)) ? `
                 <div style="margin-top: 0.5rem; display: flex; gap: 0.5rem;">
                    ${isSaved ? `
                        <button class="btn-icon" onclick="resumeSale(${s.id})" title="Reanudar Venta" style="color:var(--bg-dark); background:var(--warning); border:none; padding:0.4rem 1rem; border-radius:8px; font-weight:700; opacity:1; width:100%;">
                            <i class="ph ph-play-circle"></i> REANUDAR
                        </button>
                    ` : `
                        <button class="btn-icon" onclick="editSale(${s.id})" title="Editar Venta" style="color:var(--primary); border-color:var(--primary); opacity:0.8;">
                            <i class="ph ph-pencil-simple"></i> Editar
                        </button>
                    `}
                    
                    <!-- DELETE BUTTON (Void Sale) -->
                    <button class="btn-icon" onclick="deleteSale(${s.id})" title="Eliminar Venta (Restaurar Stock)" style="color:var(--danger); border-color:var(--danger); opacity:0.8; ${isSaved ? 'background:rgba(255,0,0,0.1);' : ''}">
                        <i class="ph ph-trash"></i>
                    </button>
                 </div>
             ` : ''}
        </div>
        `;
    });
    container.innerHTML = html;
}

window.editSale = async function (saleId) {
    const sale = db.sales.find(s => s.id === saleId);
    if (!sale) return;

    // [FIX] Currency Buy Edit Logic
    if (sale.type === 'CURRENCY_BUY') {
        const details = sale.currencyBought || {};
        // Re-open buy modal with pre-filled data
        // We need a slight modification to 'showCurrencyBuyModal' to accept values
        // Or we can manually trigger it and set values after a timeout
        
        // For simplicity, let's just delete the old one and let user recreate?
        // Better: Pre-fill. But standard modal is clean.
        // Let's modify showCurrencyBuyModal to accept 'editData'
        
        // Quick workaround: Alert user to delete and re-add or implement dedicated edit
        // User requested FIX. So we must support it.
        // Let's try to delete it (reverting funds) and open the modal fresh.
        // BUT user might want to see what was there.
        
        Swal.fire({
            title: 'Editar Compra de Divisa',
            text: 'Para editar, se eliminará el registro actual y podrás crear uno nuevo. ¿Continuar?',
            icon: 'info',
            showCancelButton: true,
            confirmButtonText: 'Sí, editar',
            cancelButtonText: 'Cancelar'
        }).then((res) => {
            if (res.isConfirmed) {
                // Delete sale (Reverts MN)
                // Manual deletion logic similar to deleteSale but without stock logic
                db.sales = db.sales.filter(s => s.id !== saleId);
                // Revert money? 'deleteSale' logic handles inventory. Currency buy handles cash.
                // We need to implement delete logic for currency buy in 'deleteSale' first or here.
                
                // Let's implement robust delete first.
                // Assuming 'deleteSale' handles generic sales.
                // Let's manually revert the cash effect here.
                if (typeof window.actualizarSaldo === 'function') {
                    window.actualizarSaldo('mn', Math.abs(sale.total)); // Add back the money spent
                }
                
                window.saveData();
                renderTodaySalesList();
                
                // Open Modal
                showCurrencyBuyModal(details); // Pass details to pre-fill
            }
        });
        return;
    }

    if (window.posCart.length > 0) {
        // ... existing cart logic ...
        const result = await Swal.fire({
            title: 'Carrito activo',
            text: "¿Qué deseas hacer con los productos en el carrito actual?",
            icon: 'question',
            showDenyButton: true,
            showCancelButton: true,
            confirmButtonText: '💾 Guardar y Editar',
            denyButtonText: '🗑️ Descartar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: 'var(--warning)',
            denyButtonColor: 'var(--danger)',
            background: 'var(--bg-card)',
            color: 'var(--text-main)'
        });

        if (result.isConfirmed) {
            window.savePendingSale().then(() => {
               window.editSale(saleId); // Recursive retry
            });
            return;
        } else if (result.isDenied) {
            window.posCart = [];
        } else {
            return;
        }
    }

    // Load to Cart
    window.posCart = sale.items.map(i => ({
        id: i.productId || i.id, // Compat
        name: i.name,
        price: i.price,
        qty: i.qty,
        image: i.image // Might be missing if not saved, but harmless
    }));

    window.editingSaleId = saleId;
    renderCart();

    // Pulse effect or notification
    showToast(`Editando Venta #${saleId}`, "info");

    // Scroll to cart
    // document.getElementById('pos-cart-panel').scrollIntoView({ behavior: 'smooth' });
}

window.savePendingSale = async function () {
    if (!window.posCart || window.posCart.length === 0) {
        showToast("El carrito está vacío", "error");
        return;
    }

    const businessId = selectedBusinessId || 'mch1';
    const totalValue = window.posCart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const timestamp = Date.now();
    const now = new Date();
    const dateString = `${now.toISOString().split('T')[0]} ${now.toLocaleTimeString([], { hour12: false })}`;

    // 1. DEDUCT STOCK (RESERVATION)
    // We deduct stock to ensure availability. If cancelled later, we revert.
    window.posCart.forEach(item => {
        const inv = db.inventory.find(i => String(i.productId) === String(item.id) && String(i.businessId) === String(businessId));
        if (inv) inv.quantity -= item.qty;
    });

    // 2. CREATE PENDING RECORD
    const saleData = {
        id: timestamp,
        date: dateString,
        timestamp: timestamp,
        businessId: businessId,
        seller: currentUser ? currentUser.name : 'Vendedor',
        sellerId: currentUser ? currentUser.id : 0,
        items: window.posCart.map(i => ({ 
            productId: i.id, 
            id: i.id, // Ensure ID is kept
            name: i.name, 
            qty: i.qty, 
            price: i.price,
            image: i.image 
        })),
        total: totalValue,
        payment: { cash: 0, transfer: 0, currency: 'mn' }, 
        status: 'saved', // MARK AS SAVED
        sessionId: (typeof window.currentSessionStartTime !== 'undefined' ? window.currentSessionStartTime : Date.now())
    };

    db.sales.unshift(saleData);
    
    // 3. CLEANUP
    window.posCart = [];
    window.editingSaleId = null; // Clear edit flag if any
    
    await window.saveData();
    renderCart();
    if (typeof renderTodaySalesList === 'function') renderTodaySalesList();
    
    showToast("Venta guardada y stock reservado 📦", "success");
}

window.resumeSale = function (saleId) {
    // 1. Find the saved sale
    const saleIndex = db.sales.findIndex(s => s.id === saleId);
    if (saleIndex === -1) return;
    const sale = db.sales[saleIndex];

    // 2. CHECK IF CART HAS ITEMS
    if (window.posCart.length > 0) {
        Swal.fire({
            title: 'Carrito ocupado',
            text: "Tienes productos en el carrito. ¿Qué deseas hacer?",
            icon: 'warning',
            showDenyButton: true,
            confirmButtonText: 'Guardar actual y Reanudar',
            denyButtonText: 'Descartar actual',
            confirmButtonColor: '#ff4081',
            denyButtonColor: 'var(--text-muted)',
            background: 'var(--bg-card)',
            color: 'var(--text-main)'
        }).then((result) => {
            if (result.isConfirmed) {
                window.savePendingSale().then(() => {
                   // Recursive call after saving
                   window.resumeSale(saleId);
                });
            } else if (result.isDenied) {
                window.posCart = [];
                window.resumeSale(saleId);
            }
        });
        return;
    }

    // 3. LOAD ITEMS TO CART
    // Note: Stock was ALREADY deducted when saved. We don't deduct again here.
    // However, we need to handle the "Edit Mode".
    // STRATEGY: We DELETE the saved sale (reverting its stock effect logically to "in cart" state).
    // Actually, simply putting items in cart implies they are "active".
    // If we delete the sale record, we must REVERT stock first? 
    // NO. If we delete the record, the stock logic in 'deleteSale' would add it back.
    // THEN 'addToCart' would subtract it again.
    // Optimization: Just move items to cart and delete sale WITHOUT reverting stock (since they are physically in hand).
    
    // BUT 'addToCart' logic isn't used here, we inject directly.
    // So: Stock is already down. Cart has items.
    // When we eventually COBRA (processPOSPayment), it tries to deduct stock again!
    // FIX: We must REVERT stock when resuming, so the Cart Logic (which deducts on checkout) works normally.
    
    // REVERT STOCK TEMPORARILY
    sale.items.forEach(item => {
        const inv = db.inventory.find(i => String(i.productId) === String(item.productId || item.id) && String(i.businessId) === String(sale.businessId));
        if (inv) inv.quantity += item.qty;
    });

    // LOAD TO CART
    window.posCart = sale.items.map(i => ({
        id: i.productId || i.id,
        name: i.name,
        price: i.price,
        qty: i.qty,
        image: i.image
    }));

    // REMOVE SAVED SALE FROM DB (It's now active in RAM)
    db.sales.splice(saleIndex, 1);

    // UPDATE UI
    window.saveData();
    renderCart();
    renderTodaySalesList();
    showToast("Venta reanudada", "info");
}

window.deleteSale = function (saleId) {
    Swal.fire({
        title: '¿Eliminar Venta?',
        text: "Esto revertirá el stock de los productos. Esta acción no se puede deshacer.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: 'var(--danger)',
        cancelButtonColor: 'var(--text-muted)',
        confirmButtonText: 'Sí, eliminar',
        background: 'var(--bg-card)',
        color: 'var(--text-main)'
    }).then((result) => {
        if (result.isConfirmed) {
            const sale = db.sales.find(s => s.id === saleId);
            if (!sale) return;

            // 1. Revert Stock
            if (sale.items) {
                sale.items.forEach(item => {
                    const inv = db.inventory.find(i => String(i.productId) === String(item.productId || item.id) && String(i.businessId) === String(sale.businessId));
                    if (inv) inv.quantity += item.qty;
                });
            }

            // 2. Remove Sale
            db.sales = db.sales.filter(s => s.id !== saleId);

            // 3. Clear editing if matching
            if (window.editingSaleId === saleId) {
                window.editingSaleId = null;
                window.posCart = [];
                renderCart();
            }

            window.saveData();
            if (typeof renderTodaySalesList === 'function') renderTodaySalesList();
            showToast("Venta eliminada y stock restaurado", "success");
        }
    });
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

                <div id="expense-desc-container" style="display:none;">
                    <label style="display:block; margin-bottom:0.5rem; color:var(--text-muted);">Descripción</label>
                    <input type="text" id="expense-desc" class="swal2-input" placeholder="Ej. Pago de Luz" style="margin:0 0 1rem 0; width:100%;">
                </div>
                
                <label style="display:block; margin-bottom:0.5rem; color:var(--text-muted);">Monto</label>
                <div style="position:relative; display:flex; align-items:center;">
                    <span style="position:absolute; left:12px; color:var(--text-muted); pointer-events:none; font-size:0.9rem;">MN</span>
                    <input type="number" id="expense-amount" class="swal2-input" placeholder="0.00" style="margin:0; width:100%; padding-left: 3rem;">
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Registrar Gasto',
        confirmButtonColor: 'var(--danger)',
        background: 'var(--bg-card)',
        color: 'var(--text-main)',
        didOpen: () => {
            const catSelect = document.getElementById('expense-category');
            const descContainer = document.getElementById('expense-desc-container');

            // Function to toggle
            const toggleDesc = () => {
                // Hide if 'area', show otherwise (or specifically 'otros'?)
                // User said: "choose other... if area do not show".
                // Let's assume 'area' is the only one that hides it.
                if (catSelect.value === 'area') {
                    descContainer.style.display = 'none';
                } else {
                    descContainer.style.display = 'block';
                }
            };

            catSelect.addEventListener('change', toggleDesc);
            toggleDesc(); // Initial check
        },
        preConfirm: () => {
            const cat = document.getElementById('expense-category').value;
            const amount = document.getElementById('expense-amount').value;
            // Get desc only if visible
            let desc = "";
            if (cat !== 'area') {
                desc = document.getElementById('expense-desc').value;
                if (!desc) {
                    Swal.showValidationMessage('La descripción es obligatoria');
                    return false;
                }
            } else {
                desc = "Gasto de Área"; // Default description
            }

            if (!amount) {
                Swal.showValidationMessage('Monto obligatorio');
                return false;
            }
            return { cat, desc, amount, currency: 'mn' };
        }
    }).then((result) => {
        if (result.isConfirmed) {
            registerExpense(result.value);
        }
    });
}



window.showIncidentModal = function () {
    if (typeof Swal === 'undefined') { alert("Sistema de modales no cargado"); return; }

    // Internal state
    let mermaItems = [];

    Swal.fire({
        title: 'Registrar Incidencia / Devolución',
        width: '750px',
        html: `
            <div style="text-align: left; min-height: 450px; display: flex; flex-direction: column;">
                
                <!-- TYPE SELECTOR -->
                <div style="background:var(--bg-dark); padding:1rem; border-radius:8px; margin-bottom:1rem; border:1px solid var(--border);">
                    <label style="display:block; margin-bottom:0.5rem; color:var(--text-muted); font-size:0.9rem;">Tipo de Incidencia</label>
                    <select id="incident-type" class="swal2-select" style="margin:0; width:100%; display:flex; font-weight:bold;">
                        <option value="rotura_interna">🛑 Rotura Interna / Merma (Stock -1, Caja $0)</option>
                        <option value="devolucion_nuevo">🔄 Devolución - Producto Nuevo (Stock +1, Caja -$)</option>
                        <option value="devolucion_roto">⚠️ Devolución - Producto Roto (Stock 0, Caja -$)</option>
                    </select>
                </div>

                <!-- SEARCH SECTION -->
                <div style="position: relative; margin-bottom: 1rem;">
                     <label style="display:block; margin-bottom:0.5rem; color:var(--text-muted);">Buscar Producto</label>
                     <input type="text" id="merma-search" class="swal2-input" placeholder="Escribe para buscar..." style="margin:0; width:100%;">
                     <!-- Results Area -->
                     <div id="merma-results" style="position: absolute; top: 100%; left: 0; right: 0; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; max-height: 200px; overflow-y: auto; z-index: 9999; display: none; box-shadow: 0 4px 12px rgba(0,0,0,0.5);">
                     </div>
                </div>

                <!-- LIST SECTION -->
                <div style="flex: 1; background: var(--bg-dark); border-radius: 8px; padding: 1rem; border: 1px solid var(--border);">
                    <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.5rem; display:flex; justify-content:space-between;">
                        <span>Productos Afectados</span>
                        <span id="merma-total-qty">0 ítems</span>
                    </div>
                    <div id="merma-list" style="max-height: 180px; overflow-y: auto;">
                        <!-- Render Items Here -->
                    </div>
                </div>

                <!-- REASON SECTION -->
                 <div style="margin-top: 1rem;">
                    <label style="display:block; margin-bottom:0.5rem; color:var(--text-muted);">Motivo / Nota</label>
                    <input type="text" id="merma-reason" class="swal2-input" placeholder="Ej. Cliente solicitó reembolso, se cayó al limpiar..." style="margin:0; width:100%;">
                 </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Registrar',
        confirmButtonColor: 'var(--primary)',
        cancelButtonText: 'Cancelar',
        background: 'var(--bg-card)',
        color: 'var(--text-main)',

        didOpen: () => {
            const searchInput = document.getElementById('merma-search');
            const resultsArea = document.getElementById('merma-results');
            const listArea = document.getElementById('merma-list');
            const qtyLabel = document.getElementById('merma-total-qty');
            const incidentType = document.getElementById('incident-type');

            // --- RENDER FUNCTION ---
            const renderList = () => {
                if (mermaItems.length === 0) {
                    listArea.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 2rem; font-style: italic;">No hay productos seleccionados</div>';
                    qtyLabel.innerText = '0 ítems';
                    return;
                }

                listArea.innerHTML = mermaItems.map((item, index) => `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.05);">
                        <div style="flex:1;">
                            <div style="font-weight: 600; font-size: 0.9rem;">${item.name}</div>
                            <div style="font-size: 0.8rem; color: var(--text-muted);">$${item.price.toFixed(2)}</div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                             <div style="background:var(--bg-card); border-radius:4px; border:1px solid var(--border); display:flex;">
                                <button type="button" class="btn-icon-small" id="dec-${index}" style="padding:2px 8px; border:none; background:transparent;">-</button>
                                <span style="font-weight:bold; min-width:24px; text-align:center; padding-top:2px;">${item.qty}</span>
                                <button type="button" class="btn-icon-small" id="inc-${index}" style="padding:2px 8px; border:none; background:transparent;">+</button>
                             </div>
                             <button type="button" class="btn-icon-small" id="del-${index}" style="color:var(--danger); border:none; background:transparent;"><i class="ph ph-trash"></i></button>
                        </div>
                    </div>
                `).join('');
                qtyLabel.innerText = `${mermaItems.reduce((s, i) => s + i.qty, 0)} ítems`;

                // Bind list buttons safely using closures (avoid global pollution)
                mermaItems.forEach((_, idx) => {
                    document.getElementById(`inc-${idx}`).onclick = () => { mermaItems[idx].qty++; renderList(); };
                    document.getElementById(`dec-${idx}`).onclick = () => { if (mermaItems[idx].qty > 1) mermaItems[idx].qty--; renderList(); };
                    document.getElementById(`del-${idx}`).onclick = () => { mermaItems.splice(idx, 1); renderList(); };
                });
            };

            // --- SEARCH FUNCTION ---
            const searchProducts = (q) => {
                if (q.length < 1) { resultsArea.style.display = 'none'; return; }

                const businessId = selectedBusinessId || 'mch1';
                // Only products that exist in this business
                const storeInventory = db.inventory.filter(i => String(i.businessId) === String(businessId));

                const matches = storeInventory.map(inv => {
                    const p = db.products.find(prod => prod.id === inv.productId);
                    return p ? { ...p, stock: inv.quantity } : null;
                }).filter(p => p && (p.name.toLowerCase().includes(q.toLowerCase()) || String(p.price).startsWith(q))).slice(0, 10);

                if (matches.length > 0) {
                    resultsArea.innerHTML = matches.map((p, idx) => `
                        <div id="res-${p.id}" class="search-result-item" 
                             style="padding: 0.8rem; border-bottom: 1px solid var(--border); cursor: pointer; display:flex; justify-content:space-between; align-items:center;">
                            <div>
                                <div style="font-weight:600;">${p.name}</div>
                                <div style="font-size:0.8rem; color:var(--text-muted);">Stock: ${p.stock}</div>
                            </div>
                            <div style="color:var(--primary); font-weight:bold;">+ Agregar</div>
                        </div>
                    `).join('');
                    resultsArea.style.display = 'block';

                    // Bind Add Clicks
                    matches.forEach(p => {
                        const el = document.getElementById(`res-${p.id}`);
                        if (el) el.onclick = () => {
                            const existing = mermaItems.find(i => i.id === p.id);
                            if (existing) existing.qty++;
                            else mermaItems.push({ id: p.id, name: p.name, price: p.price, qty: 1 });

                            renderList();
                            searchInput.value = '';
                            resultsArea.style.display = 'none';
                            searchInput.focus();
                        };
                    });
                } else {
                    resultsArea.innerHTML = '<div style="padding:1rem; text-align:center; color:var(--text-muted);">Sin resultados</div>';
                    resultsArea.style.display = 'block';
                }
            };

            // --- LISTENERS ---
            searchInput.addEventListener('input', (e) => searchProducts(e.target.value));

            // Initial Render
            renderList();
        },

        preConfirm: () => {
            const type = document.getElementById('incident-type').value;
            const reason = document.getElementById('merma-reason').value;

            if (mermaItems.length === 0) {
                Swal.showValidationMessage('No has seleccionado productos');
                return false;
            }
            if (!reason && type === 'rotura_interna') {
                // For Merma, reason is important. For Returns, maybe optional? Let's enforce it.
                // But user might want speed. Let's enforce.
                Swal.showValidationMessage('Ingresa un motivo');
                return false;
            }
            return { items: mermaItems, reason, type };
        }
    }).then((result) => {
        if (result.isConfirmed) {
            processIncident(result.value); // Generic processor
        }
    });
}

// Logic to process
window.processIncident = function (data) {
    const { items, reason, type } = data;
    const businessId = selectedBusinessId || 'mch1';

    // Calculate total value (at retail price)
    const totalValue = items.reduce((s, i) => s + (i.price * i.qty), 0);

    // LOGIC BY TYPE
    // 1. ROtura Interna: Stock -1, Cash 0.
    // 2. Dev Nuevo: Stock +1, Cash -Price.
    // 3. Dev Roto: Stock 0, Cash -Price.

    items.forEach(item => {
        const inv = db.inventory.find(i => String(i.productId) === String(item.id) && String(i.businessId) === String(businessId));
        if (inv) {
            if (type === 'rotura_interna') {
                inv.quantity -= item.qty;
            } else if (type === 'devolucion_nuevo') {
                inv.quantity += item.qty;
            } else if (type === 'devolucion_roto') {
                // No change to stock (Lost in battle)
            }
        }
    });

    // Register Sale Record (Negative Sale or Merma)
    let saleType = 'MERMA';
    let saleTotal = 0; // Revenue impact
    let lossValue = 0; // Pure loss tracking

    if (type === 'rotura_interna') {
        saleType = 'MERMA';
        saleTotal = 0;
        lossValue = totalValue; // Pure internal loss
    } else {
        // Returns (refund money)
        saleType = 'RETURN'; // Or Sale with negative total? Let's use 'RETURN' for clarity if allowed, or 'REFUND'.
        // Existing types: SALE, EXPENSE, MERMA. Let's add 'RETURN' or use negative SALE.
        // If we use negative SALE, it affects Cash Control automatically.
        saleTotal = -totalValue; // Cash Out
        lossValue = (type === 'devolucion_roto') ? totalValue : 0; // If broken, it's also a product loss
    }

    const saleData = {
        id: Date.now(),
        date: new Date().toISOString().replace('T', ' ').split('.')[0],
        timestamp: Date.now(),
        businessId: businessId,
        seller: currentUser ? currentUser.name : 'Sistema',
        sellerId: currentUser ? currentUser.id : 0,
        type: saleType,
        items: items.map(i => ({ productId: i.id, name: i.name, qty: i.qty, price: i.price })),
        total: saleTotal,
        lossValue: lossValue,
        payment: { cash: 0, transfer: 0, currency: 'mn' }, // Assuming refund in cash? Or mixed?
        // Ideally prompt for refund method, but let's assume Cash for now or MN default.
        details: `[${type}] ${reason}`,
        status: 'registered'
    };

    // For Returns, we need to affect cash balance.
    // If we rely on 'total' being negative, cash control might pick it up.
    // But 'payment' object needs to reflect where the money went.
    // Let's assume Cash Refund for simplicity unless user wants advanced return.
    if (saleTotal < 0) {
        saleData.payment.cash = saleTotal; // Negative cash
    }

    db.sales.unshift(saleData);

    // Update Cash Balance if needed
    if (saleTotal !== 0 && typeof window.actualizarSaldo === 'function') {
        window.actualizarSaldo('mn', saleTotal); // Deduct from MN
    }

    window.saveData();
    showToast("Incidencia registrada correctamente", "success");
    if (typeof renderTodaySalesList === 'function') renderTodaySalesList();
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

        window.showCurrencyBuyModal = function (editData = null) {
    const rateUSD = db.settings.currencyRates?.usd_buy || 500;
    const rateEUR = db.settings.currencyRates?.eur_buy || 550;

    // Default values or edit values
    const defType = editData ? editData.type : 'USD';
    const defAmount = editData ? editData.amount : '';

    Swal.fire({
        title: editData ? '✏️ Editar Compra Divisa' : '💵 Compra de Divisas',
        html: `
            <div style="text-align: left; display: flex; flex-direction: column; gap: 1rem;">
                
                <!-- Currency Selector -->
                <div style="background:var(--bg-dark); padding:1rem; border-radius:12px; border:1px solid var(--border);">
                    <label style="display:block; margin-bottom:0.5rem; color:var(--text-muted); font-size:0.9rem;">Divisa a Comprar</label>
                    <select id="buy-currency-type" class="swal2-select" style="margin:0; width:100%; display:flex; font-weight:bold;" onchange="updateBuyRate()">
                        <option value="USD" ${defType === 'USD' ? 'selected' : ''}>USD (Dólar)</option>
                        <option value="EUR" ${defType === 'EUR' ? 'selected' : ''}>EUR (Euro)</option>
                    </select>
                </div>

                <div class="grid-2" style="gap: 1rem;">
                    <!-- Amount Input -->
                    <div>
                        <label style="display:block; margin-bottom:0.5rem; color:var(--text-muted); font-size:0.9rem;">Cantidad</label>
                        <input type="number" id="buy-currency-amount" class="swal2-input" placeholder="0" value="${defAmount}" style="margin:0; width:100%;" oninput="calculateBuyTotal()">
                    </div>
                    <!-- Rate Display -->
                    <div>
                        <label style="display:block; margin-bottom:0.5rem; color:var(--text-muted); font-size:0.9rem;">Tasa (MN)</label>
                        <input type="number" id="buy-currency-rate" class="swal2-input" value="${rateUSD}" readonly style="margin:0; width:100%; background:var(--bg-hover); color:var(--text-muted);">
                    </div>
                </div>

                <!-- Total Cost Display -->
                <div style="background: rgba(255, 64, 129, 0.1); padding: 1rem; border-radius: 12px; text-align: center; border: 1px solid rgba(255, 64, 129, 0.3);">
                    <div style="font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase;">Costo Total (Sale de Caja)</div>
                    <div id="buy-currency-total" style="font-size: 2rem; font-weight: 900; color: #ff4081;">$0.00</div>
                </div>

                <!-- Source Warning -->
                <div style="font-size: 0.85rem; color: var(--text-muted); display:flex; gap:0.5rem; align-items:center;">
                    <i class="ph ph-info" style="color:var(--primary);"></i>
                    <span>El dinero se descontará del efectivo en MN de la caja actual.</span>
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Confirmar',
        confirmButtonColor: '#ff4081',
        background: 'var(--bg-card)',
        color: 'var(--text-main)',
        didOpen: () => {
            window.updateBuyRate = () => {
                const type = document.getElementById('buy-currency-type').value;
                const rateInput = document.getElementById('buy-currency-rate');
                const rate = type === 'USD' ? (db.settings.currencyRates?.usd_buy || 500) : (db.settings.currencyRates?.eur_buy || 550);
                rateInput.value = rate;
                window.calculateBuyTotal();
            };
            window.calculateBuyTotal = () => {
                const amount = parseFloat(document.getElementById('buy-currency-amount').value) || 0;
                const rate = parseFloat(document.getElementById('buy-currency-rate').value) || 0;
                const total = amount * rate;
                document.getElementById('buy-currency-total').innerText = `$${total.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
            };
            // Init calc
            window.updateBuyRate();
        },
        preConfirm: () => {
            const type = document.getElementById('buy-currency-type').value;
            const amount = parseFloat(document.getElementById('buy-currency-amount').value);
            const rate = parseFloat(document.getElementById('buy-currency-rate').value);
            
            if (!amount || amount <= 0) {
                Swal.showValidationMessage('Ingresa una cantidad válida');
                return false;
            }
            return { type, amount, rate, total: amount * rate };
        }
    }).then((result) => {
        if (result.isConfirmed) {
            processCurrencyBuy(result.value);
        }
    });
};

window.processCurrencyBuy = async function(data) {
    const { type, amount, rate, total } = data;
    const businessId = selectedBusinessId || 'mch1';
    
    // Register as a negative sale (expense) but specifically tagged
    const saleData = {
        id: Date.now(),
        date: new Date().toISOString().replace('T', ' ').split('.')[0],
        timestamp: Date.now(),
        businessId: businessId,
        seller: currentUser ? currentUser.name : 'Sistema',
        sellerId: currentUser ? currentUser.id : 0,
        type: 'CURRENCY_BUY', // Special Type
        items: [],
        details: `Compra ${amount} ${type} @ ${rate}`,
        total: -total, // Deduct MN cost from daily total
        currencyBought: { type, amount, rate }, // Store details for closure report
        payment: { cash: -total, transfer: 0, currency: 'mn' }, // Deduct from MN Cash
        status: 'registered',
        sessionId: (typeof window.currentSessionStartTime !== 'undefined' ? window.currentSessionStartTime : Date.now())
    };

    // Update global balance if exists (optional real-time sync)
    if (typeof window.actualizarSaldo === 'function') {
        window.actualizarSaldo('mn', -total);
        // Note: We don't add the bought currency to the "Business Fund" yet. 
        // It physically sits in the drawer until closure.
    }

    db.sales.unshift(saleData);
    await window.saveData();
    if (typeof renderTodaySalesList === 'function') renderTodaySalesList();
    showToast(`Compra registrada: ${amount} ${type}`, "success");
};

/* --- END OF DAY CLOSURE WORKFLOW (REFACTORED) --- */

window.confirmCloseDay = async function () {
    const today = new Date().toISOString().split('T')[0];
    // Filter sales for today AND current business
    const todaySales = db.sales.filter(s => s.date.startsWith(today) && s.businessId === (selectedBusinessId || 'mch1'));

    // 1. Check Pending Sales
    const pendingSales = todaySales.filter(s => s.status === 'saved');
    if (pendingSales.length > 0) {
        Swal.fire('⚠️ Pendientes', 'Hay ventas guardadas. Elimínalas o complétalas antes de cerrar.', 'warning');
        return;
    }

    // 2. Calculate Financials
    // A. Sales (MN Income)
    const incomeSales = todaySales
        .filter(s => (!s.type || s.type === 'SALE') && s.status === 'registered')
        .reduce((sum, s) => sum + s.total, 0);

    // B. Expenses (Money Out)
    const expensesTotal = todaySales
        .filter(s => s.type === 'EXPENSE' || s.type === 'MERMA' || s.type === 'RETURN')
        .reduce((sum, s) => sum + Math.abs(s.total), 0); // s.total is negative, so abs

    // C. Currency Purchases (Money Out for Investment)
    const currencyBuys = todaySales.filter(s => s.type === 'CURRENCY_BUY');
    const currencyCostMN = currencyBuys.reduce((sum, s) => sum + Math.abs(s.total), 0);
    
    // D. Currencies Acquired (To Deliver)
    const boughtUSD = currencyBuys.filter(s => s.currencyBought?.type === 'USD').reduce((sum, s) => sum + (s.currencyBought?.amount || 0), 0);
    const boughtEUR = currencyBuys.filter(s => s.currencyBought?.type === 'EUR').reduce((sum, s) => sum + (s.currencyBought?.amount || 0), 0);

    // E. Net Cash (MN) Expected in Drawer
    // Logic: Sales - Expenses - CurrencyCost = Net Cash
    const netCashExpected = incomeSales - expensesTotal - currencyCostMN;

    // F. Net Transfer
    // Assuming some sales might be transfer. Let's scan payments.
    let cashInHandMN = 0;
    let transferTotal = 0;

    todaySales.forEach(s => {
        if (s.status === 'registered') {
            if (s.payment?.cash) cashInHandMN += s.payment.cash;
            if (s.payment?.transfer) transferTotal += s.payment.transfer;
        }
    });
    // Note: s.payment.cash is already negative for expenses/buys, so simple sum works.
    
    // UI Construction
    const htmlContent = `
        <div style="text-align:left; font-family:system-ui;">
            
            <!-- TOP STATS -->
            <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:0.5rem; margin-bottom:1.5rem;">
                <div style="background:rgba(16, 185, 129, 0.1); padding:0.8rem; border-radius:8px; text-align:center;">
                    <div style="font-size:0.7rem; color:var(--success); font-weight:bold;">VENTAS BRUTAS</div>
                    <div style="font-size:1.1rem; font-weight:900; color:#fff;">$${incomeSales.toLocaleString()}</div>
                </div>
                <div style="background:rgba(239, 68, 68, 0.1); padding:0.8rem; border-radius:8px; text-align:center;">
                    <div style="font-size:0.7rem; color:var(--danger); font-weight:bold;">GASTOS/SALIDAS</div>
                    <div style="font-size:1.1rem; font-weight:900; color:#fff;">$${(expensesTotal + currencyCostMN).toLocaleString()}</div>
                </div>
                <div style="background:rgba(59, 130, 246, 0.1); padding:0.8rem; border-radius:8px; text-align:center; border:1px solid var(--primary);">
                    <div style="font-size:0.7rem; color:var(--primary); font-weight:bold;">EFECTIVO A ENTREGAR</div>
                    <div style="font-size:1.3rem; font-weight:900; color:#fff;">$${cashInHandMN.toLocaleString()}</div>
                </div>
            </div>

            <!-- CURRENCY DELIVERY SECTION -->
            ${(boughtUSD > 0 || boughtEUR > 0) ? `
                <div style="background:var(--bg-dark); padding:1rem; border-radius:12px; margin-bottom:1.5rem; border:1px solid #85bb65;">
                    <div style="font-size:0.85rem; font-weight:bold; color:#85bb65; margin-bottom:0.5rem; display:flex; align-items:center; gap:0.5rem;">
                        <i class="ph ph-money"></i> DIVISAS A ENTREGAR
                    </div>
                    <div style="display:flex; gap:1rem;">
                        ${boughtUSD > 0 ? `<div style="flex:1; background:rgba(133, 187, 101, 0.1); padding:0.5rem; border-radius:6px; text-align:center; font-weight:bold;">${boughtUSD} USD</div>` : ''}
                        ${boughtEUR > 0 ? `<div style="flex:1; background:rgba(91, 120, 255, 0.1); padding:0.5rem; border-radius:6px; text-align:center; font-weight:bold;">${boughtEUR} EUR</div>` : ''}
                    </div>
                </div>
            ` : ''}

            <!-- CASH COUNT (ARQUEO) -->
            <div style="background:var(--bg-dark); padding:1rem; border-radius:12px; border:1px solid var(--border);">
                <div style="margin-bottom:1rem; font-weight:bold; font-size:0.9rem; color:var(--text-muted);">ARQUEO DE CAJA (Lo que tienes real)</div>
                
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem; align-items:center; margin-bottom:0.5rem;">
                    <label>Efectivo MN</label>
                    <input type="number" id="close-real-mn" class="swal2-input" placeholder="${cashInHandMN}" style="margin:0; height:2.5rem;">
                </div>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem; align-items:center;">
                    <label>Transferencia</label>
                    <input type="number" id="close-real-transfer" class="swal2-input" placeholder="${transferTotal}" style="margin:0; height:2.5rem;">
                </div>
            </div>

        </div>
    `;

    Swal.fire({
        title: 'Cierre de Turno',
        html: htmlContent,
        width: '500px',
        showCancelButton: true,
        confirmButtonText: 'Confirmar Cierre',
        confirmButtonColor: 'var(--primary)',
        background: 'var(--bg-card)',
        color: 'var(--text-main)',
        preConfirm: () => {
            const realMN = parseFloat(document.getElementById('close-real-mn').value) || 0;
            const realTransfer = parseFloat(document.getElementById('close-real-transfer').value) || 0;
            return { realMN, realTransfer, expectedMN: cashInHandMN, expectedTransfer: transferTotal };
        }
    }).then(async (result) => {
        if (result.isConfirmed) {
            const data = result.value;
            // SAVE CLOSURE
            const closureReport = {
                id: Date.now(),
                date: new Date().toISOString(),
                businessId: selectedBusinessId || 'mch1',
                seller: currentUser.name,
                financials: {
                    sales: incomeSales,
                    expenses: expensesTotal,
                    currencyCost: currencyCostMN,
                    netCash: cashInHandMN,
                    transfers: transferTotal
                },
                currencies: { usd: boughtUSD, eur: boughtEUR },
                audit: {
                    expectedMN: data.expectedMN,
                    realMN: data.realMN,
                    diffMN: data.realMN - data.expectedMN
                },
                type: 'daily_closure_report', // Special type to distinguish in history
                status: 'closed'
            };

            db.sales.unshift(closureReport);
            
            // AUTOMATIC ADMIN CASH UPDATE (Integration with Cash Control Module)
            // Transfer logic: The Seller gives cash to Admin.
            // Admin Cash Control: +MN (Net Cash), +USD (Bought), +EUR (Bought)
            // We update the Admin Ledger automatically pending confirmation? 
            // Or directly? Let's do direct update to "Caja Fuerte" for seamless flow.
            
            if (!db.adminCashControl) db.adminCashControl = { balances: { mn: { current: 0 }, usd: { current: 0 }, eur: { current: 0 } }, transactions: [] };
            
            // 1. Incomes to Admin
            if (cashInHandMN > 0) {
                db.adminCashControl.balances.mn.current = (db.adminCashControl.balances.mn.current || 0) + cashInHandMN;
                db.adminCashControl.transactions.unshift({
                    date: new Date().toISOString(),
                    type: 'INCOME_CLOSURE',
                    amount: cashInHandMN,
                    currency: 'mn',
                    desc: `Cierre Caja ${currentUser.name}`
                });
            }
            if (boughtUSD > 0) {
                db.adminCashControl.balances.usd.current = (db.adminCashControl.balances.usd.current || 0) + boughtUSD;
                db.adminCashControl.transactions.unshift({ date: new Date().toISOString(), type: 'INCOME_CURRENCY', amount: boughtUSD, currency: 'usd', desc: `Divisa POS ${currentUser.name}` });
            }
            if (boughtEUR > 0) {
                db.adminCashControl.balances.eur.current = (db.adminCashControl.balances.eur.current || 0) + boughtEUR;
                db.adminCashControl.transactions.unshift({ date: new Date().toISOString(), type: 'INCOME_CURRENCY', amount: boughtEUR, currency: 'eur', desc: `Divisa POS ${currentUser.name}` });
            }

            await window.saveData();
            
            Swal.fire('¡Cierre Exitoso!', 'El turno se ha cerrado y los fondos se han transferido a la Caja Admin.', 'success').then(() => {
                location.reload(); // Reset state
            });
        }
    });
};