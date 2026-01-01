// Global Error Handler
window.onerror = function (msg, url, line, col, error) {
    alert("Error: " + msg + "\nLine: " + line + "\nCol: " + col);
    console.error(error);
    return false;
};

// Data Store (Simulated Local Database)
let db = {
    businesses: [],
    products: [],
    inventory: [],
    waste: [],
    sales: [],
    users: [],
    logs: [],
    extraMovements: [],
    purchases: [],
    employees: [],
    attendance: [],
    loans: [],
    commissions: [],
    notifications: [],
    settings: {
        theme: 'dark',
        allowAdminTransfer: false,
        allowAdminDelete: false,
        allowAdminEditInventory: false,
        allowAdminEditSales: false
    }
};

let currentUser = null;
let currentView = 'dashboard';
let selectedBusinessId = null; // null means 'Global'

// --- LOGGING ---
function logAction(action, details = '') {
    if (!db.logs) db.logs = [];
    db.logs.unshift({
        id: Date.now(),
        date: new Date().toLocaleString(),
        user: currentUser ? currentUser.name : 'System',
        action,
        details
    });
}

function addLog(details, action = 'info') {
    logAction(action, details);
}

// --- PERSISTENCE ---
async function loadData() {
    try {
        let value = await localforage.getItem('bizControlData');
        if (!value) {
            const raw = localStorage.getItem('bizControlData');
            if (raw) value = JSON.parse(raw);
        }

        if (value) {
            db = value;
            // Migrations & Integrity
            if (db.businesses) {
                const idMap = { '1': 'alm', '2': 'mch1', '3': 'mch2' };

                // 1. Migrate Business IDs
                db.businesses.forEach(b => {
                    if (idMap[String(b.id)]) b.id = idMap[String(b.id)];
                });

                // 2. Deduplicate Businesses
                db.businesses = db.businesses.filter((b, index, self) =>
                    index === self.findIndex((t) => String(t.id) === String(b.id))
                );

                // 3. Migrate Related Collections
                ['sales', 'inventory', 'waste', 'purchases', 'extraMovements', 'commissions'].forEach(coll => {
                    if (db[coll] && Array.isArray(db[coll])) {
                        db[coll].forEach(item => {
                            if (item.businessId && idMap[String(item.businessId)]) {
                                item.businessId = idMap[String(item.businessId)];
                            }
                        });
                    }
                });
            }
            if (!db.sales && db.transactions) {
                db.sales = db.transactions;
                delete db.transactions;
            }
            ['businesses', 'products', 'inventory', 'sales', 'waste', 'logs', 'extraMovements', 'purchases', 'employees', 'attendance', 'loans', 'commissions', 'notifications'].forEach(key => {
                if (!db[key]) db[key] = [];
            });
            if (!db.settings) db.settings = { theme: 'dark', allowAdminTransfer: false, allowAdminDelete: false, allowAdminEditInventory: false, allowAdminEditSales: false };

            // Sync Businesses (Standardized IDs as Strings)
            const expectedBusinesses = [
                { id: 'alm', name: 'Almacén MCH', code: 'ALM', color: '#58a6ff', icon: 'ph-warehouse' },
                { id: 'mch1', name: 'MCH 1', code: 'MCH1', color: '#3fb950', icon: 'ph-storefront' },
                { id: 'mch2', name: 'MCH 2', code: 'MCH2', color: '#d29922', icon: 'ph-shopping-bag' }
            ];
            expectedBusinesses.forEach(eb => {
                const existing = db.businesses.find(b => String(b.id) === String(eb.id));
                if (!existing) db.businesses.push(eb);
                else {
                    existing.name = eb.name;
                    existing.code = eb.code;
                    existing.icon = eb.icon;
                    existing.color = eb.color;
                }
            });

            // Ensure Users
            if (db.users.length === 0 || !db.users.find(u => u.role === 'admin')) {
                db.users = [
                    { id: 1, name: 'Boss', role: 'owner', pin: '1234', email: 'dueño@mch.com' },
                    { id: 2, name: 'Vendedor 1', role: 'seller', pin: '0000', email: 'vendedor1@mch.com' },
                    { id: 3, name: 'Administrador', role: 'admin', pin: '1111', email: 'admin@mch.com' }
                ];
            }
            if (db.sales && Array.isArray(db.sales)) {
                db.sales.forEach(s => {
                    if (s.total === undefined || s.total === null) {
                        if (s.items && Array.isArray(s.items)) {
                            s.total = s.items.reduce((sum, i) => sum + (i.price * i.qty), 0);
                        } else {
                            s.total = 0;
                        }
                    }
                    if (!s.payment) {
                        // Legacy sale might not have payment object
                        s.payment = { cash: s.total || 0, transfer: 0 };
                    } else {
                        if (s.payment.cash === undefined) s.payment.cash = 0;
                        if (s.payment.transfer === undefined) s.payment.transfer = 0;
                    }
                });
            }

            console.log("Data loaded successfully.");
            applyTheme(db.settings.theme);

            // Auto-import if empty
            if (typeof REAL_INVENTORY !== 'undefined' && db.products.length < 10) {
                console.log("Auto-importing initial inventory...");
                await importRealData();
            }
        } else {
            // Initial seed if no data
            await initializeDatabase();
        }
    } catch (error) {
        console.error('Error loading data:', error);
        await initializeDatabase();
    }
}

async function initializeDatabase() {
    db.businesses = [
        { id: 'alm', name: 'Almacén MCH', code: 'ALM', icon: 'ph-warehouse', color: '#58a6ff' },
        { id: 'mch1', name: 'MCH 1', code: 'MCH1', icon: 'ph-storefront', color: '#3fb950' },
        { id: 'mch2', name: 'MCH 2', code: 'MCH2', icon: 'ph-shopping-bag', color: '#d29922' }
    ];
    db.users = [
        { id: 1, name: 'Boss', role: 'owner', pin: '1234', email: 'dueño@mch.com' },
        { id: 2, name: 'Vendedor 1', role: 'seller', pin: '0000', email: 'vendedor1@mch.com' },
        { id: 3, name: 'Administrador', role: 'admin', pin: '1111', email: 'admin@mch.com' }
    ];
    await saveData();
}

async function saveData() {
    try {
        if (typeof localforage !== 'undefined') {
            await localforage.setItem('bizControlData', db);
        }
    } catch (e) {
        console.warn("LocalForage save failed, fallback to localStorage:", e);
    }
    try {
        localStorage.setItem('bizControlData', JSON.stringify(db));
    } catch (e) {
        console.error("Critical: Failed to save to localStorage", e);
    }
}

async function importRealData() {
    if (typeof REAL_INVENTORY === 'undefined') return;

    // Clear existing to avoid duplicates during import
    db.products = [];
    db.inventory = [];

    const productMap = new Map();
    let nextProductId = 1000;

    const processConfig = [
        { data: REAL_INVENTORY.almacen || REAL_INVENTORY.alm, id: 'alm', name: "Almacen" },
        { data: REAL_INVENTORY.mch1, id: 'mch1', name: "MCH 1" },
        { data: REAL_INVENTORY.mch2, id: 'mch2', name: "MCH 2" }
    ];

    for (const imp of processConfig) {
        if (!imp.data) continue;

        const lines = imp.data;
        lines.forEach(row => {
            const name = row['Nombre']?.trim();
            if (!name) return;

            const cost = parseFloat(row['Costo']) || 0;
            const price = parseFloat(row['Precio']) || 0;
            const qty = parseFloat(row['Cantidad']) || 0;
            const code = row['Clave']?.trim() || '';
            const category = row['Categoría']?.trim() || 'General';

            let product = productMap.get(name);
            if (!product) {
                product = {
                    id: nextProductId++,
                    name: name,
                    alias: code,
                    cost: cost,
                    price: price,
                    category: category,
                    image: ''
                };
                productMap.set(name, product);
                db.products.push(product);
            }

            if (qty > 0) {
                db.inventory.push({
                    businessId: imp.id,
                    productId: product.id,
                    quantity: qty
                });
            }
        });
        addLog(`Importado: ${imp.name}`, "success");
    }
    await saveData();
}

async function importInventoryManual() {
    if (confirm("¿Borrar datos actuales e importar desde CSV?")) {
        await importRealData();
        location.reload();
    }
}

// --- ROUTER & NAVIGATION ---
function navigateTo(viewName) {
    if (!currentUser && viewName !== 'login') {
        navigateTo('login');
        return;
    }
    currentView = viewName;
    renderSidebar(viewName);
    const content = document.getElementById('content-area');
    content.innerHTML = '';

    switch (viewName) {
        case 'login': renderLogin(content); break;
        case 'dashboard': renderDashboard(content); break;
        case 'ventas': renderVentas(content); break;
        case 'pos': renderPOS(content); break;
        case 'inventory': renderInventory(content); break;
        case 'ingresos-gastos': renderIngresosGastos(content); break;
        case 'compras': renderCompras(content); break;
        case 'employees': renderEmployees(content); break;
        case 'financials': renderFinancials(content); break;
        case 'reportes': renderReportes(content); break;
        case 'settings': renderSettings(content); break;
        case 'logs': renderLogs(content); break;
        case 'cash-control': renderCashControl(content); break;
        case 'transfer': renderTransfer(content); break;
        case 'mermas': renderMermas(content); break;
        default: renderDashboard(content);
    }
}

function getPermissions(role) {
    const ownerPerms = ['dashboard', 'pos', 'ventas', 'ingresos-gastos', 'compras', 'inventory', 'cash-control', 'reportes', 'employees', 'financials', 'transfer', 'settings', 'logs', 'mermas'];
    const adminPerms = ['dashboard', 'pos', 'ventas', 'inventory', 'reportes', 'settings', 'mermas'];
    const sellerPerms = ['pos', 'ventas', 'inventory', 'mermas'];

    if (role === 'owner') return ownerPerms;
    if (role === 'admin') return adminPerms;
    return sellerPerms;
}

// --- CORE UI COMPONENTS ---
function renderSidebar(activeView) {
    const sidebar = document.querySelector('.sidebar');
    const topBar = document.querySelector('.top-bar');

    if (!currentUser) {
        sidebar.style.display = 'none';
        topBar.style.display = 'none';
        return;
    }

    sidebar.style.display = 'flex';
    topBar.style.display = 'flex';

    // Notifications visibility
    const notifBell = document.getElementById('notification-bell');
    if (notifBell) {
        notifBell.style.display = (currentUser.role === 'owner' || currentUser.role === 'admin') ? 'block' : 'none';
        const pendingNotifs = db.notifications.filter(n => n.status === 'pending').length;
        const notifCount = document.getElementById('notif-count');
        if (notifCount) {
            notifCount.innerText = pendingNotifs;
            notifCount.style.display = pendingNotifs > 0 ? 'block' : 'none';
        }
    }

    document.querySelector('.user-profile span').innerText = currentUser.name;
    document.querySelector('.user-profile .avatar').innerText = currentUser.name.charAt(0);

    // Business Selector
    const businessOptions = [
        ...(currentUser.role === 'owner' ? [{ id: null, name: 'VISTA GLOBAL' }] : []),
        ...db.businesses
    ];

    const selectorHtml = `
        <div class="business-selector-container" style="margin: 0 1rem 1.5rem; position: relative;">
            <select id="sidebar-business-select" onchange="changeBusinessContext(this.value)" 
                    style="width: 100%; padding: 0.75rem 1rem; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; color: white; -webkit-appearance: none;">
                ${businessOptions.map(b => `<option value="${b.id === null ? 'global' : b.id}" ${String(selectedBusinessId) === String(b.id) ? 'selected' : ''}>${b.name}</option>`).join('')}
            </select>
            <i class="ph ph-caret-down" style="position: absolute; right: 1rem; top: 50%; transform: translateY(-50%); pointer-events: none; color: var(--text-muted);"></i>
        </div>
    `;

    let navItems = [
        { id: 'dashboard', icon: 'ph-chart-pie', label: 'Dashboard' },
        { id: 'pos', icon: 'ph-calculator', label: 'Punto de Venta' },
        { id: 'ventas', icon: 'ph-receipt', label: 'Ventas' },
        { id: 'inventory', icon: 'ph-warehouse', label: 'Inventario' },
        { id: 'transfer', icon: 'ph-arrows-left-right', label: 'Transferencias' },
        { id: 'mermas', icon: 'ph-warning-circle', label: 'Mermas' },
        { id: 'reportes', icon: 'ph-chart-bar', label: 'Reportes' },
        { id: 'settings', icon: 'ph-gear', label: 'Configuración' },
        { id: 'logs', icon: 'ph-scroll', label: 'Logs' }
    ];

    // Lógica específica para Almacén (ID 'alm')
    if (String(selectedBusinessId) === 'alm') {
        navItems = navItems.filter(i => i.id !== 'pos' && i.id !== 'ventas');
        const transferItem = navItems.find(i => i.id === 'transfer');
        if (transferItem) transferItem.label = 'Abastecer Kioscos';
    }

    const perms = getPermissions(currentUser.role);
    const navHtml = navItems.filter(i => perms.includes(i.id)).map(i => `
        <li class="${activeView === i.id ? 'active' : ''}" onclick="navigateTo('${i.id}')">
            <i class="ph ${i.icon}"></i>
            <span>${i.label}</span>
        </li>
    `).join('');

    sidebar.querySelector('.nav-links').innerHTML = `
        ${selectorHtml}
        ${navHtml}
        <li style="margin-top: auto; border-top: 1px solid var(--border); color: var(--danger);" onclick="logout()">
            <i class="ph ph-sign-out"></i>
            <span>Cerrar Sesión</span>
        </li>
    `;
}

function changeBusinessContext(val) {
    selectedBusinessId = (val === 'global') ? null : String(val);
    const business = db.businesses.find(b => String(b.id) === String(selectedBusinessId));
    addLog(`Cambio de contexto: ${business ? business.name : 'Global'}`);
    navigateTo(currentView);
}

function logout() {
    currentUser = null;
    selectedBusinessId = null;
    navigateTo('login');
}

function updateTitle(text) {
    document.getElementById('page-title').innerText = text;
}

// --- VIEWS ---
function renderLogin(container) {
    const users = db.users;
    const userCards = users.map(u => `
        <div class="login-card user-login-card" style="width: 155px; cursor: pointer; text-align: center; padding: 1.5rem;" 
             onclick="selectUserLogin(${u.id})">
            <div class="avatar" style="width: 70px; height: 70px; margin: 0 auto 1.25rem; font-size: 1.6rem; background: ${u.role === 'owner' ? 'linear-gradient(135deg, var(--primary), #3b82f6)' : u.role === 'admin' ? 'linear-gradient(135deg, var(--warning), #f59e0b)' : 'linear-gradient(135deg, var(--success), #10b981)'}; box-shadow: 0 4px 12px rgba(0,0,0,0.2);">
                ${u.name.charAt(0)}
            </div>
            <div style="font-weight: 600; margin-bottom: 0.35rem; color: #fff;">${u.name}</div>
            <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05rem;">
                ${u.role === 'owner' ? 'Dueño' : u.role === 'admin' ? 'Administrador' : 'Vendedor'}
            </div>
        </div>
    `).join('');

    container.innerHTML = `
        <div class="fade-in" style="display: flex; flex-direction: column; justify-content: center; align-items: center; min-height: 100vh; gap: 2.5rem; background: radial-gradient(circle at center, #1a1e23 0%, #0f1115 100%);">
            <div style="text-align: center;">
                <div style="background: rgba(59, 130, 246, 0.1); width: 80px; height: 80px; border-radius: 20px; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem; border: 1px solid rgba(59, 130, 246, 0.2);">
                    <i class="ph ph-shield-check" style="font-size: 3rem; color: var(--primary);"></i>
                </div>
                <h1 style="margin: 0; font-size: 2.5rem; letter-spacing: -0.05rem; background: linear-gradient(to right, #fff, #8b949e); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">MCH Control</h1>
                <p style="color: var(--text-muted); margin-top: 0.75rem; font-size: 1.1rem;">Panel de Gestión Empresarial</p>
            </div>
            
            <div style="display: flex; gap: 1.5rem; flex-wrap: wrap; justify-content: center;">
                ${userCards}
            </div>

            <div class="login-pin-card" style="max-width: 400px; width: 90%; text-align: center; margin-top: 1rem;">
                <p style="margin-bottom: 1.25rem; color: var(--text-muted); font-size: 0.95rem;">Acceso rápido con PIN de seguridad:</p>
                <form onsubmit="handleLogin(event)">
                    <div style="display: flex; gap: 0.75rem;">
                        <input type="password" name="pin" placeholder="••••" class="input-field" 
                               style="text-align: center; font-size: 1.5rem; letter-spacing: 0.5rem;" maxlength="4">
                        <button type="submit" class="btn-primary" style="padding: 0 1.5rem;"><i class="ph ph-arrow-right" style="font-size: 1.5rem;"></i></button>
                    </div>
                </form>
            </div>
        </div>
    `;
    updateTitle('Iniciar Sesión');
}

