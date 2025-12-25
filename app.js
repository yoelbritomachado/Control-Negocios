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
            if (!db.sales && db.transactions) {
                db.sales = db.transactions;
                delete db.transactions;
            }
            ['businesses', 'products', 'inventory', 'sales', 'waste', 'logs', 'extraMovements', 'purchases', 'employees', 'attendance', 'loans', 'commissions', 'notifications'].forEach(key => {
                if (!db[key]) db[key] = [];
            });
            if (!db.settings) db.settings = { theme: 'dark', allowAdminTransfer: false, allowAdminDelete: false, allowAdminEditInventory: false, allowAdminEditSales: false };

            // Sync Businesses
            const expectedBusinesses = [
                { id: 1, name: 'Almacén MCH', code: 'ALM', color: '#58a6ff', icon: 'ph-warehouse' },
                { id: 2, name: 'MCH 1', code: 'MCH1', color: '#3fb950', icon: 'ph-storefront' },
                { id: 3, name: 'MCH 2', code: 'MCH2', color: '#d29922', icon: 'ph-shopping-bag' }
            ];
            expectedBusinesses.forEach(eb => {
                const existing = db.businesses.find(b => b.id === eb.id);
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
                    { id: 1, name: 'Dueño', role: 'owner', pin: '1234', email: 'dueño@mch.com' },
                    { id: 2, name: 'Vendedor 1', role: 'seller', pin: '0000', email: 'vendedor1@mch.com' },
                    { id: 3, name: 'Administrador', role: 'admin', pin: '1111', email: 'admin@mch.com' }
                ];
            }
        } else {
            // Initial seed if no data
            await initializeDatabase();
        }

        // Auto-import if empty
        if (typeof REAL_INVENTORY !== 'undefined' && db.products.length < 10) {
            console.log("Auto-importing initial inventory...");
            await importRealData();
        }

        console.log("Data loaded successfully.");
        applyTheme(db.settings.theme);
    } catch (error) {
        console.error('Error loading data:', error);
        await initializeDatabase();
    }
}

async function initializeDatabase() {
    db.businesses = [
        { id: 1, name: 'Almacén MCH', code: 'ALM', icon: 'ph-warehouse', color: '#58a6ff' },
        { id: 2, name: 'MCH 1', code: 'MCH1', icon: 'ph-storefront', color: '#3fb950' },
        { id: 3, name: 'MCH 2', code: 'MCH2', icon: 'ph-shopping-bag', color: '#d29922' }
    ];
    db.users = [
        { id: 1, name: 'Dueño', role: 'owner', pin: '1234', email: 'dueño@mch.com' },
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
        { data: REAL_INVENTORY.almacen, id: 1, name: "Almacen" },
        { data: REAL_INVENTORY.mch1, id: 2, name: "MCH 1" },
        { data: REAL_INVENTORY.mch2, id: 3, name: "MCH 2" }
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
                ${businessOptions.map(b => `<option value="${b.id === null ? 'global' : b.id}" ${selectedBusinessId == b.id ? 'selected' : ''}>${b.name}</option>`).join('')}
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

    // Lógica específica para Almacén (ID 1)
    if (selectedBusinessId === 1) {
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
    selectedBusinessId = (val === 'global') ? null : parseInt(val);
    addLog(`Cambio de contexto: ${selectedBusinessId ? db.businesses.find(b => b.id === selectedBusinessId).name : 'Global'}`);
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
        <div class="card user-login-card" style="width: 150px; cursor: pointer; text-align: center; padding: 1.5rem; transition: transform 0.2s; border: 2px solid transparent;" 
             onclick="selectUserLogin(${u.id})">
            <div class="avatar" style="width: 70px; height: 70px; margin: 0 auto 1rem; font-size: 1.5rem; background: ${u.role === 'owner' ? 'var(--primary)' : u.role === 'admin' ? 'var(--warning)' : 'var(--success)'};">
                ${u.name.charAt(0)}
            </div>
            <div style="font-weight: bold; margin-bottom: 0.25rem;">${u.name}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">
                ${u.role === 'owner' ? 'Dueño' : u.role === 'admin' ? 'Administrador' : 'Vendedor'}
            </div>
        </div>
    `).join('');

    container.innerHTML = `
        <div class="fade-in" style="display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100%; gap: 2rem;">
            <div style="text-align: center;">
                <i class="ph ph-shield-check" style="font-size: 3rem; color: var(--primary); margin-bottom: 0.5rem;"></i>
                <h1 style="margin: 0; font-size: 2rem;">Control de Negocios</h1>
                <p style="color: var(--text-muted); margin-top: 0.5rem;">Selecciona tu usuario para ingresar (Pruebas)</p>
            </div>
            
            <div style="display: flex; gap: 1.5rem; flex-wrap: wrap; justify-content: center;">
                ${userCards}
            </div>

            <div class="card" style="max-width: 400px; width: 100%; text-align: center; padding: 1.5rem; margin-top: 1rem;">
                <p style="margin-bottom: 1rem; color: var(--text-muted);">O ingresa con PIN si lo prefieres:</p>
                <form onsubmit="handleLogin(event)">
                    <div style="display: flex; gap: 0.5rem;">
                        <input type="password" name="pin" placeholder="PIN" class="input-field" 
                               style="text-align: center; font-size: 1.2rem;" maxlength="4">
                        <button type="submit" class="btn-primary">Entrar</button>
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
        // Default business context: Kiosko 1 (ID 2) for non-owners, Global (null) for Owner
        selectedBusinessId = (user.role === 'owner') ? null : 2;
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
    // Default business context: Kiosko 1 (ID 2) for non-owners, Global (null) for Owner
    selectedBusinessId = (user.role === 'owner') ? null : 2;
    const firstView = getPermissions(user.role)[0];
    navigateTo(firstView);
    addLog(`Sesión iniciada: ${user.name}`);
}

function renderDashboard(container) {
    let sales = db.sales || [];
    let waste = db.waste || [];

    if (selectedBusinessId) {
        sales = sales.filter(s => s.businessId === selectedBusinessId);
        waste = waste.filter(w => w.businessId === selectedBusinessId);
    }

    const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0);
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
        const bSales = db.sales.filter(s => s.businessId === b.id).reduce((sum, s) => sum + s.total, 0);
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
        const inv = db.inventory.find(inv => inv.businessId === business.id && inv.productId === product.id);
        if (inv) inv.quantity = Math.max(0, inv.quantity - qty);
    }

    await saveData();
    alert(`Generadas ${count} ventas ficticias.`);
    navigateTo('dashboard');
}