function selectUserLogin(userId) {
    const user = db.users.find(u => u.id === userId);
    if (user) {
        currentUser = user;
        // Default business context: MCH 1 ('mch1') for non-owners, Global (null) for Owner
        selectedBusinessId = (user.role === 'owner') ? null : 'mch1';
        const firstView = getPermissions(user.role)[0];
        navigateTo(firstView);
        addLog(`Sesión iniciada: ${user.name}`);
    }
}

function handleLogin(e) {
    e.preventDefault();
    const pin = new FormData(e.target).get('pin');
    // Allow any PIN or empty for testing
    const user = db.users.find(u => u.pin === pin) || db.users[0];

    currentUser = user;
    // Default business context: MCH 1 ('mch1') for non-owners, Global (null) for Owner
    selectedBusinessId = (user.role === 'owner') ? null : 'mch1';
    const firstView = getPermissions(user.role)[0];
    navigateTo(firstView);
    addLog(`Sesión iniciada: ${user.name}`);
}

function renderDashboard(container) {
    if (!container) {
        if (currentView === 'dashboard') container = document.getElementById('content-area');
        else return;
    }
    if (!container) return;

    let waste = db.waste || [];
    let sales = db.sales || [];

    if (selectedBusinessId) {
        sales = sales.filter(s => String(s.businessId) === String(selectedBusinessId));
        waste = waste.filter(w => String(w.businessId) === String(selectedBusinessId));
    }

    const totalRevenue = sales.reduce((sum, s) => sum + (s.total || 0), 0);
    const wasteCost = waste.reduce((sum, w) => {
        const p = db.products.find(prod => prod.id === w.productId);
        return sum + (p ? p.cost * w.quantity : 0);
    }, 0);

    const balance = totalRevenue - wasteCost;

    const summaryCards = [
        { label: 'Ventas Totales', value: `$${totalRevenue.toFixed(2)}`, color: 'text-success' },
        { label: 'Mermas (Costo)', value: `$${wasteCost.toFixed(2)}`, color: 'text-danger' },
        { label: 'Resultado', value: `$${balance.toFixed(2)}`, color: '' }
    ];

    container.innerHTML = `
        <div class="fade-in">
            <div class="grid-3">
                ${summaryCards.map(c => `
                    <div class="card stat-card">
                        <span class="stat-label">${c.label}</span>
                        <span class="stat-value ${c.color}">${c.value}</span>
                    </div>
                `).join('')}
            </div>
            ${!selectedBusinessId ? `
                <h3 style="margin-top: 2rem; margin-bottom: 1rem;">Ventas por Negocio</h3>
                <div class="grid-3">
                    ${db.businesses.map(b => {
        const bSales = db.sales.filter(s => String(s.businessId) === String(b.id)).reduce((sum, s) => sum + s.total, 0);
        return `
                            <div class="card stat-card" style="border-left: 4px solid ${b.color};">
                                <span class="stat-label">${b.name}</span>
                                <span class="stat-value">$${bSales.toFixed(2)}</span>
                            </div>
                        `;
    }).join('')}
                </div>
            ` : ''}
            <div class="card" style="margin-top: 2rem;">
                <h3>Bienvenido de nuevo, ${currentUser.name}</h3>
                <p style="color: var(--text-muted);">Estás viendo el dashboard de: <strong>${selectedBusinessId ? db.businesses.find(b => b.id === selectedBusinessId).name : 'VISTA GLOBAL'}</strong></p>
                <div style="margin-top: 1.5rem; display: flex; gap: 1rem;">
                    <button class="btn-primary" onclick="navigateTo('pos')"><i class="ph ph-plus"></i> Nueva Venta</button>
                    <button class="btn-secondary" onclick="generateMockSales()"><i class="ph ph-magic-wand"></i> Generar Mock Data</button>
                </div>
            </div>
        </div>
    `;
    updateTitle(selectedBusinessId ? `Dashboard: ${db.businesses.find(b => b.id === selectedBusinessId).name}` : 'Dashboard Global');
}

async function generateMockSales() {
    const products = db.products;
    const businesses = db.businesses;
    const sellers = db.users.filter(u => u.role === 'seller');

    if (products.length === 0) {
        alert("No hay productos. Importa datos primero.");
        return;
    }

    const count = 20;
    for (let i = 0; i < count; i++) {
        const product = products[Math.floor(Math.random() * products.length)];
        const business = businesses[Math.floor(Math.random() * businesses.length)];
        const seller = sellers[Math.floor(Math.random() * sellers.length)] || currentUser;
        const qty = Math.floor(Math.random() * 3) + 1;
        const total = product.price * qty;

        const sale = {
            id: Date.now() + i,
            date: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toLocaleString(),
            businessId: business.id,
            seller: seller.name,
            total: total,
            items: [{ productId: product.id, name: product.name, qty, price: product.price }]
        };

        db.sales.unshift(sale);

        // Deduct inventory
        const inv = db.inventory.find(inv => String(inv.businessId) === String(business.id) && inv.productId === product.id);
        if (inv) inv.quantity = Math.max(0, inv.quantity - qty);
    }

    await saveData();
    alert(`Generadas ${count} ventas ficticias.`);
    navigateTo('dashboard');
}

function renderVentas(container) {
    let filteredSales = db.sales || [];
    if (selectedBusinessId) {
        filteredSales = filteredSales.filter(s => String(s.businessId) === String(selectedBusinessId));
    }

    const rows = filteredSales.map(s => {
        const isClosure = s.type === 'daily_closure';
        const displayTotal = isClosure ? s.totalSales : s.total;
        const displayProducts = isClosure ? '<span style="color:var(--primary); font-weight:600;"><i class="ph ph-lock-key"></i> Arqueo de Caja</span>' : (s.items ? s.items.length + ' productos' : 'N/A');

        return `
        <tr style="border-bottom: 1px solid var(--border); cursor: pointer; ${isClosure ? 'background: rgba(88, 166, 255, 0.03);' : ''}" onclick="showSaleDetail(${s.id})">
            <td style="padding: 1rem;">
                <div style="font-weight: 500;">${s.date}</div>
                ${!isClosure ? `<div style="font-size: 0.8rem; color: var(--text-muted);">${s.openTime || '--:--'} - ${s.closeTime || '--:--'}</div>` : ''}
            </td>
            <td style="padding: 1rem;">${db.businesses.find(b => String(b.id) === String(s.businessId))?.name || 'N/A'}</td>
            <td style="padding: 1rem;">${s.seller || 'Sistema'}</td>
            <td style="padding: 1rem;">
                <span class="badge ${s.status === 'closed' ? 'badge-success' : 'badge-warning'}">
                    ${s.status === 'closed' ? 'Cerrada' : (s.status === 'pending' ? 'Pendiente' : (s.status === 'registered' ? 'Registrada' : 'Abierta'))}
                </span>
            </td>
            <td style="padding: 1rem; font-weight: bold; text-align: right;">$${displayTotal.toFixed(2)}</td>
            <td style="padding: 1rem; text-align: right;" onclick="event.stopPropagation()">
                <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
                    ${(() => {
                const isToday = s.date.startsWith(new Date().toISOString().split('T')[0]);
                if (currentUser.role === 'seller') {
                    return (isToday && !isClosure) ? `<button class="btn-icon" onclick="editSale(${s.id})" title="Devolución/Editar"><i class="ph ph-pencil"></i></button>` : '';
                }
                return `
                            ${!isClosure ? `<button class="btn-icon" onclick="editSale(${s.id})" title="Editar"><i class="ph ph-pencil"></i></button>` : ''}
                            <button class="btn-icon" style="color: var(--danger);" onclick="deleteSale(${s.id})" title="Eliminar"><i class="ph ph-trash"></i></button>
                        `;
            })()}
                </div>
            </td>
        </tr>
        `;
    }).join('');

    container.innerHTML = `
        <div class="fade-in">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <p style="color: var(--text-muted);">Haz clic en una venta para ver el detalle completo, desgloses y ajustes.</p>
                <div style="display: flex; gap: 1rem;">
                    <button class="btn-primary" onclick="navigateTo('pos')"><i class="ph ph-plus"></i> Nueva Venta</button>
                </div>
            </div>
            <div class="card" style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="text-align: left; background: var(--bg-dark); color: var(--text-muted);">
                            <th style="padding: 1rem;">Fecha y Horario</th>
                            <th style="padding: 1rem;">Negocio</th>
                            <th style="padding: 1rem;">Vendedor</th>
                            <th style="padding: 1rem;">Estado</th>
                            <th style="padding: 1rem; text-align: right;">Total</th>
                            <th style="padding: 1rem; text-align: right;"></th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows || '<tr><td colspan="6" style="padding: 3rem; text-align: center; color: var(--text-muted);">No hay ventas registradas</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    updateTitle('Historial de Ventas');
}

function renderInventory(container) {
    let items = [];
    if (selectedBusinessId) {
        items = db.products.map(p => {
            const inv = db.inventory.find(i => i.productId === p.id && String(i.businessId) === String(selectedBusinessId));
            return { ...p, stock: inv ? inv.quantity : 0 };
        });
    } else {
        items = db.products.map(p => {
            const totalStock = db.inventory.filter(i => i.productId === p.id).reduce((sum, i) => sum + i.quantity, 0);
            return { ...p, stock: totalStock };
        });
    }

    if (currentUser.role === 'seller') {
        items = items.filter(i => i.stock > 0);
    }

    const rows = items.map(i => `
        <tr style="border-bottom: 1px solid var(--border);">
            <td style="padding: 1rem; width: 60px;">
                <div style="width: 50px; height: 50px; border-radius: 4px; overflow: hidden; background: var(--bg-dark); display: flex; align-items: center; justify-content: center; cursor: pointer; border: 1px solid var(--border);"
                     onclick="handleInventoryImageClick(${i.id})" title="Haga clic para cambiar imagen">
                    ${i.image ? `<img src="${i.image}" style="width: 100%; height: 100%; object-fit: cover;">` : `<i class="ph ph-image" style="font-size: 1.5rem; color: var(--text-muted);"></i>`}
                </div>
                <input type="file" id="inv-img-${i.id}" style="display:none" accept="image/*" onchange="handleInventoryImageUpload(${i.id}, this)">
            </td>
            <td style="padding: 1rem;">
                <strong>${i.name}</strong><br>
                <small style="color: var(--text-muted)">${i.category || 'Sin categoría'}</small>
            </td>
            <td style="padding: 1rem;">
                <div style="display:flex; align-items:center; gap:0.5rem;">
                    <span class="stat-value" style="font-size:1.1rem; color: ${i.stock <= 0 ? 'var(--danger)' : i.stock < 5 ? 'var(--warning)' : 'var(--success)'};">${i.stock}</span>
                    ${i.stock <= 0 ? '<span class="badge badge-danger" style="font-size:0.6rem;">AGOTADO</span>' : i.stock < 5 ? '<span class="badge badge-warning" style="font-size:0.6rem;">BAJO</span>' : ''}
                </div>
            </td>
            <td style="padding: 1rem;">$${i.cost.toFixed(2)}</td>
            <td style="padding: 1rem;">$${i.price.toFixed(2)}</td>
            <td style="padding: 1rem; text-align: right;">
                <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
                    ${currentUser.role !== 'seller' ? `<button class="btn-icon" onclick="showEditProductModal(${i.id})" title="Editar"><i class="ph ph-pencil"></i></button>` : ''}
                    ${selectedBusinessId ? `<button class="btn-ghost" onclick="showWasteModal(${i.id})"><i class="ph ph-warning-circle"></i> Merma</button>` : ''}
                </div>
            </td>
        </tr>
    `).join('');

    container.innerHTML = `
        <div class="fade-in">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
                <div style="display: flex; gap: 0.75rem;">
                    ${currentUser.role !== 'seller' ? `
                        <button class="btn-primary" onclick="showAddProductModal()"><i class="ph ph-plus"></i> Nuevo Producto</button>
                        <button class="btn-secondary" onclick="exportInventoryPDF()"><i class="ph ph-file-pdf"></i> PDF</button>
                        <button class="btn-secondary" onclick="exportInventoryCSV()"><i class="ph ph-file-csv"></i> Exportar CSV</button>
                        <label class="btn-secondary" style="cursor: pointer;">
                            <i class="ph ph-upload-simple"></i> Importar CSV
                            <input type="file" style="display:none" accept=".csv" onchange="importInventoryCSV(this)">
                        </label>
                    ` : ''}
                </div>
                ${(selectedBusinessId && currentUser.role !== 'seller') ? `<button class="btn-ghost" onclick="navigateTo('logs')"><i class="ph ph-list"></i> Ver Historial de Cambios</button>` : ''}
            </div>
            
            <div class="card" style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="text-align: left; background: var(--bg-dark); color: var(--text-muted);">
                            <th style="padding: 1rem;">Foto</th>
                            <th style="padding: 1rem;">Producto</th>
                            <th style="padding: 1rem;">Stock</th>
                            <th style="padding: 1rem;">Costo</th>
                            <th style="padding: 1rem;">Venta</th>
                            <th style="padding: 1rem; text-align: right;">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows || '<tr><td colspan="6" style="padding: 3rem; text-align: center; color: var(--text-muted);">No hay productos registrados</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    updateTitle(selectedBusinessId ? `Inventario: ${db.businesses.find(b => b.id === selectedBusinessId).name}` : 'Inventario Consolidado');
}

// POS State
let posCart = [];
let editingSaleId = null;
let currentPaymentMethod = 'cash'; // Default to cash