function renderVentas(container) {
    let filteredSales = db.sales || [];
    if (selectedBusinessId) {
        filteredSales = filteredSales.filter(s => s.businessId === selectedBusinessId);
    }

    const rows = filteredSales.map(s => `
        <tr style="border-bottom: 1px solid var(--border); cursor: pointer;" onclick="showSaleDetail(${s.id})">
            <td style="padding: 1rem;">
                <div style="font-weight: 500;">${s.date}</div>
                <div style="font-size: 0.8rem; color: var(--text-muted);">${s.openTime || '--:--'} - ${s.closeTime || '--:--'}</div>
            </td>
            <td style="padding: 1rem;">${db.businesses.find(b => b.id === s.businessId)?.name || 'N/A'}</td>
            <td style="padding: 1rem;">${s.seller || 'Sistema'}</td>
            <td style="padding: 1rem;">
                <span class="badge ${s.status === 'closed' ? 'badge-success' : 'badge-warning'}">
                    ${s.status === 'closed' ? 'Cerrada' : (s.status === 'pending' ? 'Pendiente' : (s.status === 'registered' ? 'Registrada' : 'Abierta'))}
                </span>
            </td>
            <td style="padding: 1rem; font-weight: bold; text-align: right;">$${s.total.toFixed(2)}</td>
            <td style="padding: 1rem; text-align: right;" onclick="event.stopPropagation()">
                <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
                    <button class="btn-icon" onclick="showEditSaleModal(${s.id})" title="Editar"><i class="ph ph-pencil"></i></button>
                    <button class="btn-icon" style="color: var(--danger);" onclick="deleteSaleAction(${s.id})" title="Eliminar"><i class="ph ph-trash"></i></button>
                </div>
            </td>
        </tr>
    `).join('');

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
            const inv = db.inventory.find(i => i.productId === p.id && i.businessId === selectedBusinessId);
            return { ...p, stock: inv ? inv.quantity : 0 };
        });
    } else {
        items = db.products.map(p => {
            const totalStock = db.inventory.filter(i => i.productId === p.id).reduce((sum, i) => sum + i.quantity, 0);
            return { ...p, stock: totalStock };
        });
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
            <td style="padding: 1rem; font-weight: bold; color: ${i.stock < 5 ? 'var(--danger)' : 'white'};">${i.stock}</td>
            <td style="padding: 1rem;">$${i.cost.toFixed(2)}</td>
            <td style="padding: 1rem;">$${i.price.toFixed(2)}</td>
            <td style="padding: 1rem; text-align: right;">
                <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
                    <button class="btn-icon" onclick="showEditProductModal(${i.id})" title="Editar"><i class="ph ph-pencil"></i></button>
                    ${selectedBusinessId ? `<button class="btn-ghost" onclick="showMermaModal(${i.id})"><i class="ph ph-warning-circle"></i> Merma</button>` : ''}
                </div>
            </td>
        </tr>
    `).join('');

    container.innerHTML = `
        <div class="fade-in">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
                <div style="display: flex; gap: 0.75rem;">
                    <button class="btn-primary" onclick="showAddProductModal()"><i class="ph ph-plus"></i> Nuevo Producto</button>
                    <button class="btn-secondary" onclick="exportInventoryPDF()"><i class="ph ph-file-pdf"></i> PDF</button>
                    <button class="btn-secondary" onclick="exportInventoryCSV()"><i class="ph ph-file-csv"></i> Exportar CSV</button>
                    <label class="btn-secondary" style="cursor: pointer;">
                        <i class="ph ph-upload-simple"></i> Importar CSV
                        <input type="file" style="display:none" accept=".csv" onchange="importInventoryCSV(this)">
                    </label>
                </div>
                ${selectedBusinessId ? `<button class="btn-ghost" onclick="navigateTo('logs')"><i class="ph ph-list"></i> Ver Historial de Cambios</button>` : ''}
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

function renderMermas(container) {
    const wasteList = db.waste.filter(w => !selectedBusinessId || w.businessId === selectedBusinessId);

    const rows = wasteList.map(w => {
        const product = db.products.find(p => p.id === w.productId);
        const business = db.businesses.find(b => b.id === w.businessId);
        return `
            <tr style="border-bottom: 1px solid var(--border);">
                <td style="padding: 1rem;">${w.date}</td>
                <td style="padding: 1rem;">${product ? product.name : 'Unknown'}</td>
                <td style="padding: 1rem; color: var(--danger); font-weight: bold;">-${w.quantity}</td>
                <td style="padding: 1rem;">${business ? business.name : 'Unknown'}</td>
                <td style="padding: 1rem;">${w.user}</td>
            </tr>
        `;
    }).reverse().join('');

    container.innerHTML = `
        <div class="fade-in">
            <div class="card" style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="text-align: left; background: var(--bg-dark); color: var(--text-muted);">
                            <th style="padding: 1rem;">Fecha</th>
                            <th style="padding: 1rem;">Producto</th>
                            <th style="padding: 1rem;">Cantidad</th>
                            <th style="padding: 1rem;">Sede</th>
                            <th style="padding: 1rem;">Registrado por</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows || '<tr><td colspan="5" style="padding: 3rem; text-align: center; color: var(--text-muted);">No hay mermas registradas</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    updateTitle(selectedBusinessId ? `Mermas: ${db.businesses.find(b => b.id === selectedBusinessId).name}` : 'Mermas Globales');
}

function renderPOS(container) {
    if (!editingSaleId) posCart = [];

    // Obtener fecha actual en formato local
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');

    const canEditDate = (currentUser.role === 'owner' || currentUser.role === 'admin');

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
                ${searchHtml}
                <div class="card" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; padding: 0;">
                    <div style="padding: 1rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
                        <h3 style="margin: 0;"><i class="ph ph-shopping-cart"></i> Carrito ${editingSaleId ? '(Editando)' : ''}</h3>
                        <div style="display: flex; gap: 0.5rem;">
                             <button class="btn-ghost" onclick="posCart=[]; renderCart();" style="color: var(--danger); padding: 0.5rem;"><i class="ph ph-trash"></i></button>
                        </div>
                    </div>
                    <div id="pos-cart-items" style="flex: 1; overflow-y: auto;"></div>
                </div>
            </div>

            <!-- Panel Derecho: Lista de Hoy y Resumen -->
            <div style="display: flex; flex-direction: column; gap: 1.5rem; min-height: 0;">
                <!-- Lista de Ventas de Hoy -->
                <div class="card" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; padding: 0;">
                    <div style="padding: 1rem; border-bottom: 1px solid var(--border); background: var(--bg-dark);">
                        <h3 style="margin: 0; font-size: 1rem;"><i class="ph ph-list-numbers"></i> Ventas de Hoy</h3>
                    </div>
                    <div id="pos-today-sales" style="flex: 1; overflow-y: auto;"></div>
                </div>

                <!-- Resumen y Acciones -->
                <div class="card" style="padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; background: var(--bg-card);">
                    <div id="pos-summary"></div>
                    <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                        <button class="btn-primary" style="width: 100%; height: 60px; font-size: 1.2rem; border-radius: 10px;" 
                                onclick="registerIndividualSale()">
                            <i class="ph ph-hand-coins"></i> REGISTRAR VENTA
                        </button>
                        ${(currentUser.role === 'seller') ? `
                            <button class="btn-secondary" style="width: 100%; border-color: var(--primary); color: var(--primary);" onclick="openPOSClosureModal()">
                                <i class="ph ph-lock-key"></i> SOLICITAR CIERRE DE DÍA
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
    const container = document.getElementById('pos-today-sales');
    if (!container) return;

    const todayDate = new Date();
    const todayStr = todayDate.toLocaleDateString();
    const isoToday = todayDate.toISOString().split('T')[0];

    const todaySales = db.sales.filter(s => {
        // Handle both localized (DD/MM/YYYY) and ISO (YYYY-MM-DD) formats
        const saleDatePart = s.date.includes(',') ? s.date.split(',')[0] : s.date.split(' ')[0];
        const isToday = (saleDatePart === todayStr || saleDatePart === isoToday);

        return isToday &&
            s.seller === currentUser.name &&
            (s.status === 'registered' || s.status === 'closed') &&
            (selectedBusinessId ? s.businessId === selectedBusinessId : true);
    });

    if (todaySales.length === 0) {
        container.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--text-muted); font-size: 0.9rem;">No has registrado ventas hoy</div>';
        return;
    }

    container.innerHTML = todaySales.map(s => `
        <div style="padding: 0.75rem 1rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
            <div>
                <div style="font-weight: 600; font-size: 0.9rem;">Venta #${s.id.toString().slice(-4)}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">${s.date.split(',')[1] || ''} - ${s.items.length} prod.</div>
            </div>
            <div style="display: flex; align-items: center; gap: 0.75rem;">
                <div style="text-align: right;">
                    <div style="font-weight: bold; color: var(--primary);">$${s.total.toFixed(2)}</div>
                </div>
                <button onclick="editSale(${s.id})" class="btn-icon" title="Editar venta" style="color: var(--primary); background: rgba(var(--primary-rgb), 0.1); border-radius: 4px; padding: 4px;">
                    <i class="ph-pencil-simple" style="font-size: 1.1rem;"></i>
                </button>
            </div>
        </div>
    `).join('');
}