function renderMermas(container) {
    const wasteList = db.waste.filter(w => !selectedBusinessId || w.businessId === selectedBusinessId);

    const rows = wasteList.map(w => {
        const product = db.products.find(p => String(p.id) === String(w.productId));
        const business = db.businesses.find(b => String(b.id) === String(w.businessId));
        const statusBadge = w.status === 'approved'
            ? '<span class="badge badge-success">Aprobada</span>'
            : '<span class="badge badge-warning">Pendiente</span>';

        return `
            <tr style="border-bottom: 1px solid var(--border);">
                <td style="padding: 1rem;">${w.date}</td>
                <td style="padding: 1rem;">${business ? business.name : 'Unknown'}</td>
                <td style="padding: 1rem;">${product ? product.name : 'Unknown'}</td>
                <td style="padding: 1rem; color: var(--danger); font-weight: bold;">-${w.quantity}</td>
                <td style="padding: 1rem;">${statusBadge}</td>
                <td style="padding: 1rem;">${w.user || w.reportedBy}</td>
            </tr>
        `;
    }).reverse().join('');

    container.innerHTML = `
        <div class="fade-in">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <h2 style="margin: 0;">${selectedBusinessId ? `Mermas: ${db.businesses.find(b => String(b.id) === String(selectedBusinessId)).name}` : 'Mermas Globales'}</h2>
                <button class="btn btn-primary" onclick="showWasteModal()">
                    <i class="ph ph-plus"></i> Registrar Merma
                </button>
            </div>
            <div class="card" style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="text-align: left; background: var(--bg-dark); color: var(--text-muted);">
                            <th style="padding: 1rem;">Fecha</th>
                            <th style="padding: 1rem;">Sede</th>
                            <th style="padding: 1rem;">Producto</th>
                            <th style="padding: 1rem;">Cantidad</th>
                            <th style="padding: 1rem;">Estado</th>
                            <th style="padding: 1rem;">Registrado por</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows || '<tr><td colspan="6" style="padding: 3rem; text-align: center; color: var(--text-muted);">No hay mermas registradas</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function showWasteModal() {
    const businessId = selectedBusinessId || 'mch1';
    const inventory = db.inventory.filter(inv => String(inv.businessId) === String(businessId));
    const products = db.products.filter(p => inventory.some(inv => inv.productId === p.id));

    const productOptions = products.map(p => {
        const stock = inventory.find(inv => inv.productId === p.id)?.quantity || 0;
        return `<option value="${p.id}">${p.name} (Stock: ${stock})</option>`;
    }).join('');

    const modalHtml = `
        <div class="modal-content card" style="max-width: 500px;">
            <div class="modal-header">
                <h3>Registrar Merma</h3>
                <i class="ph ph-x" onclick="closeModal('waste-modal')" style="cursor: pointer;"></i>
            </div>
            <form id="waste-form" onsubmit="handleSaveWaste(event)">
                <div style="margin-bottom: 1.5rem;">
                    <label style="display: block; margin-bottom: 0.5rem; color: var(--text-muted);">Producto</label>
                    <select name="productId" required style="width: 100%; padding: 0.75rem; background: var(--bg-dark); border: 1px solid var(--border); border-radius: 8px; color: white;">
                        ${productOptions}
                    </select>
                </div>
                <div style="margin-bottom: 1.5rem;">
                    <label style="display: block; margin-bottom: 0.5rem; color: var(--text-muted);">Cantidad</label>
                    <input type="number" name="quantity" required min="0.1" step="0.1" style="width: 100%; padding: 0.75rem; background: var(--bg-dark); border: 1px solid var(--border); border-radius: 8px; color: white;">
                </div>
                <div style="margin-bottom: 1.5rem;">
                    <label style="display: block; margin-bottom: 0.5rem; color: var(--text-muted);">Motivo / Notas</label>
                    <textarea name="notes" placeholder="Ej: Rotura, Vencimiento..." style="width: 100%; padding: 0.75rem; background: var(--bg-dark); border: 1px solid var(--border); border-radius: 8px; color: white; min-height: 80px;"></textarea>
                </div>
                <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                    <button type="button" class="btn btn-secondary" onclick="closeModal('waste-modal')">Cancelar</button>
                    <button type="submit" class="btn btn-primary">Guardar Merma</button>
                </div>
            </form>
        </div>
    `;

    showModal('waste-modal', modalHtml);
}

async function handleSaveWaste(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const productId = formData.get('productId');
    const quantity = parseFloat(formData.get('quantity'));
    const notes = formData.get('notes');
    const businessId = selectedBusinessId || 'mch1';

    const wasteRecord = {
        id: Date.now(),
        date: new Date().toLocaleString(),
        businessId: businessId,
        productId: productId,
        quantity: quantity,
        notes: notes,
        reportedBy: currentUser.name,
        status: (currentUser.role === 'owner' || currentUser.role === 'admin') ? 'approved' : 'pending'
    };

    if (wasteRecord.status === 'approved') {
        const invItem = db.inventory.find(inv => String(inv.businessId) === String(businessId) && String(inv.productId) === String(productId));
        if (invItem) {
            invItem.quantity = Math.max(0, invItem.quantity - quantity);
            addLog(`Merma aprobada: ${db.products.find(p => p.id === productId)?.name} (${quantity}) en ${db.businesses.find(b => String(b.id) === String(businessId))?.name}`, 'warning');
        }
    } else {
        const notif = {
            id: Date.now(),
            type: 'waste_approval',
            wasteId: wasteRecord.id,
            businessId: businessId,
            title: 'Solicitud de Merma',
            message: `${currentUser.name} reportó mermas: ${quantity} x ${db.products.find(p => p.id === productId)?.name}`,
            status: 'pending',
            date: new Date().toLocaleString()
        };
        db.notifications.unshift(notif);
        addLog(`Solicitud de merma enviada: ${db.products.find(p => p.id === productId)?.name}`, 'info');
    }

    db.waste.push(wasteRecord);
    await saveData();
    closeModal('waste-modal');
    renderMermas(document.getElementById('content-area'));
}

async function approveWaste(wasteId) {
    const waste = db.waste.find(w => w.id === wasteId);
    if (!waste || waste.status === 'approved') return;

    const invItem = db.inventory.find(inv => String(inv.businessId) === String(waste.businessId) && String(inv.productId) === String(waste.productId));
    if (invItem) {
        invItem.quantity = Math.max(0, invItem.quantity - waste.quantity);
        waste.status = 'approved';
        waste.approvedBy = currentUser.name;

        // Mark notification as seen/resolved
        const notif = db.notifications.find(n => n.wasteId === wasteId);
        if (notif) notif.status = 'seen';

        addLog(`Merma aprobada por ${currentUser.name}: ${db.products.find(p => p.id === waste.productId)?.name}`, 'success');
        await saveData();
        renderMermas(document.getElementById('content-area'));
        if (document.getElementById('modal-notifications')) showNotificationsModal();
    }
}

function renderPOS(container) {
    if (!editingSaleId) posCart = [];

    // Obtener fecha actual en formato local
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');

    const canEditDate = true; // REGLA: Fecha habilitada para todos.

    const headerHtml = `
        <div class="card" style="margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.5rem;">
            <div style="display: flex; align-items: center; gap: 1rem;">
                <i class="ph ph-calendar" style="font-size: 1.5rem; color: var(--primary);"></i>
                <div>
                    <label style="display: block; font-size: 0.75rem; color: var(--text-muted);">Fecha de Operación</label>
                    <input type="date" id="pos-date" value="${today}" ${!canEditDate ? 'disabled' : ''} 
                           style="background: transparent; border: none; color: white; font-weight: bold; font-size: 1rem; outline: none;">
                </div>
            </div>
            <div style="text-align: right;">
                <label style="display: block; font-size: 0.75rem; color: var(--text-muted);">Hora de Apertura</label>
                <input type="time" id="pos-open-time" value="${currentTime}" class="input-minimal" style="width: 80px;">
            </div>
        </div>
    `;

    const searchHtml = `
        <div class="card" style="margin-bottom: 1rem;">
            <div class="pos-search-container" style="position: relative;">
                <input type="text" id="pos-search" placeholder="Buscar producto por nombre..." 
                       oninput="handlePOSSearch(this.value)" class="input-field" style="padding-left: 3rem;">
                <i class="ph ph-magnifying-glass" style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: var(--text-muted);"></i>
                <div id="pos-results" style="display: none; position: absolute; width: 100%; z-index: 100; background: var(--bg-card); border: 1px solid var(--border); max-height: 400px; overflow-y: auto; box-shadow: 0 10px 25px rgba(0,0,0,0.5); border-radius: 0 0 8px 8px;"></div>
            </div>
        </div>
    `;

    container.innerHTML = `
        <div class="fade-in" style="display: grid; grid-template-columns: 1fr 450px; gap: 1.5rem; height: calc(100vh - 150px);">
            <!-- Panel Izquierdo: Buscador y Carrito -->
            <div style="display: flex; flex-direction: column; min-height: 0; gap: 1rem;">
                ${headerHtml}
                ${editingSaleId ? `
                    <div style="background: rgba(243, 156, 18, 0.1); border: 1px solid var(--warning); padding: 0.75rem 1.5rem; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                        <span style="color: var(--warning); font-weight: bold;"><i class="ph ph-pencil-simple"></i> MODALIDAD: EDITANDO VENTA #${editingSaleId.toString().slice(-4)}</span>
                        <button class="btn-ghost" onclick="cancelPOSEdit()" style="color: var(--danger); font-size: 0.8rem; padding: 0.2rem 0.5rem; border: 1px solid var(--danger); border-radius: 6px;">CANCELAR EDICIÓN</button>
                    </div>
                ` : ''}
                ${searchHtml}
                <div class="card" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; padding: 0;">
                    <div style="padding: 1rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
                        <h3 style="margin: 0;"><i class="ph ph-shopping-cart"></i> Carrito</h3>
                        <div style="display: flex; gap: 0.5rem;">
                             <button class="btn-ghost" onclick="posCart=[]; renderCart();" style="color: var(--danger); padding: 0.5rem;" title="Limpiar Carrito"><i class="ph ph-trash"></i></button>
                        </div>
                    </div>
                    <div id="pos-cart-items" style="flex: 1; overflow-y: auto;"></div>
                    <div class="pos-management-actions" style="padding: 1rem;">
                        <button class="btn-secondary btn-expense" onclick="openExpenseModal()">
                            <i class="ph ph-receipt"></i> Registrar Gasto
                        </button>
                        <button class="btn-secondary btn-merma" onclick="openIncidentModal()">
                            <i class="ph ph-warning-circle"></i> Incidencias / Dev
                        </button>
                    </div>
                </div>
            </div>

            <!-- Panel Derecho: Lista de Hoy y Resumen -->
            <div style="display: flex; flex-direction: column; gap: 1.5rem; min-height: 0;">
                <!-- Lista de Ventas de Hoy -->
                <div class="card" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; padding: 0;">
                    <div style="padding: 1rem; border-bottom: 1px solid var(--border); background: var(--bg-dark);">
                        <h3 style="margin: 0; font-size: 1rem;"><i class="ph ph-list-numbers"></i> Ventas de Hoy</h3>
                    </div>
                    <div id="today-sales-list" style="flex: 1; height: 400px; overflow-y: auto;"></div>
                </div>

                    <!-- Resumen y Acciones -->
                <div class="card" style="padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; background: var(--bg-card);">
                    <div id="pos-summary"></div>
                    
                    <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                        <button class="btn-primary" style="width: 100%; height: 60px; font-size: 1.2rem; border-radius: 10px;" 
                                onclick="showPaymentModal()">
                            <i class="ph ph-hand-coins"></i> COBRAR
                        </button>
                        ${(currentUser.role === 'seller') ? `
                            <button class="btn-secondary" style="width: 100%; border-color: var(--primary); color: var(--primary);" onclick="openPOSClosureModal()">
                                <i class="ph ph-lock-key"></i> TERMINAR Y CERRAR DÍA
                            </button>
                        ` : `
                            <button class="btn-secondary" style="width: 100%;" onclick="openPOSClosureModal()">
                                <i class="ph ph-check-square"></i> CERRAR DÍA (MODO ADMIN)
                            </button>
                        `}
                    </div>
                </div>
            </div>
        </div>
    `;
    updateTitle('Punto de Venta');
    renderCart();
    renderTodaySalesList();
}

function renderTodaySalesList() {
    const container = document.getElementById('today-sales-list');
    if (!container) return;

    const todayDate = document.getElementById('pos-date') ? document.getElementById('pos-date').value : new Date().toISOString().split('T')[0];

    const todaySales = db.sales.filter(s => {
        const saleDatePart = s.date.split(' ')[0];
        return saleDatePart === todayDate &&
            (s.status === 'registered' || s.status === 'closed') &&
            (selectedBusinessId ? s.businessId === selectedBusinessId : true);
    });

    if (todaySales.length === 0) {
        container.innerHTML = '<div style="padding: 2.5rem; text-align: center; color: var(--text-muted); font-size: 0.9rem;">No hay ventas registradas en esta fecha</div>';
        return;
    }

    container.innerHTML = todaySales.map(s => `
        <div class="card" style="margin: 0.5rem; padding: 1.2rem; border: 1px solid var(--border); background: var(--bg-card); border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.8rem; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem;">
                <div style="background: var(--primary); color: white; padding: 0.2rem 0.6rem; border-radius: 6px; font-size: 0.75rem; font-weight: bold;">
                    #${s.id.toString().slice(-4)}
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 1.2rem; font-weight: 900; color: var(--primary);">$${(s.total || 0).toFixed(2)}</div>
                    <div style="font-size: 0.7rem; color: var(--text-muted);">${s.payment ? `CASH: $${(s.payment.cash || 0).toFixed(1)} | TRANS: $${(s.payment.transfer || 0).toFixed(1)}` : `Efectivo`}</div>
                </div>
            </div>
            
            <div style="font-size: 0.85rem; margin-bottom: 1rem;">
                ${(s.items || []).map(i => `
                    <div onclick="returnItemFromTodaySale(${s.id}, ${i.productId || i.id})" 
                         style="display: flex; justify-content: space-between; margin-bottom: 0.4rem; cursor: pointer; padding: 0.3rem; border-radius: 4px; transition: background 0.2s; border: 1px dashed transparent;"
                         onmouseover="this.style.background='rgba(255,0,0,0.1)'; this.style.borderColor='var(--danger)';"
                         onmouseout="this.style.background='transparent'; this.style.borderColor='transparent';"
                         title="Haga clic para devolver este artículo">
                        <span><i class="ph ph-arrow-counter-clockwise" style="color:var(--danger);"></i> ${i.qty}x ${i.name}</span>
                        <span style="color: var(--text-muted);">$${(i.qty * i.price).toFixed(2)}</span>
                    </div>
                `).join('')}
            </div>
            
            <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
                 <button onclick="editSale(${s.id})" class="btn-icon" style="background:rgba(255,255,255,0.05);" title="Editar Venta"><i class="ph ph-pencil-simple"></i></button>
                 <button onclick="deleteSale(${s.id})" class="btn-icon" style="background:rgba(255,0,0,0.1); color:var(--danger);" title="Eliminar Venta"><i class="ph ph-trash"></i></button>
            </div>
        </div>
    `).join('');
}

async function returnItemFromTodaySale(saleId, itemId) {
    if (!confirm("¿Devolver este artículo al inventario?")) return;

    const sale = db.sales.find(s => s.id === saleId);
    if (!sale) return;

    const itemIdx = sale.items.findIndex(i => (i.productId || i.id) === itemId);
    if (itemIdx === -1) return;

    const item = sale.items[itemIdx];

    // 1. Restaurar inventario
    const inv = db.inventory.find(invI => invI.productId === (item.productId || item.id) && invI.businessId === sale.businessId);
    if (inv) inv.quantity += 1;

    // 2. Registrar devolución diaria
    if (!db.dailyReturns) db.dailyReturns = 0;
    db.dailyReturns += item.price;

    // 3. Ajustar venta
    item.qty -= 1;
    sale.total -= item.price;

    // Si la cantidad llega a 0, eliminar item
    if (item.qty <= 0) {
        sale.items.splice(itemIdx, 1);
    }

    // Si la venta se queda vacía, eliminar venta
    if (sale.items.length === 0) {
        db.sales = db.sales.filter(s => s.id !== saleId);
    }

    await saveData();
    addLog(`Artículo devuelto de venta #${saleId}: ${item.name}`, 'warning');
    renderTodaySalesList();
    renderInventory(document.getElementById('content-area')); // Refrescar stock si visible
}

async function deleteSale(saleId) {
    if (currentUser.role === 'seller') {
        if (!confirm("👮 EL VENDEDOR intenta eliminar una venta cerrada. ¿Autorizar operación?")) return;
    } else {
        if (!confirm("¿Estás seguro de eliminar esta venta permanentemente? El stock se restaurará.")) return;
    }

    const index = db.sales.findIndex(s => s.id === saleId);
    if (index !== -1) {
        const sale = db.sales[index];

        // Devolución monetaria si es del día actual
        const today = new Date().toISOString().split('T')[0];
        if (sale.date.startsWith(today)) {
            if (!db.dailyReturns) db.dailyReturns = 0;
            db.dailyReturns += sale.total;
        }

        // Devolver items al stock
        if (sale.items) {
            sale.items.forEach(item => {
                const inv = db.inventory.find(i => String(i.productId) === String(item.productId || item.id) && String(i.businessId) === String(sale.businessId));
                if (inv) inv.quantity += item.qty;
                else db.inventory.push({ productId: item.productId || item.id, businessId: sale.businessId, quantity: item.qty });
            });
        }

        db.sales.splice(index, 1);
        addLog(`Venta #${saleId.toString().slice(-4)} eliminada. Stock restaurado.`, 'warning');

        await saveData();

        // Refrescar según la vista actual
        if (currentView === 'pos') {
            renderTodaySalesList();
            renderPOS(document.getElementById('content-area'));
        } else if (currentView === 'ventas' || currentView === 'daily-records') {
            renderVentas(document.getElementById('content-area'));
        }

        if (typeof renderDashboard === 'function') renderDashboard(null);
        alert("Venta eliminada y stock restaurado.");
    }
}

async function editSale(saleId) {
    const sale = db.sales.find(s => s.id === saleId);
    if (!sale) return;

    if (currentUser.role === 'seller') {
        const today = new Date().toISOString().split('T')[0];
        if (!sale.date.startsWith(today)) {
            alert("Solo puedes editar ventas del día de hoy.");
            return;
        }
    }

    if (!confirm("¿Deseas editar esta venta? Los cambios se aplicarán al volver a cobrar.")) return;

    editingSaleId = saleId;
    posCart = sale.items.map(i => ({
        id: i.productId || i.id,
        name: i.name,
        price: i.price,
        qty: i.qty,
        image: db.products.find(p => String(p.id) === String(i.productId || i.id))?.image || ''
    }));

    if (currentView !== 'pos') {
        navigateTo('pos');
    } else {
        renderPOS(document.getElementById('content-area'));
    }
    alert("Venta cargada en el carrito. Modifica lo necesario y presiona COBRAR para guardar.");
}

async function registerIndividualSale() {
    console.log("Registering sale...");
    if (posCart.length === 0) {
        alert("El carrito está vacío");
        return;
    }

    const cashInput = document.getElementById('pay-cash-input');
    const transferInput = document.getElementById('pay-transfer-input');

    if (!cashInput || !transferInput) {
        // If modal not open (e.g. called from elsewhere), default to currentPaymentMethod
        showPaymentModal();
        return;
    }

    const cash = parseFloat(cashInput.value || 0);
    const transfer = parseFloat(transferInput.value || 0);
    const total = posCart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const businessId = selectedBusinessId || 'mch1';
    const now = new Date();
    const explicitDate = document.getElementById('pos-date') ? document.getElementById('pos-date').value : now.toISOString().split('T')[0];
    const dateString = `${explicitDate} ${now.toLocaleTimeString([], { hour12: false })}`;
    const timestamp = Date.now();

    // Verificación final de stock antes de procesar
    for (const item of posCart) {
        const available = getAvailableStock(item.id);
        if (item.qty > available) {
            alert(`Error: Se ha excedido el stock disponible para "${item.name}".\nPor favor revise las cantidades antes de confirmar.`);
            return;
        }
    }

    try {
        if (editingSaleId) {
            const oldSale = db.sales.find(s => s.id === editingSaleId);
            if (oldSale && oldSale.items) {
                // Restore inventory from old items
                for (const item of oldSale.items) {
                    const inv = db.inventory.find(i => String(i.productId) === String(item.productId || item.id) && String(i.businessId) === String(oldSale.businessId));
                    if (inv) inv.quantity += item.qty;
                }
            }
        }

        // Deduct new inventory
        for (const item of posCart) {
            const inv = db.inventory.find(i => String(i.productId) === String(item.id) && String(i.businessId) === String(businessId));
            if (inv) {
                inv.quantity -= item.qty;
            } else {
                db.inventory.push({ productId: item.id, businessId: businessId, quantity: -item.qty });
            }
        }

        if (editingSaleId) {
            const saleIndex = db.sales.findIndex(s => s.id === editingSaleId);
            if (saleIndex !== -1) {
                const s = db.sales[saleIndex];
                s.items = posCart.map(i => ({ productId: i.id, name: i.name, qty: i.qty, price: i.price }));
                s.total = total;
                s.payment = { cash, transfer };
                s.businessId = businessId;
                s.date = dateString;
                s.timestamp = timestamp;
                addLog(`Venta #${s.id} actualizada: $${total.toFixed(2)} (C:$${cash}, T:$${transfer})`, 'info');
            }
            editingSaleId = null;
        } else {
            const saleData = {
                id: timestamp,
                date: dateString,
                timestamp: timestamp,
                businessId: businessId,
                seller: currentUser ? currentUser.name : 'Vendedor 1',
                sellerId: currentUser ? currentUser.id : 2,
                items: posCart.map(i => ({ productId: i.id, name: i.name, qty: i.qty, price: i.price })),
                total: total,
                payment: { cash, transfer },
                status: (currentUser && (currentUser.role === 'owner' || currentUser.role === 'admin')) ? 'closed' : 'registered'
            };
            db.sales.unshift(saleData);
            addLog(`Venta registrada: $${total.toFixed(2)} (C:$${cash}, T:$${transfer})`, 'success');
        }

        await saveData();
        closeModal('payment-modal');
        alert("¡Venta procesada con éxito!");

        posCart = [];
        renderPOS(document.getElementById('content-area'));
        renderTodaySalesList();
        if (typeof renderDashboard === 'function') renderDashboard(null); // Keep dashboard up to date if rendered

    } catch (error) {
        console.error("Error registering sale:", error);
        alert("Error al registrar la venta: " + error.message);
    }
}

function showPaymentModal() {
    if (posCart.length === 0) {
        alert("El carrito está vacío");
        return;
    }
    const total = posCart.reduce((sum, item) => sum + (item.price * item.qty), 0);

    const modalHtml = `
        <div class="card" style="width: 400px; padding: 2rem; border-radius: 20px;">
            <h2 style="margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.5rem;">
                <i class="ph ph-coins" style="color: var(--warning);"></i> Finalizar Venta
            </h2>
            <div style="background: var(--bg-dark); padding: 1rem; border-radius: 12px; margin-bottom: 1.5rem; text-align: center;">
                <div style="font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase;">Total a Cobrar</div>
                <div style="font-size: 2.5rem; font-weight: 900; color: var(--primary);">$${total.toFixed(2)}</div>
            </div>

            <div class="form-group" style="margin-bottom: 1rem;">
                <label style="display: block; margin-bottom: 0.5rem; font-size: 0.9rem;">Monto Efectivo</label>
                <div style="position: relative;">
                    <i class="ph ph-money" style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: var(--success);"></i>
                    <input type="number" id="pay-cash-input" step="0.1" class="input-field" style="padding-left: 3rem;" value="${total.toFixed(2)}" oninput="validatePaymentSplit(${total})">
                </div>
            </div>

            <div class="form-group" style="margin-bottom: 1.5rem;">
                <label style="display: block; margin-bottom: 0.5rem; font-size: 0.9rem;">Monto Transferencia</label>
                <div style="position: relative;">
                    <i class="ph ph-arrows-left-right" style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: var(--primary);"></i>
                    <input type="number" id="pay-transfer-input" step="0.1" class="input-field" style="padding-left: 3rem;" value="0.00" oninput="validatePaymentSplit(${total})">
                </div>
            </div>

            <div id="payment-error" style="color: var(--danger); font-size: 0.85rem; margin-bottom: 1.5rem; text-align: center; display: none;">
                <i class="ph ph-warning"></i> La suma debe ser igual al total ($${total.toFixed(2)})
            </div>

            <div style="display: flex; gap: 1rem;">
                <button class="btn-ghost" style="flex: 1;" onclick="closeModal('payment-modal')">Cancelar</button>
                <button id="confirm-payment-btn" class="btn-primary" style="flex: 2;" onclick="registerIndividualSale()">
                    COBRAR AHORA
                </button>
            </div>
        </div>
    `;
    showModal('payment-modal', modalHtml);
}

function validatePaymentSplit(total) {
    const cash = parseFloat(document.getElementById('pay-cash-input').value || 0);
    const transfer = parseFloat(document.getElementById('pay-transfer-input').value || 0);
    const sum = cash + transfer;
    const diff = Math.abs(sum - total);

    const errorEl = document.getElementById('payment-error');
    const btn = document.getElementById('confirm-payment-btn');

    if (diff > 0.02) { // Tolerance for floating point
        errorEl.style.display = 'block';
        btn.disabled = true;
        btn.style.opacity = '0.5';
    } else {
        errorEl.style.display = 'none';
        btn.disabled = false;
        btn.style.opacity = '1';
    }
}

function setPaymentMethod(method) {
    currentPaymentMethod = method;
    const btnCash = document.getElementById('pay-cash');
    const btnTrans = document.getElementById('pay-transfer');

    if (method === 'cash') {
        btnCash.style.border = '1px solid var(--primary)';
        btnCash.style.color = 'var(--primary)';
        btnCash.style.background = 'rgba(var(--primary-rgb), 0.1)';

        btnTrans.style.border = '1px solid var(--border)';
        btnTrans.style.color = 'var(--text-muted)';
        btnTrans.style.background = 'transparent';
    } else {
        btnTrans.style.border = '1px solid var(--primary)';
        btnTrans.style.color = 'var(--primary)';
        btnTrans.style.background = 'rgba(var(--primary-rgb), 0.1)';

        btnCash.style.border = '1px solid var(--border)';
        btnCash.style.color = 'var(--text-muted)';
        btnCash.style.background = 'transparent';
    }
}

// --- POS HELPERS ---
function getAvailableStock(productId) {
    const businessId = selectedBusinessId || 'mch1';
    const inv = db.inventory.find(i => String(i.productId) === String(productId) && String(i.businessId) === String(businessId));
    let stock = inv ? inv.quantity : 0;

    // Si estamos editando, sumar la cantidad original de la venta para no restringir artificialmente
    if (editingSaleId) {
        const oldSale = db.sales.find(s => s.id === editingSaleId);
        if (oldSale && oldSale.items) {
            const item = oldSale.items.find(it => String(it.productId) === String(productId));
            if (item) stock += item.qty;
        }
    }
    return stock;
}

function handlePOSSearch(val) {
    const results = document.getElementById('pos-results');
    if (!val) { results.style.display = 'none'; return; }

    const isSeller = currentUser.role === 'seller';

    const matches = db.products.filter(p => {
        const inv = db.inventory.find(i => i.productId === p.id && i.businessId === (selectedBusinessId || 'mch1'));
        const stock = inv ? inv.quantity : 0;

        if (isSeller && stock <= 0) return false;
        return p.name.toLowerCase().includes(val.toLowerCase());
    }).slice(0, 8);

    if (matches.length === 0) {
        results.innerHTML = '<div style="padding:1rem; color:var(--text-muted);">No se encontraron productos</div>';
        results.style.display = 'block';
        return;
    }

    results.innerHTML = matches.map(p => {
        const inv = db.inventory.find(i => i.productId === p.id && i.businessId === (selectedBusinessId || 2));
        const stock = inv ? inv.quantity : 0;
        return `
            <div class="pos-search-item" onclick="addToCart(${p.id})" style="display:flex; align-items:center; gap:1rem; padding:0.75rem 1rem; cursor:pointer; border-bottom:1px solid var(--border);">
                <div style="width: 40px; height: 40px; border-radius: 4px; overflow: hidden; background: var(--bg-dark); display: flex; align-items: center; justify-content: center; border: 1px solid var(--border);">
                    ${p.image ? `<img src="${p.image}" style="width: 100%; height: 100%; object-fit: cover;">` : `<i class="ph ph-image" style="font-size: 1.2rem; color: var(--text-muted);"></i>`}
                </div>
                <div style="flex:1;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div style="font-weight:bold;">${p.name}</div>
                        <div style="font-weight:bold; color:var(--primary);">$${p.price.toFixed(2)}</div>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; margin-top:2px;">
                        <div style="color:var(--text-muted);">${p.alias || ''}</div>
                        <div style="color:${stock > 0 ? 'var(--success)' : 'var(--danger)'};">Stock: ${stock}</div>
                    </div>
                </div>
                <i class="ph ph-plus-circle" style="color:var(--primary); font-size:1.2rem;"></i>
            </div>
        `;
    }).join('');
    results.style.display = 'block';
}

function addToCart(id) {
    const p = db.products.find(prod => prod.id === id);
    if (!p) return;

    const available = getAvailableStock(id);
    const existing = posCart.find(i => i.id === id);
    const currentInCart = existing ? existing.qty : 0;

    if (currentInCart + 1 > available) {
        alert(`Stock insuficiente para "${p.name}".\nDisponible: ${available}\nEn el carrito: ${currentInCart}`);
        return;
    }

    if (existing) {
        existing.qty++;
    } else {
        posCart.push({ id: p.id, name: p.name, price: p.price, qty: 1, image: p.image });
    }
    document.getElementById('pos-search').value = '';
    document.getElementById('pos-results').style.display = 'none';
    renderCart();
}