async function registerIndividualSale() {
    if (posCart.length === 0) {
        alert("El carrito está vacío");
        return;
    }

    // Confirmation Logic
    if (editingSaleId) {
        if (!confirm("Usted ha editado la venta, ¿está de acuerdo?")) return;
    } else {
        if (!confirm("¿Registrar esta venta?")) return;
    }

    const businessId = selectedBusinessId || 2;
    const total = posCart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const now = new Date();
    const dateString = now.toISOString().replace('T', ' ').split('.')[0]; // "YYYY-MM-DD HH:MM:SS"

    try {
        // Inventory Management: Deduct / Restore
        if (editingSaleId) {
            const oldSale = db.sales.find(s => s.id === editingSaleId);
            if (oldSale) {
                oldSale.items.forEach(item => {
                    const inv = db.inventory.find(i => i.productId === item.productId && i.businessId === oldSale.businessId);
                    if (inv) inv.quantity += item.qty;
                });
            }
        }

        // Now deduct NEW inventory (from posCart)
        for (const item of posCart) {
            const inv = db.inventory.find(i => i.productId === item.id && i.businessId === businessId);
            if (inv) {
                inv.quantity -= item.qty;
            } else {
                db.inventory.push({ productId: item.id, businessId: businessId, quantity: -item.qty });
            }
        }

        if (editingSaleId) {
            // Update existing sale
            const saleIndex = db.sales.findIndex(s => s.id === editingSaleId);
            if (saleIndex !== -1) {
                const s = db.sales[saleIndex];
                s.items = posCart.map(i => ({ productId: i.id, name: i.name, qty: i.qty, price: i.price }));
                s.total = total;
                s.businessId = businessId;
                s.date = dateString; // Update date to show in Today's list
                addLog(`Venta #${s.id} editada: $${total.toFixed(2)}`, 'info');
            }
            editingSaleId = null;
        } else {
            // Create NEW sale
            const saleData = {
                id: Date.now(),
                date: dateString,
                businessId: businessId,
                seller: currentUser.name,
                items: posCart.map(i => ({ productId: i.id, name: i.name, qty: i.qty, price: i.price })),
                total: total,
                status: (currentUser.role === 'owner' || currentUser.role === 'admin') ? 'closed' : 'registered',
                paymentMethod: 'pending_closure'
            };
            db.sales.unshift(saleData);
            addLog(`Venta individual registrada: $${total.toFixed(2)}`, 'success');
        }

        await saveData();
        alert("Venta procesada con éxito.");

        // UI Reset
        posCart = [];
        renderPOS(document.getElementById('content-area'));

    } catch (error) {
        console.error("Error registering sale:", error);
        alert("Error al registrar la venta: " + error.message);
    }
}