function renderCart() {
    const container = document.getElementById('pos-cart-items');
    const summary = document.getElementById('pos-summary');
    if (!container || !summary) return;

    if (posCart.length === 0) {
        container.innerHTML = '<div style="padding:3rem; text-align:center; color:var(--text-muted);"><i class="ph ph-shopping-cart" style="font-size:3rem; display:block; margin-bottom:1rem; opacity:0.2;"></i>El carrito está vacío</div>';
        summary.innerHTML = '<div style="font-size:2rem; font-weight:bold; color:var(--text-muted);">$0.00</div>';
        return;
    }

    container.innerHTML = posCart.map((item, index) => `
        <div style="display:flex; align-items:center; gap:1rem; padding:1rem; border-bottom:1px solid var(--border);">
            <div style="width: 50px; height: 50px; border-radius: 4px; overflow: hidden; background: var(--bg-dark); display: flex; align-items: center; justify-content: center; border: 1px solid var(--border);">
                ${item.image ? `<img src="${item.image}" style="width: 100%; height: 100%; object-fit: cover;">` : `<i class="ph ph-image" style="font-size: 1.5rem; color: var(--text-muted);"></i>`}
            </div>
            <div style="flex:1;">
                <div style="font-weight:bold;">${item.name}</div>
                <div style="color:var(--text-muted); font-size:0.9rem;">$${item.price.toFixed(2)} c/u</div>
            </div>
            <div style="display:flex; align-items:center; gap:0.5rem; background:var(--bg-dark); padding:0.25rem; border-radius:6px;">
                <button class="btn-icon" onclick="adjustPOSQty(${index}, -1)" style="padding:0.25rem;"><i class="ph ph-minus"></i></button>
                <span style="min-width:30px; text-align:center; font-weight:bold;">${item.qty}</span>
                <button class="btn-icon" onclick="adjustPOSQty(${index}, 1)" style="padding:0.25rem;"><i class="ph ph-plus"></i></button>
            </div>
            <div style="min-width:80px; text-align:right; font-weight:bold;">$${(item.qty * item.price).toFixed(2)}</div>
            <button class="btn-icon" onclick="removeFromCart(${index})" style="color:var(--danger);"><i class="ph ph-trash"></i></button>
        </div>
    `).join('');

    const total = posCart.reduce((sum, item) => sum + (item.qty * item.price), 0);
    summary.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:0.5rem;">
            <div style="display:flex; justify-content:space-between; color:var(--text-muted);">
                <span>Subtotal (${posCart.length} productos):</span>
                <span>$${total.toFixed(2)}</span>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:2.5rem; font-weight:bold; color:var(--primary); margin-top:1rem; border-top:2px solid var(--border); padding-top:1rem;">
                <span>${editingSaleId ? 'TOTAL A EDITAR' : 'TOTAL'}</span>
                <span>$${total.toFixed(2)}</span>
            </div>
            ${editingSaleId ? `
                <div style="text-align: center; margin-top: 0.5rem;">
                    <button class="btn-ghost" onclick="cancelPOSEdit()" style="color: var(--danger); font-size: 0.8rem;">Descartar cambios y salir de edición</button>
                </div>
            ` : ''}
        </div>
    `;
}

function adjustPOSQty(idx, delta) {
    const item = posCart[idx];
    if (delta > 0) {
        const available = getAvailableStock(item.id);
        if (item.qty + delta > available) {
            alert(`No se puede aumentar más. Stock máximo alcanzado para "${item.name}": ${available}`);
            return;
        }
    }
    item.qty = Math.max(1, item.qty + delta);
    renderCart();
}

// --- POS MANAGEMENT (EXPENSES & INCIDENTS) ---

function openExpenseModal() {
    const modalHtml = `
        <div class="card" style="width: 400px; padding: 2rem; border-radius: 20px;">
            <h2 style="margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.5rem;">
                <i class="ph ph-receipt" style="color: #f39c12;"></i> Salida de Caja (Gasto)
            </h2>
            <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 1.5rem;">Se restará del efectivo en caja del día.</p>
            
            <div class="form-group" style="margin-bottom: 1.5rem;">
                <label style="display: block; margin-bottom: 0.5rem; font-size: 0.9rem;">Monto ($)</label>
                <input type="number" id="expenseAmount" placeholder="0.00" min="0" step="0.1" class="input-field">
            </div>
            
            <div class="form-group" style="margin-bottom: 2rem;">
                <label style="display: block; margin-bottom: 0.5rem; font-size: 0.9rem;">Motivo</label>
                <input type="text" id="expenseReason" placeholder="Ej: Compra de insumos, comida..." class="input-field">
            </div>

            <div style="display: flex; gap: 1rem;">
                <button class="btn-ghost" style="flex: 1;" onclick="closeModal('expense-modal')">Cancelar</button>
                <button class="btn-primary" style="flex: 2; background: #f39c12; border-color: #f39c12;" onclick="confirmExpense()">
                    REGISTRAR GASTO
                </button>
            </div>
        </div>
    `;
    showModal('expense-modal', modalHtml);
}

function openIncidentModal() {
    const modal = document.getElementById('incidentModal');
    if (!modal) return;

    modal.classList.remove('hidden');

    // Llenar el datalist para búsqueda predictiva con stock según sede actual
    const datalist = document.getElementById('productsDataList');
    const businessId = selectedBusinessId || 'mch1';

    datalist.innerHTML = db.products.map(p => {
        const inv = db.inventory.find(i => String(i.productId) === String(p.id) && String(i.businessId) === String(businessId));
        const stock = inv ? inv.quantity : 0;
        return `<option value="${p.name}">Stock: ${stock}</option>`;
    }).join('');

    // Resetear campos
    document.getElementById('incidentProductSearch').value = '';
    document.getElementById('incidentReason').value = '';
    document.getElementById('incidentQty').value = '1';
    document.getElementById('incidentAmount').value = '';

    updateIncidentUI();
}

function updateIncidentUI() {
    const type = document.getElementById('incidentType').value;
    const info = document.getElementById('incidentInfo');
    const moneyGroup = document.getElementById('moneyGroup');

    if (type === 'refund_broken') {
        info.innerHTML = "⚠️ <b>Devolución:</b> Resta dinero. El producto se va a la basura (Roto).";
        moneyGroup.style.visibility = 'visible';
    } else if (type === 'refund_good') {
        info.innerHTML = "✅ <b>Reingreso:</b> Resta dinero. El producto vuelve al Stock.";
        moneyGroup.style.visibility = 'visible';
    } else if (type === 'internal_loss') {
        info.innerHTML = "📉 <b>Rotura o deterioro:</b> Solo resta inventario. No afecta el dinero de caja.";
        moneyGroup.style.visibility = 'hidden';
    }
}

async function confirmExpense() {
    const amount = parseFloat(document.getElementById('expenseAmount').value);
    const reason = document.getElementById('expenseReason').value;

    if (!amount || amount <= 0 || !reason) {
        alert("Por favor, completa el monto y el motivo.");
        return;
    }

    // PERMISO VENDEDOR
    if (currentUser.role === 'seller') {
        if (!confirm("⚠️ VENDEDOR: Se requiere autorización del dueño para sacar dinero. ¿Autorizar?")) return;
    }

    const businessId = selectedBusinessId || 'mch1';
    const now = new Date();
    const explicitDate = document.getElementById('pos-date') ? document.getElementById('pos-date').value : now.toISOString().split('T')[0];
    const dateString = `${explicitDate} ${now.toLocaleTimeString([], { hour12: false })}`;
    const timestamp = Date.now();

    // Registrar como transacción negativa
    const expenseEntry = {
        id: timestamp,
        date: dateString,
        timestamp: timestamp,
        businessId: businessId,
        seller: currentUser.name,
        total: -amount, // Negativo para restar de la caja
        items: [{ name: "GASTO OPERATIVO", price: -amount, qty: 1 }],
        details: reason,
        type: "EXPENSE",
        status: (currentUser.role === 'owner' || currentUser.role === 'admin') ? 'closed' : 'registered'
    };

    db.sales.unshift(expenseEntry);
    addLog(`Gasto registrado: -$${amount.toFixed(2)} (${reason})`, 'warning');

    await saveData();
    alert("Gasto registrado con éxito.");
    closeModal('expense-modal');
    renderTodaySalesList();
    if (typeof renderDashboard === 'function') renderDashboard(null);
}

async function processIncident() {
    const type = document.getElementById('incidentType').value;
    const nameInput = document.getElementById('incidentProductSearch').value.trim();
    // Búsqueda insensible a mayúsculas
    const product = db.products.find(p => p.name.toLowerCase() === nameInput.toLowerCase());

    const qty = parseInt(document.getElementById('incidentQty').value);
    const amount = parseFloat(document.getElementById('incidentAmount').value) || 0;
    const reason = document.getElementById('incidentReason').value.trim();

    if (!product) return alert("❌ El producto '" + nameInput + "' no existe. Selecciónalo de la lista.");
    if (!reason) return alert("❌ Debes escribir un motivo.");

    if (currentUser.role === 'seller') {
        if (!confirm("👮 Se requiere autorización del Dueño para procesar esto. ¿Autorizar?")) return;
    }

    const businessId = selectedBusinessId || 'mch1';
    const inventory = db.inventory.find(i => String(i.productId) === String(product.id) && String(i.businessId) === String(businessId));

    let logType = "";
    if (type === 'refund_good') {
        logType = "DEVOLUCION_STOCK";
        if (inventory) inventory.quantity += qty;
        else db.inventory.push({ productId: product.id, businessId: businessId, quantity: qty });
    }
    else if (type === 'refund_broken') {
        logType = "DEVOLUCION_ROTO";
    }
    else if (type === 'internal_loss') {
        logType = "ROTURA_DETERIORO";
        if (inventory) inventory.quantity = Math.max(0, inventory.quantity - qty);
    }

    const now = new Date();
    const explicitDate = document.getElementById('pos-date') ? document.getElementById('pos-date').value : now.toISOString().split('T')[0];
    const dateString = `${explicitDate} ${now.toLocaleTimeString([], { hour12: false })}`;
    const timestamp = Date.now();

    const entry = {
        id: timestamp,
        date: dateString,
        timestamp: timestamp,
        businessId: businessId,
        seller: currentUser.name,
        total: (type === 'internal_loss') ? 0 : -amount,
        items: [{ productId: product.id, name: product.name, price: amount, qty: qty }],
        details: `[${logType}] ${reason}`,
        type: logType,
        status: (currentUser.role === 'owner' || currentUser.role === 'admin') ? 'closed' : 'registered'
    };

    db.sales.unshift(entry);

    if (type === 'internal_loss') {
        db.waste.push({
            id: timestamp,
            date: dateString,
            businessId: businessId,
            productId: product.id,
            quantity: qty,
            notes: reason,
            reportedBy: currentUser.name,
            status: 'approved'
        });
    }

    addLog(`Incidencia registrada: ${logType} - ${product.name} (x${qty})`, (type === 'internal_loss' ? 'danger' : 'warning'));

    await saveData();
    alert("✅ Operación completada.");
    closeModal('incidentModal');
    renderTodaySalesList();
    renderInventory(document.getElementById('content-area'));
    if (typeof renderDashboard === 'function') renderDashboard(null);
}

function removeFromCart(idx) {
    posCart.splice(idx, 1);
    renderCart();
}

function cancelPOSEdit() {
    if (!confirm("¿Deseas cancelar la edición? Los cambios realizados se perderán.")) return;
    editingSaleId = null;
    posCart = [];
    if (currentView === 'pos') {
        renderPOS(document.getElementById('content-area'));
    } else {
        navigateTo('ventas');
    }
}

// --- PLACEHOLDER VIEWS ---
function renderProducts(container) {
    const rows = db.products.map(p => `
        <tr style="border-bottom: 1px solid var(--border);">
            <td style="padding: 1rem;">${p.name}</td>
            <td style="padding: 1rem;">${p.alias}</td>
            <td style="padding: 1rem;">$${p.cost.toFixed(2)}</td>
            <td style="padding: 1rem;">$${p.price.toFixed(2)}</td>
            <td style="padding: 1rem; text-align: right;">
                <button class="btn-icon" onclick="showEditProductModal(${p.id})"><i class="ph ph-pencil"></i></button>
                <button class="btn-icon text-danger" onclick="deleteProduct(${p.id})"><i class="ph ph-trash"></i></button>
            </div>
        </tr>
    `).join('');
    container.innerHTML = `<div class="card" style="overflow-x: auto;"><table style="width: 100%;"><thead><tr><th>Nombre</th><th>Código</th><th>Costo</th><th>Precio</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderIngresosGastos(container) { container.innerHTML = '<div class="card"><h3>Ingresos/Gastos Extra</h3><p>Módulo en desarrollo para control de flujo de caja no operacional.</p></div>'; }
function renderCompras(container) { container.innerHTML = '<div class="card"><h3>Gestión de Compras</h3><p>Módulo para registro de facturas y entrada al almacén.</p></div>'; }
function renderEmployees(container) { container.innerHTML = '<div class="card"><h3>Personal y Nómina</h3><p>Control de asistencia y pagos.</p></div>'; }
function renderFinancials(container) { container.innerHTML = '<div class="card"><h3>Finanzas y Préstamos</h3><p>Seguimiento de capital y deudas.</p></div>'; }
function renderReportes(container) {
    const totalSales = db.sales.reduce((sum, s) => sum + (s.total || 0), 0);
    const businessStats = db.businesses.map(b => {
        const sales = db.sales.filter(s => s.businessId === b.id);
        const revenue = sales.reduce((sum, s) => sum + (s.total || 0), 0);
        return { name: b.name, revenue, count: sales.length };
    });

    container.innerHTML = `
        <div class="fade-in">
            <div class="grid-3" style="margin-bottom: 2rem;">
                <div class="card stat-card" style="border-top: 4px solid var(--primary);">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div>
                            <small class="stat-label">Ventas Totales</small>
                            <h2 class="stat-value" style="color: var(--primary);">$${totalSales.toFixed(2)}</h2>
                        </div>
                        <i class="ph ph-trend-up" style="font-size: 2rem; color: var(--primary); opacity: 0.5;"></i>
                    </div>
                </div>
                <div class="card stat-card" style="border-top: 4px solid var(--success);">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div>
                            <small class="stat-label">Transacciones</small>
                            <h2 class="stat-value" style="color: var(--success);">${db.sales.length}</h2>
                        </div>
                        <i class="ph ph-receipt" style="font-size: 2rem; color: var(--success); opacity: 0.5;"></i>
                    </div>
                </div>
                <div class="card stat-card" style="border-top: 4px solid var(--warning);">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div>
                            <small class="stat-label">Sedes Activas</small>
                            <h2 class="stat-value" style="color: var(--warning);">${db.businesses.length}</h2>
                        </div>
                        <i class="ph ph-buildings" style="font-size: 2rem; color: var(--warning); opacity: 0.5;"></i>
                    </div>
                </div>
            </div>

            <div class="card-glass" style="padding:0; overflow: hidden;">
                <div style="padding:1.5rem; border-bottom:1px solid var(--border);">
                    <h3 style="margin:0;"><i class="ph ph-buildings"></i> Rendimiento por Sede</h3>
                </div>
                <div style="padding:1rem;">
                    <table style="width:100%; border-collapse:collapse;">
                        <thead>
                            <tr style="text-align:left; color:var(--text-muted); font-size:0.85rem;">
                                <th style="padding:1rem;">Sede</th>
                                <th style="padding:1rem;">Operaciones</th>
                                <th style="padding:1rem; text-align:right;">Ingreso Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${businessStats.map(bs => `
                                <tr style="border-bottom: 1px solid var(--border);">
                                    <td style="padding:1rem;"><strong>${bs.name}</strong></td>
                                    <td style="padding:1rem;">${bs.count}</td>
                                    <td style="padding:1rem; text-align:right; color:var(--success); font-weight:bold;">$${bs.revenue.toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <div style="margin-top:2rem; display:flex; gap:1rem; flex-wrap:wrap;">
                 <button class="btn-secondary" onclick="exportInventoryCSV()"><i class="ph ph-file-csv"></i> Exportar Inventario (CSV)</button>
                 <button class="btn-secondary" onclick="exportDB()"><i class="ph ph-database"></i> Backup Base de Datos (JSON)</button>
            </div>
        </div>
    `;
    updateTitle('Reportes y Estadísticas');
}
function renderSettings(container) {
    container.innerHTML = `
        <div class="card">
            <h3>Configuración</h3>
            <div style="margin-top: 2rem;">
                <button class="btn-secondary" onclick="importInventoryManual()">Re-importar CSVs</button>
                <button class="btn-secondary" onclick="exportDB()">Exportar DB (JSON)</button>
            </div>
        </div>
    `;
}
function renderLogs(container) {
    const rows = db.logs.slice(0, 50).map(l => `<tr><td style="padding: 0.5rem;">${l.date}</td><td>${l.user}</td><td>${l.action}</td><td>${l.details}</td></tr>`).join('');
    container.innerHTML = `<div class="card"><h3>Logs de Auditoría</h3><table style="width: 100%; font-size: 0.8rem;"><thead><tr><th>Fecha</th><th>User</th><th>Acción</th><th>Detalle</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
function renderCashControl(container) { container.innerHTML = '<div class="card"><h3>Arqueo de Caja</h3><p>Cuadre diario de efectivo vs sistema.</p></div>'; }
function renderTransfer(container) {
    const isAlmacen = String(selectedBusinessId) === 'alm';
    const title = isAlmacen ? 'Abastecer Kioscos' : 'Transferir Mercancía';

    // Filtro de destinos: El almacén puede abastecer a cualquiera, los kioscos pueden transferir a cualquiera (incluido almacén)
    const destinations = db.businesses.filter(b => String(b.id) !== String(selectedBusinessId || 'alm'));

    const inventory = db.inventory.filter(inv => String(inv.businessId) === String(selectedBusinessId || 'alm'));
    const products = db.products.filter(p => inventory.some(inv => inv.productId === p.id));

    const productOptions = products.map(p => {
        const stock = inventory.find(inv => inv.productId === p.id)?.quantity || 0;
        return `<option value="${p.id}">${p.name} (Stock: ${stock})</option>`;
    }).join('');

    const businessOptions = destinations.map(b => `<option value="${b.id}">${b.name}</option>`).join('');

    container.innerHTML = `
        <div class="fade-in">
            <div class="card" style="max-width: 600px; margin: 0 auto;">
                <div style="margin-bottom: 2rem;">
                    <h2><i class="ph ph-arrows-left-right"></i> ${title}</h2>
                    <p style="color: var(--text-muted);">Mueva inventario entre sedes de forma directa.</p>
                </div>
                
                <form id="transfer-form" onsubmit="handleLogisticsMovement(event)">
                    <div class="form-group" style="margin-bottom: 1.5rem;">
                        <label>Producto a Mover</label>
                        <select name="productId" required class="input-field">
                            ${productOptions || '<option disabled>Sin productos con stock</option>'}
                        </select>
                    </div>
                    
                    <div class="grid-2" style="gap: 1.5rem; margin-bottom: 1.5rem;">
                        <div class="form-group">
                            <label>Origen</label>
                            <input type="text" value="${db.businesses.find(b => String(b.id) === String(selectedBusinessId || 'alm'))?.name}" disabled class="input-field" style="opacity: 0.6;">
                        </div>
                        <div class="form-group">
                            <label>Destino</label>
                            <select name="targetBusinessId" required class="input-field">
                                ${businessOptions}
                            </select>
                        </div>
                    </div>

                    <div class="form-group" style="margin-bottom: 2rem;">
                        <label>Cantidad</label>
                        <input type="number" name="quantity" required min="0.1" step="0.1" class="input-field" placeholder="0.0">
                    </div>

                    <button type="submit" class="btn-primary" style="width: 100%; height: 50px; font-weight: bold;">
                        EJECUTAR MOVIMIENTO
                    </button>
                </form>
            </div>

            <div class="card" style="margin-top: 2rem;">
                <h3>Últimos Movimientos</h3>
                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; margin-top: 1rem;">
                        <thead>
                            <tr style="text-align: left; color: var(--text-muted); font-size: 0.85rem;">
                                <th style="padding: 0.5rem;">Fecha</th>
                                <th style="padding: 0.5rem;">Producto</th>
                                <th style="padding: 0.5rem;">Origen</th>
                                <th style="padding: 0.5rem;">Destino</th>
                                <th style="padding: 0.5rem; text-align: right;">Cant.</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${(db.extraMovements || []).slice(0, 10).map(m => `
                                <tr style="border-bottom: 1px solid var(--border);">
                                    <td style="padding: 0.75rem; font-size: 0.85rem;">${m.date}</td>
                                    <td style="padding: 0.75rem;">${db.products.find(p => p.id === (m.productId || m.id))?.name || 'N/A'}</td>
                                    <td style="padding: 0.75rem;">${db.businesses.find(b => String(b.id) === String(m.fromId))?.name || 'N/A'}</td>
                                    <td style="padding: 0.75rem;">${db.businesses.find(b => String(b.id) === String(m.toId))?.name || 'N/A'}</td>
                                    <td style="padding: 0.75rem; text-align: right; font-weight: bold;">${m.quantity}</td>
                                </tr>
                            `).join('') || '<tr><td colspan="5" style="padding: 2rem; text-align: center; color: var(--text-muted);">No hay movimientos recientes</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
    updateTitle(title);
}

async function handleLogisticsMovement(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const productId = parseInt(formData.get('productId'));
    const targetBusinessId = String(formData.get('targetBusinessId'));
    const originBusinessId = String(selectedBusinessId || 'alm');
    const quantity = parseFloat(formData.get('quantity'));

    if (quantity <= 0) return;

    // Deduct from Source
    const sourceInv = db.inventory.find(i => String(i.productId) === String(productId) && String(i.businessId) === originBusinessId);
    if (!sourceInv || sourceInv.quantity < quantity) {
        alert("Stock insuficiente en origen.");
        return;
    }

    sourceInv.quantity -= quantity;

    // Add to Destination
    let targetInv = db.inventory.find(i => String(i.productId) === String(productId) && String(i.businessId) === targetBusinessId);
    if (!targetInv) {
        targetInv = { businessId: targetBusinessId, productId: productId, quantity: 0 };
        db.inventory.push(targetInv);
    }
    targetInv.quantity += quantity;

    // Log movement
    const movement = {
        id: Date.now(),
        date: new Date().toLocaleString(),
        productId,
        fromId: originBusinessId,
        toId: targetBusinessId,
        quantity,
        user: currentUser.name,
        type: originBusinessId === 'alm' ? 'supply' : 'transfer'
    };
    if (!db.extraMovements) db.extraMovements = [];
    db.extraMovements.unshift(movement);

    addLog(`${movement.type === 'supply' ? 'Abastecimiento' : 'Transferencia'}: ${quantity} x ${db.products.find(p => p.id === productId)?.name} de ${db.businesses.find(b => String(b.id) === originBusinessId)?.name} a ${db.businesses.find(b => String(b.id) === targetBusinessId)?.name}`, 'info');

    await saveData();
    alert("Movimiento completado con éxito.");
    renderTransfer(document.getElementById('content-area'));
}

function setupNotifications() {
    const notifBtn = document.getElementById('notifBtn');
    if (notifBtn) {
        notifBtn.onclick = (e) => {
            e.stopPropagation();
            const dropdown = document.getElementById('notifDropdown');
            dropdown.classList.toggle('show');
            if (dropdown.classList.contains('show')) {
                renderNotifications();
            }
        };
    }

    document.addEventListener('click', (e) => {
        const dropdown = document.getElementById('notifDropdown');
        const btn = document.getElementById('notifBtn');
        if (dropdown && dropdown.classList.contains('show') && !dropdown.contains(e.target) && !btn.contains(e.target)) {
            dropdown.classList.remove('show');
        }
    });
}

function renderNotifications() {
    const dropdown = document.getElementById('notifDropdown');
    if (!dropdown) return;

    const notifs = db.notifications || [];
    const unseenCount = notifs.filter(n => !n.seen).length;
    const badge = document.getElementById('notif-count');
    if (badge) {
        badge.innerText = unseenCount;
        badge.style.display = unseenCount > 0 ? 'block' : 'none';
    }

    if (notifs.length === 0) {
        dropdown.innerHTML = '<div style="padding: 1.5rem; text-align: center; color: var(--text-muted);">No hay notificaciones</div>';
        return;
    }

    dropdown.innerHTML = `
        <div style="padding: 1rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
            <h4 style="margin: 0;">Notificaciones</h4>
            <button class="btn-ghost" style="font-size: 0.75rem;" onclick="markAllNotificationsAsSeen()">Marcar todas como leídas</button>
        </div>
        <div style="max-height: 400px; overflow-y: auto;">
            ${notifs.map(n => `
                <div style="padding: 1rem; border-bottom: 1px solid var(--border); cursor: pointer; background: ${n.seen ? 'transparent' : 'rgba(88, 166, 255, 0.05)'};" onclick="handleNotificationClick(${n.id})">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                        <span style="font-weight: 600; font-size: 0.9rem;">${n.title}</span>
                        <span style="font-size: 0.7rem; color: var(--text-muted);">${n.date.split(' ')[0]}</span>
                    </div>
                    <div style="font-size: 0.8rem; color: var(--text-muted); line-height: 1.4;">${n.message}</div>
                </div>
            `).join('')}
        </div>
    `;
}

async function markAllNotificationsAsSeen() {
    if (db.notifications) {
        db.notifications.forEach(n => n.seen = true);
        await saveData();
        renderNotifications();
    }
}

async function handleNotificationClick(id) {
    const n = db.notifications.find(notif => notif.id === id);
    if (n) {
        n.seen = true;
        await saveData();
        renderNotifications();
        // If it's a specific type, navigate
        if (n.type === 'waste_approval') navigateTo('inventory');
    }
}

function showNotificationsModal() {
    // Reutilizar el dropdown o abrir modal según prefiera el sistema ahora
    const dropdown = document.getElementById('notifDropdown');
    if (dropdown) dropdown.classList.add('show');
    renderNotifications();
}

function markNotificationAsSeen(id) {
    const n = db.notifications.find(notif => notif.id === id);
    if (n && !n.seen) {
        n.seen = true;
        saveData();
        // Update UI without full flicker
        const modal = document.getElementById('notifications-modal');
        if (modal) {
            modal.remove();
            showNotificationsModal();
        }
        renderSidebar(currentView);
    }
}

async function approveNotification(id) {
    const n = db.notifications.find(notif => notif.id === id);
    if (!n) return;

    if (n.type === 'closure_request') {
        // Find the closure record
        const closureRecord = db.sales.find(s => s.id === n.refId);
        if (closureRecord) {
            closureRecord.status = 'closed';
            closureRecord.approver = currentUser.name;

            // Also close all individual sales linked to this closure
            db.sales.forEach(s => {
                if (s.closureId === closureRecord.id) {
                    s.status = 'closed';
                }
            });
        }
    } else if (n.type === 'delete_request') {
        await deleteSaleAction(n.refId, true);
    } else if (n.type === 'waste_approval') {
        await approveWaste(n.wasteId);
    }

    n.status = 'approved';
    n.resolvedBy = currentUser.name;
    await saveData();
    closeModal();
    renderSidebar(currentView);
    addLog(`Notificación aprobada: ${n.title}`, 'success');
}

async function rejectNotification(id) {
    const n = db.notifications.find(notif => notif.id === id);
    if (!n) return;

    n.status = 'rejected';
    n.resolvedBy = currentUser.name;
    await saveData();
    closeModal();
    renderSidebar(currentView);
    addLog(`Notificación rechazada: ${n.title}`, 'warning');
}


// --- GLOBALS FOR MODALS ---
let currentMermaCart = [];

// --- HELPERS & MODALS ---

function showModal(id, html) {
    const existing = document.getElementById(id);
    if (existing) existing.remove();
    const modal = document.createElement('div');
    modal.id = id;
    modal.className = 'modal-overlay fade-in';
    modal.style.cssText = 'display:flex; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:9999; justify-content:center; align-items:center; backdrop-filter: blur(4px);';
    modal.innerHTML = html;
    modal.onclick = (e) => { if (e.target === modal) closeModal(id); };
    document.body.appendChild(modal);
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.add('fade-out');
        setTimeout(() => modal.remove(), 200);
    }
}

function zoomImage(src, name) {
    if (!src) return;
    const overlay = document.createElement('div');
    overlay.style = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); z-index:2000; display:flex; justify-content:center; align-items:center; cursor:pointer;';
    overlay.onclick = () => overlay.remove();

    const img = document.createElement('img');
    img.src = src;
    img.style = 'max-width:90%; max-height:90%; border-radius:8px; box-shadow:0 0 20px rgba(0,0,0,0.5); background: #222;';

    const caption = document.createElement('div');
    caption.innerText = name;
    caption.style = 'position:absolute; bottom:20px; color:white; font-size:1.5rem; font-weight:bold; text-shadow: 0 2px 4px rgba(0,0,0,0.5);';

    overlay.appendChild(img);
    overlay.appendChild(caption);
    document.body.appendChild(overlay);
}

function compressImage(file, callback) {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_SIZE = 512;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > MAX_SIZE) {
                    height *= MAX_SIZE / width;
                    width = MAX_SIZE;
                }
            } else {
                if (height > MAX_SIZE) {
                    width *= MAX_SIZE / height;
                    height = MAX_SIZE;
                }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            callback(canvas.toDataURL('image/jpeg', 0.8));
        };
    };
}

function showAddProductModal() {
    const modalHtml = `
        <div id="product-modal" class="modal-overlay" style="display:flex;">
            <div class="card" style="width:500px; padding:2rem;">
                <h3>Nuevo Producto</h3>
                <form id="add-product-form" onsubmit="event.preventDefault(); saveNewProduct();">
                    <div class="form-group">
                        <label>Nombre del Producto</label>
                        <input type="text" name="name" class="input-field" required>
                    </div>
                    <div class="form-group grid-2">
                        <div>
                            <label>Precio Costo</label>
                            <input type="number" step="0.01" name="cost" class="input-field" required>
                        </div>
                        <div>
                            <label>Precio Venta</label>
                            <input type="number" step="0.01" name="price" class="input-field" required>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Categoría</label>
                        <input type="text" name="category" class="input-field" list="categories-list">
                        <datalist id="categories-list">
                            ${[...new Set(db.products.map(p => p.category))].map(c => `<option value="${c}">`).join('')}
                        </datalist>
                    </div>
                    <div class="form-group">
                        <label>Imagen del Producto</label>
                        <input type="file" accept="image/*" onchange="handleImageUpload(this)" class="input-field">
                        <input type="hidden" name="image" id="product-image-data">
                        <div id="image-preview" style="margin-top:1rem; text-align:center;"></div>
                    </div>
                    <div style="display:flex; gap:1rem; margin-top:2rem;">
                        <button type="submit" class="btn-primary" style="flex:1;">Guardar</button>
                        <button type="button" class="btn-ghost" onclick="closeModal('product-modal')">Cancelar</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function handleImageUpload(input) {
    if (input.files && input.files[0]) {
        compressImage(input.files[0], (base64) => {
            document.getElementById('product-image-data').value = base64;
            document.getElementById('image-preview').innerHTML = `<img src="${base64}" style="width:100px; height:100px; border-radius:8px; object-fit:cover;">`;
        });
    }
}

async function saveNewProduct() {
    if (currentUser.role === 'seller') {
        alert("No tienes permisos para añadir productos.");
        return;
    }
    const form = document.getElementById('add-product-form');
    const formData = new FormData(form);
    const newProduct = {
        id: Date.now(),
        name: formData.get('name'),
        cost: parseFloat(formData.get('cost')),
        price: parseFloat(formData.get('price')),
        category: formData.get('category') || 'General',
        image: formData.get('image'),
        alias: ''
    };
    db.products.push(newProduct);

    // Si estamos en un contexto de negocio, inicializar stock en 0
    if (selectedBusinessId) {
        db.inventory.push({ businessId: selectedBusinessId, productId: newProduct.id, quantity: 0 });
    } else {
        // En vista global, inicializar en Almacén por defecto
        db.inventory.push({ businessId: 'alm', productId: newProduct.id, quantity: 0 });
    }

    await saveData();
    addLog(`Producto añadido: ${newProduct.name}`, 'success');
    closeModal('product-modal');
    renderInventory(document.getElementById('content-area'));
}

function showEditProductModal(id) {
    const p = db.products.find(prod => prod.id === id);
    if (!p) return;

    const inv = selectedBusinessId ? db.inventory.find(i => i.productId === id && i.businessId === selectedBusinessId) : null;
    const stock = inv ? inv.quantity : 0;

    const modalHtml = `
        <div id="edit-product-modal" class="modal-overlay" style="display:flex;">
            <div class="card" style="width:500px; padding:2rem;">
                <h3>Editar Producto</h3>
                <form id="edit-product-form" onsubmit="event.preventDefault(); updateProduct(${id});">
                    <div class="form-group">
                        <label>Nombre del Producto</label>
                        <input type="text" name="name" value="${p.name}" class="input-field" required>
                    </div>
                    <div class="form-group grid-2">
                        <div>
                            <label>Precio Costo</label>
                            <input type="number" step="0.01" name="cost" value="${p.cost}" class="input-field" required>
                        </div>
                        <div>
                            <label>Precio Venta</label>
                            <input type="number" step="0.01" name="price" value="${p.price}" class="input-field" required>
                        </div>
                    </div>
                    ${selectedBusinessId ? `
                    <div class="form-group">
                        <label>Existencia en ${db.businesses.find(b => b.id === selectedBusinessId).name}</label>
                        <input type="number" name="stock" value="${stock}" class="input-field" required>
                    </div>` : ''}
                    <div class="form-group">
                        <label>Categoría</label>
                        <input type="text" name="category" value="${p.category || ''}" class="input-field">
                    </div>
                    <div class="form-group">
                        <label>Cambiar Imagen</label>
                        <input type="file" accept="image/*" onchange="handleImageUploadEdit(this)" class="input-field">
                        <input type="hidden" name="image" id="product-image-data-edit" value="${p.image || ''}">
                        <div id="image-preview-edit" style="margin-top:1rem; text-align:center;">
                            ${p.image ? `<img src="${p.image}" style="width:100px; height:100px; border-radius:8px; object-fit:cover;">` : ''}
                        </div>
                    </div>
                    <div style="display:flex; gap:1rem; margin-top:2rem;">
                        <button type="submit" class="btn-primary" style="flex:1;">Actualizar</button>
                        <button type="button" class="btn-ghost" onclick="closeModal('edit-product-modal')">Cancelar</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function handleImageUploadEdit(input) {
    if (input.files && input.files[0]) {
        compressImage(input.files[0], (base64) => {
            document.getElementById('product-image-data-edit').value = base64;
            document.getElementById('image-preview-edit').innerHTML = `<img src="${base64}" style="width:100px; height:100px; border-radius:8px; object-fit:cover;">`;
        });
    }
}

async function updateProduct(id) {
    if (currentUser.role === 'seller') {
        alert("No tienes permisos para editar productos.");
        return;
    }
    const form = document.getElementById('edit-product-form');
    const formData = new FormData(form);
    const pIndex = db.products.findIndex(prod => prod.id === id);
    if (pIndex === -1) return;

    db.products[pIndex].name = formData.get('name');
    db.products[pIndex].cost = parseFloat(formData.get('cost'));
    db.products[pIndex].price = parseFloat(formData.get('price'));
    db.products[pIndex].category = formData.get('category');
    db.products[pIndex].image = formData.get('image');

    if (selectedBusinessId) {
        let inv = db.inventory.find(i => i.productId === id && i.businessId === selectedBusinessId);
        if (!inv) {
            inv = { businessId: selectedBusinessId, productId: id, quantity: 0 };
            db.inventory.push(inv);
        }
        inv.quantity = parseFloat(formData.get('stock'));
    }

    await saveData();
    addLog(`Producto actualizado: ${db.products[pIndex].name}`);
    closeModal('edit-product-modal');
    renderInventory(document.getElementById('content-area'));
}

function closeModal(id) {
    if (id) {
        const modal = document.getElementById(id);
        if (modal) modal.remove();
    } else {
        const modal = document.querySelector('.modal-overlay');
        if (modal) modal.remove();
    }
}

function handleInventoryImageClick(id) {
    document.getElementById(`inv-img-${id}`).click();
}

function handleInventoryImageUpload(id, input) {
    if (input.files && input.files[0]) {
        compressImage(input.files[0], (base64) => {
            const p = db.products.find(prod => prod.id === id);
            if (p) {
                p.image = base64;
                saveData();
                renderInventory(document.getElementById('content-area'));
                addLog(`Imagen de producto ${p.name} actualizada`, 'info');
            }
        });
    }
}

function showMermaModal(productId) {
    const p = db.products.find(prod => prod.id === productId);
    const qtyStr = prompt(`Registrar Merma para: ${p.name}\n¿Cuántas unidades se perdieron?`, "1");
    if (qtyStr === null) return;

    const qty = parseFloat(qtyStr);
    if (isNaN(qty) || qty <= 0) {
        alert("Cantidad no válida");
        return;
    }

    const businessId = selectedBusinessId || 1;
    const inv = db.inventory.find(i => i.productId === productId && i.businessId === businessId);

    if (!inv || inv.quantity < qty) {
        if (!confirm("El stock actual es menor a la merma indicada. ¿Continuar de todos modos y dejar stock en 0?")) return;
        if (inv) inv.quantity = 0;
    } else {
        inv.quantity -= qty;
    }

    db.waste.push({
        id: Date.now(),
        date: new Date().toLocaleString(),
        businessId: businessId,
        productId: productId,
        quantity: qty,
        user: currentUser.name
    });

    saveData();
    addLog(`Merma registrada: ${qty}x ${p.name}`, 'warning');
    renderInventory(document.getElementById('content-area'));
}

// --- CSV UTILS ---
function exportInventoryCSV() {
    const headers = ["ID", "Producto", "Categoria", "Stock", "Costo", "Precio Venta"];
    let rows = db.products.map(p => {
        const stock = selectedBusinessId ? (db.inventory.find(i => i.productId === p.id && i.businessId === selectedBusinessId)?.quantity || 0) :
            db.inventory.filter(i => i.productId === p.id).reduce((s, i) => s + i.quantity, 0);
        return [p.id, p.name, p.category, stock, p.cost, p.price];
    });

    let csvContent = "data:text/csv;charset=utf-8,"
        + headers.join(",") + "\n"
        + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `inventario_${selectedBusinessId || 'global'}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
}

function importInventoryCSV(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        const text = e.target.result;
        const lines = text.split('\n');
        // Ignorar cabecera
        for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(',');
            if (cols.length < 6) continue;

            const id = parseInt(cols[0]);
            const name = cols[1];
            const category = cols[2];
            const stock = parseFloat(cols[3]);
            const cost = parseFloat(cols[4]);
            const price = parseFloat(cols[5]);

            let p = db.products.find(prod => prod.id === id);
            if (p) {
                p.name = name;
                p.category = category;
                p.cost = cost;
                p.price = price;
            } else {
                p = { id: id || Date.now() + i, name, category, cost, price, alias: '', image: '' };
                db.products.push(p);
            }

            if (selectedBusinessId) {
                let inv = db.inventory.find(invItem => invItem.productId === p.id && invItem.businessId === selectedBusinessId);
                if (!inv) {
                    inv = { businessId: selectedBusinessId, productId: p.id, quantity: 0 };
                    db.inventory.push(inv);
                }
                inv.quantity = stock;
            }
        }
        await saveData();
        alert("Importación completada");
        renderInventory(document.getElementById('content-area'));
    };
    reader.readAsText(file);
}

// --- PDF EXPORT ---
async function exportInventoryPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const businessName = selectedBusinessId ? db.businesses.find(b => b.id === selectedBusinessId).name : 'Global';

    doc.setFontSize(18);
    doc.text(`Inventario: ${businessName}`, 14, 20);
    doc.setFontSize(10);
    doc.text(`Generado el: ${new Date().toLocaleString()}`, 14, 28);

    const products = db.products.map(p => {
        const stock = selectedBusinessId ? (db.inventory.find(i => i.productId === p.id && i.businessId === selectedBusinessId)?.quantity || 0) :
            db.inventory.filter(i => i.productId === p.id).reduce((s, i) => s + i.quantity, 0);
        return [p.name, p.category, stock, `$${p.cost.toFixed(2)}`, `$${p.price.toFixed(2)}`];
    });

    doc.autoTable({
        head: [['Producto', 'Categoría', 'Existencia', 'Costo', 'Venta']],
        body: products,
        startY: 35,
        theme: 'grid',
        headStyles: { fillColor: [63, 185, 80] }
    });

    doc.save(`Inventario_${businessName}.pdf`);
}

// --- SALE DETAIL ---

async function showSaleDetail(saleId) {
    const s = db.sales.find(sale => sale.id === saleId);
    if (!s) return;

    const modalHtml = `
        <div id="sale-detail-modal" class="modal-overlay" style="display:flex; align-items:flex-start; padding-top:5vh;">
            <div class="card" style="width:700px; max-height:90vh; overflow-y:auto; padding:2rem; position:relative;">
                <button class="btn-icon" style="position:absolute; right:1.5rem; top:1.5rem;" onclick="closeModal('sale-detail-modal')"><i class="ph ph-x"></i></button>
                
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; border-bottom:1px solid var(--border); padding-bottom:1rem;">
                    <div>
                        <h2 style="margin:0;">Detalle de Venta #${s.id.toString().slice(-6)}</h2>
                        <div style="color:var(--text-muted);">${s.date} | ${db.businesses.find(b => String(b.id) === String(s.businessId))?.name}</div>
                    </div>
                    <span class="badge ${s.status === 'closed' ? 'badge-success' : 'badge-warning'}">
                        ${s.status === 'closed' ? 'Cerrada' : (s.status === 'pending' ? 'Pendiente' : 'Abierta')}
                    </span>
                </div>

                <div class="grid-2" style="margin-bottom:1.5rem; background:var(--bg-dark); padding:1rem; border-radius:8px;">
                    <div>
                        <small style="color:var(--text-muted); display:block;">Vendedor</small>
                        <strong>${s.seller || 'Sistema'}</strong>
                    </div>
                    <div>
                        <small style="color:var(--text-muted); display:block;">Horario de Venta</small>
                        <strong>${s.openTime || '--:--'} - ${s.closeTime || '--:--'}</strong>
                    </div>
                </div>

                ${s.type === 'daily_closure' ? `
                <h3 style="margin-bottom:1rem;">Desglose de Arqueo (Cierre de Día)</h3>
                <div class="grid-2" style="gap:1rem; margin-bottom:1.5rem;">
                    <div class="card" style="background:var(--bg-dark); padding:1rem; border: 1px solid var(--border);">
                        <h4 style="color:var(--success); margin-bottom:0.75rem; display:flex; align-items:center; gap:0.5rem;">
                            <i class="ph ph-money"></i> Efectivo
                        </h4>
                        <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
                            <span>Esperado:</span> <strong>$${(s.expectedCash || 0).toFixed(2)}</strong>
                        </div>
                        <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
                            <span>Real:</span> <strong>$${(s.cashReal || 0).toFixed(2)}</strong>
                        </div>
                        <div style="display:flex; justify-content:space-between; border-top:1px solid var(--border); padding-top:0.5rem; color: ${s.cashDiff < 0 ? 'var(--danger)' : (s.cashDiff > 0 ? 'var(--primary)' : 'var(--success)')};">
                            <span>Diferencia:</span> <strong>$${(s.cashDiff || 0).toFixed(2)}</strong>
                        </div>
                    </div>
                    <div class="card" style="background:var(--bg-dark); padding:1rem; border: 1px solid var(--border);">
                        <h4 style="color:var(--primary); margin-bottom:0.75rem; display:flex; align-items:center; gap:0.5rem;">
                            <i class="ph ph-arrows-left-right"></i> Transferencia
                        </h4>
                        <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
                            <span>Esperado:</span> <strong>$${(s.expectedTransfer || 0).toFixed(2)}</strong>
                        </div>
                        <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
                            <span>Real:</span> <strong>$${(s.transferReal || 0).toFixed(2)}</strong>
                        </div>
                        <div style="display:flex; justify-content:space-between; border-top:1px solid var(--border); padding-top:0.5rem; color: ${s.transferDiff < 0 ? 'var(--danger)' : (s.transferDiff > 0 ? 'var(--primary)' : 'var(--success)')};">
                            <span>Diferencia:</span> <strong>$${(s.transferDiff || 0).toFixed(2)}</strong>
                        </div>
                    </div>
                </div>

                <div style="background:rgba(255,255,255,0.03); padding:1rem; border-radius:12px; margin-bottom:1.5rem;">
                    <h4 style="margin-top:0; font-size:0.9rem; color:var(--text-muted);">RESUMEN TOTAL</h4>
                    <div style="display:flex; justify-content:space-between; font-size:1.1rem; font-weight:bold;">
                        <span>Total Arqueado:</span>
                        <span style="color:var(--primary);">$${((s.cashReal || 0) + (s.transferReal || 0)).toFixed(2)}</span>
                    </div>
                </div>

                ${s.additionalInfo ? `
                <div style="margin-bottom:1.5rem;">
                    <h4 style="margin-bottom:0.5rem;">Notas de Justificación</h4>
                    <div style="background:var(--bg-dark); padding:1rem; border-radius:8px; font-style:italic; border-left:4px solid var(--primary);">
                        "${s.additionalInfo}"
                    </div>
                </div>` : ''}

                <div style="margin-bottom:1.5rem;">
                    <h4 style="margin-bottom:0.5rem;">Ventas Incluidas (${s.salesIds ? s.salesIds.length : 0})</h4>
                    <div style="font-size:0.8rem; color:var(--text-muted); display:flex; flex-wrap:wrap; gap:0.5rem;">
                        ${s.salesIds ? s.salesIds.map(id => `<span class="badge" style="background:var(--bg-dark);">#${id.toString().slice(-6)}</span>`).join('') : 'Ninguna'}
                    </div>
                </div>

                ` : `
                <h3 style="margin-bottom:1rem;">Productos</h3>
                <table style="width:100%; border-collapse:collapse; margin-bottom:1.5rem;">
                    <thead>
                        <tr style="text-align:left; border-bottom:1px solid var(--border); color:var(--text-muted); font-size:0.9rem;">
                            <th style="padding:0.5rem;">Producto</th>
                            <th style="padding:0.5rem; text-align:center;">Cant</th>
                            <th style="padding:0.5rem; text-align:right;">Precio</th>
                            <th style="padding:0.5rem; text-align:right;">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${s.items ? s.items.map(i => `
                            <tr style="border-bottom:1px solid var(--bg-dark);">
                                <td style="padding:0.75rem 0.5rem;">${i.name}</td>
                                <td style="padding:0.75rem 0.5rem; text-align:center;">${i.qty}</td>
                                <td style="padding:0.75rem 0.5rem; text-align:right;">$${i.price.toFixed(2)}</td>
                                <td style="padding:0.75rem 0.5rem; text-align:right;">$${(i.qty * i.price).toFixed(2)}</td>
                            </tr>
                        `).join('') : '<tr><td colspan="4">No hay items</td></tr>'}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="3" style="padding:1rem 0.5rem; font-weight:bold; text-align:right;">TOTAL:</td>
                            <td style="padding:1rem 0.5rem; font-weight:bold; text-align:right; color:var(--primary); font-size:1.2rem;">$${s.total.toFixed(2)}</td>
                        </tr>
                    </tfoot>
                </table>

                <div style="display:flex; justify-content:space-between; margin-bottom:1rem; padding:1rem; background:var(--bg-dark); border-radius:8px;">
                     <div>
                        <span style="color:var(--text-muted); font-size:0.8rem;">Método de Pago</span>
                        <div style="font-weight:bold;"><i class="ph ph-${s.paymentMethod === 'transfer' ? 'arrows-left-right' : 'money'}"></i> ${s.paymentMethod === 'transfer' ? 'Transferencia' : 'Efectivo'}</div>
                     </div>
                     <div style="text-align:right;">
                        <span style="color:var(--text-muted); font-size:0.8rem;">Estado</span>
                        <div class="badge ${s.status === 'closed' ? 'badge-success' : 'badge-warning'}">${s.status === 'closed' ? 'Cerrada' : 'Registrada'}</div>
                     </div>
                </div>
                `}

                <div style="display:flex; gap:1rem; margin-top:2rem; padding-top:1rem; border-top:1px solid var(--border);">
                    ${(currentUser.role === 'owner' || currentUser.role === 'admin' || (s.status === 'registered' && s.seller === currentUser.name)) && s.type !== 'daily_closure' ? `
                        <button class="btn-primary" onclick="showEditSaleModal(${s.id})" style="flex:1;">
                            <i class="ph ph-pencil"></i> Editar
                        </button>
                    ` : ''}
                    
                    ${s.status === 'pending' && (currentUser.role === 'owner' || currentUser.role === 'admin') ? `
                        <button class="btn-primary" onclick="approveSale(${s.id})" style="flex:1; background:var(--success);">
                            <i class="ph ph-check"></i> Aprobar Cierre
                        </button>
                    ` : ''}

                    ${(currentUser.role === 'owner' || currentUser.role === 'admin' || (s.status === 'registered' && s.seller === currentUser.name)) ? `
                        <button class="btn-ghost" style="flex:1; color:var(--danger);" onclick="deleteSaleAction(${s.id})">
                            <i class="ph ph-trash"></i> Eliminar
                        </button>
                    ` : ''}
                    <button class="btn-ghost" onclick="closeModal('sale-detail-modal')" style="flex:1;">Cerrar</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

async function deleteSaleAction(id, force = false) {
    const s = db.sales.find(sale => sale.id === id);
    if (!s) return;

    // Se requiere aprobación a menos que sea el Dueño o se pase 'force' (desde aprobación)
    if (!force) {
        if (currentUser.role === 'owner') {
            if (!confirm(`¿Eliminar venta #${id.toString().slice(-6)}? El stock se devolverá.`)) return;
            force = true;
        } else if (currentUser.role === 'admin') {
            if (db.settings.allowAdminDeleteSales) {
                if (confirm(`¿Eliminar esta venta?`)) force = true;
                else return;
            } else {
                alert("Necesita permisos para hacer esta acción. Solicite aprobación si es necesario.");
                if (confirm("¿Enviar solicitud de eliminación al Dueño?")) sendDeleteRequest(s);
                return;
            }
        } else {
            // Vendedor
            alert("Necesita permisos para hacer esta acción en el historial general.");
            if (confirm("¿Solicitar eliminación de esta venta antigua al Administrador?")) sendDeleteRequest(s);
            return;
        }
    }

    if (force) {
        // Restaurar inventario
        if (s.items) {
            s.items.forEach(item => {
                const inv = db.inventory.find(invI => invI.productId === (item.productId || item.id) && invI.businessId === s.businessId);
                if (inv) inv.quantity += item.qty;
            });
        }
        db.sales = db.sales.filter(sale => sale.id !== id);
        db.notifications = db.notifications.filter(n => !(n.refId === id && n.type === 'delete_request'));
        await saveData();
        addLog(`Venta #${id.toString().slice(-6)} eliminada. Stock restaurado.`, 'warning');
        alert("Venta eliminada con éxito.");

        if (currentView === 'ventas') renderVentas(document.getElementById('content-area'));
        if (currentView === 'pos') renderPOS(document.getElementById('content-area'));
        closeModal('sale-detail-modal');
    }
}

function sendDeleteRequest(s) {
    db.notifications.unshift({
        id: Date.now(),
        type: 'delete_request',
        refId: s.id,
        businessId: s.businessId,
        title: `Solicitud de Borrado: ${currentUser.name}`,
        message: `Venta de $${s.total.toFixed(2)} por ${s.seller}. "Error en el registro de hoy".`,
        status: 'pending',
        date: new Date().toLocaleString()
    });
    saveData();
    alert("Solicitud enviada para aprobación.");
}

function approveSale(id) {
    const s = db.sales.find(sale => sale.id === id);
    if (!s) return;
    s.status = 'closed';
    saveData();
    addLog(`Cierre de venta aprobado: #${id.toString().slice(-6)} `, 'success');
    closeModal('sale-detail-modal');
    renderVentas(document.getElementById('content-area'));
}

function editSale(id) {
    if (!confirm("¿Deseas editar esta venta? Los cambios afectarán el inventario.")) return;
    closeModal('sale-detail-modal');
    showEditSaleModal(id);
}

// --- UTILS ---
function applyTheme(theme) {
    document.body.className = (theme === 'light') ? 'theme-light' : '';
}

async function exportDB() {
    const data = JSON.stringify(db, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bizcontrol_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
}

// --- POS CLOSURE ---
function openPOSClosureModal() {
    const today = new Date().toISOString().split('T')[0];
    const registeredSales = db.sales.filter(s =>
        s.date.startsWith(today) &&
        s.seller === currentUser.name &&
        s.status === 'registered' &&
        (selectedBusinessId ? s.businessId === selectedBusinessId : true)
    );

    // Calcular totales esperados (New: use s.payment object)
    const expectedCash = registeredSales.reduce((sum, s) => sum + (s.payment?.cash || (s.paymentMethod === 'cash' ? s.total : 0)), 0);
    const expectedTransfer = registeredSales.reduce((sum, s) => sum + (s.payment?.transfer || (s.paymentMethod === 'transfer' ? s.total : 0)), 0);
    const totalExpected = expectedCash + expectedTransfer;

    // Daily Returns
    const dailyReturns = db.dailyReturns || 0;

    // Times
    const firstSale = registeredSales.length > 0 ? registeredSales[registeredSales.length - 1] : null; // Sales are unshifted, so last is first
    const openingTime = firstSale ? (firstSale.date.split(' ')[1] || '08:00') : '08:00';
    const closingTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (posCart.length > 0) {
        if (!confirm("Tienes productos en el carrito. ¿Deseas ignorarlos y proceder con el arqueo de las ventas ya registradas?")) return;
    }

    if (registeredSales.length === 0) {
        alert("No tienes ventas registradas hoy para realizar el arqueo.");
        return;
    }

    const modalHtml = `
    <div id="pos-closure-modal" class="modal-overlay" style="display:flex;">
        <div class="card" style="width:650px; padding:2.5rem; max-height:95vh; overflow-y:auto; border-radius:24px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2rem;">
                <div>
                    <h2 style="margin:0; font-size:1.8rem;">Solicitud de Cierre</h2>
                    <p style="color:var(--text-muted); margin:0.5rem 0 0 0;">${new Date().toLocaleDateString()} | ${currentUser.name}</p>
                    <p style="font-size:0.8rem; color:var(--primary);">Horario: ${openingTime} - ${closingTime}</p>
                </div>
                <div style="text-align:right;">
                    <div style="font-size:0.8rem; color:var(--text-muted); font-weight:600;">VENTAS BRUTAS</div>
                    <div style="font-size:1.5rem; font-weight:bold; color:var(--primary);">$${totalExpected.toFixed(2)}</div>
                    ${dailyReturns > 0 ? `<div style="font-size:0.8rem; color:var(--danger); font-weight:600;">DEVOLUCIONES: -$${dailyReturns.toFixed(2)}</div>` : ''}
                </div>
            </div>

            <form id="pos-closure-form" onsubmit="event.preventDefault(); finalizePOSSale();">
                <input type="hidden" name="totalExpected" value="${totalExpected}">
                <input type="hidden" name="dailyReturns" value="${dailyReturns}">
                <input type="hidden" name="openingTime" value="${openingTime}">
                <input type="hidden" name="closingTime" value="${closingTime}">
                
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:1.5rem; margin-bottom:2rem;">
                    <!-- Columna EFECTIVO -->
                    <div style="background:rgba(255,255,255,0.03); padding:1.5rem; border-radius:16px; border:1px solid var(--border);">
                        <h3 style="margin:0 0 1rem 0; color:var(--success); display:flex; align-items:center; gap:0.5rem;">
                            <i class="ph ph-money"></i> Efectivo
                        </h3>
                        <div style="margin-bottom:1rem;">
                            <label style="font-size:0.75rem; color:var(--text-muted);">Esperado (Ventas)</label>
                            <div style="font-size:1.2rem; font-weight:bold;">$${expectedCash.toFixed(2)}</div>
                        </div>
                        <div class="form-group">
                            <label>Efectivo en Caja</label>
                            <input type="number" step="0.01" name="cashReal" class="input-field" placeholder="0.00" required 
                                   oninput="updateAuditDiff('cash', ${expectedCash}, this.value)">
                            <div id="cash-diff-label" style="font-size:0.8rem; margin-top:0.5rem; font-weight:600;"></div>
                        </div>
                    </div>

                    <!-- Columna TRANSFERENCIA -->
                    <div style="background:rgba(255,255,255,0.03); padding:1.5rem; border-radius:16px; border:1px solid var(--border);">
                        <h3 style="margin:0 0 1rem 0; color:var(--primary); display:flex; align-items:center; gap:0.5rem;">
                            <i class="ph ph-arrows-left-right"></i> Transf.
                        </h3>
                        <div style="margin-bottom:1rem;">
                            <label style="font-size:0.75rem; color:var(--text-muted);">Esperado (Ventas)</label>
                            <div style="font-size:1.2rem; font-weight:bold;">$${expectedTransfer.toFixed(2)}</div>
                        </div>
                        <div class="form-group">
                            <label>Confirmado en Banco</label>
                            <input type="number" step="0.01" name="transferReal" class="input-field" placeholder="0.00" required
                                   oninput="updateAuditDiff('transfer', ${expectedTransfer}, this.value)">
                            <div id="transfer-diff-label" style="font-size:0.8rem; margin-top:0.5rem; font-weight:600;"></div>
                        </div>
                    </div>
                <div class="form-group">
                    <label>Justificación / Notas</label>
                    <textarea name="additionalInfo" class="input-field" style="height:100px; resize:none;" placeholder="Notas adicionales sobre el cierre..."></textarea>
                </div>

                <div style="display:flex; gap:1rem; margin-top:2.5rem;">
                    <button type="submit" class="btn-primary" style="flex:2; height:55px; border-radius:12px; font-weight:bold; font-size:1.1rem;">
                        <i class="ph ph-lock-key"></i> ENVIAR SOLICITUD DE CIERRE
                    </button>
                    <button type="button" class="btn-ghost" onclick="closeModal('pos-closure-modal')" style="flex:1;">CANCELAR</button>
                </div>
            </form>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function updateAuditDiff(type, expected, realValue) {
    const real = parseFloat(realValue || 0);
    const diff = real - expected;
    const label = document.getElementById(`${type} -diff - label`);
    if (!label) return;

    if (Math.abs(diff) < 0.01) {
        label.innerHTML = '<span style="color:var(--success);"><i class="ph ph-check-circle"></i> Caja Cuadra</span>';
    } else if (diff > 0) {
        label.innerHTML = `< span style = "color:var(--primary);" > <i class="ph ph-plus-circle"></i> Sobrante: $${diff.toFixed(2)}</span > `;
    } else {
        label.innerHTML = `< span style = "color:var(--danger);" > <i class="ph ph-minus-circle"></i> Faltante: $${Math.abs(diff).toFixed(2)}</span > `;
    }
}

async function finalizePOSSale() {
    const form = document.getElementById('pos-closure-form');
    if (!form) return;
    const formData = new FormData(form);
    const businessId = String(selectedBusinessId || 'mch1');
    const today = new Date().toISOString().split('T')[0];

    const totalExpected = parseFloat(formData.get('totalExpected'));
    const expectedCash = parseFloat(formData.get('expectedCash'));
    const expectedTransfer = parseFloat(formData.get('expectedTransfer'));
    const dailyReturns = parseFloat(formData.get('dailyReturns'));
    const openingTime = formData.get('openingTime');
    const closingTime = formData.get('closingTime');
    const cashReal = parseFloat(formData.get('cashReal') || 0);
    const transferReal = parseFloat(formData.get('transferReal') || 0);
    const additionalInfo = formData.get('additionalInfo') || '';

    const closureId = Date.now();
    const request = {
        id: closureId,
        type: 'closure_request',
        businessId: businessId,
        title: `Solicitud de Cierre: ${currentUser.name} `,
        message: `Total: $${totalExpected.toFixed(2)} | Ret: $${dailyReturns.toFixed(2)} | Efectivo: $${cashReal.toFixed(2)} | Transf: $${transferReal.toFixed(2)} `,
        data: {
            businessId,
            seller: currentUser.name,
            totalExpected,
            expectedCash,
            expectedTransfer,
            dailyReturns,
            openingTime,
            closingTime,
            cashReal,
            transferReal,
            additionalInfo,
            date: today
        },
        status: 'pending',
        date: new Date().toLocaleString()
    };

    if (!db.notifications) db.notifications = [];
    db.notifications.unshift(request);
    db.dailyReturns = 0;
    await saveData();
    alert("Solicitud de cierre enviada al Administrador.");
    closeModal('pos-closure-modal');
    navigateTo('dashboard');
}

function showNotificationsModal() {
    const pendingNotifs = db.notifications.filter(n => n.status === 'pending');
    const modalHtml = `
        < div id = "notifications-modal" class="modal-overlay" style = "display:flex;" >
            <div class="card" style="width:500px; max-height:80vh; overflow-y:auto; padding:2rem;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
                    <h2 style="margin:0;"><i class="ph ph-bell"></i> Notificaciones</h2>
                    <button class="btn-icon" onclick="closeModal('notifications-modal')"><i class="ph ph-x"></i></button>
                </div>
                ${pendingNotifs.length === 0 ? '<p style="text-align:center; color:var(--text-muted);">No hay notificaciones pendientes</p>' :
            pendingNotifs.map(n => `
                    <div class="card" style="margin-bottom:1rem; padding:1rem; border:1px solid var(--border); background:rgba(255,255,255,0.02);">
                        <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
                            <strong style="color:var(--primary);">${n.title}</strong>
                            <small style="color:var(--text-muted);">${n.date}</small>
                        </div>
                        <p style="font-size:0.9rem; margin-bottom:1.5rem;">${n.message}</p>
                        <div style="display:flex; gap:0.5rem;">
                            ${n.type === 'closure_request' ? `
                                <button class="btn-primary" style="flex:1;" onclick="reviewClosureRequest(${n.id})">Revisar</button>
                            ` : ''}
                            <button class="btn-ghost" onclick="markNotificationAsRead(${n.id})">Ignorar</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div >
        `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function markNotificationAsRead(id) {
    const notif = db.notifications.find(n => n.id === id);
    if (notif) {
        notif.status = 'read';
        saveData();
        closeModal('notifications-modal');
        renderSidebar(currentView);
    }
}

function reviewClosureRequest(notifId) {
    const notif = db.notifications.find(n => n.id === notifId);
    if (!notif) return;
    const d = notif.data;

    const modalHtml = `
        <div id="review-closure-modal" class="modal-overlay" style="display:flex;">
            <div class="card" style="width:600px; padding:2rem; max-height:90vh; overflow-y:auto;">
                <h2 style="margin-bottom:1.5rem;">Revisión de Cierre: ${d.seller}</h2>
                <div style="background:var(--bg-dark); padding:1rem; border-radius:8px; margin-bottom:1.5rem; display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
                    <div><small style="color:var(--text-muted);">Negocio:</small> <br><strong>${db.businesses.find(b => b.id === d.businessId)?.name || d.businessId}</strong></div>
                    <div><small style="color:var(--text-muted);">Horario:</small> <br><strong>${d.openingTime} - ${d.closingTime}</strong></div>
                    <div><small style="color:var(--text-muted);">Ventas Brutas:</small> <br><strong>$${d.totalExpected.toFixed(2)}</strong></div>
                    <div><small style="color:var(--text-muted);">Devoluciones:</small> <br><strong style="color:var(--danger);">-$${d.dailyReturns.toFixed(2)}</strong></div>
                </div>

                <div class="grid-2" style="gap:1rem; margin-bottom:1.5rem;">
                    <div style="border:1px solid var(--border); padding:1rem; border-radius:8px;">
                        <h4 style="color:var(--success); margin-bottom:0.5rem;"><i class="ph ph-money"></i> Efectivo</h4>
                        <div>Esperado: $${d.expectedCash.toFixed(2)}</div>
                        <div style="margin-top:0.5rem;">
                            <label style="font-size:0.8rem;">Monto Real (Editable)</label>
                            <input type="number" step="0.01" id="review-cash-real" class="input-field" value="${d.cashReal}">
                        </div>
                    </div>
                    <div style="border:1px solid var(--border); padding:1rem; border-radius:8px;">
                        <h4 style="color:var(--primary); margin-bottom:0.5rem;"><i class="ph ph-arrows-left-right"></i> Transf.</h4>
                        <div>Esperado: $${d.expectedTransfer.toFixed(2)}</div>
                        <div style="margin-top:0.5rem;">
                            <label style="font-size:0.8rem;">Confirmado Banco</label>
                            <input type="number" step="0.01" id="review-transfer-real" class="input-field" value="${d.transferReal}">
                        </div>
                    </div>
                </div>

                <div class="form-group">
                    <label>Notas del Vendedor</label>
                    <div style="padding:0.75rem; background:rgba(255,255,255,0.05); border-radius:8px; font-style:italic;">"${d.additionalInfo || 'Sin notas'}"</div>
                </div>
                
                <div class="form-group">
                    <label>Comentarios del Revisor (Opcional)</label>
                    <textarea id="review-admin-notes" class="input-field" style="height:80px;"></textarea>
                </div>

                <div style="display:flex; gap:1rem; margin-top:2rem;">
                    <button class="btn-primary" style="flex:2; background:var(--success);" onclick="approveClosure('${notifId}')">APROBAR Y CERRAR DÍA</button>
                    <button class="btn-ghost" style="flex:1;" onclick="closeModal('review-closure-modal')">CANCELAR</button>
                </div>
            </div>
        </div>
    `;
    showModal('review-closure-modal', modalHtml);
}

async function approveClosure(notifId) {
    const notif = db.notifications.find(n => n.id == notifId);
    if (!notif) return;
    const d = notif.data;

    const cashReal = parseFloat(document.getElementById('review-cash-real').value);
    const transferReal = parseFloat(document.getElementById('review-transfer-real').value);
    const adminNotes = document.getElementById('review-admin-notes').value;

    const cashDiff = cashReal - d.expectedCash;
    const transferDiff = transferReal - d.expectedTransfer;

    // 1. Create Closure Record
    const closureRecord = {
        id: Date.now(),
        type: 'daily_closure',
        date: new Date().toISOString().replace('T', ' ').split('.')[0],
        businessId: d.businessId,
        seller: d.seller,
        openingTime: d.openingTime,
        closingTime: d.closingTime,
        totalSales: d.totalExpected,
        dailyReturns: d.dailyReturns,
        expectedCash: d.expectedCash,
        expectedTransfer: d.expectedTransfer,
        cashReal: cashReal,
        transferReal: transferReal,
        cashDiff: cashDiff,
        transferDiff: transferDiff,
        additionalInfo: d.additionalInfo,
        adminNotes: adminNotes,
        status: 'closed'
    };

    // 2. Mark sales as closed
    db.sales.forEach(s => {
        if (s.date.startsWith(d.date) && s.seller === d.seller && s.status === 'registered' && s.businessId === d.businessId) {
            s.status = 'closed';
        }
    });

    // 3. Add to sales (as a closure record)
    db.sales.unshift(closureRecord);

    // 4. Update notification
    notif.status = 'approved';
    notif.message += " (APROBADO)";

    await saveData();
    alert("Cierre aprobado con éxito.");
    closeModal('review-closure-modal');
    closeModal('notifications-modal');
    navigateTo('ventas');
}

// --- BOOTSTRAP ---
window.addEventListener('DOMContentLoaded', async () => {
    console.log("App starting...");
    await loadData();
    setupNotifications();
    renderNotifications(); // Cargar contador inicial
    navigateTo('dashboard');
});

/* =============================================================
   PARCHE DE EMERGENCIA - FUNCIONES GLOBALES (POWERED BY ANTIGRAVITY)
   Garantiza que los botones del HTML siempre tengan acceso a la lógica.
   ============================================================= */

// Helper para abrir modales si el sistema lo requiere
window.openModal = function (id) {
    const m = document.getElementById(id);
    if (m) m.classList.remove('hidden');
    else console.warn("Modal no encontrado:", id);
};

// Helper para cerrar modales (Soporta estáticos y dinámicos)
window.closeModal = function (id) {
    const m = document.getElementById(id);
    if (!m) return;

    // Si es un modal estático definido en el HTML (usamos la clase hidden)
    if (m.classList.contains('static-modal') || id === 'incidentModal') {
        m.classList.add('hidden');
    } else {
        // Si es un modal dinámico creado por showModal()
        m.classList.add('fade-out');
        setTimeout(() => {
            if (m.parentNode) m.parentNode.removeChild(m);
        }, 200);
    }
};

// 1. Forzar la función de EDITAR al ámbito global
window.editSale = async function (id) {
    console.log("🚀 [BRIDGE] Intentando editar venta ID:", id);
    if (!currentUser) return alert("Error: Sesión no válida.");

    // Buscador robusto que soporta ID como string o number
    const sale = db.sales.find(s => String(s.id) === String(id));
    if (!sale) {
        console.error("Venta no encontrada para ID:", id);
        return alert("Error: Venta no encontrada (#" + String(id).slice(-4) + ")");
    }

    const isOwnerOrAdmin = currentUser.role === 'owner' || currentUser.role === 'admin';
    const today = new Date().toISOString().split('T')[0];
    const isToday = sale.date && sale.date.startsWith(today);

    if (sale.status === 'closed' && !isOwnerOrAdmin) {
        return alert("Solo el Administrador puede editar una venta ya cerrada.");
    }

    if (!confirm("¿Deseas editar esta venta? Los cambios se aplicarán al volver a cobrar.")) return;

    // Cargar en el carrito (Arquitectura actual)
    editingSaleId = sale.id;
    posCart = (sale.items || []).map(i => ({
        id: i.productId || i.id,
        name: i.name,
        price: i.price,
        qty: i.qty,
        image: db.products.find(p => String(p.id) === String(i.productId || i.id))?.image || ''
    }));

    if (currentView !== 'pos') {
        navigateTo('pos');
    } else {
        renderPOS(document.getElementById('content-area'));
    }

    console.log("✅ Venta cargada en carrito para edición.");
    alert("Venta cargada en el carrito. Modifica lo necesario y presiona COBRAR.");
};

// 2. Forzar la función de BORRAR al ámbito global
window.deleteSale = async function (id) {
    console.log("🗑️ [BRIDGE] Intentando borrar venta ID:", id);
    if (!currentUser) return alert("Error de sesión.");

    const sale = db.sales.find(s => String(s.id) === String(id));
    if (!sale) return alert("Error: Venta no encontrada.");

    if (!confirm("⚠️ ¿Estás seguro de eliminar esta venta permanentemente?\nEl stock se restaurará automáticamente.")) {
        return;
    }

    const index = db.sales.findIndex(s => String(s.id) === String(id));
    if (index > -1) {
        // Devolución monetaria si es del día actual
        const today = new Date().toISOString().split('T')[0];
        if (sale.date && sale.date.startsWith(today)) {
            if (!db.dailyReturns) db.dailyReturns = 0;
            db.dailyReturns += (sale.total || 0);
        }

        // Restaurar stock
        if (sale.items) {
            sale.items.forEach(item => {
                const inv = db.inventory.find(i => String(i.productId) === String(item.productId || item.id) && String(i.businessId) === String(sale.businessId));
                if (inv) inv.quantity += item.qty;
                else db.inventory.push({ productId: item.productId || item.id, businessId: sale.businessId, quantity: item.qty });
            });
        }

        db.sales.splice(index, 1);
        addLog(`Venta #${String(id).slice(-4)} eliminada. Stock restaurado.`, 'warning');

        await saveData();
        alert("Venta eliminada y stock restaurado.");

        // Refrescar vista
        if (currentView === 'pos') {
            renderTodaySalesList();
            renderPOS(document.getElementById('content-area'));
        } else if (currentView === 'ventas' || currentView === 'daily-records') {
            renderVentas(document.getElementById('content-area'));
        }
        if (typeof renderDashboard === 'function') renderDashboard(null);
    }
};

// Exposición de funciones UI y Gestión
// Exposición de funciones UI y Gestión
window.navigateTo = navigateTo;
if (typeof showSaleDetail === 'function') window.showSaleDetail = showSaleDetail;
if (typeof editSale === 'function') window.editSale = editSale;
if (typeof deleteSale === 'function') window.deleteSale = deleteSale;
window.processIncident = processIncident;
window.openIncidentModal = openIncidentModal;
window.updateIncidentUI = updateIncidentUI;
window.addToCart = addToCart;
window.adjustPOSQty = adjustPOSQty;
window.removeFromCart = removeFromCart;
window.showPaymentModal = showPaymentModal;
window.registerIndividualSale = registerIndividualSale;
window.cancelPOSEdit = cancelPOSEdit;
window.openExpenseModal = openExpenseModal;
window.confirmExpense = confirmExpense;
window.handlePOSSearch = handlePOSSearch;
window.setPaymentMethod = setPaymentMethod;
window.validatePaymentSplit = validatePaymentSplit;
window.changeBusinessContext = changeBusinessContext;
window.logout = logout;
window.markAllNotificationsAsSeen = markAllNotificationsAsSeen;
window.handleNotificationClick = handleNotificationClick;
window.showNotificationsModal = showNotificationsModal;

// Funciones de Inventario y Mermas (Se asignan directamente para evitar recursión)
if (typeof showWasteModal === 'function') window.showWasteModal = showWasteModal;
if (typeof handleSaveWaste === 'function') window.handleSaveWaste = handleSaveWaste;
if (typeof approveWaste === 'function') window.approveWaste = approveWaste;
if (typeof showAddProductModal === 'function') window.showAddProductModal = showAddProductModal;
if (typeof showEditProductModal === 'function') window.showEditProductModal = showEditProductModal;
if (typeof saveNewProduct === 'function') window.saveNewProduct = saveNewProduct;
if (typeof updateProduct === 'function') window.updateProduct = updateProduct;
if (typeof exportInventoryPDF === 'function') window.exportInventoryPDF = exportInventoryPDF;
if (typeof exportInventoryCSV === 'function') window.exportInventoryCSV = exportInventoryCSV;
if (typeof importInventoryCSV === 'function') window.importInventoryCSV = importInventoryCSV;
if (typeof handleInventoryImageClick === 'function') window.handleInventoryImageClick = handleInventoryImageClick;
if (typeof handleInventoryImageUpload === 'function') window.handleInventoryImageUpload = handleInventoryImageUpload;