function handlePOSSearch(val) {
    const results = document.getElementById('pos-results');
    if (!val) { results.style.display = 'none'; return; }

    const matches = db.products.filter(p =>
        p.name.toLowerCase().includes(val.toLowerCase())
    ).slice(0, 8);

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
    const existing = posCart.find(i => i.id === id);
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
                <span>TOTAL</span>
                <span>$${total.toFixed(2)}</span>
            </div>
        </div>
    `;
}

function adjustPOSQty(idx, delta) {
    posCart[idx].qty = Math.max(1, posCart[idx].qty + delta);
    renderCart();
}

function removeFromCart(idx) {
    posCart.splice(idx, 1);
    renderCart();
}

async function processPOSSale() {
    if (posCart.length === 0) return;

    const businessId = selectedBusinessId || 2; // Default to MCH 1 if in global view
    const total = posCart.reduce((sum, i) => sum + i.price * i.qty, 0);

    if (editingSaleId) {
        const oldSale = db.sales.find(s => s.id === editingSaleId);
        if (oldSale) {
            // Restore inventory from old sale
            oldSale.items.forEach(item => {
                const invItem = db.inventory.find(inv => inv.businessId === oldSale.businessId && inv.productId === item.productId);
                if (invItem) invItem.quantity += item.qty;
            });
            // Update sale object
            oldSale.items = posCart.map(i => ({ productId: i.id, name: i.name, qty: i.qty, price: i.price }));
            oldSale.total = total;
            oldSale.businessId = businessId; // Support moving sale between businesses if needed
        }
        editingSaleId = null;
    } else {
        const sale = {
            id: Date.now(),
            date: new Date().toLocaleString(),
            businessId: businessId,
            items: posCart.map(i => ({ productId: i.id, name: i.name, qty: i.qty, price: i.price })),
            total: total,
            seller: currentUser.name
        };
        db.sales.unshift(sale);
    }

    // Deduct new inventory
    posCart.forEach(item => {
        const invItem = db.inventory.find(inv => inv.businessId === businessId && inv.productId === item.id);
        if (invItem) {
            invItem.quantity = Math.max(0, invItem.quantity - item.qty);
        }
    });

    await saveData();
    addLog(`Venta procesada en ${db.businesses.find(b => b.id === businessId).name}: $${total.toFixed(2)}`);
    posCart = [];
    navigateTo('ventas');
}

function showEditSaleModal(id) {
    const sale = db.sales.find(s => s.id === id);
    if (!sale) return;

    if (!confirm("¿Deseas editar esta venta? El inventario se recalculará al guardar.")) return;

    editingSaleId = id;
    posCart = sale.items.map(i => ({ id: i.productId, name: i.name, price: i.price, qty: i.qty }));
    navigateTo('pos');
}

function cancelPOSEdit() {
    editingSaleId = null;
    posCart = [];
    navigateTo('ventas');
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
                <div class="card" style="text-align: center; border-top: 4px solid var(--primary);">
                    <small style="color: var(--text-muted);">Ventas Totales</small>
                    <h2 style="color: var(--primary);">$${totalSales.toFixed(2)}</h2>
                </div>
                <div class="card" style="text-align: center; border-top: 4px solid var(--success);">
                    <small style="color: var(--text-muted);">Transacciones</small>
                    <h2>${db.sales.length}</h2>
                </div>
                <div class="card" style="text-align: center; border-top: 4px solid var(--warning);">
                    <small style="color: var(--text-muted);">Sedes Activas</small>
                    <h2>${db.businesses.length}</h2>
                </div>
            </div>

            <div class="card" style="padding:0;">
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
function renderTransfer(container) { container.innerHTML = '<div class="card"><h3>Traspasos entre Sedes</h3><p>Módulo para mover stock del Almacén a los Kioscos.</p></div>'; }

function showNotificationsModal() {
    // Show all but highlight pending
    const notifs = db.notifications;

    const content = `
        <div style="padding: 1rem;">
            <h3>Notificaciones</h3>
            <div style="margin-top: 1rem; max-height: 400px; overflow-y: auto;">
                ${notifs.length === 0 ? '<p style="color: var(--text-muted);">No hay notificaciones</p>' : notifs.map(n => `
                    <div class="card" style="margin-bottom: 0.75rem; border-left: 4px solid ${n.status === 'pending' ? 'var(--primary)' : 'var(--border)'}; padding: 1rem; opacity: ${n.seen ? 0.7 : 1};" onclick="markNotificationAsSeen(${n.id})">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                            <div>
                                <div style="font-weight: bold; margin-bottom: 0.25rem;">
                                    ${n.title} ${n.seen ? '' : '<span style="display:inline-block; width:8px; height:8px; background:var(--primary); border-radius:50%; margin-left:5px;"></span>'}
                                </div>
                                <div style="font-size: 0.85rem; color: var(--text-muted);">${n.message}</div>
                                <div style="font-size: 0.75rem; margin-top: 0.5rem; opacity: 0.7;">${n.date} - Sede: ${db.businesses.find(b => b.id === n.businessId)?.name || 'N/A'}</div>
                            </div>
                            ${n.status === 'pending' ? `
                                <div style="display: flex; gap: 0.5rem;">
                                    <button class="btn-primary" style="padding: 0.5rem;" onclick="event.stopPropagation(); approveNotification(${n.id})"><i class="ph ph-check"></i></button>
                                    <button class="btn-ghost" style="padding: 0.5rem; color: var(--danger);" onclick="event.stopPropagation(); rejectNotification(${n.id})"><i class="ph ph-x"></i></button>
                                </div>
                            ` : `
                                <div style="font-size: 0.75rem; color: var(--text-muted); font-style: italic;">${n.status}</div>
                            `}
                        </div>
                    </div>
                `).join('')}
            </div>
            <button class="btn-ghost" style="width: 100%; margin-top: 1rem;" onclick="closeModal('notifications-modal')">Cerrar</button>
        </div>
    `;

    const modal = document.createElement('div');
    modal.id = 'notifications-modal';
    modal.className = 'modal-overlay fade-in';
    modal.style.display = 'flex';
    modal.onclick = (e) => { if (e.target === modal) closeModal('notifications-modal'); };
    modal.innerHTML = `<div class="card" style="width: 500px; max-width: 95%; position: relative;">${content}</div>`;
    document.body.appendChild(modal);
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
        db.inventory.push({ businessId: 1, productId: newProduct.id, quantity: 0 });
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
                        <div style="color:var(--text-muted);">${s.date} | ${db.businesses.find(b => b.id === s.businessId)?.name}</div>
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
                        ${s.items.map(i => `
                            <tr style="border-bottom:1px solid var(--bg-dark);">
                                <td style="padding:0.75rem 0.5rem;">${i.name}</td>
                                <td style="padding:0.75rem 0.5rem; text-align:center;">${i.qty}</td>
                                <td style="padding:0.75rem 0.5rem; text-align:right;">$${i.price.toFixed(2)}</td>
                                <td style="padding:0.75rem 0.5rem; text-align:right;">$${(i.qty * i.price).toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="3" style="padding:1rem 0.5rem; font-weight:bold; text-align:right;">TOTAL:</td>
                            <td style="padding:1rem 0.5rem; font-weight:bold; text-align:right; color:var(--primary); font-size:1.2rem;">$${s.total.toFixed(2)}</td>
                        </tr>
                    </tfoot>
                </table>

                <h3 style="margin-bottom:1rem;">Desglose de Pago y Arqueo</h3>
                <div class="grid-2" style="gap:1rem; margin-bottom:1.5rem;">
                    <div class="card" style="background:var(--bg-dark); padding:1rem;">
                        <h4 style="color:var(--text-muted); margin-bottom:0.5rem;">Efectivo</h4>
                        <div style="display:flex; justify-content:space-between; margin-bottom:0.25rem;">
                            <span>Vendido:</span> <strong>$${(s.cashAmount || 0).toFixed(2)}</strong>
                        </div>
                        <div style="display:flex; justify-content:space-between; color:var(--danger);">
                            <span>Faltante:</span> <strong>$${(s.cashFaltante || 0).toFixed(2)}</strong>
                        </div>
                        <div style="display:flex; justify-content:space-between; color:var(--success);">
                            <span>Sobrante:</span> <strong>$${(s.cashSobrante || 0).toFixed(2)}</strong>
                        </div>
                    </div>
                    <div class="card" style="background:var(--bg-dark); padding:1rem;">
                        <h4 style="color:var(--text-muted); margin-bottom:0.5rem;">Transferencia</h4>
                        <div style="display:flex; justify-content:space-between; margin-bottom:0.25rem;">
                            <span>Vendido:</span> <strong>$${(s.transferAmount || 0).toFixed(2)}</strong>
                        </div>
                        <div style="display:flex; justify-content:space-between; color:var(--danger);">
                            <span>Faltante:</span> <strong>$${(s.transferFaltante || 0).toFixed(2)}</strong>
                        </div>
                        <div style="display:flex; justify-content:space-between; color:var(--success);">
                            <span>Sobrante:</span> <strong>$${(s.transferSobrante || 0).toFixed(2)}</strong>
                        </div>
                    </div>
                </div>

                ${s.additionalInfo ? `
                <div style="margin-bottom:1.5rem;">
                    <h3 style="margin-bottom:0.5rem;">Información Adicional</h3>
                    <div style="background:var(--bg-dark); padding:1rem; border-radius:8px; font-style:italic; color:var(--text-muted);">
                        "${s.additionalInfo}"
                    </div>
                </div>` : ''}

                <div style="display:flex; gap:1rem; margin-top:2rem; padding-top:1rem; border-top:1px solid var(--border);">
                    ${(currentUser.role === 'owner' || currentUser.role === 'admin' || (s.status === 'registered' && s.seller === currentUser.name)) ? `
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
                </div>
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

    if (!force) {
        if (currentUser.role === 'owner') {
            const confirmed = confirm(`ATENCIÓN: ¿Estás seguro de eliminar la venta #${id.toString().slice(-6)}?\n\nESTO ES IRREVERSIBLE y los productos correspondientes serán devueltos al inventario de ${db.businesses.find(b => b.id === s.businessId)?.name || 'N/A'}.`);
            if (!confirmed) return;
        } else if (currentUser.role === 'admin') {
            if (!db.settings.allowAdminDeleteSales) {
                if (confirm("No tienes permiso administrativo para eliminar ventas directamente.\n\n¿Deseas enviar una SOLICITUD DE ELIMINACIÓN al Dueño?")) {
                    db.notifications.unshift({
                        id: Date.now(),
                        type: 'delete_request',
                        refId: id,
                        businessId: s.businessId,
                        title: `Solicitud de Eliminación: ${currentUser.name}`,
                        message: `Venta de $${s.total.toFixed(2)} en ${db.businesses.find(b => b.id === s.businessId)?.name || 'N/A'}. Requiere devolución de stock.`,
                        status: 'pending',
                        date: new Date().toLocaleString()
                    });
                    await saveData();
                    alert("Solicitud de eliminación enviada al Dueño correctamente.");
                }
                return;
            }
            if (!confirm(`¿Confirmas la eliminación de esta venta? El stock se restaurará automáticamente.`)) return;
        } else {
            // Seller
            if (s.status === 'registered' && s.seller === currentUser.name) {
                const confirmed = confirm(`¿Deseas eliminar esta venta y devolver los productos al inventario?`);
                if (!confirmed) return;
                // Allow direct deletion
                force = true;
            } else {
                if (confirm("Como vendedor, no tienes permiso para eliminar ventas pasadas o de otros.\n\n¿Deseas solicitar la eliminación de esta venta a un Administrador?")) {
                    db.notifications.unshift({
                        id: Date.now(),
                        type: 'delete_request',
                        refId: id,
                        businessId: s.businessId,
                        title: `Solicitud de Borrado: ${currentUser.name}`,
                        message: `Venta de $${s.total.toFixed(2)} por ${s.seller}. Error cometido durante la venta.`,
                        status: 'pending',
                        date: new Date().toLocaleString()
                    });
                    await saveData();
                    alert("Solicitud enviada al Administrador.");
                }
                return;
            }
        }
    }

    if (force || (currentUser.role === 'owner' || (currentUser.role === 'admin' && db.settings.allowAdminDeleteSales))) {
        // Proceed with deletion logic...
    } else {
        return; // Triple check
    }

    // Restaurar inventario
    if (s.items && s.items.length > 0) {
        s.items.forEach(item => {
            const inv = db.inventory.find(invItem => invItem.productId === item.productId && invItem.businessId === s.businessId);
            if (inv) {
                inv.quantity += item.qty;
            } else {
                db.inventory.push({
                    productId: item.productId,
                    businessId: s.businessId,
                    quantity: item.qty
                });
            }
        });
    }

    // Si es un cierre de día, manejarlo diferente? 
    // Por ahora tratamos todo como "venta" en db.sales.

    db.sales = db.sales.filter(sale => sale.id !== id);
    db.notifications = db.notifications.filter(n => !(n.refId === id && n.type === 'delete_request'));

    await saveData();
    addLog(`Venta eliminada: #${id.toString().slice(-6)}. Stock restaurado.`, 'warning');

    closeModal('sale-detail-modal');
    renderVentas(document.getElementById('content-area'));
    renderSidebar(currentView);
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
    const today = new Date().toLocaleDateString();
    const registeredSales = db.sales.filter(s =>
        s.date.split(',')[0] === today &&
        s.seller === currentUser.name &&
        s.status === 'registered' &&
        (selectedBusinessId ? s.businessId === selectedBusinessId : true)
    );

    let total = 0;
    let isCierreDia = false;

    if (posCart.length > 0) {
        total = posCart.reduce((sum, item) => sum + (item.qty * item.price), 0);
    } else if (registeredSales.length > 0) {
        total = registeredSales.reduce((sum, s) => sum + s.total, 0);
        isCierreDia = true;
    } else {
        alert("No hay productos en el carrito ni ventas registradas hoy para cerrar.");
        return;
    }

    const dateValue = document.getElementById('pos-date')?.value || new Date().toISOString().split('T')[0];
    const openTimeValue = document.getElementById('pos-open-time')?.value || '00:00';

    const modalTitle = isCierreDia ? 'Cierre de Día' : 'Finalizar Venta';
    const submitLabel = (currentUser.role === 'owner' || currentUser.role === 'admin') ? 'CERRAR OPERACIÓN' : 'SOLICITAR CIERRE';

    const modalHtml = `
    <div id="pos-closure-modal" class="modal-overlay" style="display:flex;">
        <div class="card" style="width:600px; padding:2rem; max-height:90vh; overflow-y:auto;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
                <h2 style="margin:0;">${modalTitle}</h2>
                <div style="font-size:1.5rem; font-weight:bold; color:var(--primary);">$${total.toFixed(2)}</div>
            </div>

            <form id="pos-closure-form" onsubmit="event.preventDefault(); finalizePOSSale();">
                <input type="hidden" name="total" value="${total}">
                <input type="hidden" name="date" value="${dateValue}">
                <input type="hidden" name="openTime" value="${openTimeValue}">
                <input type="hidden" name="isCierreDia" value="${isCierreDia}">

                            <div style="background:var(--bg-dark); padding:1rem; border-radius:8px; margin-bottom:1.5rem;">
                                <h4 style="margin-top:0;"><i class="ph ph-money"></i> Desglose de Pago</h4>
                                <div class="grid-2">
                                    <div class="form-group">
                                        <label>Efectivo Recibido</label>
                                        <input type="number" step="0.01" name="cashAmount" class="input-field" placeholder="0.00">
                                    </div>
                                    <div class="form-group">
                                        <label>Transferencia Recibida</label>
                                        <input type="number" step="0.01" name="transferAmount" class="input-field" placeholder="0.00">
                                    </div>
                                </div>
                                <div class="grid-2" style="margin-top:1rem;">
                                    <div class="form-group">
                                        <label>Faltante / Sobrante (Efectivo)</label>
                                        <input type="number" step="0.01" name="cashDiff" class="input-field" placeholder="0.00">
                                            <small style="color:var(--text-muted);">Poner negativo si falta, positivo si sobra.</small>
                                    </div>
                                    <div class="form-group">
                                        <label>Faltante / Sobrante (Transf)</label>
                                        <input type="number" step="0.01" name="transferDiff" class="input-field" placeholder="0.00">
                                    </div>
                                </div>
                            </div>

                            <div class="form-group">
                                <label>Información Adicional / Notas</label>
                                <textarea name="additionalInfo" class="input-field" style="height:80px; resize:none;" placeholder="Ej: Pago pendiente, billete falso, etc." maxlength="500"></textarea>
                            </div>

                            <div style="display:flex; gap:1rem; margin-top:2rem;">
                                <button type="submit" class="btn-primary" style="flex:2; height:50px;">
                                    <i class="ph ph-paper-plane-tilt"></i> ${submitLabel}
                                </button>
                                <button type="button" class="btn-ghost" onclick="closeModal('pos-closure-modal')" style="flex:1;">CANCELAR</button>
                            </div>
                        </form>
                    </div>
                </div>
                `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

async function finalizePOSSale() {
    const form = document.getElementById('pos-closure-form');
    if (!form) return;
    const formData = new FormData(form);
    const now = new Date();
    const closeTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
    const isCierreDia = formData.get('isCierreDia') === 'true';

    const cashDiff = parseFloat(formData.get('cashDiff') || 0);
    const transDiff = parseFloat(formData.get('transferDiff') || 0);
    const businessId = selectedBusinessId || 2;
    const totalValue = parseFloat(formData.get('total'));
    const status = (currentUser.role === 'owner' || currentUser.role === 'admin') ? 'closed' : 'pending';

    // If editing, restore old stock first
    if (editingSaleId) {
        const oldSale = db.sales.find(s => s.id === editingSaleId);
        if (oldSale && oldSale.items) {
            oldSale.items.forEach(item => {
                const inv = db.inventory.find(i => i.productId === (item.id || item.productId) && i.businessId === oldSale.businessId);
                if (inv) inv.quantity += item.qty;
            });
        }
    }

    const baseData = {
        id: editingSaleId || Date.now(),
        date: new Date().toLocaleString(),
        openTime: formData.get('openTime'),
        closeTime: closeTime,
        businessId: businessId,
        seller: currentUser.name,
        total: totalValue,
        cashAmount: parseFloat(formData.get('cashAmount') || 0),
        transferAmount: parseFloat(formData.get('transferAmount') || 0),
        cashFaltante: cashDiff < 0 ? Math.abs(cashDiff) : 0,
        cashSobrante: cashDiff > 0 ? cashDiff : 0,
        transferFaltante: transDiff < 0 ? Math.abs(transDiff) : 0,
        transferSobrante: transDiff > 0 ? transDiff : 0,
        additionalInfo: formData.get('additionalInfo'),
        status: status
    };

    if (isCierreDia) {
        const today = new Date().toLocaleDateString();
        const pendingSales = db.sales.filter(s =>
            s.date.split(',')[0] === today &&
            s.seller === currentUser.name &&
            s.businessId === businessId &&
            s.status === 'registered'
        );

        pendingSales.forEach(s => {
            s.status = status;
            s.closureId = baseData.id;
        });

        baseData.type = 'daily_closure';
        baseData.salesCount = pendingSales.length;

        if (status === 'pending') {
            db.notifications.unshift({
                id: Date.now() + 1,
                type: 'closure_request',
                refId: baseData.id,
                businessId: businessId,
                title: `Cierre de Día: ${currentUser.name}`,
                message: `$${totalValue.toFixed(2)} (${pendingSales.length} ventas)`,
                status: 'pending',
                date: new Date().toLocaleString()
            });
        }
    } else {
        baseData.items = posCart.map(i => ({ productId: i.id, name: i.name, qty: i.qty, price: i.price }));
        baseData.type = 'sale';

        // Deduct new inventory
        for (const item of posCart) {
            const inv = db.inventory.find(i => i.productId === item.id && i.businessId === businessId);
            if (inv) inv.quantity -= item.qty;
            else {
                db.inventory.push({ productId: item.id, businessId: businessId, quantity: -item.qty });
            }
        }

        if (status === 'pending') {
            const notifTitle = editingSaleId ? `Edición de Venta: ${currentUser.name}` : `Nueva Venta: ${currentUser.name}`;
            db.notifications.unshift({
                id: Date.now() + 1,
                type: 'closure_request',
                refId: baseData.id,
                businessId: businessId,
                title: notifTitle,
                message: `$${totalValue.toFixed(2)} - Esperando aprobación`,
                status: 'pending',
                date: new Date().toLocaleString()
            });
        }
    }

    if (editingSaleId) {
        if (!confirm("Usted ha editado la venta, ¿está de acuerdo?")) return;
        const idx = db.sales.findIndex(s => s.id === editingSaleId);
        if (idx !== -1) db.sales[idx] = baseData;
        editingSaleId = null;
    } else {
        db.sales.unshift(baseData);
    }

    await saveData();
    addLog(`${isCierreDia ? 'Cierre de día' : 'Venta'} ${editingSaleId ? 'actualizada' : 'registrada'}: $${totalValue.toFixed(2)} (${status})`, 'success');

    if (status === 'pending') alert("Solicitud enviada para aprobación del administrador.");

    posCart = [];
    closeModal('pos-closure-modal');
    navigateTo('ventas');
}

// --- BOOTSTRAP ---
window.addEventListener('DOMContentLoaded', async () => {
    console.log("App starting...");
    await loadData();
    navigateTo('dashboard');
});
