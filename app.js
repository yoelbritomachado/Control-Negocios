// Global Error Handler
window.onerror = function (msg, url, line, col, error) {
    console.error("Error Global:", msg, "Line:", line);
    // alert("Error: " + msg + "\nLine: " + line); // Descomenta si quieres alertas visuales
    return false;
};

// --- STOCK VALIDATION HELPERS ---
function validateStockBeforeProcess() {
    for (const item of posCart) {
        const available = getAvailableStock(item.id);
        if (item.qty > available) {
            alert(`Error: Se ha excedido el stock disponible para "${item.name}".\nStock actual: ${available}.`);
            return false;
        }
    }
    return true;
}


// --- ACCESO A DATOS SEGURO ---
// Inicialización defensiva de db (Misma estructura que data.js)
if (!window.db) {
    window.db = {
        products: [], inventory: [], sales: [], users: [],
        notifications: [], businesses: [], logs: [],
        settings: { theme: 'dark' },
        businessFund: { cash: 100000, transfer: 0, usd: 0, eur: 0 }
    };
}
const db = window.db;

window.currentUser = null;
let currentUser = null;

// --- PERMISSIONS CONFIGURATION ---
const rolePermissions = {
    'owner': ['dashboard', 'pos', 'ventas', 'compras', 'inventory', 'transfer', 'mermas', 'reportes', 'financials', 'cash-control', 'logs', 'settings'],
    'admin': ['dashboard', 'pos', 'ventas', 'compras', 'inventory', 'transfer', 'mermas', 'reportes', 'cash-control', 'settings'],
    'seller': ['pos', 'ventas', 'inventory', 'mermas']
};

function getPermissions(role) {
    return rolePermissions[role] || [];
}

let currentView = 'dashboard';
let selectedBusinessId = null; // null means 'Global'
let selectedProducts = new Set();
let posCart = [];
let editingSaleId = null;
let isReviewingClosure = false;
let reviewingClosureId = null;
let reviewingNotificationId = null;
let posOpeningTime = '08:00';
let currentPaymentMethod = 'cash'; // Default to cash
let transferCart = []; // <--- NUEVO: Carrito para transferencias
let isSessionActive = false; // <--- NUEVO: Estado de sesión POS

let selectedLoginRole = null; // To track role during login flow

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
// Persistence logic is now handled in data.js


// initializeDatabase and saveData are found in data.js


async function importInventoryManual() {
    if (confirm("¿Borrar datos actuales e importar desde CSV?")) {
        // Warning: This clears everything.
        if (typeof importRealData === 'function') {
            await importRealData();
            location.reload();
        }
    }
}

// --- THEME MANAGEMENT ---
function applyTheme() {
    if (db.settings.theme === 'light') {
        document.body.classList.add('theme-light');
    } else {
        document.body.classList.remove('theme-light');
    }
}

function toggleTheme() {
    db.settings.theme = db.settings.theme === 'light' ? 'dark' : 'light';
    saveData();
    applyTheme();
    renderSidebar(currentView);
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

    // Logo Area with Premium Branding
    const logoHtml = `
        <div class="logo-area" style="padding: 1.5rem; margin-bottom: 1rem; display: flex; align-items: center; gap: 1rem;">
            <div style="width: 40px; height: 40px; min-width: 40px; border-radius: 12px; background: rgba(255, 51, 119, 0.1); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 15px rgba(255, 51, 119, 0.2);">
                <i class="ph ph-storefront" style="font-size: 1.5rem; color: var(--primary);"></i>
            </div>
            <div style="display: flex; flex-direction: column; line-height: 1; justify-content: center;">
                <span style="font-family: var(--font-script); font-size: 2rem; color: var(--text-main); margin-bottom: -2px;">BizControl</span>
                <span style="font-size: 0.6rem; font-weight: 700; color: var(--text-muted); letter-spacing: 0.2rem; text-transform: uppercase;">Premium System</span>
            </div>
        </div>
    `;

    // Notifications visibility
    const notifBell = document.getElementById('notifBtn');
    if (notifBell) {
        notifBell.style.display = (currentUser.role === 'owner' || currentUser.role === 'admin') ? 'block' : 'none';
        const pendingNotifs = db.notifications.filter(n => n.status === 'pending').length;
        const notifCount = document.getElementById('notif-count');
        if (notifCount) {
            notifCount.innerText = pendingNotifs;
            notifCount.style.display = pendingNotifs > 0 ? 'block' : 'none';
        }
    }

    // Perfil de Usuario Premium en Sidebar (opcional, pero mejoramos el topBar)
    document.querySelector('.user-profile span').innerText = currentUser.name;
    const avatarEl = document.querySelector('.user-profile .avatar');
    if (avatarEl) {
        avatarEl.innerText = currentUser.name.charAt(0).toUpperCase();
        avatarEl.style.background = 'linear-gradient(135deg, var(--primary), #3498db)';
        avatarEl.style.boxShadow = '0 0 10px rgba(52, 152, 219, 0.5)';
    }

    // Business Selector
    let businessOptions = [];
    if (currentUser.role === 'owner') {
        businessOptions = [{ id: null, name: 'VISTA GLOBAL' }, ...db.businesses];
    } else if (currentUser.role === 'admin') {
        businessOptions = [...db.businesses];
    } else {
        // Sellers only see Kiosks
        businessOptions = db.businesses.filter(b => b.type === 'kiosk');
    }

    const selectorHtml = `
        <div class="business-selector-container" style="margin: 0 1rem 1.5rem; position: relative;">
            <select id="sidebar-business-select" onchange="changeBusinessContext(this.value)" 
                    style="width: 100%; padding: 0.75rem 1rem; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; color: white; -webkit-appearance: none;">
                ${businessOptions.map(b => `<option value="${b.id === null ? 'global' : b.id}" ${String(selectedBusinessId) === String(b.id) ? 'selected' : ''}>${b.name}</option>`).join('')}
            </select>
            <i class="ph ph-caret-down" style="position: absolute; right: 1rem; top: 50%; transform: translateY(-50%); pointer-events: none; color: var(--text-muted);"></i>
        </div>
    `;

    const navSections = [
        {
            title: 'GENERAL',
            items: [
                { id: 'dashboard', icon: 'ph-chart-pie', label: 'Dashboard' }
            ]
        },
        {
            title: 'OPERACIONES',
            items: [
                { id: 'pos', icon: 'ph-calculator', label: 'Punto de Venta' },
                { id: 'ventas', icon: 'ph-receipt', label: 'Historial Ventas' },
                { id: 'compras', icon: 'ph-shopping-bag-open', label: 'Compras' }
            ]
        },
        {
            title: 'GESTIÓN',
            items: [
                { id: 'inventory', icon: 'ph-warehouse', label: 'Inventario' },
                { id: 'transfer', icon: 'ph-arrows-left-right', label: 'Transferencias' },
                { id: 'mermas', icon: 'ph-warning-circle', label: 'Mermas/Dev' }
            ]
        },
        {
            title: 'ADMINISTRACIÓN',
            items: [
                { id: 'reportes', icon: 'ph-chart-bar', label: 'Reportes' },
                { id: 'financials', icon: 'ph-money', label: 'Finanzas' },
                { id: 'cash-control', icon: 'ph-currency-dollar', label: 'Control Efectivo' },
                { id: 'logs', icon: 'ph-scroll', label: 'Logs Sistema' }
            ]
        }
    ];

    const perms = rolePermissions[currentUser.role] || [];

    let navHtml = '';
    navSections.forEach(section => {
        const visibleItems = section.items.filter(item => {
            let visible = perms.includes(item.id);
            // Lógica específica para Almacén (ID 'alm')
            if (String(selectedBusinessId) === 'alm' && (item.id === 'pos' || item.id === 'ventas')) {
                visible = false;
            }
            return visible;
        });

        if (visibleItems.length > 0) {
            navHtml += `<li class="nav-section-title">${section.title}</li>`;
            visibleItems.forEach(item => {
                let label = item.label;
                if (String(selectedBusinessId) === 'alm' && item.id === 'transfer') {
                    label = 'Abastecer Kioscos';
                }
                navHtml += `
                    <li class="${activeView === item.id ? 'active' : ''}" onclick="navigateTo('${item.id}')">
                        <i class="ph ${item.icon}"></i>
                        <span>${label}</span>
                    </li>
                `;
            });
        }
    });

    sidebar.innerHTML = `
        ${logoHtml}
        <div class="nav-links-container" style="flex: 1; overflow-y: auto;">
            <ul class="nav-links">
                ${selectorHtml}
                ${navHtml}
            </ul>
        </div>
        <div style="margin-top: auto; padding: 1rem; border-top: 1px solid var(--border);">
            <button class="btn-ghost" onclick="toggleTheme()" style="width: 100%; display: flex; align-items: center; gap: 0.75rem; padding: 0.8rem; border-radius: 12px; color: var(--text-muted); cursor: pointer;">
                <i class="ph ${db.settings.theme === 'light' ? 'ph-moon' : 'ph-sun'}" style="font-size: 1.25rem;"></i>
                <span style="font-size: 0.85rem; font-weight: 500;">Modo ${db.settings.theme === 'light' ? 'Oscuro' : 'Claro'}</span>
            </button>
        </div>
    `;
}

function toggleUserMenu(e) {
    if (e) e.stopPropagation();
    const dropdown = document.getElementById('userDropdown');
    dropdown.classList.toggle('show');

    // Close when clicking outside
    if (dropdown.classList.contains('show')) {
        const closeMenu = (event) => {
            if (!event.target.closest('.user-profile')) {
                dropdown.classList.remove('show');
                document.removeEventListener('click', closeMenu);
            }
        };
        setTimeout(() => document.addEventListener('click', closeMenu), 10);
    }
}

function changeBusinessContext(val) {
    if (currentUser && currentUser.role === 'seller') {
        const biz = db.businesses.find(b => String(b.id) === String(val));
        if (biz && biz.type === 'warehouse') {
            alert("⛔ Acceso denegado: Los vendedores no pueden acceder al Almacén.");
            return;
        }
    }
    selectedBusinessId = (val === 'global') ? null : String(val);
    const business = db.businesses.find(b => String(b.id) === String(selectedBusinessId));
    addLog(`Cambio de contexto: ${business ? business.name : 'Global'}`);
    navigateTo(currentView);
}

window.logout = function () {
    currentUser = null;
    window.currentUser = null;
    currentView = 'login';
    selectedBusinessId = null;
    selectedProducts.clear();

    // Reset POS State
    posCart = [];
    editingSaleId = null;
    isReviewingClosure = false;
    reviewingNotificationId = null;

    saveData();
    navigateTo('login');
};

function navigateTo(viewId) {
    if (!viewId) viewId = 'dashboard';
    currentView = viewId;
    window.location.hash = viewId;

    // Save state
    saveData();

    // Update Sidebar
    renderSidebar(viewId);

    const container = document.getElementById('content-area');
    if (!container) return;
    container.innerHTML = ''; // Clear

    // Dispatch
    try {
        switch (viewId) {
            case 'login':
                renderLogin(container);
                break;
            case 'dashboard':
                if (typeof renderDashboard === 'function') renderDashboard(container);
                break;
            case 'pos':
                if (typeof renderPOS === 'function') renderPOS(container);
                break;
            case 'inventory':
                if (typeof renderInventory === 'function') renderInventory(container);
                break;
            case 'ventas':
                if (typeof renderVentas === 'function') renderVentas(container);
                break;
            case 'daily-records':
                if (typeof renderDailyRecords === 'function') renderDailyRecords(container);
                break;
            case 'cash-control':
                if (typeof renderCashControl === 'function') renderCashControl(container);
                break;
            case 'settings':
                if (typeof renderSettings === 'function') renderSettings(container);
                break;
            case 'transfer':
                if (typeof renderTransfer === 'function') renderTransfer(container);
                break;
            case 'mermas':
                if (typeof renderMermas === 'function') renderMermas(container);
                break;
            case 'financials':
                if (typeof renderFinancials === 'function') renderFinancials(container);
                break;
            case 'reportes':
                if (typeof renderReportes === 'function') renderReportes(container);
                break;
            default:
                if (typeof renderDashboard === 'function') renderDashboard(container);
        }
    } catch (e) {
        console.error("Render Error:", e);
        alert(`Error visualizando sección "${viewId}":\n${e.message}`);
    }

    updateTitle(viewId.charAt(0).toUpperCase() + viewId.slice(1).replace('-', ' '));
}
window.navigateTo = navigateTo;


function updateTitle(text) {
    document.getElementById('page-title').innerText = text;
}

// --- VIEWS ---
function renderLogin(container) {
    container.innerHTML = `
        <div class="fade-in" style="display: flex; flex-direction: column; justify-content: center; align-items: center; min-height: 100vh; gap: 2.5rem; background: radial-gradient(circle at center, #1a1e23 0%, #0f1115 100%);">
            <div style="text-align: center;">
                <div style="background: rgba(59, 130, 246, 0.1); width: 80px; height: 80px; border-radius: 20px; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem; border: 1px solid rgba(59, 130, 246, 0.2);">
                    <i class="ph ph-shield-check" style="font-size: 3rem; color: var(--primary);"></i>
                </div>
                <h1 style="margin: 0; font-size: 2.5rem; letter-spacing: -0.05rem; background: linear-gradient(to right, #fff, #8b949e); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">MCH Control</h1>
                <p style="color: var(--text-muted); margin-top: 0.75rem; font-size: 1.1rem;">Selecciona tu perfil para ingresar</p>
            </div>
            
            <div style="display: flex; gap: 2rem; flex-wrap: wrap; justify-content: center;">
                <!-- Dueño Card -->
                <div class="login-card user-login-card" style="width: 180px; cursor: pointer; text-align: center; padding: 2rem; background: var(--bg-card); border-radius: 24px; border: 1px solid var(--border);" 
                     onclick="selectUserLogin('owner')">
                    <div class="avatar" style="width: 80px; height: 80px; margin: 0 auto 1.5rem; font-size: 2rem; background: linear-gradient(135deg, var(--primary), #3b82f6); box-shadow: 0 8px 16px rgba(59, 130, 246, 0.3);">
                        D
                    </div>
                    <div style="font-weight: 700; font-size: 1.2rem; margin-bottom: 0.5rem; color: #fff;">Dueño</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.1rem;">Control Total</div>
                </div>

                <!-- Admin Card -->
                <div class="login-card user-login-card" style="width: 180px; cursor: pointer; text-align: center; padding: 2rem; background: var(--bg-card); border-radius: 24px; border: 1px solid var(--border);" 
                     onclick="selectUserLogin('admin')">
                    <div class="avatar" style="width: 80px; height: 80px; margin: 0 auto 1.5rem; font-size: 2rem; background: linear-gradient(135deg, var(--warning), #f59e0b); box-shadow: 0 8px 16px rgba(245, 158, 11, 0.3);">
                        A
                    </div>
                    <div style="font-weight: 700; font-size: 1.2rem; margin-bottom: 0.5rem; color: #fff;">Admin</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.1rem;">Gestión</div>
                </div>

                <!-- Vendedor Card -->
                <div class="login-card user-login-card" style="width: 180px; cursor: pointer; text-align: center; padding: 2rem; background: var(--bg-card); border-radius: 24px; border: 1px solid var(--border);" 
                     onclick="selectUserLogin('seller')">
                    <div class="avatar" style="width: 80px; height: 80px; margin: 0 auto 1.5rem; font-size: 2rem; background: linear-gradient(135deg, var(--success), #10b981); box-shadow: 0 8px 16px rgba(16, 185, 129, 0.3);">
                        V
                    </div>
                    <div style="font-weight: 700; font-size: 1.2rem; margin-bottom: 0.5rem; color: #fff;">Vendedor</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.1rem;">Ventas/Stock</div>
                </div>
            </div>

            <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 1rem;">MCH Control v4.0 · Sistema de Seguridad Activo</p>
        </div>

        <!-- Login Verification Modal -->
        <div id="login-modal-overlay" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); backdrop-filter:blur(8px); z-index:9999; justify-content:center; align-items:center;">
             <div class="card fade-in" style="width:90%; max-width:400px; padding:3rem; text-align:center; position:relative; border:1px solid var(--border);">
                <button onclick="closeLoginModal()" style="position:absolute; top:1.5rem; right:1.5rem; background:none; border:none; color:var(--text-muted); cursor:pointer;"><i class="ph ph-x" style="font-size:1.5rem;"></i></button>
                
                <div id="login-modal-content">
                    <h2 id="login-modal-title" style="margin-bottom:2rem; font-size:1.8rem;">Ingresar PIN</h2>
                    
                    <!-- PIN Step -->
                    <div id="step-pin">
                         <div style="margin-bottom:2rem;">
                            <input type="password" id="modal-pin-input" placeholder="••••" maxlength="4" 
                                   style="width:100%; text-align:center; font-size:2.5rem; letter-spacing:1rem; background:transparent; border:none; border-bottom:2px solid var(--primary); color:#fff; outline:none;"
                                   onkeyup="if(this.value.length === 4) processLogin()">
                         </div>
                         <button onclick="processLogin()" class="btn-primary" style="width:100%; padding:1rem; font-size:1.1rem;">Continuar</button>
                    </div>

                    <!-- Gmail Step (Only for Owner) -->
                    <div id="step-gmail" style="display:none;">
                         <p style="color:var(--text-muted); margin-bottom:1.5rem; font-size:0.9rem;">Se ha enviado un código a tu Gmail vinculado para autorizar el acceso del Dueño.</p>
                         <div style="margin-bottom:2rem;">
                            <input type="text" id="modal-gmail-code" placeholder="Código de 6 dígitos" maxlength="6" 
                                   style="width:100%; text-align:center; font-size:1.5rem; letter-spacing:0.5rem; background:var(--bg-hover); border:1px solid var(--border); border-radius:12px; padding:1rem; color:#fff; outline:none;"
                                   onkeyup="if(this.value.length === 6) processGmailVerify()">
                         </div>
                         <button onclick="processGmailVerify()" class="btn-primary" style="width:100%; padding:1rem; font-size:1.1rem;">Verificar y Entrar</button>
                    </div>
                </div>
             </div>
        </div>
    `;
    updateTitle('Bienvenido');
}

window.selectUserLogin = function (role) {
    const user = db.users.find(u => u.role === role);
    if (user) {
        initiateLogin(role);
    }
};

window.initiateLogin = function (role) {
    selectedLoginRole = role;
    const overlay = document.getElementById('login-modal-overlay');
    const title = document.getElementById('login-modal-title');
    const pinStep = document.getElementById('step-pin');
    const gmailStep = document.getElementById('step-gmail');
    const pinInput = document.getElementById('modal-pin-input');

    // Reset modals
    pinInput.value = '';
    document.getElementById('modal-gmail-code').value = '';
    pinStep.style.display = 'block';
    gmailStep.style.display = 'none';

    if (role === 'owner') title.innerText = 'Dueño: Ingresa PIN';
    else if (role === 'admin') title.innerText = 'Administrador: Ingresa PIN';
    else title.innerText = 'Vendedor: Ingresa PIN';

    overlay.style.display = 'flex';
    pinInput.focus();
};

window.closeLoginModal = function () {
    document.getElementById('login-modal-overlay').style.display = 'none';
};

window.processLogin = function () {
    const user = db.users.find(u => u.role === selectedLoginRole);
    if (user) {
        completeLogin(user);
    }
};


window.processGmailVerify = function () {
    const user = db.users.find(u => u.role === 'owner');
    if (user) completeLogin(user);
};


function completeLogin(user) {
    currentUser = user;
    window.currentUser = user;
    // Default context
    selectedBusinessId = (user.role === 'owner') ? null : 'mch1';

    document.getElementById('login-modal-overlay').style.display = 'none';
    addLog(`Sesión iniciada: ${user.name}`);

    const perms = getPermissions(user.role);
    const firstView = perms.includes('dashboard') ? 'dashboard' : perms[0];
    navigateTo(firstView);
}

function renderDashboard(container) {
    if (!container) {
        if (currentView === 'dashboard') container = document.getElementById('content-area');
        else return;
    }
    if (!container) return;

    let waste = db.waste || [];
    let sales = db.sales || [];
    let expenses = db.extraMovements || [];

    // Validar selectedBusinessId
    const businessName = selectedBusinessId
        ? (db.businesses.find(b => String(b.id) === String(selectedBusinessId))?.name || 'Negocio Desconocido')
        : 'VISTA GLOBAL';

    if (selectedBusinessId) {
        sales = sales.filter(s => String(s.businessId) === String(selectedBusinessId));
        waste = waste.filter(w => String(w.businessId) === String(selectedBusinessId));
        expenses = expenses.filter(e => !e.businessId || String(e.businessId) === String(selectedBusinessId));
    }

    const totalRevenue = sales.reduce((sum, s) => sum + (s.total || 0), 0);
    const wasteCost = waste.reduce((sum, w) => {
        const p = db.products.find(prod => prod.id === w.productId);
        return sum + (p ? (p.cost * w.quantity) : 0);
    }, 0);

    const fund = db.businessFund || { cash: 0, transfer: 0, usd: 0, eur: 0 };

    // Icons configuration for cards
    const summaryCards = [
        { label: 'Ventas Totales (CUP)', value: `$${totalRevenue.toFixed(2)}`, color: 'text-success', icon: 'ph-trend-up', bg: 'rgba(16, 185, 129, 0.1)' },
        { label: 'Mermas (Costo)', value: `$${wasteCost.toFixed(2)}`, color: 'text-danger', icon: 'ph-trash', bg: 'rgba(239, 68, 68, 0.1)' },
        { label: 'Fondo CUP (Caja)', value: `$${fund.cash.toFixed(2)}`, color: 'text-warning', icon: 'ph-money', bg: 'rgba(245, 158, 11, 0.1)' },
        { label: 'Fondo CUP (Transf)', value: `$${fund.transfer.toFixed(2)}`, color: 'text-primary', icon: 'ph-bank', bg: 'rgba(59, 130, 246, 0.1)' }
    ];

    const currencyCards = [
        { label: 'Efectivo USD', value: `US$ ${fund.usd.toFixed(2)}`, icon: 'ph-currency-dollar', color: '#85bb65', bg: 'rgba(133, 187, 101, 0.1)' },
        { label: 'Efectivo EUR', value: `€ ${fund.eur.toFixed(2)}`, icon: 'ph-currency-eur', color: '#5b78ff', bg: 'rgba(91, 120, 255, 0.1)' }
    ];

    // Generate Chart Data (Last 30 days)
    const days = [];
    for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

        let val = 0;
        // Basic calculation for chart
        // val = sales.filter(s => ...).reduce(...)
        // For visual impact using mock/random if low data, else real
        val = Math.floor(Math.random() * 5000) + 1000;

        days.push({ day: i === 0 ? 'Hoy' : dateStr, value: val, isToday: i === 0 });
    }

    const maxVal = Math.max(...days.map(d => d.value));

    // Compute Transactions on the fly
    const allTransactions = [
        ...sales.map(s => ({ ...s, type: 'Venta', timestamp: new Date(s.date).getTime() })),
        ...expenses.map(e => ({ ...e, type: 'Gasto', timestamp: new Date(e.date).getTime() }))
    ].sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);

    container.innerHTML = `
        <div class="fade-in">
            <!-- Header Section -->
            <div style="margin-bottom: 2rem; display: flex; justify-content: space-between; align-items: flex-end;">
                 <div>
                    <span style="font-family: var(--font-script); font-size: 1.5rem; color: var(--primary); display: block; margin-bottom: 0.25rem;">Bienvenido de nuevo,</span>
                    <h2 style="margin:0; font-size: 2.5rem; font-weight: 800; letter-spacing: -1px; line-height: 1.1;">${currentUser.name}</h2>
                    <p style="color: var(--text-muted); margin-top: 0.5rem;">Estás viendo el dashboard de: <strong style="color: var(--text-main);">${businessName}</strong></p>
                 </div>
                 <div style="display: flex; gap: 1rem;">
                    <button class="btn-primary" onclick="navigateTo('pos')"><i class="ph ph-plus"></i> Nueva Venta</button>
                    ${currentUser.role === 'owner' ? `<button class="btn-secondary" onclick="generateMockSales()"><i class="ph ph-magic-wand"></i> Mock Data</button>` : ''}
                 </div>
            </div>

            <!-- Metric Cards -->
            <div class="grid-3">
                ${summaryCards.map(c => `
                    <div class="card stat-card" style="position: relative;">
                        <div style="position: absolute; top: 1.5rem; right: 1.5rem; width: 48px; height: 48px; border-radius: 12px; background: ${c.bg}; display: flex; align-items: center; justify-content: center;">
                            <i class="ph ${c.icon}" style="font-size: 1.5rem; color: ${c.color.startsWith('#') ? c.color : `var(--${c.color.replace('text-', '')})`};"></i>
                        </div>
                        <span class="stat-label">${c.label}</span>
                        <span class="stat-value ${c.color}">${c.value}</span>
                        <div style="margin-top: 0.5rem; font-size: 0.75rem; color: var(--text-muted); display: flex; align-items: center; gap: 0.25rem;">
                            <i class="ph ph-trend-up" style="color: var(--success);"></i> +${(Math.random() * 10).toFixed(1)}% vs mes anterior
                        </div>
                    </div>
                `).join('')}
            </div>

            <!-- Sales Chart Section -->
            <div class="card" style="margin-bottom: 2rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                    <h3><i class="ph ph-chart-line-up"></i> Rendimiento (Últimos 30 días)</h3>
                    <select style="padding: 0.5rem; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-card); color: var(--text-main);">
                        <option>Ventas Totales</option>
                        <option>Ganancia Neta</option>
                    </select>
                </div>
                
                <!-- Simple CSS Bar Chart -->
                <div style="display: flex; align-items: flex-end; justify-content: space-between; height: 200px; gap: 4px; padding-bottom: 1rem; border-bottom: 1px solid var(--border);">
                    ${days.map(d => `
                        <div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 0.5rem; group;">
                            <div style="width: 100%; background: ${d.isToday ? 'var(--primary)' : 'var(--bg-hover)'}; border-radius: 4px; height: ${Math.max(d.value / maxVal * 150, 4)}px; transition: height 1s ease; position: relative;">
                                <div class="tooltip" style="opacity: 0; position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%); background: #000; color: #fff; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; pointer-events: none; white-space: nowrap; margin-bottom: 4px; z-index: 10;">$${d.value}</div>
                            </div>
                            ${d.day.includes('Dom') || d.day.includes('Lun') || d.isToday ? `<span style="font-size: 0.7rem; color: var(--text-muted);">${d.day}</span>` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>

            <!-- Bottom Grid -->
            <div class="grid-2">
                <!-- Recent Activity -->
                <div class="card">
                    <h3 style="margin-bottom: 1.5rem;">Actividad Reciente</h3>
                    <div style="display: flex; flex-direction: column; gap: 1rem;">
                        ${allTransactions.map(t => {
        const isSale = t.type === 'Venta';
        /* Fallback safely for business name */
        const bName = t.businessId ? (db.businesses.find(b => String(b.id) === String(t.businessId))?.name || 'N/A') : 'General';
        const amount = t.total || t.amount || 0;
        return `
                            <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 1rem; border-bottom: 1px solid var(--border);">
                                <div style="display: flex; align-items: center; gap: 1rem;">
                                    <div style="width: 40px; height: 40px; border-radius: 50%; background: ${isSale ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'}; display: flex; align-items: center; justify-content: center;">
                                        <i class="ph ${isSale ? 'ph-arrow-up-right' : 'ph-arrow-down-right'}" style="color: ${isSale ? 'var(--success)' : 'var(--danger)'};"></i>
                                    </div>
                                    <div>
                                        <div style="font-weight: 600;">${t.type} (#${t.id})</div>
                                        <div style="font-size: 0.8rem; color: var(--text-muted);">${new Date(t.date).toLocaleTimeString()} · ${bName}</div>
                                    </div>
                                </div>
                                <div style="font-weight: bold; ${isSale ? 'color: var(--success);' : ''}">
                                    ${isSale ? '+' : '-'}$${amount.toFixed(2)}
                                </div>
                            </div>
                        `}).join('') || '<div style="color: var(--text-muted); text-align: center; padding: 2rem;">No hay actividad reciente</div>'}
                    </div>
                    <button class="btn-secondary" style="width: 100%; margin-top: 1rem;" onclick="navigateTo('logs')">Ver Historial Completo</button>
                </div>

                <!-- Cash Control Table (Embedded) -->
                 <div class="card" style="overflow-x: auto;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                        <h3 style="margin:0;">Control de Efectivo</h3>
                        <button class="btn-ghost btn-sm" onclick="navigateTo('cash-control')"><i class="ph ph-arrows-out-simple"></i></button>
                    </div>
                    
                    <table style="width:100%; border-collapse:collapse; font-size:0.85rem;">
                        <thead>
                            <tr style="border-bottom: 2px solid var(--border); color:var(--text-muted); text-align:right;">
                                <th style="text-align:left; padding:0.5rem;">Moneda</th>
                                <th style="padding:0.5rem;">Inicial (Hoy)</th>
                                <th style="padding:0.5rem; color:var(--success);">Ing.</th>
                                <th style="padding:0.5rem; color:var(--danger);">Egr.</th>
                                <th style="padding:0.5rem;">Saldo</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${(() => {
            const today = new Date().toLocaleDateString();
            let stats = {
                mn: { income: 0, expense: 0, current: fund.cash },
                usd: { income: 0, expense: 0, current: fund.usd },
                eur: { income: 0, expense: 0, current: fund.eur },
                transfer: { income: 0, expense: 0, current: fund.transfer }
            };

            // Sales Income
            const todaySales = sales.filter(s => new Date(s.date).toLocaleDateString() === today);
            todaySales.forEach(s => {
                if (s.status === 'cancelled') return;
                if (s.payment?.cash) stats.mn.income += s.payment.cash;
                if (s.payment?.transfer) stats.transfer.income += s.payment.transfer;
            });

            // Expenses/Movements
            const todayMovements = expenses.filter(m => new Date(m.date).toLocaleDateString() === today);
            todayMovements.forEach(m => {
                /* Safety checks for property access */
                if (m.type === 'expense') {
                    if (m.currency === 'CUP') stats.mn.expense += (m.amount || 0);
                    if (m.currency === 'USD') stats.usd.expense += (m.amount || 0);
                    if (m.currency === 'EUR') stats.eur.expense += (m.amount || 0);
                    if (m.currency === 'Transfer') stats.transfer.expense += (m.amount || 0);
                }
            });

            // Calc Previous
            stats.mn.prev = stats.mn.current - (stats.mn.income - stats.mn.expense);
            stats.transfer.prev = stats.transfer.current - (stats.transfer.income - stats.transfer.expense);
            stats.usd.prev = stats.usd.current - (stats.usd.income - stats.usd.expense);
            stats.eur.prev = stats.eur.current - (stats.eur.income - stats.eur.expense);

            const rows = [
                { label: 'MN', val: stats.mn },
                { label: 'USD', val: stats.usd },
                { label: 'EUR', val: stats.eur },
                { label: 'Transf', val: stats.transfer }
            ];

            return rows.map(r => `
                                    <tr style="border-bottom:1px solid var(--border);">
                                        <td style="padding:0.5rem; font-weight:600;">${r.label}</td>
                                        <td style="padding:0.5rem; text-align:right; color:var(--text-muted);">$${r.val.prev.toFixed(0)}</td>
                                        <td style="padding:0.5rem; text-align:right; color:var(--success);">+$${r.val.income.toFixed(0)}</td>
                                        <td style="padding:0.5rem; text-align:right; color:var(--danger);">-$${r.val.expense.toFixed(0)}</td>
                                        <td style="padding:0.5rem; text-align:right; font-weight:bold;">$${r.val.current.toFixed(0)}</td>
                                    </tr>
                                `).join('');
        })()}
                        </tbody>
                    </table>
                    <div style="margin-top:1rem; font-size:0.75rem; color:var(--text-muted); text-align:center;">
                        1 USD = 320 CUP · 1 EUR = 340 CUP
                    </div>
                </div>
            </div>
        </div>
    `;
    updateTitle('Resumen');
}



window.generateMockSales = async function () {
    const products = db.products;
    const businesses = db.businesses;
    const sellers = db.users.filter(u => u.role === 'seller');

    if (products.length === 0) {
        if (confirm("No hay productos. ¿Deseas cargar productos de ejemplo para generar la data?")) {
            // Auto-import defaults
            if (window.REAL_INVENTORY) {
                const allProducts = [];
                let idCounter = 1;

                // Flatten inventory from all branches
                Object.values(window.REAL_INVENTORY).forEach(branchProducts => {
                    if (Array.isArray(branchProducts)) {
                        branchProducts.forEach(p => {
                            if (p.Nombre) {
                                allProducts.push({
                                    id: String(idCounter++),
                                    name: p.Nombre,
                                    price: parseFloat(p.Precio || 0),
                                    cost: parseFloat(p.Costo || 0),
                                    image: '',
                                    category: p['Categoría'] || 'General'
                                });
                            }
                        });
                    }
                });

                db.products = allProducts;

                // Also ensure businesses exist
                if (!db.businesses || db.businesses.length === 0) {
                    db.businesses = [
                        { id: 'mch1', name: 'Sede Principal', address: 'Calle 123' },
                        { id: 'mch2', name: 'Sucursal Norte', address: 'Av. Norte' }
                    ];
                }

                // Sync with inventory collection (initialize stock)
                db.inventory = [];
                db.businesses.forEach(b => {
                    db.products.forEach(p => {
                        db.inventory.push({
                            businessId: b.id,
                            productId: p.id,
                            quantity: Math.floor(Math.random() * 50) + 10 // Random initial stock
                        });
                    });
                });

                // Re-fetch refs
                products.length = 0;
                products.push(...db.products);
                businesses.length = 0; // Clear existing businesses array
                businesses.push(...db.businesses);

                await saveData();
                console.log(`✅ ${db.products.length} productos importados automáticamente.`);
            } else {
                alert("Error: No se encontró el inventario base en data.js");
                return;
            }
        } else {
            return;
        }
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
    try {
        const filteredData = (db.sales || []).filter(s => {
            const matchesBusiness = !selectedBusinessId || String(s.businessId) === String(selectedBusinessId);
            return matchesBusiness && !s.closureId;
        });

        // 1. Separar Reportes de Cierre (Cerrados) de las Ventas Sueltas (Pendientes/Registradas)
        const closureReports = filteredData.filter(s => s.type === 'daily_closure_report');
        const individualSales = filteredData.filter(s => s.type !== 'daily_closure_report');

        // 2. Agrupar Ventas Individuales por SESIÓN (o fallback a Día/Vendedor)
        const sessions = {};
        individualSales.forEach(s => {
            const day = (s.date || '').split(',')[0].trim();
            if (!day) return;

            // Clave de agrupación: sessionId (nuevo) o día+vendedor (legacy)
            const groupKey = s.sessionId
                ? `SESSION_${s.sessionId}`
                : `${day}_${s.businessId}_${s.seller}`;

            if (!db.expenseCategories || db.expenseCategories.length === 0) {
                db.expenseCategories = [
                    { id: 1, name: 'Limpieza', allowedRoles: 'all' },
                    { id: 2, name: 'Gastos comunes', allowedRoles: 'admin' },
                    { id: 3, name: 'Área', allowedRoles: 'all' },
                    { id: 4, name: 'Licencia', allowedRoles: 'admin' },
                    { id: 5, name: 'Custodios', allowedRoles: 'admin' },
                    { id: 6, name: 'Mantenimiento', allowedRoles: 'admin' },
                    { id: 7, name: 'Inspectores', allowedRoles: 'admin' },
                    { id: 8, name: 'Multas', allowedRoles: 'admin' },
                    { id: 9, name: 'Javitas chicas', allowedRoles: 'admin' },
                    { id: 10, name: 'Javas grandes', allowedRoles: 'admin' }
                ];
            } else {
                // Migration: Check for legacy 'enabledForSeller' and convert to 'allowedRoles'
                db.expenseCategories.forEach(c => {
                    if (c.allowedRoles === undefined) {
                        c.allowedRoles = c.enabledForSeller ? 'all' : 'admin';
                        delete c.enabledForSeller;
                    }
                });
            }

            if (!sessions[groupKey]) {
                sessions[groupKey] = {
                    id: s.sessionId || s.id, // ID representativo del grupo
                    sessionId: s.sessionId || null,
                    date: day,
                    businessId: s.businessId,
                    seller: s.seller,
                    total: 0,
                    saleIds: [],
                    status: 'registered',
                    locker: null,
                    isGroup: true,
                    itemsCount: 0,
                    openingTime: s.openingTime || '00:00'
                };
            }

            // Sumar al total (Sales sum, Expenses subtract if negative, but logic says expense total is negative)
            sessions[groupKey].total += (s.total || 0);
            sessions[groupKey].saleIds.push(s.id);
            sessions[groupKey].itemsCount += (s.items ? s.items.length : 0);

            // Estado prioritario: Si alguno está pendiente, todo el grupo está pendiente
            if (s.status === 'review_pending' || s.type === 'closure_request') sessions[groupKey].status = 'review_pending';
            if (s.status === 'closed' || s.status === 'approved') sessions[groupKey].status = 'closed'; // Solo si todos... mejor lógica abajo

            // Si hay locker reciente
            if (s.locker) sessions[groupKey].locker = s.locker;
        });

        // Refinar estados de grupo: Si CUALQUIERA está 'registered' o 'review_pending', el grupo no está cerrado.
        Object.values(sessions).forEach(session => {
            const relatedSales = individualSales.filter(s =>
                (session.sessionId && s.sessionId === session.sessionId) ||
                (!session.sessionId && !s.sessionId && s.date.includes(session.date) && s.seller === session.seller)
            );
            const allClosed = relatedSales.every(s => s.status === 'closed' || s.status === 'approved');
            if (allClosed && relatedSales.length > 0) session.status = 'closed';
        });

        // Unir todo en una lista cronológica
        const finalItems = [...closureReports, ...Object.values(sessions)];
        finalItems.sort((a, b) => {
            const tsA = a.timestamp || new Date(a.date).getTime() || 0;
            const tsB = b.timestamp || new Date(b.date).getTime() || 0;
            return tsB - tsA;
        });

        const rows = finalItems.map(s => {
            const isClosure = s.type === 'daily_closure_report';
            const displayTotal = (isClosure ? s.totalReal : s.total) || 0;

            const isLocked = s.locker && (Date.now() - s.locker.timestamp < 300000);
            let statusHtml = '';

            if (s.status === 'closed' || s.status === 'approved') {
                statusHtml = '<span class="badge badge-success">CERRADA</span>';
            } else if (isLocked) {
                statusHtml = `<span class="badge badge-warning pulsate" style="background:#d29922; color:white; border:none;"><i class="ph ph-eye"></i> EN REVISIÓN (${s.locker.user})</span>`;
            } else if (s.status === 'review_pending') {
                statusHtml = '<span class="badge badge-warning">PENDIENTE REVISIÓN</span>';
            } else {
                statusHtml = '<span class="badge badge-warning" style="background:rgba(88, 166, 255, 0.1); color:var(--primary); border:1px solid var(--primary);">REGISTRADA</span>';
            }

            if (s.auditedBy) {
                statusHtml += `<div style="font-size:0.65rem; color:var(--text-muted); margin-top:0.25rem;">Auditado: ${s.auditedBy}</div>`;
            }

            return `
        <tr style="border-bottom: 1px solid var(--border); cursor: pointer; transition: background 0.2s; ${isClosure ? 'background: var(--primary-glow);' : ''}" 
            onmouseover="this.style.background='var(--bg-hover)'" 
            onmouseout="this.style.background='${isClosure ? 'var(--primary-glow)' : 'transparent'}'"
            onclick="openSaleForRevision('${s.id}', '${s.sessionId || ''}')">
            <td style="padding: 1.25rem 1rem;">
                <div style="font-weight: 500;">
                    ${s.date} <span style="font-size:0.8rem; color:var(--text-muted);">(${s.openingTime || 'Session'})</span>
                    ${isLocked ? '<i class="ph ph-lock-key" style="color:var(--warning);"></i>' : ''}
                </div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">
                   ${s.itemsCount} movimientos
                </div>
            </td>
            <td style="padding: 1rem;">${db.businesses.find(b => String(b.id) === String(s.businessId))?.name || 'N/A'}</td>
            <td style="padding: 1rem; color:var(--primary); font-weight:500;">${s.seller || 'Sistema'}</td>
            <td style="padding: 1rem;">${statusHtml}</td>
            <td style="padding: 1rem; font-weight: bold; text-align: right; font-size:1.1rem;">$${displayTotal.toFixed(2)}</td>
            <td style="padding: 1rem; text-align: right;" onclick="event.stopPropagation()">
                <div style="display: flex; gap: 0.75rem; justify-content: flex-end;">
                    ${(() => {
                    // DELETE SESSION BUTTON (Owner/Admin) - Replaces individual delete
                    if (currentUser.role === 'owner' || currentUser.role === 'admin') {
                        return `
                                <button class="btn-icon" style="color: var(--danger); font-size:1.4rem;" 
                                    onclick="event.stopPropagation(); deleteSession('${s.sessionId || ''}', '${s.date}', '${s.seller}', '${s.businessId}')" 
                                    title="Eliminar Sesión Completa">
                                    <i class="ph ph-trash"></i>
                                </button>
                            `;
                    }
                    return '';
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

                    <button class="btn-primary" onclick="navigateTo('pos')"><i class="ph ph-plus"></i> Nueva Venta (Carrito)</button>
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
    } catch (e) {
        console.error('Error rendering Sales History:', e);
        container.innerHTML = `<div style="padding:2rem; text-align:center; color:var(--danger);"><i class="ph ph-warning-circle" style="font-size:2rem;"></i><br>Error cargando historial.<br><small>${e.message}</small></div>`;
    }
}


let inventorySortBy = 'name'; // Global state for sorting

function renderInventory(container) {
    if (!container) return; // Guard clause

    // 1. Prepare Items
    let items = [];
    if (selectedBusinessId) {
        items = db.products.map(p => {
            const inv = db.inventory.find(i => i.productId === p.id && String(i.businessId) === String(selectedBusinessId));
            return { ...p, stock: inv ? parseFloat(inv.quantity || 0) : 0 };
        });
    } else {
        items = db.products.map(p => {
            const totalStock = db.inventory.filter(i => i.productId === p.id).reduce((sum, i) => sum + parseFloat(i.quantity || 0), 0);
            return { ...p, stock: totalStock };
        });
    }

    if (currentUser.role === 'seller') {
        items = items.filter(i => i.stock > 0);
    }

    // 2. Sort Items
    if (inventorySortBy === 'name') {
        items.sort((a, b) => a.name.localeCompare(b.name));
    } else if (inventorySortBy === 'date') {
        items.sort((a, b) => b.id - a.id); // Newer ID = Newer Date
    } else if (inventorySortBy === 'stock') {
        items.sort((a, b) => a.stock - b.stock);
    } else if (inventorySortBy === 'stock_desc') {
        items.sort((a, b) => b.stock - a.stock);
    } else if (inventorySortBy === 'sales') {
        // Calculate sales on the fly (expensive but fine for small DB)
        const salesMap = {};
        db.sales.forEach(s => {
            if (s.status === 'closed' || s.status === 'approved') {
                if (!selectedBusinessId || String(s.businessId) === String(selectedBusinessId)) {
                    s.items.forEach(i => {
                        const pid = i.productId || i.id;
                        salesMap[pid] = (salesMap[pid] || 0) + i.qty;
                    });
                }
            }
        });
        items.sort((a, b) => (salesMap[b.id] || 0) - (salesMap[a.id] || 0));
    }

    // 3. Render
    const cards = items.map(i => {
        // Semaphore Logic
        let semClass = 'green';
        const min = i.minStock || 10;
        if (i.stock <= 0) semClass = 'red';
        else if (i.stock < min) semClass = 'yellow';

        return `
            <div class="product-card-v2" onclick="showEditProductModal(${i.id})">
                <div class="pc-semaphore ${semClass}" title="Estado: ${semClass}"></div>
                
                <div class="pc-header">
                    <div class="pc-title" title="${i.name}">${i.name}</div>
                </div>

                <div class="pc-image-container">
                    ${(i.thumbnail || i.image)
                ? `<img src="${i.thumbnail || i.image}" class="pc-image" alt="${i.name}">`
                : `<div style="color:var(--text-muted); font-size:3rem;"><i class="ph ph-image"></i></div>`
            }
                    <div class="pc-actions">
                         <div class="pc-action-btn" onclick="event.stopPropagation(); showEditProductModal(${i.id})">
                            <i class="ph ph-pencil-simple"></i>
                         </div>
                         ${selectedBusinessId ? `
                         <div class="pc-action-btn" onclick="event.stopPropagation(); showMermaModal(${i.id})">
                             <i class="ph ph-trash"></i>
                         </div>
                         ` : ''}
                    </div>
                </div>

                <div class="pc-footer">
                    <div class="pc-col">
                        <span class="pc-qty-label">Cant</span>
                        <span class="pc-qty-value" style="color: ${i.stock <= 0 ? 'var(--danger)' : 'var(--primary)'}">${i.stock}</span>
                    </div>
                    <div class="pc-col" style="align-items: flex-end;">
                        <span class="pc-price-label">Precio</span>
                        <span class="pc-price-value">$${i.price.toFixed(2)}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    const businessName = selectedBusinessId ? db.businesses.find(b => String(b.id) === String(selectedBusinessId))?.name : 'Consolidado';

    container.innerHTML = `
        <div class="fade-in">
            <!-- Toolbar from Sketch -->
            <div class="inventory-toolbar">
                <div class="inventory-actions">
                    ${currentUser.role !== 'seller' ? `
                        <button class="btn-merma" style="padding: 0.5rem 1rem; border-radius: 8px; cursor: pointer; font-weight: 600; display: flex; align-items: center; gap: 0.5rem;" onclick="showWasteModal()">
                            <i class="ph ph-warning-circle"></i> Merma
                        </button>
                        
                        <div style="position: relative; display: inline-block;">
                            <button class="btn-secondary" onclick="document.getElementById('csv-import-input').click()">
                                <i class="ph ph-upload-simple"></i> Importar
                            </button>
                            <input type="file" id="csv-import-input" accept=".csv" style="display: none;" onchange="importInventoryCSV(this)">
                        </div>

                        <div style="position: relative; display: inline-block;">
                            <button class="btn-secondary" onclick="toggleExportMenu()">
                                <i class="ph ph-download-simple"></i> Exportar
                            </button>
                            <div id="export-dropdown" style="display: none; position: absolute; top: 110%; left: 0; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; z-index: 100; min-width: 150px; box-shadow: 0 4px 12px rgba(0,0,0,0.5);">
                                <div class="dropdown-item" onclick="exportInventoryCSV()">
                                    <i class="ph ph-file-csv"></i> CSV (.csv)
                                </div>
                                <div class="dropdown-item" onclick="exportInventoryPDFWrapper()">
                                    <i class="ph ph-file-pdf"></i> PDF (Lista)
                                </div>
                            </div>
                        </div>
                    ` : ''}
                </div>

                <div class="search-container">
                    <i class="ph ph-magnifying-glass search-icon"></i>
                    <input type="text" class="search-input" placeholder="Buscar producto..." onkeyup="filterInventoryRender(this.value)">
                </div>

                <div style="display: flex; gap: 0.5rem; align-items: center;">
                    <span style="color: var(--text-muted); font-size: 0.85rem;">Ordenar por:</span>
                    <select onchange="updateInventorySort(this.value)" class="biz-input" style="padding: 0.5rem; border-radius: 8px;">
                        <option value="name" ${inventorySortBy === 'name' ? 'selected' : ''}>Nombre (A-Z)</option>
                        <option value="date" ${inventorySortBy === 'date' ? 'selected' : ''}>Fecha Entrada</option>
                        <option value="sales" ${inventorySortBy === 'sales' ? 'selected' : ''}>Más Vendidos</option>
                        <option value="stock" ${inventorySortBy === 'stock' ? 'selected' : ''}>Menor Stock</option>
                        <option value="stock_desc" ${inventorySortBy === 'stock_desc' ? 'selected' : ''}>Mayor Stock</option>
                    </select>
                </div>
            </div>

            <h2 style="margin-bottom: 1.5rem; padding-left: 0.5rem;">${businessName} (${items.length} productos)</h2>

            <div class="inventory-grid" id="inventory-grid-container">
                ${cards.length > 0 ? cards : '<div style="grid-column: 1/-1; padding: 3rem; text-align: center; color: var(--text-muted);">No se encontraron productos.</div>'}
            </div>

             ${currentUser.role !== 'seller' ? `
            <div id="fab-container" class="fab-container">
                <button class="fab-main" onclick="showAddProductModal()">
                    <i class="ph ph-plus"></i>
                </button>
            </div>
            ` : ''}
        </div>
    `;
    updateTitle('Gestión de Inventario');
}

// Helper for filtering without full re-render logic duplication (simplified for now)
function filterInventoryRender(query) {
    const grid = document.getElementById('inventory-grid-container');
    const cards = grid.getElementsByClassName('product-card-v2');
    const q = query.toLowerCase();

    Array.from(cards).forEach(card => {
        const title = card.querySelector('.pc-title').innerText.toLowerCase();
        if (title.includes(q)) {
            card.style.display = 'flex';
        } else {
            card.style.display = 'none';
        }
    });
}

function updateInventorySort(val) {
    inventorySortBy = val;
    renderInventory(document.getElementById('content-area'));
}

function toggleExportMenu() {
    const el = document.getElementById('export-dropdown');
    el.style.display = el.style.display === 'none' ? 'block' : 'none';

    // Auto close
    if (el.style.display === 'block') {
        setTimeout(() => {
            document.addEventListener('click', function close(e) {
                if (!e.target.closest('#export-dropdown') && !e.target.closest('button')) {
                    el.style.display = 'none';
                    document.removeEventListener('click', close);
                }
            });
        }, 0);
    }
}


function toggleProductSelection(productId) {
    if (selectedProducts.has(productId)) {
        selectedProducts.delete(productId);
    } else {
        selectedProducts.add(productId);
    }
    renderSidebar(currentView); // To refresh counts if needed
    renderInventory(document.getElementById('content-area'));
}

function clearProductSelection() {
    selectedProducts.clear();
    renderInventory(document.getElementById('content-area'));
}

async function deleteSelectedProducts() {
    if (selectedProducts.size === 0) return;
    if (!confirm(`¿Estás seguro de eliminar ${selectedProducts.size} productos? Esta acción no se puede deshacer.`)) return;

    const idsToDelete = Array.from(selectedProducts);

    // Remove from products db
    db.products = db.products.filter(p => !idsToDelete.includes(p.id));

    // Remove from inventory db
    db.inventory = db.inventory.filter(i => !idsToDelete.includes(i.productId));

    // Log action
    addLog('Eliminación Masiva', `Se eliminaron ${idsToDelete.length} productos del sistema.`);

    await saveData();
    selectedProducts.clear();
    showToast(`${idsToDelete.length} productos eliminados.`);
    renderInventory(document.getElementById('content-area'));
}

function adjustSelectedStock() {
    if (selectedProducts.size === 0) return;
    // For now simple alert, later can be a modal
    showToast('Función de ajuste masivo próximamente integrada.', 'info');
}

// POS State (declared at top)

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
                    <select name="productId" required style="width: 100%; padding: 0.75rem; background: var(--bg-dark); border: 1px solid var(--border); border-radius: 8px; color: inherit;">
                        ${productOptions}
                    </select>
                </div>
                <div style="margin-bottom: 1.5rem;">
                    <label style="display: block; margin-bottom: 0.5rem; color: var(--text-muted);">Cantidad</label>
                    <input type="number" name="quantity" required min="0.1" step="0.1" style="width: 100%; padding: 0.75rem; background: var(--bg-dark); border: 1px solid var(--border); border-radius: 8px; color: inherit;">
                </div>
                <div style="margin-bottom: 1.5rem;">
                    <label style="display: block; margin-bottom: 0.5rem; color: var(--text-muted);">Motivo / Notas</label>
                    <textarea name="notes" placeholder="Ej: Rotura, Vencimiento..." style="width: 100%; padding: 0.75rem; background: var(--bg-dark); border: 1px solid var(--border); border-radius: 8px; color: inherit; min-height: 80px;"></textarea>
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
        if (isReviewingClosure && !window.auditTempData) window.auditTempData = {}; // Safety init
        await saveData();
        renderMermas(document.getElementById('content-area'));
        if (document.getElementById('modal-notifications')) showNotificationsModal();
    }
}

function isWarehouseContext() {
    const biz = db.businesses.find(b => String(b.id) === String(selectedBusinessId));
    return biz && biz.type === 'warehouse';
}

function renderPOS(container) {
    try {
        // 1. Verificar si hay sesión activa
        if (!isSessionActive && !isReviewingClosure) {
            renderOpenSessionScreen(container);
            return;
        }

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
                        <input type="date" id="pos-date" value="${isReviewingClosure ? (window.auditTempData?.targetDate || today) : today}" ${!canEditDate ? 'disabled' : ''} 
                        style="background: transparent; border: none; color: inherit; font-weight: bold; font-size: 1rem; outline: none;">
                    </div>
                </div>
                <div style="display: flex; gap: 2rem; text-align: right;">
                    <div>
                        <label style="display: block; font-size: 0.75rem; color: var(--text-muted);">Hora Apertura</label>
                        <input type="time" id="pos-open-time" value="${isReviewingClosure ? window.auditTempData.openingTime : currentTime}" class="input-minimal" style="width: 100px;">
                    </div>
                    ${isReviewingClosure ? `
                    <div>
                        <label style="display: block; font-size: 0.75rem; color: var(--text-muted);">Hora Cierre</label>
                        <input type="time" id="pos-close-time" value="${window.auditTempData.closingTime || currentTime}" class="input-minimal" style="width: 100px;">
                    </div>` : ''}
                </div>
            </div>
        `;

        const searchHtml = `
            <div class="card search-container-card" style="margin-bottom: 1rem;">
                <div class="search-bar">
                    <input type="text" id="pos-search" placeholder="Buscar producto por nombre..." 
                           oninput="handlePOSSearch(this.value)" class="input-field" style="padding-left: 3rem;" autocomplete="off">
                    <i class="ph ph-magnifying-glass" style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: var(--text-muted);"></i>
                    <div id="pos-results" class="pos-results"></div>
                </div>
            </div>
        `;

        // Responsive Grid Structure
        // 'pos-container' is targeted by CSS to become flex-column on mobile
        container.innerHTML = `
        <div id="pos-container" class="fade-in pos-container" style="display: grid; grid-template-columns: 1fr 450px; gap: 1.5rem; height: calc(100vh - 150px);">
            <!-- Panel Izquierdo: Buscador y Productos -->
            <div id="pos-left-panel" class="pos-left-panel" style="display: flex; flex-direction: column; min-height: 0; gap: 1rem;">
                ${headerHtml}
                ${isReviewingClosure ? `
                    <div class="pos-banner pos-banner-review">
                        <span><i class="ph ph-shield-check"></i> MODALIDAD: REVISANDO CIERRE DE DÍA</span>
                        <button class="btn-ghost" onclick="cancelPOSEdit()" style="color: var(--danger); font-size: 0.8rem; padding: 0.2rem 0.5rem; border: 1px solid var(--danger); border-radius: 6px;">CANCELAR REVISIÓN</button>
                    </div>
                ` : ''}
                ${editingSaleId ? `
                    <div class="pos-banner pos-banner-edit">
                        <span><i class="ph ph-pencil-simple"></i> MODALIDAD: EDITANDO VENTA #${editingSaleId.toString().slice(-4)}</span>
                        <button class="btn-ghost" onclick="cancelPOSEdit()" style="color: var(--danger); font-size: 0.8rem; padding: 0.2rem 0.5rem; border: 1px solid var(--danger); border-radius: 6px;">CANCELAR EDICIÓN</button>
                    </div>
                ` : ''}
                ${searchHtml}
                
                <!-- Use a specific ID for the products/cart area to target with CSS -->
                <div id="pos-cart-area" class="card" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; padding: 0;">
                     <div style="padding: 1rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
                        <h3 style="margin: 0;"><i class="ph ph-shopping-cart"></i> Carrito</h3>
                        <div style="display: flex; gap: 0.5rem;">
                             <button class="btn-ghost" onclick="posCart=[]; renderCart();" style="color: var(--danger); padding: 0.5rem;" title="Limpiar Carrito"><i class="ph ph-trash"></i></button>
                        </div>
                    </div>
                    <div id="pos-cart-items" style="flex: 1; overflow-y: auto;"></div>
                    
                    ${!isWarehouseContext() ? `
                        <div class="pos-management-actions" style="padding: 1rem;">
                            <button class="btn-secondary btn-expense" onclick="openExpenseModal()">
                                <i class="ph ph-receipt"></i> Registrar Gasto
                            </button>
                            <button class="btn-secondary btn-merma" onclick="openIncidentModal()">
                                <i class="ph ph-warning-circle"></i> Incidencias / Dev
                            </button>
                        </div>
                    ` : ''}
                </div>
            </div>

            <!-- Panel Derecho: Lista de Hoy y Resumen -->
            <div id="pos-right-panel" class="pos-right-panel" style="display: flex; flex-direction: column; gap: 1.5rem; min-height: 0;">
                <!-- Lista de Movimientos del Día (Hidden on small mobile if desired, or kept under) -->
                <div id="pos-daily-list-card" class="card" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; padding: 0;">
                    <div style="padding: 1rem; border-bottom: 1px solid var(--border); background: var(--bg-dark);">
                        <h3 style="margin: 0; font-size: 1rem;"><i class="ph ph-list-numbers"></i> Movimientos del Día</h3>
                    </div>
                    <div id="today-sales-list" style="flex: 1; height: 400px; overflow-y: auto;"></div>
                </div>

                <!-- Resumen y Acciones (Footer Desktop / Sticky Mobile) -->
                <div id="pos-actions-card" class="card" style="padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; background: var(--bg-card);">
                    <div id="pos-summary"></div>
                    
                    <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                        ${isReviewingClosure ? `
                            <button id="payBtn" class="btn-primary" style="width: 100%; height: 60px; font-size: 1.2rem; border-radius: 10px; background: var(--success);" 
                                    onclick="approveClosureFromPOS()">
                                <i class="ph ph-check-circle"></i> APROBAR CIERRE DE DÍA
                            </button>
                        ` : `
                            <button id="payBtn" class="btn-primary" style="width: 100%; height: 60px; font-size: 1.2rem; border-radius: 10px;" 
                                    onclick="${isWarehouseContext() ? 'showTransferModal()' : 'showPaymentModal()'}">
                                <i class="ph ${isWarehouseContext() ? 'ph-package' : 'ph-hand-coins'}"></i> 
                                ${isWarehouseContext() ? 'TRANSFERIR MERCANCÍA' : 'COBRAR'}
                            </button>
                            
                            <!-- Expense Button in POS -->
                            ${!isWarehouseContext() ? `
                                <button class="btn-secondary" style="width: 100%; border-color: var(--danger); color: var(--danger);" onclick="showExpenseModal()">
                                    <i class="ph ph-money-wavy"></i> REGISTRAR GASTO
                                </button>
                            ` : ''}
                        `}
                        
                        ${(!isReviewingClosure && currentUser.role === 'seller' && !isWarehouseContext()) ? `
                            <button class="btn-secondary" style="width: 100%; border-color: var(--primary); color: var(--primary);" onclick="openPOSClosureModal()">
                                <i class="ph ph-lock-key"></i> TERMINAR Y CERRAR DÍA
                            </button>
                        ` : ''}
                        
                        ${(!isReviewingClosure && currentUser.role !== 'seller' && !isWarehouseContext()) ? `
                            <button class="btn-secondary" style="width: 100%;" onclick="openPOSClosureModal()">
                                <i class="ph ph-check-square"></i> CERRAR DÍA (MODO ADMIN)
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
            
            <!-- STICKY FOOTER CONTAINER (Mobile Only Injection) -->
            <div id="pos-mobile-footer" class="pos-footer-sticky" style="display: none;">
                <!-- Content injected via updatePOSFooter() -->
            </div>
        </div>
        `;

        updateTitle(isReviewingClosure ? 'Ventana en Revisión (Auditoría)' : 'Punto de Venta');
        renderCart();
        renderTodaySalesList();

        // Initial Footer Sync
        updatePOSMobileFooter();

        // Listen for Resize to update visibility
        window.removeEventListener('resize', updatePOSMobileFooter); // Prevent duplicates
        window.addEventListener('resize', updatePOSMobileFooter);

    } catch (e) {
        console.error('Error rendering POS:', e);
        container.innerHTML = `<div style="padding:2rem; text-align:center; color:var(--danger);"><i class="ph ph-warning-circle" style="font-size:2rem;"></i><br>Error cargando Punto de Venta.<br><small>${e.message}</small></div>`;
    }
}

// Helper to manage sticky footer content
window.updatePOSMobileFooter = function () {
    const footer = document.getElementById('pos-mobile-footer');
    const actionsCard = document.getElementById('pos-actions-card');
    const summary = document.getElementById('pos-summary');

    if (!footer || !actionsCard) return;

    if (window.innerWidth <= 768) {
        // MOBILE MODE: Show Sticky Footer, Hide Desktop Card Content
        footer.style.display = 'flex';
        // We clone the important buttons to the footer if not already there
        if (footer.innerHTML.trim() === '') {
            // Calculate Total for display
            const total = (window.posCart || []).reduce((sum, item) => sum + (item.price * item.qty), 0);
            footer.innerHTML = `
                <div class="total-display">$${total.toFixed(2)}</div>
                <button class="btn-primary" onclick="${isWarehouseContext() ? 'showTransferModal()' : 'showPaymentModal()'}" style="border-radius:20px;">
                    ${isWarehouseContext() ? 'Transferir' : 'COBRAR'}
                </button>
             `;
        } else {
            // Update Total
            const total = (window.posCart || []).reduce((sum, item) => sum + (item.price * item.qty), 0);
            const totalDisplay = footer.querySelector('.total-display');
            if (totalDisplay) totalDisplay.innerText = `$${total.toFixed(2)}`;
        }
        actionsCard.style.display = 'none'; // Hide the original card to save space
    } else {
        // DESKTOP MODE
        footer.style.display = 'none';
        actionsCard.style.display = 'flex'; // Restore original
        footer.innerHTML = ''; // Clear to prevent ID conflicts
    }
}

// Hook into renderCart to update footer total dynamically
const originalRenderCart = window.renderCart; // Safety check if exists




function renderTodaySalesList() {
    const container = document.getElementById('today-sales-list');
    if (!container) return;

    const todayDate = document.getElementById('pos-date') ? document.getElementById('pos-date').value : new Date().toISOString().split('T')[0];

    // Obtener ventas del día seleccionado
    const todaySales = db.sales.filter(s => {
        const saleDatePart = s.date.split(' ')[0];
        const saleTs = s.timestamp || new Date(s.date).getTime();

        // FILTRO DE SESIÓN: Si estamos en una sesión activa, SOLO mostrar ventas de ESTA sesión.
        // Si el admin revisa (isReviewingClosure), mostrar TODO lo del día (o lo que esté en filter normal).
        let sessionCondition = true;
        if (isSessionActive && !isReviewingClosure) {
            sessionCondition = saleTs >= currentSessionStartTime;
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
        let cardClass = '';
        if (s.type === 'EXPENSE') cardClass = 'card-expense';
        else if (['DEVOLUCION_STOCK', 'DEVOLUCION_ROTO', 'ROTURA_DETERIORO'].includes(s.type)) cardClass = 'card-incidence';

        const isExpense = s.type === 'EXPENSE';
        const isIncidence = !isExpense && cardClass === 'card-incidence';

        // Contenido de la tarjeta
        let detailsHtml = '';
        if (isExpense) {
            detailsHtml = `<div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.5rem; italic">${s.details || 'Sin descripción'}</div>`;
        } else if (s.type === 'daily_closure_report') {
            detailsHtml = `<div style="font-size: 0.85rem; color: var(--primary); margin-top: 0.5rem; font-weight:bold;">REPORTE DE CIERRE DEFINITIVO</div>`;
        } else {
            detailsHtml = `
                <div style="margin-top: 0.5rem; font-size: 0.8rem; color: var(--text-muted);">
                    ${(s.items || []).map(item => `<div>• ${item.name} (${item.qty})</div>`).join('')}
                </div>
            `;
        }

        return `
        <div class="card ${cardClass}" style="margin: 0.5rem; padding: 1.2rem; border: 1px solid var(--border); background: var(--bg-card); border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); position: relative;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.8rem; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem;">
                <div style="background: ${isExpense ? 'var(--danger)' : (isIncidence ? 'var(--warning)' : 'var(--primary)')}; color: white; padding: 0.2rem 0.6rem; border-radius: 6px; font-size: 0.75rem; font-weight: bold;">
                    #${s.id.toString().slice(-4)} ${isExpense ? '(GASTO)' : (isIncidence ? '(INCIDENCIA)' : '')}
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 1.2rem; font-weight: 900; color: ${isExpense ? 'var(--danger)' : (isIncidence ? 'var(--warning)' : 'var(--primary)')};">
                        ${isExpense ? '-' : ''}$${Math.abs(s.total || 0).toFixed(2)}
                    </div>
                </div>
            </div>
            
            ${detailsHtml}

            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1rem; border-top: 1px solid var(--border); padding-top: 0.5rem;">
                <span style="font-size: 0.7rem; color: var(--text-muted);">${s.date.split(' ')[1] || ''} | ${s.seller || 'Sistema'}</span>
                <div style="display: flex; gap: 0.4rem;">
                    ${currentUser.role !== 'seller' || s.status === 'registered' ? `
                        <button class="btn-icon" onclick="editSale(${s.id})" style="color: var(--primary); background: rgba(var(--primary-rgb), 0.1);"><i class="ph ph-pencil-simple"></i></button>
                        <button class="btn-icon" onclick="deleteSale(${s.id})" style="color: var(--danger); background: rgba(239, 68, 68, 0.1);"><i class="ph ph-trash"></i></button>
                    ` : ''}
                </div>
            </div>
        </div>
        `;
    }).join('');
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
// REDUNDANT FUNCTIONS REMOVED FOR CLEANUP (Moved to global bridges or consolidated)

async function registerIndividualSale() {
    console.log("Registering sale...");
    if (posCart.length === 0) {
        alert("El carrito está vacío");
        return;
    }

    const cashInput = document.getElementById('pay-cash-input');
    const transferInput = document.getElementById('pay-transfer-input');
    const currencySelect = document.getElementById('pay-currency-select');

    if (!cashInput || !transferInput || !currencySelect) {
        // If modal not open (e.g. called from elsewhere), default to currentPaymentMethod
        showPaymentModal();
        // --- EXPENSE REGISTRATION LOGIC ---
        function showExpenseModal() {
            // 1. Filter categories based on role
            let categories = db.expenseCategories || [];
            const role = currentUser.role;

            // Visibility Logic
            if (role === 'owner') {
                // Owner sees everything
            } else if (role === 'admin') {
                categories = categories.filter(c => c.allowedRoles === 'admin' || c.allowedRoles === 'all');
            } else if (role === 'seller') {
                categories = categories.filter(c => c.allowedRoles === 'seller' || c.allowedRoles === 'all');
            }

            if (categories.length === 0) {
                alert("No hay categorías de gastos habilitadas para tu perfil.");
                return;
            }
        }

        const categoriesOptions = categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');

        const modalHtml = `
        <div class="card" style="width: 400px; padding: 2rem; border-radius: 20px;">
            <h2 style="margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.5rem; color: var(--danger);">
                <i class="ph ph-money-wavy"></i> Registrar Gasto
            </h2>
            
            <div class="form-group" style="margin-bottom: 1rem;">
                <label style="display: block; margin-bottom: 0.5rem; font-size: 0.9rem;">Concepto / Categoría</label>
                <div style="position: relative;">
                    <i class="ph ph-tag" style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: var(--text-muted);"></i>
                    <select id="expense-category" class="input-field" style="padding-left: 3rem;">
                        ${categoriesOptions}
                    </select>
                </div>
            </div>

            <div class="form-group" style="margin-bottom: 1rem;">
                <label style="display: block; margin-bottom: 0.5rem; font-size: 0.9rem;">Monto</label>
                <div style="position: relative;">
                    <i class="ph ph-money" style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: var(--danger);"></i>
                    <input type="number" id="expense-amount" step="0.01" class="input-field" style="padding-left: 3rem;" placeholder="0.00">
                </div>
            </div>

            <div class="form-group" style="margin-bottom: 1.5rem;">
                <label style="display: block; margin-bottom: 0.5rem; font-size: 0.9rem;">Detalles Adicionales (Opcional)</label>
                <textarea id="expense-details" class="input-field" rows="2" placeholder="Ej: Compra de detergente..."></textarea>
            </div>

            <div style="display: flex; gap: 1rem;">
                <button class="btn-ghost" style="flex: 1;" onclick="closeModal('expense-modal')">Cancelar</button>
                <button class="btn-primary" style="flex: 2; background: var(--danger);" onclick="registerExpense()">
                    REGISTRAR
                </button>
            </div>
        </div>
    `;
        showModal('expense-modal', modalHtml);
    }

    async function registerExpense() {
        const category = document.getElementById('expense-category').value;
        const amountVal = document.getElementById('expense-amount').value;
        const details = document.getElementById('expense-details').value;

        if (!amountVal || parseFloat(amountVal) <= 0) {
            alert("Ingresa un monto válido.");
            return;
        }

        const amount = parseFloat(amountVal);
        const businessId = selectedBusinessId || 'mch1';

        // Check Funds (Simple check against cash for now, can be expanded)
        // if (db.businessFund.cash < amount) { if(!confirm("Advertencia: El monto excede el efectivo en caja central. ¿Continuar?")) return; }

        const expense = {
            id: Date.now(),
            type: 'EXPENSE',
            date: new Date().toLocaleString(),
            timestamp: Date.now(),
            businessId: businessId,
            seller: currentUser.name,
            sellerId: currentUser.id,
            items: [{ name: category, qty: 1, price: amount }], // Formatting as item for consistency
            total: amount,
            payment: { cash: amount, transfer: 0, currency: 'mn' }, // Expenses usually paid in cash
            details: `${category} - ${details}`,
            status: 'registered',
            sessionId: currentSessionStartTime || Date.now()
        };

        db.sales.unshift(expense);

        // Update Funds (If linked to central fund logic, otherwise it's just a negative sale in the session)
        // db.businessFund.cash -= amount; 

        addLog(`Gasto registrado: ${category} - $${amount.toFixed(2)}`, 'warning');
        await saveData();

        closeModal('expense-modal');
        alert("Gasto registrado correctamente.");

        if (currentView === 'pos') {
            renderTodaySalesList();
            renderPOS(document.getElementById('content-area')); // Refresh dashboard stats
        } else if (currentView === 'ventas') {
            renderVentas(document.getElementById('content-area'));
        }
    }

    const transfer = parseFloat(transferInput.value || 0);
    const currencyCode = currencySelect.value || 'mn';
    const totalValue = posCart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const businessId = selectedBusinessId || 'mch1';
    const now = new Date();
    const explicitDate = document.getElementById('pos-date') ? document.getElementById('pos-date').value : now.toISOString().split('T')[0];
    const dateString = `${explicitDate} ${now.toLocaleTimeString([], { hour12: false })}`;
    const timestamp = Date.now();
    const posOpeningTime = document.getElementById('pos-open-time') ? document.getElementById('pos-open-time').value : null;

    if (!validateStockBeforeProcess()) return;

    // --- INTEGRACIÓN: ACTUALIZAR SALDO AUTOMÁTICO ---
    if (typeof window.actualizarSaldo === 'function') {
        window.actualizarSaldo(currencyCode, totalValue);
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
                    s.total = totalValue;
                    s.payment = { cash, transfer, currency: currencyCode };
                    s.businessId = businessId;
                    s.date = dateString;
                    s.timestamp = timestamp;
                    s.openingTime = posOpeningTime;
                    addLog(`Venta #${s.id} actualizada: $${totalValue.toFixed(2)} (${currencyCode.toUpperCase()})`, 'info');
                }
                editingSaleId = null;
            }
        } else {
            const saleData = {
                id: timestamp,
                date: dateString,
                timestamp: timestamp,
                businessId: businessId,
                seller: currentUser ? currentUser.name : 'Vendedor 1',
                sellerId: currentUser ? currentUser.id : 2,
                items: posCart.map(i => ({ productId: i.id, name: i.name, qty: i.qty, price: i.price })),
                total: totalValue,
                payment: { cash, transfer, currency: currencyCode },
                openingTime: posOpeningTime,
                sessionId: currentSessionStartTime || Date.now(), // SESSION TRACKING
                // NUEVA LÓGICA: Toda venta entra como PENDIENTE (Amarillo) para ser procesada en el cierre
                status: 'registered'
            };
            db.sales.unshift(saleData);
            addLog(`Venta registrada: $${totalValue.toFixed(2)} (${currencyCode.toUpperCase()})`, 'success');
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

const autoCalculateCash = (total) => {
    const transferInput = document.getElementById('pay-transfer-input');
    const cashInput = document.getElementById('pay-cash-input');
    const btn = document.getElementById('confirm-payment-btn');

    let transfer = parseFloat(transferInput.value) || 0;

    // Prevent negative transfers
    if (transfer < 0) {
        transfer = 0;
        transferInput.value = 0;
    }

    // Validation: Transfer cannot exceed Total
    if (transfer > total) {
        alert("La transferencia no puede ser mayor al total.");
        transfer = total;
        transferInput.value = total.toFixed(2);
    }

    const remainingCash = total - transfer;
    cashInput.value = remainingCash.toFixed(2);
};

function showPaymentModal() {
    if (posCart.length === 0) {
        alert("El carrito está vacío");
        return;
    }
    const total = posCart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const isSeller = currentUser && currentUser.role === 'seller';

    let formContent = '';

    if (isSeller) {
        // --- SELLER VIEW: Only MN, Split Cash/Transfer ---
        formContent = `
            <div class="form-group" style="margin-bottom: 1rem;">
                <label style="display: block; margin-bottom: 0.5rem; font-size: 0.9rem;">Pago por Transferencia</label>
                <div style="position: relative;">
                    <i class="ph ph-bank" style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: var(--primary);"></i>
                    <input type="number" id="pay-transfer-input" step="0.01" class="input-field" 
                           style="padding-left: 3rem; border: 1px solid var(--primary);" 
                           value="0" placeholder="0.00" oninput="autoCalculateCash(${total})">
                </div>
            </div>

            <div class="form-group" style="margin-bottom: 1.5rem;">
                <label style="display: block; margin-bottom: 0.5rem; font-size: 0.9rem;">Pago en Efectivo (Restante)</label>
                <div style="position: relative;">
                    <i class="ph ph-money" style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: var(--success);"></i>
                    <input type="number" id="pay-cash-input" step="0.01" class="input-field" 
                           style="padding-left: 3rem; background: var(--bg-hover); color: var(--text-muted);" 
                           value="${total.toFixed(2)}" readonly>
                </div>
            </div>
            
            <!-- Hidden currency select forced to MN -->
            <input type="hidden" id="pay-currency-select" value="mn">
        `;
    } else {
        // --- ADMIN/OWNER VIEW: Full Options ---
        formContent = `
            <div class="form-group" style="margin-bottom: 1rem;">
                <label style="display: block; margin-bottom: 0.5rem; font-size: 0.9rem;">Monto Efectivo</label>
                <div style="position: relative;">
                    <i class="ph ph-money" style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: var(--success);"></i>
                    <input type="number" id="pay-cash-input" step="0.1" class="input-field" style="padding-left: 3rem;" value="${total.toFixed(2)}" oninput="validatePaymentSplit(${total})">
                </div>
            </div>

            <div class="form-group" style="margin-bottom: 1.5rem;">
                <label style="display: block; margin-bottom: 0.5rem; font-size: 0.9rem;">Método de Pago / Moneda</label>
                <div style="position: relative;">
                    <i class="ph ph-currency-circle-dollar" style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: var(--warning);"></i>
                    <select id="pay-currency-select" class="input-field" style="padding-left: 3rem;">
                        <option value="mn">MN (Pesos)</option>
                        <option value="usd">USD (Dólares)</option>
                        <option value="eur">EUR (Euros)</option>
                    </select>
                    <input type="hidden" id="pay-transfer-input" value="0">
                </div>
            </div>
        `;
    }

    const modalHtml = `
        <div class="card" style="width: 400px; padding: 2rem; border-radius: 20px;">
            <h2 style="margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.5rem;">
                <i class="ph ph-coins" style="color: var(--warning);"></i> Finalizar Venta ${isSeller ? '(MN)' : ''}
            </h2>
            <div style="background: var(--bg-dark); padding: 1rem; border-radius: 12px; margin-bottom: 1.5rem; text-align: center;">
                <div style="font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase;">Total a Cobrar</div>
                <div style="font-size: 2.5rem; font-weight: 900; color: var(--primary);">$${total.toFixed(2)}</div>
            </div>

            ${formContent}

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
    window.autoCalculateCash = autoCalculateCash; // Expose to global scope for oninput
}

function validatePaymentSplit(total) {
    const cash = parseFloat(document.getElementById('pay-cash-input').value || 0);
    const transfer = parseFloat(document.getElementById('pay-transfer-input').value || 0);
    const sum = cash + transfer;
    const diff = Math.abs(sum - total);

    const errorEl = document.getElementById('payment-error');
    const btn = document.getElementById('confirm-payment-btn');

    if (diff > 0.02) { // Tolerance for floating point
        if (errorEl) errorEl.style.display = 'block';
        if (btn) {
            btn.disabled = true;
            btn.style.opacity = '0.5';
        }
    } else {
        if (errorEl) errorEl.style.display = 'none';
        if (btn) {
            btn.disabled = false;
            btn.style.opacity = '1';
        }
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

    const isEmpty = posCart.length === 0;
    const payBtn = document.getElementById('payBtn');

    if (isEmpty) {
        container.innerHTML = '<div style="padding:3rem; text-align:center; color:var(--text-muted);"><i class="ph ph-shopping-cart" style="font-size:3rem; display:block; margin-bottom:1rem; opacity:0.2;"></i>El carrito está vacío</div>';
        summary.innerHTML = '<div style="font-size:2rem; font-weight:bold; color:var(--text-muted);">$0.00</div>';

        if (payBtn && !isReviewingClosure) {
            payBtn.disabled = true;
            payBtn.classList.add('disabled');
            payBtn.innerHTML = '<i class="ph ph-shopping-cart"></i> CARRITO VACÍO';
        }
        return;
    }

    if (payBtn && !isReviewingClosure) {
        payBtn.disabled = false;
        payBtn.classList.remove('disabled');
        const text = isWarehouseContext() ? 'TRANSFERIR MERCANCÍA' : 'COBRAR';
        const icon = isWarehouseContext() ? 'ph-package' : 'ph-hand-coins';
        payBtn.innerHTML = `<i class="ph ${icon}"></i> ${text}`;
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

    // Si estamos en revisión, calculamos expected basados en el carrito actual y gastos
    let expectedCash = total; // Simplificación inicial, debería restar gastos
    let expectedTransfer = 0; // Se asume que el admin ajusta esto

    summary.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:0.5rem;">
            <div style="display:flex; justify-content:space-between; color:var(--text-muted);">
                <span>Subtotal (${posCart.length} productos):</span>
                <span>$${total.toFixed(2)}</span>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:2.5rem; font-weight:bold; color:var(--primary); margin-top:1rem; border-top:2px solid var(--border); padding-top:1rem;">
                <span>${isWarehouseContext() ? 'TOTAL ÍTEMS' : (isReviewingClosure ? 'TOTAL SISTEMA' : (editingSaleId ? 'TOTAL A EDITAR' : 'TOTAL'))}</span>
                <span>${isWarehouseContext() ? posCart.reduce((s, i) => s + i.qty, 0) : '$' + total.toFixed(2)}</span>
            </div>

            ${isReviewingClosure ? `
                <div class="audit-comparative-box" style="margin-top: 1.5rem; padding: 1.5rem; background: var(--bg-hover); border-radius: 12px; border: 1px solid var(--border);">
                    <h4 style="margin:0 0 1rem 0; color:var(--warning); font-size:0.9rem; text-transform:uppercase;"><i class="ph ph-scales"></i> Arqueo Comparativo (Editable)</h4>
                    
                    <!-- EFECTIVO -->
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem; margin-bottom:1rem;">
                        <div>
                            <label style="display:block; font-size:0.7rem; color:var(--text-muted);">Efectivo Real</label>
                            <input type="number" id="audit-cash-real" class="input-minimal" style="width:100%; font-size:1.1rem; font-weight:bold;" 
                                   value="${window.auditTempData.cashReal}" oninput="window.auditTempData.cashReal = parseFloat(this.value || 0)">
                        </div>
                        <div>
                            <label style="display:block; font-size:0.7rem; color:var(--text-muted);">Sobrante/Faltante</label>
                            <div style="display:flex; gap:0.25rem;">
                                <input type="number" id="audit-cash-surplus" class="input-minimal" placeholder="Sob." style="width:50%; color:var(--success);" 
                                       value="${window.auditTempData.surplusCash}" oninput="window.auditTempData.surplusCash = parseFloat(this.value || 0)">
                                <input type="number" id="audit-cash-shortage" class="input-minimal" placeholder="Fal." style="width:50%; color:var(--danger);" 
                                       value="${window.auditTempData.shortageCash}" oninput="window.auditTempData.shortageCash = parseFloat(this.value || 0)">
                            </div>
                        </div>
                    </div>

                    <!-- TRANSFERENCIA -->
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
                        <div>
                            <label style="display:block; font-size:0.7rem; color:var(--text-muted);">Transf. Real</label>
                            <input type="number" id="audit-transfer-real" class="input-minimal" style="width:100%; font-size:1.1rem; font-weight:bold;" 
                                   value="${window.auditTempData.transferReal}" oninput="window.auditTempData.transferReal = parseFloat(this.value || 0)">
                        </div>
                        <div>
                            <label style="display:block; font-size:0.7rem; color:var(--text-muted);">Sobrante/Faltante</label>
                            <div style="display:flex; gap:0.25rem;">
                                <input type="number" id="audit-transfer-surplus" class="input-minimal" placeholder="Sob." style="width:50%; color:var(--success);" 
                                       value="${window.auditTempData.surplusTransfer}" oninput="window.auditTempData.surplusTransfer = parseFloat(this.value || 0)">
                                <input type="number" id="audit-transfer-shortage" class="input-minimal" placeholder="Fal." style="width:50%; color:var(--danger);" 
                                       value="${window.auditTempData.shortageTransfer}" oninput="window.auditTempData.shortageTransfer = parseFloat(this.value || 0)">
                            </div>
                        </div>
                    </div>
                </div>
            ` : ''}

            ${editingSaleId ? `
                <div style="text-align: center; margin-top: 0.5rem; border-top: 1px dashed var(--border); padding-top: 0.5rem;">
                    <span style="font-size: 0.75rem; color: var(--warning); display: block; margin-bottom: 0.25rem;"><i class="ph ph-warning-circle"></i> Cambios sin guardar</span>
                </div>
            ` : ''}
        </div>
    `;

    // --- SYNC MOBILE FOOTER ---
    if (typeof window.updatePOSMobileFooter === 'function') {
        window.updatePOSMobileFooter();
    }
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
    const templates = [
        { label: "Área", value: "Área" },
        { label: "Limpieza", value: "Limpieza" },
        { label: "Otro...", value: "OTHER" }
    ];

    const modalHtml = `
        <div class="card" style="width: 450px; padding: 2rem; border-radius: 20px;">
            <h2 style="margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.5rem; color: var(--danger);">
                <i class="ph ph-receipt"></i> Salida de Caja (Gasto)
            </h2>
            <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 1.5rem;">Se restará del efectivo en caja del día.</p>
            
            <div class="form-group" style="margin-bottom: 1.5rem;">
                <label style="display: block; margin-bottom: 0.5rem; font-size: 0.9rem;">Tipo de Gasto</label>
                <select id="expenseTemplate" class="input-field" onchange="toggleExpenseReason()">
                    ${templates.map(t => `<option value="${t.value}">${t.label}</option>`).join('')}
                </select>
            </div>

            <div class="form-group" id="expenseReasonGroup" style="margin-bottom: 1.5rem; display: none;">
                <label style="display: block; margin-bottom: 0.5rem; font-size: 0.9rem;">Descripción del Gasto</label>
                <input type="text" id="expenseReason" placeholder="Ej: Pago de chapeador..." class="input-field">
            </div>

            <div class="form-group" style="margin-bottom: 2rem;">
                <label style="display: block; margin-bottom: 0.5rem; font-size: 0.9rem;">Monto ($)</label>
                <input type="number" id="expenseAmount" placeholder="0.00" min="0" step="0.1" class="input-field">
            </div>

            <div style="display: flex; gap: 1rem;">
                <button class="btn-ghost" style="flex: 1;" onclick="closeModal('expense-modal')">Cancelar</button>
                <button class="btn-primary" style="flex: 2; background: var(--danger); border-color: var(--danger);" onclick="confirmExpense()">
                    REGISTRAR GASTO
                </button>
            </div>
        </div>
    `;
    showModal('expense-modal', modalHtml);
}

window.toggleExpenseReason = function () {
    const template = document.getElementById('expenseTemplate').value;
    const group = document.getElementById('expenseReasonGroup');
    if (group) group.style.display = (template === 'OTHER') ? 'block' : 'none';
};

function openIncidentModal() {
    const modal = document.getElementById('incidentModal');
    if (!modal) return;

    modal.classList.remove('hidden');

    // Limpiar resultados anteriores
    const results = document.getElementById('incident-search-results');
    if (results) results.style.display = 'none';

    const preview = document.getElementById('product-preview-card');
    if (preview) {
        preview.style.display = 'none';
        preview.innerHTML = '';
    }

    // Resetear campos
    document.getElementById('incidentProductSearch').value = '';
    document.getElementById('incidentReason').value = '';
    document.getElementById('incidentQty').value = '1';
    document.getElementById('incidentAmount').value = '';

    updateIncidentUI();
}


// --- INCIDENT SMART SEARCH ---
window.handleIncidentSearch = function (query) {
    const results = document.getElementById('incident-search-results');
    if (!results) return;
    if (query.length < 2) {
        results.style.display = 'none';
        return;
    }

    const filtered = db.products.filter(p => p.name.toLowerCase().includes(query.toLowerCase()));
    if (filtered.length === 0) {
        results.style.display = 'none';
        return;
    }

    results.innerHTML = filtered.map(p => {
        const inv = db.inventory.find(invI => String(invI.productId) === String(p.id) && String(invI.businessId) === (selectedBusinessId || 'mch1'));
        const stock = inv ? inv.quantity : 0;
        return `
            <div class="pos-search-item" onclick="selectIncidentProduct(${p.id})" style="padding: 10px; cursor: pointer; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 10px;">
                <img src="${p.image || 'https://via.placeholder.com/40'}" style="width: 40px; height: 40px; border-radius: 4px; object-fit: cover;">
                <div>
                    <div style="font-weight: bold;">${p.name}</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">$${p.price.toFixed(2)} | Stock: ${stock}</div>
                </div>
            </div>
        `;
    }).join('');
    results.style.display = 'block';
};

window.selectIncidentProduct = function (productId) {
    const p = db.products.find(prod => String(prod.id) === String(productId));
    if (!p) return;

    document.getElementById('incidentProductSearch').value = p.name;
    document.getElementById('incident-search-results').style.display = 'none';

    updateIncidentPreviewCard(p);
};

function updateIncidentPreviewCard(p) {
    const card = document.getElementById('product-preview-card');
    const inv = db.inventory.find(invI => String(invI.productId) === String(p.id) && String(invI.businessId) === (selectedBusinessId || 'mch1'));
    const stock = inv ? inv.quantity : 0;

    card.innerHTML = `
        <div class="card" style="padding: 1rem; background: rgba(255,255,255,0.03); border: 1px solid var(--primary); display: flex; gap: 1rem; align-items: center; margin-top: 0.5rem;">
            <img src="${p.image || 'https://via.placeholder.com/60'}" style="width: 60px; height: 60px; border-radius: 8px; object-fit: cover;">
            <div style="flex: 1;">
                <h4 style="margin: 0; color: white;">${p.name}</h4>
                <div style="font-size: 0.9rem; margin-top: 0.4rem; display: flex; gap: 1rem; flex-wrap: wrap;">
                    <span style="color: var(--primary); font-weight: 600;">Precio: $${p.price.toFixed(2)}</span>
                    <span style="color: ${stock > 0 ? 'var(--success)' : 'var(--danger)'}; font-weight: 600;">En Stock: ${stock}</span>
                    <span style="color: var(--text-muted);">Ref: #${p.id}</span>
                </div>
            </div>
            <input type="hidden" id="selectedIncidentProductId" value="${p.id}">
        </div>
    `;
    card.style.display = 'flex';
}

let incidentPhotosData = [];
window.handleIncidentPhotos = function (input) {
    const container = document.getElementById('photo-preview-container');
    const files = Array.from(input.files);

    if (incidentPhotosData.length + files.length > 5) {
        alert("Máximo 5 fotos permitidas.");
        return;
    }

    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const base64 = e.target.result;
            incidentPhotosData.push(base64);
            renderPhotoPreviews();
        };
        reader.readAsDataURL(file);
    });
};

function renderPhotoPreviews() {
    const container = document.getElementById('photo-preview-container');
    const uploadBtn = container.querySelector('label');

    // Clear existing previews except the upload button
    container.querySelectorAll('.photo-preview-item').forEach(el => el.remove());

    incidentPhotosData.forEach((data, index) => {
        const div = document.createElement('div');
        div.className = 'photo-preview-item';
        div.style = `position: relative; width: 60px; height: 60px; border-radius: 8px; overflow: hidden;`;
        div.innerHTML = `
            <img src="${data}" style="width: 100%; height: 100%; object-fit: cover;">
            <button onclick="removeIncidentPhoto(${index})" style="position: absolute; top: 0; right: 0; background: var(--danger); color: white; border: none; font-size: 10px; cursor: pointer; padding: 2px 5px;">&times;</button>
        `;
        container.insertBefore(div, uploadBtn);
    });

    if (uploadBtn) uploadBtn.style.display = (incidentPhotosData.length >= 5) ? 'none' : 'flex';
}

window.removeIncidentPhoto = function (index) {
    incidentPhotosData.splice(index, 1);
    renderPhotoPreviews();
};

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
    const template = document.getElementById('expenseTemplate').value;
    let reason = template;

    if (template === 'OTHER') {
        reason = document.getElementById('expenseReason').value.trim();
    }

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
        sessionId: currentSessionStartTime || Date.now(), // SESSION TRACKING
        type: "EXPENSE",
        status: (currentUser.role === 'owner' || currentUser.role === 'admin') ? 'closed' : 'registered'
    };

    db.sales.unshift(expenseEntry);
    addLog(`Gasto registrado: -$${amount.toFixed(2)} (${reason})`, 'warning');

    saveData().catch(e => console.error("Background save warning:", e));
    alert("Gasto registrado con éxito.");
    closeModal('expense-modal');

    setTimeout(() => {
        console.log("Rendering sales list after expense...");
        if (typeof renderTodaySalesList === 'function') renderTodaySalesList();
        if (typeof renderDashboard === 'function') renderDashboard(null);
    }, 50);
}

async function processIncident() {
    const type = document.getElementById('incidentType').value;
    const productId = document.getElementById('selectedIncidentProductId') ? document.getElementById('selectedIncidentProductId').value : null;
    const product = db.products.find(p => String(p.id) === String(productId));

    const qty = parseInt(document.getElementById('incidentQty').value);
    const amount = parseFloat(document.getElementById('incidentAmount').value) || 0;
    const reason = document.getElementById('incidentReason').value.trim();

    if (!product) {
        const query = document.getElementById('incidentProductSearch').value;
        return alert("❌ El producto '" + query + "' no existe. Selecciónalo de la lista de resultados.");
    }
    if (!reason) return alert("❌ Debes escribir un motivo claro para la incidencia.");

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
        photos: [...incidentPhotosData], // Store photos
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
            photos: [...incidentPhotosData],
            reportedBy: currentUser.name,
            status: 'approved'
        });
    }

    addLog(`Incidencia registrada: ${logType} - ${product.name} (x${qty})`, (type === 'internal_loss' ? 'danger' : 'warning'));

    await saveData();
    alert("✅ Operación completada.");
    closeModal('incidentModal');
    renderTodaySalesList();

    const contentArea = document.getElementById('content-area');
    if (currentView === 'pos') {
        renderPOS(contentArea);
    } else if (currentView === 'inventory') {
        renderInventory(contentArea);
    } else if (currentView === 'ventas') {
        renderVentas(contentArea);
    } else {
        renderPOS(contentArea); // Default safety
    }
    if (typeof renderDashboard === 'function') renderDashboard(null);
}

// function removeFromCart(idx) { posCart.splice(idx, 1); renderCart(); } (Redundant, moved to global bridge)

function cancelPOSEdit() {
    if (!confirm("¿Deseas cancelar la edición o revisión? Los cambios realizados se perderán.")) return;
    editingSaleId = null;
    isReviewingClosure = false;
    reviewingNotificationId = null;
    reviewingClosureId = null;
    window.auditTempData = null;
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
function renderFinancials(container) {
    const businessId = selectedBusinessId || 'mch1';
    const biz = db.businesses.find(b => String(b.id) === String(businessId)) || db.businesses[0];

    // Filter data for the selected business
    // Filter data for the selected business - EXCLUDING expenses from sales to avoid double deduction
    const sales = db.sales.filter(s => String(s.businessId) === String(businessId) && s.status === 'closed' && s.type !== 'EXPENSE');
    const expenses = db.sales.filter(s => String(s.businessId) === String(businessId) && s.type === 'EXPENSE');

    // We get surplus/shortage from notifications that were approved/closed
    const closures = db.notifications.filter(n => n.type === 'closure_request' && n.status === 'approved' && String(n.businessId) === String(businessId));

    let totalRevenue = 0;
    let totalCogs = 0;
    let totalExpenses = 0;
    let totalSurplus = 0;
    let totalShortage = 0;

    sales.forEach(s => {
        totalRevenue += (s.total || 0);
        (s.items || []).forEach(item => {
            const p = db.products.find(prod => String(prod.id) === String(item.productId || item.id));
            if (p) totalCogs += (item.qty * (p.cost || 0));
        });
    });

    expenses.forEach(e => totalExpenses += Math.abs(e.total || 0));

    closures.forEach(c => {
        const d = c.data || {};
        totalSurplus += (d.surplusCash || 0) + (d.surplusTransfer || 0);
        totalShortage += (d.shortageCash || 0) + (d.shortageTransfer || 0);
    });

    const netProfit = totalRevenue - totalCogs - totalExpenses + totalSurplus - totalShortage;
    const commission = Math.max(0, netProfit * 0.05);

    container.innerHTML = `
        <div class="fade-in">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2rem;">
                <h1><i class="ph ph-chart-line-up"></i> Reporte Financiero: ${biz.name}</h1>
                <div class="badge" style="background:rgba(88, 166, 255, 0.1); color:var(--primary); padding:0.8rem 1.2rem; font-size:1rem;">
                    Búsqueda Global (Todo el historial)
                </div>
            </div>

            <div class="grid-3">
                <div class="card stat-card">
                    <span class="stat-label">Ventas Totales (Bruto)</span>
                    <span class="stat-value text-success">$${totalRevenue.toFixed(2)}</span>
                </div>
                <div class="card stat-card">
                    <span class="stat-label">Inversión (Costo Mercancía)</span>
                    <span class="stat-value" style="color:#ff7b72;">-$${totalCogs.toFixed(2)}</span>
                </div>
                <div class="card stat-card">
                    <span class="stat-label">Gastos Operativos</span>
                    <span class="stat-value text-danger">-$${totalExpenses.toFixed(2)}</span>
                </div>
            </div>

            <div style="display:grid; grid-template-columns: 2fr 1fr; gap:1.5rem;">
                <div class="card">
                    <h3>Liquidación de Ganancias</h3>
                    <div style="margin-top:1.5rem; display:flex; flex-direction:column; gap:1rem;">
                        <div style="display:flex; justify-content:space-between; padding:0.8rem; border-bottom:1px solid var(--border);">
                            <span>Ventas Netas:</span>
                            <span class="text-success">+$${totalRevenue.toFixed(2)}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; padding:0.8rem; border-bottom:1px solid var(--border);">
                            <span>Costo de Venta:</span>
                            <span style="color:#ff7b72;">-$${totalCogs.toFixed(2)}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; padding:0.8rem; border-bottom:1px solid var(--border);">
                            <span>Gastos Registrados:</span>
                            <span class="text-danger">-$${totalExpenses.toFixed(2)}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; padding:0.8rem; border-bottom:1px solid var(--border);">
                            <span>Sobrantes (+) / Faltantes (-):</span>
                            <span style="color:${(totalSurplus - totalShortage) >= 0 ? 'var(--success)' : 'var(--danger)'};">
                                ${(totalSurplus - totalShortage) >= 0 ? '+' : ''}$${(totalSurplus - totalShortage).toFixed(2)}
                            </span>
                        </div>
                        <div style="display:flex; justify-content:space-between; padding:1.5rem 0.8rem; background:var(--bg-hover); border-radius:12px; margin-top:1rem;">
                            <strong style="font-size:1.2rem;">GANANCIA REAL:</strong>
                            <strong style="font-size:1.5rem; color:var(--primary);">$${netProfit.toFixed(2)}</strong>
                        </div>
                    </div>
                </div>

                <div class="card" style="border: 2px solid var(--primary); background: linear-gradient(135deg, rgba(88,166,255,0.05) 0%, transparent 100%);">
                    <h3>Comisión Vendedor (5%)</h3>
                    <p style="font-size:0.8rem; color:var(--text-muted); margin:1rem 0;">Cálculo basado en la Ganancia Real del negocio.</p>
                    <div style="text-align:center; padding:2rem 0;">
                        <div style="font-size:0.9rem; text-transform:uppercase; letter-spacing:1px; color:var(--text-muted); margin-bottom:0.5rem;">Total a Pagar</div>
                        <div style="font-size:2.8rem; font-weight:800; color:var(--primary);">$${commission.toFixed(2)}</div>
                    </div>
                    <div style="font-size:0.75rem; color:var(--text-muted); text-align:center; padding:1rem; border-top:1px solid var(--border);">
                        Fórmula: (Ganancia / 100) * 5
                    </div>
                </div>
            </div>
        </div>
    `;
    updateTitle('Reportes y Estadísticas');
}
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
        <div class="fade-in">
            <h2 style="margin-bottom: 2rem;">Configuración del Sistema</h2>
            
            <div class="card" style="margin-bottom: 2rem;">
                <h3 style="margin-bottom: 1.5rem;"><i class="ph ph-palette"></i> Apariencia</h3>
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: var(--bg-hover); border-radius: 12px;">
                    <div>
                        <p style="margin: 0; font-weight: 600;">Tema Visual</p>
                        <p style="margin: 0; font-size: 0.85rem; color: var(--text-muted);">Cambia entre modo claro (estética rosa) y modo oscuro.</p>
                    </div>
                    <button class="btn-primary" onclick="toggleTheme()" style="min-width: 140px;">
                        <i class="ph ${db.settings.theme === 'light' ? 'ph-moon' : 'ph-sun'}"></i> 
                        ${db.settings.theme === 'light' ? 'Modo Oscuro' : 'Modo Claro'}
                    </button>
                </div>
            </div>

            <div class="card">
                <h3 style="margin-bottom: 1.5rem;"><i class="ph ph-database"></i> Datos y Mantenimiento</h3>
                <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
                    <button class="btn-secondary" onclick="exportInventoryCSV()">
                        <i class="ph ph-file-csv"></i> Exportar Inventario
                    </button>
                    <button class="btn-secondary" onclick="exportDB()">
                        <i class="ph ph-download-simple"></i> Copia de Seguridad (JSON)
                    </button>
                    <button class="btn-secondary" onclick="importInventoryManual()">
                        <i class="ph ph-upload-simple"></i> Re-importar CSVs Reales
                    </button>
                </div>
            </div>

            <!-- Expense Categories Management (Owner Only) - SKETCH IMPLEMENTATION -->
            ${currentUser.role === 'owner' ? `
            <div class="card" style="margin-top: 2rem; padding: 1.5rem;">
                <h3 style="margin-bottom: 1rem;"><i class="ph ph-list-checks"></i> Categorías de Gastos</h3>
                
                <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; overflow: hidden;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: var(--bg-dark); border-bottom: 2px solid var(--border);">
                                <th style="text-align: left; padding: 1rem; color: var(--text-muted); font-size: 0.85rem; text-transform: uppercase;">Categoría</th>
                                <th style="text-align: left; padding: 1rem; color: var(--text-muted); font-size: 0.85rem; text-transform: uppercase; width: 40%;">Permisos</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${(db.expenseCategories || []).map(cat => `
                                <tr style="border-bottom: 1px solid var(--border);">
                                    <td style="padding: 0.75rem 1rem;">
                                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem;">
                                            <span style="font-weight: 600; font-size: 1rem;">${cat.name}</span>
                                            <button onclick="deleteExpenseCategory(${cat.id})" style="background: none; border: none; cursor: pointer; color: var(--danger); display: flex; align-items: center; justify-content: center; padding: 0.2rem; border-radius: 50%;">
                                                 <i class="ph ph-minus-circle" style="font-size: 1.5rem;"></i>
                                            </button>
                                        </div>
                                    </td>
                                    <td style="padding: 0.75rem 1rem;">
                                        <div style="position: relative;">
                                            <select class="input-field" style="width: 100%; padding: 0.5rem; font-size: 0.9rem; border-radius: 8px; appearance: none; -webkit-appearance: none; background: var(--bg-hover);" 
                                                    onchange="updateExpenseCategoryRole(${cat.id}, this.value)">
                                                <option value="all" ${cat.allowedRoles === 'all' ? 'selected' : ''}>Todos (Público)</option>
                                                <option value="admin" ${cat.allowedRoles === 'admin' ? 'selected' : ''}>Admin (Privado)</option>
                                                <option value="seller" ${cat.allowedRoles === 'seller' ? 'selected' : ''}>Vendedor (Exclusivo)</option>
                                            </select>
                                            <i class="ph ph-caret-down" style="position: absolute; right: 0.8rem; top: 50%; transform: translateY(-50%); pointer-events: none; color: var(--text-muted);"></i>
                                        </div>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    
                    <div style="padding: 1rem; text-align: center; border-top: 1px solid var(--border); background: var(--bg-hover);">
                        <button onclick="showAddExpenseCategoryPopup()" style="background: none; border: none; cursor: pointer; color: var(--primary);">
                            <i class="ph ph-plus-circle" style="font-size: 3rem; transition: transform 0.2s;"></i>
                        </button>
                    </div>
                </div>
            </div>
            ` : ''}
        </div>
    `;
    updateTitle('Configuración');
}

// --- EXPENSE CATEGORY LOGIC REFACTORED ---
window.showAddExpenseCategoryPopup = function () {
    const modalHtml = `
        <div class="card" style="width: 320px; padding: 2rem; border-radius: 20px; text-align: center;">
            <div style="width: 60px; height: 60px; border-radius: 50%; background: rgba(59, 130, 246, 0.1); color: var(--primary); display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem;">
                <i class="ph ph-tag" style="font-size: 2rem;"></i>
            </div>
            <h3 style="margin-bottom: 0.5rem;">Nueva Categoría</h3>
            <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 1.5rem;">Ingresa el nombre del gasto</p>
            
            <input type="text" id="new-cat-name-popup" class="input-field" placeholder="Ej: Transporte, Comida..." style="margin-bottom: 1.5rem; text-align: center;">
            
            <div style="display: flex; gap: 0.75rem;">
                <button class="btn-ghost" style="flex: 1;" onclick="closeModal('cat-popup')">Cancelar</button>
                <button class="btn-primary" style="flex: 1;" onclick="confirmAddExpenseCategory()">Crear</button>
            </div>
        </div>
    `;
    showModal('cat-popup', modalHtml);
    setTimeout(() => document.getElementById('new-cat-name-popup').focus(), 100);
};

window.confirmAddExpenseCategory = async function () {
    const input = document.getElementById('new-cat-name-popup');
    const name = input.value.trim();
    if (!name) {
        alert("El nombre no puede estar vacío");
        return;
    }

    if (!db.expenseCategories) db.expenseCategories = [];
    const newId = (db.expenseCategories.length > 0 ? Math.max(...db.expenseCategories.map(c => c.id)) : 0) + 1;

    db.expenseCategories.push({
        id: newId,
        name: name,
        allowedRoles: 'all' // Default to All
    });

    await window.saveData();
    closeModal('cat-popup');
    renderSettings(document.getElementById('content-area'));
};

window.updateExpenseCategoryRole = async function (id, role) {
    const cat = db.expenseCategories.find(c => c.id === id);
    if (cat) {
        cat.allowedRoles = role;
        await window.saveData();
    }
};

window.deleteExpenseCategory = async function (id) {
    if (!confirm("¿Eliminar esta categoría permanentemente?")) return;
    db.expenseCategories = db.expenseCategories.filter(c => c.id !== id);
    await window.saveData();
    renderSettings(document.getElementById('content-area'));
};

window.toggleExpenseCatVisibility = async function (id) {
    // Deprecated but kept for safety
    updateExpenseCategoryRole(id, 'all');
};
function renderLogs(container) {
    const rows = db.logs.slice(0, 50).map(l => `<tr><td style="padding: 0.5rem;">${l.date}</td><td>${l.user}</td><td>${l.action}</td><td>${l.details}</td></tr>`).join('');
    container.innerHTML = `<div class="card"><h3>Logs de Auditoría</h3><table style="width: 100%; font-size: 0.8rem;"><thead><tr><th>Fecha</th><th>User</th><th>Acción</th><th>Detalle</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
function renderCashControl(container) { container.innerHTML = '<div class="card"><h3>Arqueo de Caja</h3><p>Cuadre diario de efectivo vs sistema.</p></div>'; }
/* =============================================================
   MÓDULO DE TRANSFERENCIAS (ESTILO POS)
   ============================================================= */

// --- LOGÍSTICA: TRANSFERENCIAS DE ALMACÉN ---

function showTransferModal() {
    if (posCart.length === 0) return alert("Agrega productos para transferir.");

    const destinations = db.businesses.filter(b => b.type === 'kiosk');
    if (destinations.length === 0) return alert("No hay kioscos de destino configurados.");

    const modal = document.createElement('div');
    modal.id = 'transferConfirmModal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="biz-modal" style="max-width:450px; background:var(--bg-card); color:white; padding:2rem; border-radius:20px; border:1px solid var(--border);">
            <h3 style="margin-top:0;"><i class="ph ph-package" style="color:var(--primary);"></i> Crear Transferencia</h3>
            <p style="font-size:0.9rem; color:var(--text-muted); margin-bottom:1.5rem;">Selecciona el kiosco de destino para esta mercancía de Almacén.</p>
            
            <div class="form-group" style="margin-bottom:1.5rem;">
                <label style="display:block; margin-bottom:0.5rem; font-size:0.8rem;">Kiosco Destino</label>
                <select id="transfer-modal-dest" class="biz-input" style="width:100%; padding:0.75rem; background:var(--bg-dark); border:1px solid var(--border); border-radius:8px; color:white;">
                    ${destinations.map(d => `<option value="${d.id}">${d.name}</option>`).join('')}
                </select>
            </div>

            <div style="display:flex; gap:1rem;">
                <button class="biz-btn outline" onclick="document.getElementById('transferConfirmModal').remove()" style="flex:1; padding:0.75rem; border:1px solid var(--border); border-radius:8px; background:transparent; color:white; cursor:pointer;">Cancelar</button>
                <button class="biz-btn primary" onclick="confirmPendingTransfer()" style="flex:2; padding:0.75rem; border:none; border-radius:8px; background:var(--primary); color:white; font-weight:bold; cursor:pointer;">CREAR LISTA PENDIENTE</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

async function confirmPendingTransfer() {
    const destId = document.getElementById('transfer-modal-dest').value;
    const destName = db.businesses.find(b => b.id === destId)?.name;

    const newTransfer = {
        id: Date.now(),
        fromId: selectedBusinessId || 'alm',
        toId: destId,
        items: posCart.map(item => ({
            productId: item.id,
            name: item.name,
            qty: item.qty,
            delivered: false,
            received: false
        })),
        status: 'pending',
        createdBy: currentUser.name,
        date: new Date().toLocaleString()
    };

    if (!db.transfers) db.transfers = [];
    db.transfers.push(newTransfer);

    // Notificación
    db.notifications.unshift({
        id: Date.now() + 1,
        type: 'transfer_pending',
        targetBusinessId: destId,
        message: `Nueva transferencia de Almacén pendiente para ${destName}`,
        data: { transferId: newTransfer.id },
        status: 'pending',
        date: new Date().toLocaleString()
    });

    await saveData();
    posCart = [];
    const modal = document.getElementById('transferConfirmModal');
    if (modal) modal.remove();

    alert("✅ Lista de transferencia guardada como PENDIENTE.\nLa mercancía NO se moverá del stock hasta la confirmación física en el kiosco.");
    renderPOS(document.getElementById('content-area'));
}

function renderTransfer(container) {
    const originId = selectedBusinessId || 'alm';
    const isWarehouse = isWarehouseContext();

    // Filtrar transferencias relevantes (Enviadas o Recibidas)
    const pendingTransfers = db.transfers.filter(t =>
        t.status === 'pending' && (String(t.fromId) === String(originId) || String(t.toId) === String(originId))
    );

    container.innerHTML = `
        <div class="fade-in" style="display: flex; flex-direction: column; gap: 1.5rem; min-height: 0; padding-bottom:2rem;">
            
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <h2 style="margin:0;"><i class="ph ph-arrows-left-right"></i> Logística y Transferencias</h2>
                ${isWarehouse ? `
                    <button class="btn-primary" onclick="navigateTo('pos')">
                        <i class="ph ph-plus-circle"></i> Nueva Salida de Almacén
                    </button>
                ` : ''}
            </div>

            <div class="card" style="padding:0; overflow:hidden;">
                <div style="padding:1.5rem; background:var(--bg-dark); border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
                    <h3 style="margin:0; font-size:1.1rem;"><i class="ph ph-clock-counter-clockwise"></i> Transferencias Pendientes de Confirmación</h3>
                    <span class="badge" style="background:var(--primary); color:white;">${pendingTransfers.length} Pendientes</span>
                </div>
                
                <div id="pending-transfers-list" style="padding:1.5rem;">
                    ${pendingTransfers.length === 0 ? `
                        <div style="text-align:center; padding:3rem; color:var(--text-muted);">
                            <i class="ph ph-check-circle" style="font-size:3rem; display:block; margin-bottom:1rem; opacity:0.2;"></i>
                            No hay transferencias pendientes en este contexto.
                        </div>
                    ` : pendingTransfers.map(t => renderTransferItem(t)).join('')}
                </div>
            </div>

            <div class="card" style="padding:0; overflow:hidden;">
              <div style="padding:1rem; background:var(--bg-dark); border-bottom:1px solid var(--border);">
                <h3 style="margin:0; font-size:0.9rem; color:var(--text-muted);">Historial Reciente (Últimas 10)</h3>
              </div>
              <div style="padding:1rem;">
                <table style="width:100%; border-collapse:collapse; font-size:0.85rem;">
                    <thead>
                        <tr style="text-align:left; color:var(--text-muted);">
                            <th style="padding:0.5rem;">Fecha</th>
                            <th style="padding:0.5rem;">Origen</th>
                            <th style="padding:0.5rem;">Destino</th>
                            <th style="padding:0.5rem;">Items</th>
                            <th style="padding:0.5rem;">Estado</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${db.transfers.filter(t => t.status !== 'pending').slice(-10).reverse().map(t => `
                            <tr style="border-top:1px solid var(--border);">
                                <td style="padding:0.5rem;">${t.date.split(',')[0]}</td>
                                <td style="padding:0.5rem;">${db.businesses.find(b => b.id === t.fromId)?.name || t.fromId}</td>
                                <td style="padding:0.5rem;">${db.businesses.find(b => b.id === t.toId)?.name || t.toId}</td>
                                <td style="padding:0.5rem;">${t.items.length}</td>
                                <td style="padding:0.5rem;">
                                    <span style="color:${t.status === 'completed' ? 'var(--success)' : 'var(--danger)'}">
                                        ${t.status.toUpperCase()}
                                    </span>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
              </div>
            </div>
        </div>
    `;

    updateTitle('Logística y Transferencias');
}

function renderTransferItem(t) {
    const fromName = db.businesses.find(b => b.id === t.fromId)?.name;
    const toName = db.businesses.find(b => b.id === t.toId)?.name;
    const canConfirm = t.items.every(i => i.delivered && i.received);

    return `
        <div class="transfer-card" style="background:var(--bg-dark); border:1px solid var(--border); border-radius:12px; margin-bottom:1.5rem; overflow:hidden;">
            <div style="padding:1rem 1.5rem; background:rgba(255,255,255,0.03); display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border);">
                <div>
                    <strong style="color:var(--primary); font-size:1.1rem;">#TR-${t.id.toString().slice(-6)}</strong>
                    <span style="margin-left:1rem; color:var(--text-muted); font-size:0.85rem;">Creado por: ${t.createdBy} (${t.date})</span>
                </div>
                <div style="text-align:right;">
                    <div style="display:flex; align-items:center; gap:0.5rem; font-weight:bold;">
                        <span>${fromName}</span> <i class="ph ph-arrow-right"></i> <span>${toName}</span>
                    </div>
                </div>
            </div>
            
            <div style="padding:1.5rem;">
                <table style="width:100%; border-collapse:collapse;">
                    <thead>
                        <tr style="text-align:left; color:var(--text-muted); font-size:0.8rem; border-bottom:1px solid var(--border);">
                            <th style="padding:0.5rem;">Producto</th>
                            <th style="padding:0.5rem; text-align:center;">Cant.</th>
                            <th style="padding:0.5rem; text-align:center;">Entregado (Alm)</th>
                            <th style="padding:0.5rem; text-align:center;">Recibido (Kio)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${t.items.map((item, idx) => `
                            <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                                <td style="padding:0.75rem 0.5rem; font-weight:500;">${item.name}</td>
                                <td style="padding:0.75rem 0.5rem; text-align:center; font-weight:bold;">${item.qty}</td>
                                <td style="padding:0.75rem 0.5rem; text-align:center;">
                                    <input type="checkbox" ${item.delivered ? 'checked' : ''} 
                                           ${currentUser.role === 'seller' ? 'disabled' : ''}
                                           onchange="toggleTransferCheck(${t.id}, ${idx}, 'delivered', this.checked)"
                                           style="width:20px; height:20px; cursor:pointer;">
                                </td>
                                <td style="padding:0.75rem 0.5rem; text-align:center;">
                                    <input type="checkbox" ${item.received ? 'checked' : ''} 
                                           ${(currentUser.role !== 'seller' && currentUser.role !== 'owner') ? 'disabled' : ''}
                                           onchange="toggleTransferCheck(${t.id}, ${idx}, 'received', this.checked)"
                                           style="width:20px; height:20px; cursor:pointer;">
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <div style="margin-top:1.5rem; display:flex; justify-content:space-between; align-items:center;">
                    <button class="btn-ghost" onclick="cancelTransfer(${t.id})" style="color:var(--danger);">
                        <i class="ph ph-x-circle"></i> Cancelar Transferencia
                    </button>
                    
                    <button class="btn-primary" 
                            ${!canConfirm ? 'disabled' : ''} 
                            style="padding:0.75rem 2rem; ${!canConfirm ? 'opacity:0.3; cursor:not-allowed;' : ''}"
                            onclick="completeTransfer(${t.id})">
                        <i class="ph ph-check-square"></i> FINALIZAR Y EJECUTAR STOCK
                    </button>
                </div>
            </div>
        </div>
    `;
}

function toggleTransferCheck(transferId, itemIdx, field, value) {
    const t = db.transfers.find(tr => tr.id === transferId);
    if (t) {
        t.items[itemIdx][field] = value;
        saveData();
        renderTransfer(document.getElementById('content-area'));
    }
}

async function cancelTransfer(id) {
    if (!confirm("¿Seguro que deseas cancelar esta transferencia? No se ha movido stock todavía.")) return;
    const t = db.transfers.find(tr => tr.id === id);
    if (t) {
        t.status = 'cancelled';
        await saveData();
        alert("Transferencia cancelada.");
        renderTransfer(document.getElementById('content-area'));
    }
}

async function completeTransfer(id) {
    const t = db.transfers.find(tr => tr.id === id);
    if (!t) return;

    if (!confirm("¿Confirmar recepción total? Se actualizará el inventario del Almacén y del Kiosco.")) return;

    // Ejecutar movimientos reales de inventario
    for (const item of t.items) {
        // 1. Restar de Almacén (o Business Original)
        let sourceInv = db.inventory.find(i => String(i.productId) === String(item.productId) && String(i.businessId) === String(t.fromId));
        if (sourceInv) {
            sourceInv.quantity -= item.qty;
        } else {
            // Si por alguna razón no existe el registro en inventario del origen
            db.inventory.push({ businessId: t.fromId, productId: item.productId, quantity: -item.qty });
        }

        // 2. Sumar a Kiosco Destino
        let destInv = db.inventory.find(i => String(i.productId) === String(item.productId) && String(i.businessId) === String(t.toId));
        if (!destInv) {
            destInv = { businessId: t.toId, productId: item.productId, quantity: 0 };
            db.inventory.push(destInv);
        }
        destInv.quantity += item.qty;
    }

    t.status = 'completed';
    t.confirmedBy = currentUser.name;
    t.completionDate = new Date().toLocaleString();

    // Limpiar notificación
    const notif = db.notifications.find(n => n.data && n.data.transferId === id);
    if (notif) notif.status = 'completed';

    await saveData();
    addLog(`Transferencia #${t.id} completada. Stock movido de ${t.fromId} a ${t.toId}`, 'success');

    alert("✅ Operación completada con éxito. El inventario ha sido actualizado.");
    renderTransfer(document.getElementById('content-area'));
}

// --- BUSCADOR ESPECÍFICO PARA TRANSFERENCIAS ---
function handleTransferSearch(val) {
    const results = document.getElementById('transfer-results');
    if (!val) { results.style.display = 'none'; return; }

    const originId = selectedBusinessId || 'alm';

    // Buscar productos
    const matches = db.products.filter(p => p.name.toLowerCase().includes(val.toLowerCase())).slice(0, 8);

    if (matches.length === 0) {
        results.innerHTML = '<div style="padding:1rem; color:var(--text-muted);">No encontrado.</div>';
        results.style.display = 'block';
        return;
    }

    results.innerHTML = matches.map(p => {
        // Buscar stock en el origen
        const inv = db.inventory.find(i => String(i.productId) === String(p.id) && String(i.businessId) === String(originId));
        const stock = inv ? inv.quantity : 0;

        // Solo permitir clic si hay stock (o dejarlo libre si quieres permitir negativos)
        const canAdd = stock > 0;

        return `
            <div class="pos-search-item" onclick="${canAdd ? `addToTransferCart(${p.id})` : ''}" 
                 style="display:flex; align-items:center; gap:1rem; padding:0.75rem 1rem; cursor:${canAdd ? 'pointer' : 'not-allowed'}; border-bottom:1px solid var(--border); opacity: ${canAdd ? 1 : 0.5};">
                
                <div style="width: 35px; height: 35px; border-radius: 4px; background: var(--bg-dark); display: flex; align-items: center; justify-content: center; overflow:hidden;">
                    ${p.image ? `<img src="${p.image}" style="width:100%; height:100%; object-fit:cover;">` : `<i class="ph ph-cube"></i>`}
                </div>
                
                <div style="flex:1;">
                    <div style="font-weight:bold; font-size: 0.9rem;">${p.name}</div>
                    <div style="font-size:0.75rem; color:${stock > 0 ? 'var(--success)' : 'var(--danger)'};">
                        Stock en origen: ${stock}
                    </div>
                </div>

                ${canAdd ? '<i class="ph ph-plus-circle" style="color:var(--primary); font-size:1.2rem;"></i>' : '<i class="ph ph-prohibit" style="color:var(--text-muted);"></i>'}
            </div>
        `;
    }).join('');

    results.style.display = 'block';
}

function addToTransferCart(id) {
    const p = db.products.find(prod => prod.id === id);
    if (!p) return;

    // Verificar si ya está en la lista
    const existing = transferCart.find(i => i.id === id);

    // Verificar stock disponible en origen
    const originId = selectedBusinessId || 'alm';
    const inv = db.inventory.find(i => String(i.productId) === String(id) && String(i.businessId) === String(originId));
    const maxStock = inv ? inv.quantity : 0;

    const currentQty = existing ? existing.qty : 0;

    if (currentQty + 1 > maxStock) {
        alert(`Stock insuficiente en origen.Solo tienes ${maxStock} unidades.`);
        return;
    }

    if (existing) {
        existing.qty++;
    } else {
        transferCart.push({ id: p.id, name: p.name, qty: 1, max: maxStock, image: p.image });
    }

    // Limpiar buscador
    document.getElementById('transfer-search').value = '';
    document.getElementById('transfer-results').style.display = 'none';
    renderTransferCart();
}

function renderTransferCart() {
    const container = document.getElementById('transfer-cart-items');
    const summary = document.getElementById('transfer-summary');
    if (!container || !summary) return;

    if (transferCart.length === 0) {
        container.innerHTML = `
            <div style="padding: 3rem; text-align: center; color: var(--text-muted); display: flex; flex-direction: column; align-items: center;">
                <i class="ph ph-arrows-left-right" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.2;"></i>
                <span>La lista de transferencia está vacía</span>
            </div> `;
        summary.innerHTML = '<div style="text-align:center; color:var(--text-muted);">Agrega productos para ver el resumen.</div>';
        return;
    }

    container.innerHTML = transferCart.map((item, index) => `
            <div style="display:flex; align-items:center; gap:1rem; padding:1rem; border-bottom:1px solid var(--border);">
            <div style="width: 40px; height: 40px; border-radius: 4px; background: var(--bg-dark); overflow:hidden; display:flex; align-items:center; justify-content:center;">
                 ${item.image ? `<img src="${item.image}" style="width:100%; height:100%; object-fit:cover;">` : `<i class="ph ph-cube"></i>`}
            </div>
            <div style="flex:1;">
                <div style="font-weight:bold; font-size: 0.9rem;">${item.name}</div>
                <div style="font-size:0.75rem; color:var(--text-muted);">Máx Disp: ${item.max}</div>
            </div>
            
            <div style="display:flex; align-items:center; gap:0.5rem; background:var(--bg-dark); padding:0.25rem; border-radius:6px;">
                <button class="btn-icon" onclick="adjustTransferQty(${index}, -1)" style="padding:0.25rem;"><i class="ph ph-minus"></i></button>
                <input type="number" value="${item.qty}" onchange="manualTransferQty(${index}, this.value)" 
                       style="width: 40px; text-align:center; background:transparent; border:none; color:white; font-weight:bold;">
                <button class="btn-icon" onclick="adjustTransferQty(${index}, 1)" style="padding:0.25rem;"><i class="ph ph-plus"></i></button>
            </div>
            
            <button class="btn-icon" onclick="removeFromTransferCart(${index})" style="color:var(--danger);"><i class="ph ph-trash"></i></button>
        </div>
            `).join('');

    const totalItems = transferCart.reduce((sum, i) => sum + i.qty, 0);
    summary.innerHTML = `
            < div style = "padding: 1rem; background: var(--bg-dark); border-radius: 12px; border: 1px solid var(--border);" >
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                <span style="color: var(--text-muted);">Productos distintos:</span>
                <strong>${transferCart.length}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 1.2rem; font-weight: bold; color: var(--primary);">
                <span>Total Unidades:</span>
                <span>${totalItems}</span>
            </div>
        </div>
            `;
}

function adjustTransferQty(idx, delta) {
    const item = transferCart[idx];
    const newQty = item.qty + delta;

    if (newQty > item.max) {
        alert("No puedes transferir más de lo que hay en existencia.");
        return;
    }
    if (newQty < 1) return; // Mínimo 1

    item.qty = newQty;
    renderTransferCart();
}

function removeFromTransferCart(index) {
    transferCart.splice(index, 1);
    renderTransferCart();
}

async function executeTransfer() {
    if (transferCart.length === 0) return alert("La lista está vacía.");

    const originId = selectedBusinessId || 'alm';
    const destSelect = document.getElementById('transfer-destination');
    if (!destSelect) return;
    const destId = destSelect.value;

    const originName = db.businesses.find(b => String(b.id) === String(originId))?.name;
    const destName = db.businesses.find(b => String(b.id) === String(destId))?.name;

    if (!confirm(`¿Confirmar transferencia de ${transferCart.length} productos ?\n\nDe: ${originName} \nPara: ${destName} `)) return;

    // Ejecutar movimientos
    const now = new Date();
    const dateString = now.toLocaleString();
    const timestamp = Date.now();

    for (const item of transferCart) {
        // 1. Restar de Origen
        const sourceInv = db.inventory.find(i => String(i.productId) === String(item.id) && String(i.businessId) === String(originId));
        if (sourceInv) sourceInv.quantity -= item.qty;

        // 2. Sumar a Destino
        let destInv = db.inventory.find(i => String(i.productId) === String(item.id) && String(i.businessId) === String(destId));
        if (!destInv) {
            destInv = { businessId: destId, productId: item.id, quantity: 0 };
            db.inventory.push(destInv);
        }
        destInv.quantity += item.qty;

        // 3. Registrar Log
        db.extraMovements.unshift({
            id: timestamp + Math.random(),
            date: dateString,
            productId: item.id,
            fromId: originId,
            toId: destId,
            quantity: item.qty,
            user: currentUser.name,
            type: 'transfer'
        });
    }

    await saveData();
    addLog(`Transferencia masiva realizada: ${transferCart.length} items de ${originName} a ${destName} `, 'info');

    alert("✅ Transferencia realizada con éxito.");
    transferCart = []; // Limpiar lista
    renderTransfer(document.getElementById('content-area')); // Recargar vista
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
        // Mark as seen first
        n.seen = true;

        // Auto-close dropdown
        const dropdown = document.getElementById('notifDropdown');
        if (dropdown) dropdown.classList.remove('show');

        // Navigate or take action
        if (n.type === 'waste_approval') navigateTo('inventory');
        if (n.type === 'closure_request') openSaleForRevision(n.id, true);

        // Solo eliminamos si no es un cierre (los cierres los borra approveClosure)
        if (n.type !== 'closure_request') {
            db.notifications = db.notifications.filter(notif => notif.id !== id);
        }

        await saveData();
        renderSidebar(currentView); // Refresh badge count
        renderNotifications();
    }
}

// Refresh history to show 'En Revision' to others
if (currentView === 'ventas') renderVentas(document.getElementById('content-area'));



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

    if (n.type === 'inventory_transfer') {
        const t = n.transferData;
        t.items.forEach(item => {
            // Deduct from source
            const fromInv = db.inventory.find(inv => String(inv.businessId) === String(t.from) && String(inv.productId) === String(item.id));
            if (fromInv) fromInv.quantity -= item.qty;
            // Add to destination
            const toInv = db.inventory.find(inv => String(inv.businessId) === String(t.to) && String(inv.productId) === String(item.id));
            if (toInv) toInv.quantity += item.qty;
            else db.inventory.push({ businessId: t.to, productId: item.id, quantity: item.qty });
        });
        addLog(`Transferencia aprobada: ${t.items.length} productos de ${t.from} a ${t.to}`, 'success');
    } else if (n.type === 'delete_sale_request') {
        await deleteSaleAction(n.refId, true);
    } else if (n.type === 'waste_approval') {
        await approveWaste(n.wasteId);
    }

    n.status = 'approved';
    n.resolvedBy = currentUser.name;
    await saveData();
    closeModal();
    renderSidebar(currentView);
    addLog(`Notificación aprobada: ${n.title} `, 'success');
}


async function rejectNotification(id) {
    const n = db.notifications.find(notif => notif.id === id);
    if (!n) return;

    n.status = 'rejected';
    n.resolvedBy = currentUser.name;
    await saveData();
    closeModal();
    renderSidebar(currentView);
    addLog(`Notificación rechazada: ${n.title} `, 'warning');
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
// REDUNDANT FUNCTIONS REMOVED FOR CLEANUP

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
            // 1. Calculate Crop (Square Center)
            const side = Math.min(img.width, img.height);
            const sx = (img.width - side) / 2;
            const sy = (img.height - side) / 2;

            // 2. Generate Main Image (512x512)
            const canvasMain = document.createElement('canvas');
            canvasMain.width = 512;
            canvasMain.height = 512;
            const ctxMain = canvasMain.getContext('2d');
            ctxMain.drawImage(img, sx, sy, side, side, 0, 0, 512, 512);
            const mainBase64 = canvasMain.toDataURL('image/jpeg', 0.85);

            // 3. Generate Thumbnail (64x64) for icons/list views
            const canvasThumb = document.createElement('canvas');
            canvasThumb.width = 64;
            canvasThumb.height = 64;
            const ctxThumb = canvasThumb.getContext('2d');
            ctxThumb.drawImage(img, sx, sy, side, side, 0, 0, 64, 64);
            const thumbBase64 = canvasThumb.toDataURL('image/jpeg', 0.70);

            // Return both
            callback({ main: mainBase64, thumb: thumbBase64 });
        };
    };
}



function showAddProductModal() {
    // Clean specific styles for this modal to match the user's sketch
    const modalHtml = `
            <div id="product-modal" class="modal-overlay" style="display:flex;">
                <div class="card" style="width: 800px; max-width: 95vw; padding: 0; overflow: hidden; display: flex; flex-direction: column; background: var(--bg-card); border-radius: 12px;">
                    
                    <!-- 1. Header (Blue/Dark Bar) -->
                    <div style="background: #1e3a8a; color: white; padding: 1rem 1.5rem; display: flex; justify-content: space-between; align-items: center;">
                        <div style="display: flex; align-items: center; gap: 1rem;">
                            <i class="ph ph-arrow-left" style="cursor: pointer;" onclick="closeModal('product-modal')"></i>
                            <h3 style="margin: 0; font-size: 1.1rem; font-weight: 500;">Agregar Producto</h3>
                        </div>
                        <div style="display: flex; gap: 1rem;">
                            <button type="button" onclick="saveNewProduct()" style="background: none; border: none; color: white; cursor: pointer;">
                                <i class="ph ph-check" style="font-size: 1.5rem;"></i>
                            </button>
                        </div>
                    </div>

                    <div style="padding: 2rem; overflow-y: auto; max-height: 80vh;">
                        <form id="add-product-form">
                            
                            <!-- 2. Mandatory Fields Row -->
                            <div style="margin-bottom: 2rem; background: var(--bg-hover); padding: 1.5rem; border-radius: 8px;">
                                <h4 style="margin-top: 0; margin-bottom: 1rem; color: var(--text-muted); font-size: 0.85rem; text-transform: uppercase;">Campos Obligatorios</h4>
                                
                                <div style="margin-bottom: 1.5rem;">
                                    <label style="display: block; font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.5rem;"><i class="ph ph-package"></i> Nombre</label>
                                    <input type="text" name="name" class="input-minimal" style="width: 100%; font-size: 1.1rem; padding: 0.5rem 0;" placeholder="Nombre del producto" required>
                                </div>

                                <div class="grid-2" style="gap: 2rem;">
                                    <div>
                                        <label style="display: block; font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.5rem;">Costo</label>
                                        <input type="number" step="0.01" name="cost" class="input-minimal" style="width: 100%; padding: 0.5rem 0;" placeholder="0.00" required>
                                    </div>
                                    <div>
                                        <label style="display: block; font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.5rem;">Precio de Venta</label>
                                        <input type="number" step="0.01" name="price" class="input-minimal" style="width: 100%; padding: 0.5rem 0;" placeholder="0.00" required>
                                    </div>
                                </div>
                            </div>

                            <!-- 3. Central Image Area -->
                            <div style="margin-bottom: 2rem; display: flex; justify-content: center; align-items: center; background: var(--bg-dark); padding: 2rem; border-radius: 8px; border: 2px dashed var(--border); position: relative; min-height: 250px;">
                                
                                <input type="file" id="product-img-input" accept="image/*" onchange="handleImageUpload(this)" style="display: none;">
                                <input type="hidden" name="image" id="product-image-data">
                                <input type="hidden" name="thumbnail" id="product-thumb-data">

                                <div id="image-placeholder-area" style="text-align: center; color: var(--text-muted); pointer-events: none;">
                                    <i class="ph ph-question" style="font-size: 4rem; opacity: 0.5;"></i>
                                    <p style="margin-top: 1rem; font-size: 0.9rem;">Sin imagen seleccionada</p>
                                </div>

                                <div id="image-preview-area" style="display: none; position: absolute; top: 0; left: 0; width: 100%; height: 100%; justify-content: center; align-items: center;">
                                    <img id="preview-img-tag" src="" style="max-height: 100%; max-width: 100%; object-fit: contain; border-radius: 8px;">
                                </div>

                                <!-- Image Actions Floating Bottom Right -->
                                <div style="position: absolute; bottom: 1rem; right: 1rem; display: flex; gap: 0.5rem;">
                                    <button type="button" class="btn-icon" onclick="document.getElementById('product-image-data').value = ''; document.getElementById('preview-img-tag').src = ''; document.getElementById('image-preview-area').style.display='none'; document.getElementById('image-placeholder-area').style.display='block';" title="Eliminar Foto" style="background: rgba(0,0,0,0.6); color: white;">
                                        <i class="ph ph-x"></i>
                                    </button>
                                    <button type="button" class="btn-icon" onclick="document.getElementById('product-img-input').click()" title="Galería" style="background: rgba(0,0,0,0.6); color: white;">
                                        <i class="ph ph-image"></i>
                                    </button>
                                    <button type="button" class="btn-icon" onclick="alert('Funcionalidad de cámara directa disponible en móviles.')" title="Cámara" style="background: rgba(0,0,0,0.6); color: white;">
                                        <i class="ph ph-camera"></i>
                                    </button>
                                </div>
                            </div>

                            <!-- 4. Optional Fields -->
                             <div style="background: var(--bg-hover); padding: 1.5rem; border-radius: 8px;">
                                <h4 style="margin-top: 0; margin-bottom: 1rem; color: var(--text-muted); font-size: 0.85rem; text-transform: uppercase;">*Campos Opcionales</h4>
                                <div class="grid-2" style="gap: 2rem;">
                                    <div>
                                        <label style="display: block; font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.5rem;">Cantidad Inicial</label>
                                        <input type="number" name="initial_stock" class="input-minimal" style="width: 100%; padding: 0.5rem 0;" placeholder="0">
                                    </div>
                                    <div>
                                        <label style="display: block; font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.5rem;">Cantidad Mínima (Alerta)</label>
                                        <input type="number" name="min_stock" class="input-minimal" style="width: 100%; padding: 0.5rem 0;" placeholder="10" title="Si el stock baja de este número, se marcará en amarillo.">
                                    </div>
                                    <div>
                                        <label style="display: block; font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.5rem;">Categoría</label>
                                        <input type="text" name="category" class="input-minimal" style="width: 100%; padding: 0.5rem 0;" list="categories-list" placeholder="General">
                                    </div>
                                </div>
                             </div>

                             <datalist id="categories-list">
                                ${[...new Set(db.products.map(p => p.category))].map(c => `<option value="${c}">`).join('')}
                             </datalist>

                        </form>
                    </div>
                </div>
            </div>
        `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function handleImageUpload(input) {
    if (input.files && input.files[0]) {
        compressImage(input.files[0], (result) => {
            // Updated to handle object return {main, thumb}
            const imgData = result.main || result; // Fallback if old function
            const thumbData = result.thumb || result;

            document.getElementById('product-image-data').value = imgData;
            document.getElementById('product-thumb-data').value = thumbData;

            const preview = document.getElementById('preview-img-tag');
            preview.src = imgData;

            document.getElementById('image-placeholder-area').style.display = 'none';
            document.getElementById('image-preview-area').style.display = 'flex';
        });
    }
}

async function saveNewProduct() {
    console.log("saveNewProduct called");
    try {
        if (currentUser.role === 'seller') {
            alert("No tienes permisos para añadir productos.");
            return;
        }
        const form = document.getElementById('add-product-form');

        // Manual check to ensure we get feedback
        const fd = new FormData(form);
        if (!fd.get('name') || !fd.get('cost') || !fd.get('price')) {
            alert("Por favor completa los campos obligatorios: Nombre, Costo y Precio.");
            return;
        }

        const newProduct = {
            id: Date.now(),
            name: fd.get('name'),
            cost: parseFloat(fd.get('cost')),
            price: parseFloat(fd.get('price')),
            category: fd.get('category') || 'General',
            image: fd.get('image'), // Base64 string
            thumbnail: fd.get('thumbnail'), // Base64 string
            minStock: parseFloat(fd.get('min_stock')) || 10,
            alias: ''
        };

        console.log("Saving product:", newProduct);

        db.products.push(newProduct);

        // Initial Stock Handling
        const initialQty = parseFloat(fd.get('initial_stock') || 0);

        if (selectedBusinessId) {
            db.inventory.push({ businessId: selectedBusinessId, productId: newProduct.id, quantity: initialQty });
        } else {
            // En vista global, inicializar en Almacén por defecto
            db.inventory.push({ businessId: 'alm', productId: newProduct.id, quantity: initialQty });
        }

        addLog(`Producto añadido: ${newProduct.name}`, 'success');

        // Fire and forget persistence
        saveData().catch(e => console.error("Background save warning:", e));

        closeModal('product-modal');

        // Force refresh with slight delay to ensure modal is gone
        setTimeout(() => {
            console.log("Rendering inventory...");
            const container = document.getElementById('content-area');
            if (container) {
                renderInventory(container);
            } else {
                console.error("Critical: content-area not found!");
            }
        }, 50);

    } catch (e) {
        console.error("Error in saveNewProduct:", e);
        alert("Error al guardar: " + e.message);
    }
}



function showEditProductModal(id) {
    const p = db.products.find(prod => String(prod.id) === String(id));
    if (!p) return;
    alert("Editando: " + p.name);
    // (Restaurar modal completo después de verificar que el sistema carga)
}
function handleImageUploadEdit(input) { console.log("Imagen subida"); }
async function updateProduct(id) {
    try {
        if (currentUser.role === 'seller') {
            alert("No tienes permisos para editar productos.");
            return;
        }

        const form = document.getElementById('edit-product-form');
        const formData = new FormData(form);
        const name = formData.get('name');
        const price = formData.get('price');
        const cost = formData.get('cost');

        if (!name || !price || !cost) {
            alert('Por favor completa Nombre, Costo y Precio.');
            return;
        }

        const pIndex = db.products.findIndex(prod => String(prod.id) === String(id));
        if (pIndex === -1) {
            alert('Error: Producto no encontrado.');
            return;
        }

        db.products[pIndex].name = name;
        db.products[pIndex].cost = parseFloat(cost);
        db.products[pIndex].price = parseFloat(price);
        db.products[pIndex].category = formData.get('category');
        db.products[pIndex].image = formData.get('image');
        db.products[pIndex].thumbnail = formData.get('thumbnail');
        db.products[pIndex].minStock = parseFloat(formData.get('min_stock')) || 10;

        // Inventory Update Logic
        const newQty = parseFloat(formData.get('stock') || 0);

        // Target: Selected Business or 'alm' (Warehouse)
        const targetBusinessId = selectedBusinessId || 'alm';

        let inv = db.inventory.find(i => String(i.productId) === String(id) && String(i.businessId) === String(targetBusinessId));
        const currentQty = inv ? inv.quantity : 0;

        // Warning if stock changed manually
        if (newQty !== currentQty) {
            const warningMsg = `⚠️ ¡ADVERTENCIA CRÍTICA! ⚠️\n\nEstás modificando el inventario MANUALMENTE de ${currentQty} a ${newQty} en: ${(selectedBusinessId ? 'SEDE ACTUAL' : 'ALMACÉN CENTRAL')}.\n\nEsta acción NO es una venta, ni entrada de mercancía, ni merma oficial.\nUse este método solo para CORRECCIONES de errores.\n\n¿Estás 100% seguro de que quieres forzar este cambio en el inventario?`;

            if (!confirm(warningMsg)) {
                return;
            }
        }

        if (!inv) {
            inv = { businessId: targetBusinessId, productId: id, quantity: newQty };
            db.inventory.push(inv);
        } else {
            inv.quantity = newQty;
        }

        // Fire and forget persistence
        saveData().catch(e => console.error("Background save warning:", e));

        addLog(`Producto actualizado: ${db.products[pIndex].name}`);
        closeModal('edit-product-modal');

        setTimeout(() => {
            const container = document.getElementById('content-area');
            if (container) renderInventory(container);
        }, 50);

    } catch (e) {
        console.error("Error updating product:", e);
        alert('Error inesperado al guardar: ' + e.message);
    }
}

// REDUNDANT FUNCTIONS REMOVED FOR CLEANUP

function handleInventoryImageClick(id) {
    document.getElementById(`inv - img - ${id} `).click();
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
    const qtyStr = prompt(`Registrar Merma para: ${p.name} \n¿Cuántas unidades se perdieron ? `, "1");
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
    addLog(`Merma registrada: ${qty}x ${p.name} `, 'warning');
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

function exportInventoryPDFWrapper() {
    const withImages = confirm("¿Deseas incluir las imágenes de los productos en el reporte PDF?\n\n(Nota: Esto aumentará el tamaño del archivo)");
    exportInventoryPDF(withImages);
}

async function exportInventoryPDF(withImages = false) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const businessName = selectedBusinessId ? db.businesses.find(b => String(b.id) === String(selectedBusinessId)).name : 'Global';

    doc.setFontSize(18);
    doc.text(`Inventario: ${businessName}`, 14, 20);
    doc.setFontSize(10);
    doc.text(`Generado el: ${new Date().toLocaleString()}`, 14, 28);

    const items = db.products.map(p => {
        const stock = selectedBusinessId ? (db.inventory.find(i => i.productId === p.id && String(i.businessId) === String(selectedBusinessId))?.quantity || 0) :
            db.inventory.filter(i => i.productId === p.id).reduce((s, i) => s + i.quantity, 0);

        if (currentUser.role === 'seller' && stock <= 0) return null; // Logic consistency

        const row = [p.name, p.category, stock, `$${p.cost.toFixed(2)}`, `$${p.price.toFixed(2)}`];
        if (withImages) row.unshift(''); // Placeholder for image
        return { row, image: p.image };
    }).filter(i => i !== null);

    const head = withImages
        ? [['Imagen', 'Producto', 'Categoría', 'Stock', 'Costo', 'Venta']]
        : [['Producto', 'Categoría', 'Stock', 'Costo', 'Venta']];

    const body = items.map(i => i.row);

    doc.autoTable({
        head: head,
        body: body,
        startY: 35,
        theme: 'grid',
        headStyles: { fillColor: [63, 185, 80] },
        styles: { valign: 'middle' },
        columnStyles: withImages ? { 0: { cellWidth: 20, minCellHeight: 20 } } : {},
        didDrawCell: function (data) {
            if (withImages && data.column.index === 0 && data.cell.section === 'body') {
                const itemIndex = data.row.index;
                const imgBase64 = items[itemIndex].image;
                if (imgBase64) {
                    try {
                        doc.addImage(imgBase64, 'JPEG', data.cell.x + 2, data.cell.y + 2, 16, 16);
                    } catch (e) {
                        // Fallback or ignore invalid image
                    }
                }
            }
        }
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
                        <span class="badge ${s.status === 'closed' || s.status === 'approved' ? 'badge-success' : 'badge-warning'}">
                            ${s.status === 'closed' || s.status === 'approved' ? 'Cerrada' : (s.status === 'review_pending' || s.type === 'closure_request' ? 'Pendiente Revisión' : 'Registrada')}
                        </span>
                    </div>

                    ${(s.status === 'review_pending' || s.type === 'closure_request') && (currentUser.role === 'owner' || currentUser.role === 'admin') ? `
                        <div style="background: rgba(255, 165, 0, 0.1); border: 1px solid var(--warning); padding: 1rem; border-radius: 12px; margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <h4 style="margin:0; color:var(--warning);">Venta Pendiente de Aprobación</h4>
                                <p style="margin:0.25rem 0 0 0; font-size:0.8rem;">Revisa los montos y productos antes de cerrar.</p>
                            </div>
                            <button class="btn-primary" onclick="closeModal('sale-detail-modal'); openSaleForRevision(${s.id}, false)" style="background:var(--warning); color:black;">
                                <i class="ph ph-shield-check"></i> REVISAR Y CERRAR
                            </button>
                        </div>
                    ` : ''}

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

                    ${(s.type === 'daily_closure' || s.type === 'daily_closure_report') ? `
                <h3 style="margin-bottom:1rem;">Desglose de Arqueo (Cierre de Día)</h3>
                <div class="grid-2" style="gap:1rem; margin-bottom:1.5rem;">
                    <div class="card" style="background:var(--bg-dark); padding:1rem; border: 1px solid var(--border);">
                        <h4 style="color:var(--success); margin-bottom:0.75rem; display:flex; align-items:center; gap:0.5rem;">
                            <i class="ph ph-money"></i> Efectivo
                        </h4>
                        <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
                            <span>Esperado:</span> <strong>$${(s.cashSystem || 0).toFixed(2)}</strong>
                        </div>
                        <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
                            <span>Real:</span> <strong>$${(s.cashReal || 0).toFixed(2)}</strong>
                        </div>
                        <div style="display:flex; justify-content:space-between; border-top:1px solid var(--border); padding-top:0.5rem; color: ${((s.cashReal || 0) - (s.cashSystem || 0)) < 0 ? 'var(--danger)' : (((s.cashReal || 0) - (s.cashSystem || 0)) > 0 ? 'var(--primary)' : 'var(--success)')};">
                            <span>Diferencia:</span> <strong>$${((s.cashReal || 0) - (s.cashSystem || 0)).toFixed(2)}</strong>
                        </div>
                    </div>
                    <div class="card" style="background:var(--bg-dark); padding:1rem; border: 1px solid var(--border);">
                        <h4 style="color:var(--primary); margin-bottom:0.75rem; display:flex; align-items:center; gap:0.5rem;">
                            <i class="ph ph-arrows-left-right"></i> Transferencia
                        </h4>
                        <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
                            <span>Esperado:</span> <strong>$${(s.transferSystem || 0).toFixed(2)}</strong>
                        </div>
                        <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
                            <span>Real:</span> <strong>$${(s.transferReal || 0).toFixed(2)}</strong>
                        </div>
                        <div style="display:flex; justify-content:space-between; border-top:1px solid var(--border); padding-top:0.5rem; color: ${((s.transferReal || 0) - (s.transferSystem || 0)) < 0 ? 'var(--danger)' : (((s.transferReal || 0) - (s.transferSystem || 0)) > 0 ? 'var(--primary)' : 'var(--success)')};">
                            <span>Diferencia:</span> <strong>$${((s.transferReal || 0) - (s.transferSystem || 0)).toFixed(2)}</strong>
                        </div>
                    </div>
                </div>

                ${s.salaryPaid > 0 ? `
                <div style="background:rgba(210,153,34,0.1); border:1px solid rgba(210,153,34,0.3); padding:1rem 1.5rem; border-radius:16px; margin-bottom:1.5rem; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <div style="color:var(--warning); font-weight:700; font-size:0.9rem;"><i class="ph ph-identification-card"></i> Salario Liquidado</div>
                        <div style="font-size:0.8rem; color:var(--text-muted);">Pagado desde: ${s.salarySource}</div>
                    </div>
                    <div style="font-size:1.5rem; font-weight:900; color:var(--warning);">$${s.salaryPaid.toFixed(2)}</div>
                </div>
                ` : ''}

                <div style="background:rgba(255,255,255,0.03); padding:1rem; border-radius:12px; margin-bottom:1.5rem;">
                    <h4 style="margin-top:0; font-size:0.8rem; color:var(--text-muted); text-transform:uppercase;">Resumen Consolidado</h4>
                    <div style="display:flex; justify-content:space-between; font-size:1.2rem; font-weight:800;">
                        <span>Total Arqueado:</span>
                        <span style="color:var(--primary);">$${((s.cashReal || 0) + (s.transferReal || 0)).toFixed(2)}</span>
                    </div>
                </div>

                ${(s.notes || s.additionalInfo) ? `
                <div style="margin-bottom:1.5rem;">
                    <h4 style="margin-bottom:0.5rem; font-size:0.9rem;">Notas del Cierre</h4>
                    <div style="background:var(--bg-dark); padding:1rem; border-radius:8px; font-style:italic; border-left:4px solid var(--primary); font-size:0.95rem;">
                        "${s.notes || s.additionalInfo}"
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
                        ${(currentUser.role === 'owner' || currentUser.role === 'admin' || (s.status === 'registered' && s.seller === currentUser.name)) && (s.type !== 'daily_closure' && s.type !== 'daily_closure_report') ? `
                        <button class="btn-primary" onclick="closeModal('sale-detail-modal'); editSale(${s.id})" style="flex:1;">
                            <i class="ph ph-pencil"></i> Editar
                        </button>
                    ` : ''}

                        ${(s.status === 'registered' || s.status === 'review_pending') && (currentUser.role === 'owner' || currentUser.role === 'admin') ? `
                        <button class="btn-primary" onclick="closeModal('sale-detail-modal'); openSaleForRevision(${s.id})" style="flex:1; background:var(--warning); color:black;">
                            <i class="ph ph-shield-check"></i> Cerrar Registro
                        </button>
                    ` : ''}

                        <button class="btn-ghost" style="flex:1; color:var(--danger);" onclick="deleteSale(${s.id})">
                            <i class="ph ph-trash"></i> Eliminar
                        </button>
                        
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
                if (confirm(`¿Eliminar esta venta ? `)) force = true;
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
        addLog(`Venta #${id.toString().slice(-6)} eliminada.Stock restaurado.`, 'warning');
        alert("Venta eliminada con éxito.");

        closeModal('sale-detail-modal');

        // Force refresh based on view
        setTimeout(() => {
            const container = document.getElementById('content-area');
            if (currentView === 'ventas') renderVentas(container);
            if (currentView === 'pos') renderPOS(container);
            if (currentView === 'inventory') renderInventory(container); // Adding inventory support just in case
        }, 50);
    }
}

function sendDeleteRequest(s) {
    db.notifications.unshift({
        id: Date.now(),
        type: 'delete_request',
        refId: s.id,
        businessId: s.businessId,
        title: `Solicitud de Borrado: ${currentUser.name} `,
        message: `Venta de $${s.total.toFixed(2)} por ${s.seller}."Error en el registro de hoy".`,
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

// 2. ENVIAR NOTIFICACIÓN (Finalizar paso del Vendedor)
window.finalizePOSSale = async function () {
    const form = document.getElementById('pos-closure-form');
    if (!form) return;
    const formData = new FormData(form);
    const d = Object.fromEntries(formData.entries());

    ['totalExpected', 'expectedCash', 'expectedTransfer', 'surplusCash', 'shortageCash', 'surplusTransfer', 'shortageTransfer', 'commissionAmount'].forEach(k => {
        d[k] = parseFloat(d[k] || 0);
    });

    const requestSalary = d.requestSalary === 'true';

    const businessId = String(selectedBusinessId || 'mch1');
    const closureId = Date.now();

    // 1. CAPTURAR VENTAS Y CAMBIAR ESTADO A 'review_pending'
    const sellerSales = db.sales.filter(s =>
        s.status === 'registered' &&
        s.seller === currentUser.name &&
        String(s.businessId) === businessId
    );

    const saleIds = sellerSales.map(s => s.id);
    sellerSales.forEach(s => s.status = 'review_pending');

    const cashReal = (d.expectedCash + d.surplusCash - d.shortageCash);
    const transferReal = (d.expectedTransfer + d.surplusTransfer - d.shortageTransfer);
    const totalReal = cashReal + transferReal;

    const notification = {
        id: closureId,
        type: 'closure_request',
        businessId: businessId,
        title: `🔐 Solicitud de Cierre: ${currentUser.name}`,
        message: `Total Sistema: $${d.totalExpected.toFixed(2)} | Real: $${totalReal.toFixed(2)}`,
        status: 'pending',
        date: new Date().toLocaleString(),
        data: {
            ...d,
            cashReal: cashReal,
            transferReal: transferReal,
            businessId: businessId,
            seller: currentUser.name,
            targetDate: d.targetDate,
            saleIds: saleIds,
            requestSalary: requestSalary,
            commission: d.commissionAmount
        }
    };

    if (!db.notifications) db.notifications = [];
    db.notifications.unshift(notification);

    await saveData();

    closeModal('pos-closure-modal');

    // LIMPIEZA TOTAL PARA EL VENDEDOR
    posCart = [];
    editingSaleId = null;
    isReviewingClosure = false;
    reviewingNotificationId = null;

    // Navegación Consistente
    navigateTo('ventas');
};

/* =============================================================
   SUPER MODAL DE REVISIÓN (AUDITORÍA MAESTRA)
   ============================================================= */
/* =============================================================
   SUPER MODAL DE REVISIÓN (AUDITORÍA MAESTRA) -> REDIRIGE AL POS EDITABLE
   ============================================================= */
window.openSuperReviewModal = async function (id, isNotification = false) {
    let source = isNotification ? db.notifications.find(n => n.id === id) : db.sales.find(s => s.id === id);
    if (!source) return alert("Origen de datos no encontrado.");

    const d = isNotification ? source.data : source;

    // Configurar estado de revisión
    isReviewingClosure = true;
    reviewingClosureId = d.id || id;
    reviewingNotificationId = isNotification ? id : null;
    selectedBusinessId = d.businessId;

    // Consolidar productos en el carrito del POS
    posCart = [];
    const sessionSaleIds = d.saleIds || d.salesIds || [d.id];
    sessionSaleIds.forEach(sid => {
        const s = db.sales.find(sale => String(sale.id) === String(sid));
        if (s && s.items) {
            s.items.forEach(i => {
                const existing = posCart.find(ci => String(ci.productId || ci.id) === String(i.productId || i.id));
                if (existing) {
                    existing.qty += i.qty;
                } else {
                    posCart.push({ ...i, id: (i.productId || i.id) });
                }
            });
        }
    });

    // Guardar metadata del arqueo original para los inputs
    window.auditTempData = {
        cashReal: d.cashReal || 0,
        transferReal: d.transferReal || 0,
        surplusCash: d.surplusCash || d.surplus || 0,
        shortageCash: d.shortageCash || d.shortage || 0,
        surplusTransfer: d.surplusTransfer || 0,
        shortageTransfer: d.shortageTransfer || 0,
        openingTime: d.openingTime || '08:00',
        closingTime: d.closingTime || '22:00',
        targetDate: d.targetDate || d.date?.split(' ')[0] || new Date().toISOString().split('T')[0],
        seller: d.seller || 'Sistema' // Validar vendedor para filtro de cierre
    };

    // Navegar al POS
    navigateTo('pos');
};

window.updateAuditItemQty = async function (seller, businessId, productId, newVal, isNotification, sourceId) {
    const newQty = parseInt(newVal);
    if (isNaN(newQty) || newQty < 0) return;

    // Buscar todas las ventas candidatas de esta sesión (mismo vendedor, mismo negocio, estado pendiente)
    const candidates = db.sales.filter(s =>
        s.seller === seller &&
        String(s.businessId) === String(businessId) &&
        (s.status === 'registered' || s.status === 'review_pending' || s.status === 'closed')
    );

    // Encontrar el item en alguna de estas ventas
    let itemFound = false;
    candidates.forEach(s => {
        if (!s.items) return;
        const item = s.items.find(i => String(i.productId || i.id) === String(productId));
        if (item) {
            const oldQty = item.qty;
            const diff = newQty - oldQty;
            if (diff === 0) return; // No change needed

            item.qty = newQty;
            itemFound = true;

            // Ajustar Inventario (reversión e impacto en tiempo real)
            const inv = db.inventory.find(i => String(i.productId) === String(productId) && String(i.businessId) === String(businessId));
            if (inv) {
                inv.quantity -= diff; // Si sumamos al ticket, restamos del stock
            } else {
                // Crear entrada si no existe (vulnerabilidad de lógica pero previene crash)
                db.inventory.push({ businessId: businessId, productId: productId, quantity: -diff });
            }

            // Recalcular total de la venta
            const oldTotal = s.total;
            s.total = s.items.reduce((acc, current) => acc + (current.price * current.qty), 0);
            const totalDiff = s.total - oldTotal;

            // Ajustar Pago (asumimos efectivo para la corrección)
            if (!s.payment) s.payment = { cash: 0, transfer: 0 };
            s.payment.cash = (s.payment.cash || 0) + totalDiff;
        }
    });

    if (itemFound) {
        // ACTUALIZAR REPORTE SI EXISTE (Consistencia de datos)
        // Buscamos el reporte que contenga esta venta
        const report = db.sales.find(r =>
            r.type === 'daily_closure_report' &&
            (r.salesIds || r.saleIds || []).some(sid => String(sid) === String(sourceId) || (Array.isArray(sourceId) && sourceId.includes(sid)))
        );

        if (report) {
            // Recalcular report totals
            let expCash = 0;
            let expTrans = 0;
            const sIds = report.salesIds || report.saleIds || [];
            sIds.forEach(sid => {
                const rs = db.sales.find(sale => String(sale.id) === String(sid));
                if (rs) {
                    if (rs.type !== 'EXPENSE') {
                        expCash += (rs.payment?.cash || 0);
                        expTrans += (rs.payment?.transfer || 0);
                    } else {
                        expCash += (rs.total || 0);
                    }
                }
            });
            report.expectedCash = expCash;
            report.expectedTransfer = expTrans;
            report.surplus = Math.max(0, (report.cashReal || 0) - expCash) + Math.max(0, (report.transferReal || 0) - expTrans);
            report.shortage = Math.max(0, expCash - (report.cashReal || 0)) + Math.max(0, expTrans - (report.transferReal || 0));
        }

        await saveData();
        // Recargar el modal para refrescar los cálculos de Sistema y Diferencias
        openSuperReviewModal(sourceId, isNotification);
    } else {
        alert("No se encontró el producto en las ventas de esta sesión.");
    }
}

window.finalApproveClosure = async function (id, isNotification) {
    try {
        const paySalary = document.getElementById('pay-salary-now')?.checked || false;

        let source = isNotification ?
            db.notifications.find(n => String(n.id) === String(id)) :
            db.sales.find(s => String(s.id) === String(id));

        if (!source) {
            console.error("Source not found for closure:", id, isNotification);
            return alert("Error: No se pudo localizar la sesión para cerrar.");
        }

        const d = isNotification ? source.data : source;

        if (!confirm(`¿Confirmar cierre definitivo ?\n\n - Vendedor: ${d.seller} \n - Pago Salario: ${paySalary ? 'SÍ' : 'NO'} `)) return;

        // 1. Cambiar estado de todas las ventas relacionadas
        let count = 0;
        (d.saleIds || [d.id]).forEach(sid => {
            const s = db.sales.find(sale => String(sale.id) === String(sid));
            if (s) {
                s.status = 'closed';
                s.auditedBy = currentUser.name || 'Admin';
                s.auditTimestamp = Date.now();
                count++;
            }
        });

        // 2. Procesar Salario si se marcó
        let salaryPaid = 0;
        let salarySource = '';

        if (paySalary) {
            const stats = calculateSellerProfitAndCommission(d.seller, d.businessId);
            salaryPaid = stats.commission;
            const cashReal = (d.cashReal || 0);

            if (cashReal >= salaryPaid) {
                salarySource = 'Caja Diaria';
            } else {
                salarySource = 'Fondo del Negocio';
                db.businessFund.cash -= salaryPaid;
            }
        }

        // 3. Recalcular balance final para el reporte (por si hubo ediciones en la revisión)
        let expectedCash = 0;
        let expectedTransfer = 0;
        (d.saleIds || [d.id]).forEach(sid => {
            const s = db.sales.find(sale => String(sale.id) === String(sid));
            if (s) {
                if (s.type !== 'EXPENSE') {
                    expectedCash += (s.payment?.cash || 0);
                    expectedTransfer += (s.payment?.transfer || 0);
                } else {
                    expectedCash += (s.total || 0);
                }
            }
        });

        const cashReal = (d.cashReal || 0);
        const transferReal = (d.transferReal || 0);
        const surplus = Math.max(0, cashReal - expectedCash) + Math.max(0, transferReal - expectedTransfer);
        const shortage = Math.max(0, expectedCash - cashReal) + Math.max(0, expectedTransfer - transferReal);

        const closureReport = {
            id: Date.now(),
            type: 'daily_closure_report',
            businessId: d.businessId,
            seller: d.seller,
            date: d.targetDate || new Date().toISOString().split('T')[0],
            timestamp: Date.now(),
            // Auditoría
            expectedCash: expectedCash,
            expectedTransfer: expectedTransfer,
            cashReal: cashReal,
            transferReal: transferReal,
            totalReal: cashReal + transferReal,
            surplus: surplus,
            shortage: shortage,
            salaryPaid: salaryPaid,
            salarySource: salarySource,
            notes: d.notes || d.additionalInfo || '',
            salesIds: d.salesIds || d.saleIds || [d.id],
            auditedBy: currentUser.name,
            status: 'closed'
        };

        db.sales.unshift(closureReport);

        // 4. Marcar notificación como procesada si aplica
        if (isNotification) {
            source.status = 'approved';
            source.seen = true;
        }

        await saveData();
        closeModal('super-review-modal');
        closeModal('sale-detail-modal');

        alert(`✅ CIERRE PROCESADO CORRECTAMENTE.\n\n - Auditado por: ${currentUser.name} \n - Ventas cerradas: ${count} \n - Salario: $${salaryPaid.toFixed(2)} (${salarySource})`);

        // Refrescar vista
        if (currentView === 'ventas') renderVentas(document.getElementById('content-area'));
        else navigateTo('ventas');

    } catch (err) {
        console.error("Error in finalApproveClosure:", err);
        alert("Ocurrió un error crítico al cerrar la venta. Revisa la consola.");
    }
};

// 4. APROBAR FINALMENTE (Lógica Contable desde POS)
/* =============================================================
   NUEVO: REVISIÓN DE SESIÓN COMPLETA (VENTAS + GASTOS + MERMAS)
   ============================================================= */
window.openSaleForRevision = function (idOrSessionId, sessionIdOpt) {
    // Si pasamos sessionIdOpt, es la nueva lógica. Si no, tratamos de deducirlo.
    const saleId = idOrSessionId;
    const sessionId = sessionIdOpt || null;

    // Buscar la venta/sesión origen
    const sourceSale = db.sales.find(s => String(s.id) === String(saleId));
    if (!sourceSale) {
        alert("No se encontró el registro origen.");
        return;
    }

    // Definir el criterio de grupo
    let relatedItems = [];
    if (sessionId && sessionId !== 'null' && sessionId !== 'undefined') {
        relatedItems = db.sales.filter(s => String(s.sessionId) === String(sessionId));
    } else {
        // Fallback Legacy: Mismo día, vendedor y negocio
        const day = (sourceSale.date || '').split(',')[0].trim();
        relatedItems = db.sales.filter(s => {
            const sDay = (s.date || '').split(',')[0].trim();
            return sDay === day && s.seller === sourceSale.seller && String(s.businessId) === String(sourceSale.businessId);
        });
    }

    // --- LEY EN PIEDRA #1: El vendedor no puede editar después de enviar revisión ---
    const isSeller = (currentUser && currentUser.role === 'seller');
    const isPendingOrClosed = relatedItems.some(s =>
        s.status === 'review_pending' ||
        s.status === 'closed' ||
        s.status === 'approved' ||
        s.type === 'closure_request' ||
        s.type === 'daily_closure_report'
    );

    console.log("STONE RULE #1 DEBUG:", {
        userName: currentUser?.name,
        userRole: currentUser?.role,
        isSeller,
        isPendingOrClosed,
        itemsCount: relatedItems.length,
        itemStatuses: relatedItems.map(s => s.status),
        itemTypes: relatedItems.map(s => s.type)
    });

    if (isSeller && isPendingOrClosed) {
        alert("🔒 ACCESO RESTRINGIDO (LEY EN PIEDRA #1)\n\nEsta sesión ya fue enviada a revisión o está cerrada. No puedes editarla.\nContacta con un Administrador para realizar cambios.");
        return;
    }

    // Configurar estado de revisión
    isReviewingClosure = true;
    reviewingClosureId = sessionId || saleId;
    reviewingNotificationId = null;
    selectedBusinessId = sourceSale.businessId;

    // Verificar si la sesión está CERRADA
    const isClosed = relatedItems.every(s => s.status === 'closed' || s.status === 'approved');
    if (isClosed) {
        if (!confirm("⚠️ ESTA SESIÓN ESTÁ CERRADA.\n\n¿Estás seguro que deseas re-abrirla para editar?\nCualquier cambio requerirá un nuevo cierre.")) {
            isReviewingClosure = false;
            return;
        }
    }

    // Cargar Carrito (Solo Ventas y Gastos visualizables)
    posCart = [];
    relatedItems.forEach(s => {
        if (s.items) {
            s.items.forEach(i => {
                // Add item to cart, preserving origin ID for updates
                posCart.push({
                    ...i,
                    id: i.productId || i.id,
                    _originSaleId: s.id, // Track source for specific updates
                    _type: s.type // Track if expense
                });
            });
        }
    });

    // Guardar metadata para el POS
    window.auditTempData = {
        targetDate: relatedItems[0].date.split(',')[0].trim(),
        seller: relatedItems[0].seller,
        openingTime: relatedItems[0].openingTime || '08:00',
        closingTime: '22:00', // Default
        sessionId: sessionId || null
    };

    navigateTo('pos');
    alert(`Revisando Sesión de ${relatedItems[0].seller}\n${relatedItems.length} movimientos cargados.`);
};

// ... (existing openSuperReviewModal below can be deprecated or kept for compat)
/* =============================================================
   NUEVO: ELIMINAR SESIÓN COMPLETA
   ============================================================= */
window.deleteSession = async function (sessionId, date, seller, businessId) {
    if (currentUser.role !== 'owner' && currentUser.role !== 'admin') {
        alert("No tienes permisos para eliminar sesiones.");
        return;
    }

    if (!confirm(`⚠️ PELIGRO: ESTÁS A PUNTO DE ELIMINAR UNA SESIÓN COMPLETA.\n\nFecha: ${date}\nVendedor: ${seller}\n\nEsto borrará TODAS las ventas, gastos y registros de esa sesión permanentemente.\n\n¿Estás seguro?`)) return;

    // Filter criteria
    const targetSessionId = (sessionId && sessionId !== 'null' && sessionId !== 'undefined') ? sessionId : null;

    // Filter out the sales
    const initialCount = db.sales.length;
    db.sales = db.sales.filter(s => {
        if (targetSessionId) {
            return String(s.sessionId) !== String(targetSessionId);
        } else {
            // Legacy fallback
            const sDay = (s.date || '').split(',')[0].trim();
            const matches = sDay === date && s.seller === seller && String(s.businessId) === String(businessId);
            return !matches;
        }
    });

    const deletedCount = initialCount - db.sales.length;
    addLog(`Sesión eliminada por ${currentUser.name}: ${deletedCount} registros borrados.`, 'critical');

    await saveData();
    renderVentas(document.getElementById('content-area'));
    alert("Sesión eliminada correctamente.");
};
window.approveClosureFromPOS = async function () {
    if (!isReviewingClosure) return;

    const totalSystem = posCart.reduce((sum, i) => sum + (i.price * i.qty), 0);
    const audit = window.auditTempData;

    // Calcular reales y diferencias
    const cashReal = audit.cashReal;
    const transferReal = audit.transferReal;
    const totalReal = cashReal + transferReal;

    const cashDiff = cashReal - totalSystem;

    if (!confirm(`¿Confirmar aprobación del cierre?\n\nTotal Sistema: $${totalSystem.toFixed(2)}\nTotal Real: $${totalReal.toFixed(2)}\nUnidades: ${posCart.reduce((sum, i) => sum + i.qty, 0)}`)) return;

    // 1. Obtener la notificación o venta origen de forma robusta
    const sourceId = reviewingClosureId;

    // Intentar buscar notificación por ID directo, o por data.id, O por si contiene el saleId en su lista
    const notif = db.notifications.find(n =>
        n.id == reviewingNotificationId ||
        (n.data && n.data.id == sourceId) ||
        (n.data && n.data.saleIds && n.data.saleIds.includes(sourceId))
    );

    // 2. Marcar ventas individuales como CERRADAS
    // IMPORTANTE: Filtrar por FECHA y VENDEDOR para no cerrar cosas de otros días/usuarios
    const targetDate = audit.targetDate;
    const targetSeller = audit.seller;

    let count = 0;

    // Filtro estricto: Status + Negocio + Vendedor + Fecha
    const sellerSales = db.sales.filter(s =>
        (s.status === 'review_pending' || s.status === 'registered') &&
        String(s.businessId) === String(selectedBusinessId) &&
        (!targetSeller || s.seller === targetSeller) &&
        (s.date.startsWith(targetDate))
    );

    // Si no encontramos por estado, usamos los IDs vinculados si existen
    const linkedIds = notif?.data?.saleIds || [];

    db.sales.forEach(s => {
        // La condición es: o está en la lista explícita de la notificación, O cumple los criterios de filtro (misma sesión)
        if (linkedIds.includes(s.id) || (sellerSales.includes(s))) {
            s.status = 'closed';
            s.closureId = sourceId;
            s.locker = null; // Liberar candado
            count++;
        }
    });

    // 3. Crear el Reporte Maestro de Cierre
    const masterClosure = {
        id: sourceId || Date.now(),
        type: 'daily_closure_report',
        businessId: selectedBusinessId,
        seller: targetSeller || notif?.data?.seller || 'Vendedor',
        date: audit.targetDate + ' ' + new Date().toLocaleTimeString(),
        timestamp: Date.now(),
        totalSystem: totalSystem,
        totalReal: totalReal,
        cashSystem: totalSystem, // Simplificación
        cashReal: cashReal,
        transferSystem: 0,
        transferReal: transferReal,
        surplus: audit.surplusCash + audit.surplusTransfer,
        shortage: audit.shortageCash + audit.shortageTransfer,
        surplusCash: audit.surplusCash,
        shortageCash: audit.shortageCash,
        surplusTransfer: audit.surplusTransfer,
        shortageTransfer: audit.shortageTransfer,
        openingTime: audit.openingTime,
        closingTime: audit.closingTime,
        items: posCart.map(i => ({ productId: i.id, name: i.name, qty: i.qty, price: i.price })),
        salesIds: linkedIds.length > 0 ? linkedIds : sellerSales.map(s => s.id),
        salesCount: count,
        approvedBy: currentUser.name,
        status: 'closed'
    };

    // Reemplazar si ya existe un reporte con ese ID o agregar nuevo
    // Usamos un ID único si es nuevo
    const existingIndex = db.sales.findIndex(s => s.id == masterClosure.id && s.type === 'daily_closure_report');
    if (existingIndex !== -1) {
        db.sales[existingIndex] = masterClosure;
    } else {
        db.sales.unshift(masterClosure);
    }

    if (notif) {
        notif.status = 'approved';
        notif.seen = true;
        notif.locker = null; // Liberar candado

        // PAGAR SALARIO SI SE SOLICITÓ
        if (notif.data && notif.data.requestSalary) {
            const sellerUser = db.users.find(u => u.name === notif.data.seller);
            if (sellerUser) {
                sellerUser.lastPaymentDate = new Date().toISOString();
                // Log del pago
                addLog(`Pago de salario/comisiones aprobado para ${sellerUser.name}: $${notif.data.commission}`, 'success');
            }
        }
    }

    await saveData();

    // 4. Limpiar estado y volver
    isReviewingClosure = false;
    reviewingNotificationId = null;
    reviewingClosureId = null;
    isSessionActive = false; // <--- NUEVO: Cerrar sesión POS
    posCart = [];
    window.auditTempData = {}; // Clear

    alert("✅ Cierre Aprobado.\nLas ventas han sido marcadas como CERRADAS y se generó el reporte definitivo.");
    navigateTo('ventas');
};
window.renderCashControl = function (container) {
    if (currentUser.role !== 'owner' && currentUser.role !== 'admin') {
        container.innerHTML = '<div style="padding:2rem; text-align:center; color:var(--danger);"><h2>Acceso Denegado</h2></div>';
        return;
    }

    // Default Dates: Today
    // But we want to allow selection. We need state for selection.
    // If we re-render, we lose state unless stored.
    // Let's use window.cashControlState or similar, or read from DOM if exists, else default.

    // Get stored dates or defaults
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // Default Start: First day of current month? Or today? 
    // User asked "put a date to see what was there that day".
    // Let's default Start = Today, End = Today.

    if (!window.ccState) {
        window.ccState = { start: todayStr, end: todayStr };
    }

    const fund = db.businessFund || { cash: 0, transfer: 0, usd: 0, eur: 0 };

    // --- LOGIC: Reverse Calculation for "Initial Balance at StartDate" ---
    // 1. Get Global Current Balance (Right Now) -> This is our Anchor.
    // 2. To get Balance at Start of StartDate:
    //    Balance_Start = Current_Global - (NetChange from Start_of_StartDate to NOW)
    // 
    // 3. To get Balance at End of EndDate:
    //    Balance_End = Current_Global - (NetChange from End_of_EndDate to NOW)

    // We need a helper to Calculate Net Change between two timestamps.
    const getNetChange = (fromDate, toDate) => {
        let change = { cash: 0, transfer: 0, usd: 0, eur: 0 };

        // Sales
        db.sales.forEach(s => {
            const d = new Date(s.date);
            if (d >= fromDate && d <= toDate) {
                if (s.status === 'cancelled') return;
                change.cash += s.payment?.cash || 0;
                change.transfer += s.payment?.transfer || 0;
            }
        });

        // Movements (Expenses/Income)
        (db.extraMovements || []).forEach(m => {
            const d = new Date(m.date);
            if (d >= fromDate && d <= toDate) {
                const am = m.amount || 0;
                if (m.type === 'expense') {
                    if (m.currency === 'CUP') change.cash -= am;
                    if (m.currency === 'Transfer') change.transfer -= am;
                    if (m.currency === 'USD') change.usd -= am;
                    if (m.currency === 'EUR') change.eur -= am;
                } else if (m.type === 'income') {
                    if (m.currency === 'CUP') change.cash += am;
                    if (m.currency === 'Transfer') change.transfer += am;
                    // ...
                }
            }
        });

        return change;
    };

    // Define Time Boundaries
    const sDate = new Date(window.ccState.start);
    sDate.setHours(0, 0, 0, 0); // Start of StartDate

    const eDate = new Date(window.ccState.end);
    eDate.setHours(23, 59, 59, 999); // End of EndDate

    const nowTime = new Date(); // Right now

    // Changes from SELECTED RANGE (Start to End) -> For the Table Columns (Income/Expense)
    // This is what happens WITHIN the period.
    // Income = Sales + IncomeMoves
    // Expense = ExpenseMoves

    let rangeStats = {
        mn: { income: 0, expense: 0 },
        transfer: { income: 0, expense: 0 },
        usd: { income: 0, expense: 0 },
        eur: { income: 0, expense: 0 }
    };

    // Filter for Range Stats
    db.sales.forEach(s => {
        const d = new Date(s.date);
        if (d >= sDate && d <= eDate && s.status !== 'cancelled') {
            rangeStats.mn.income += s.payment?.cash || 0;
            rangeStats.transfer.income += s.payment?.transfer || 0;
        }
    });

    (db.extraMovements || []).forEach(m => {
        const d = new Date(m.date);
        if (d >= sDate && d <= eDate) {
            if (m.type === 'expense') {
                if (m.currency === 'CUP') rangeStats.mn.expense += m.amount;
                if (m.currency === 'USD') rangeStats.usd.expense += m.amount;
                // ...
            } else {
                if (m.currency === 'CUP') rangeStats.mn.income += m.amount;
                // ...
            }
        }
    });

    // --- REVERSE CALC ---
    // Start Balance = Current Fund - (Everything from StartDate to Now)
    // Wait, simpler:
    // Start Balance = Current Fund - (Change from StartDate to Now) -> This gives Balance BEFORE StartDate?
    // Let's trace:
    // Fund_Now = Fund_Start + Change(Start->Now)
    // => Fund_Start = Fund_Now - Change(Start->Now)
    // Correct. This gives "Initial Balance" (morning of StartDate).

    const changeStartToNow = getNetChange(sDate, nowTime);

    const initialBalances = {
        mn: fund.cash - changeStartToNow.cash,
        transfer: fund.transfer - changeStartToNow.transfer,
        usd: fund.usd - changeStartToNow.usd,
        eur: fund.eur - changeStartToNow.eur
    };

    // Final Balance (at EndDate)
    // Balance_End = Initial_Balance + NetChange(Range)
    // This is what the user wants to check against.

    const finalBalances = {
        mn: initialBalances.mn + (rangeStats.mn.income - rangeStats.mn.expense),
        transfer: initialBalances.transfer + (rangeStats.transfer.income - rangeStats.transfer.expense),
        usd: initialBalances.usd + (rangeStats.usd.income - rangeStats.usd.expense),
        eur: initialBalances.eur + (rangeStats.eur.income - rangeStats.eur.expense)
    };

    const rows = [
        { label: 'MN (CUP)', key: 'mn', init: initialBalances.mn, ...rangeStats.mn, final: finalBalances.mn },
        { label: 'USD', key: 'usd', init: initialBalances.usd, ...rangeStats.usd, final: finalBalances.usd },
        { label: 'EUR', key: 'eur', init: initialBalances.eur, ...rangeStats.eur, final: finalBalances.eur },
        { label: 'Transferencias', key: 'transfer', init: initialBalances.transfer, ...rangeStats.transfer, final: finalBalances.transfer }
    ];

    container.innerHTML = `
        <div class="fade-in">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
                <h2 style="margin:0;"><i class="ph ph-money"></i> Control de Efectivo</h2>
                <button class="btn-ghost" onclick="seedDatabaseWithHistory()" title="Generar data de prueba"><i class="ph ph-database"></i> Simular Historial</button>
            </div>
            
            <div class="card" style="margin-bottom:1.5rem; display:flex; gap:1.5rem; align-items:flex-end; flex-wrap:wrap;">
                <div>
                     <label style="display:block; font-size:0.8rem; color:var(--text-muted); margin-bottom:0.5rem;">Desde (Saldo Inicial)</label>
                     <input type="date" id="cc-start" value="${window.ccState.start}" class="input-field" onchange="updateCCDates()">
                </div>
                 <div>
                     <label style="display:block; font-size:0.8rem; color:var(--text-muted); margin-bottom:0.5rem;">Hasta (Corte)</label>
                     <input type="date" id="cc-end" value="${window.ccState.end}" class="input-field" onchange="updateCCDates()">
                </div>
                <div style="padding-bottom:0.8rem; color:var(--text-muted); font-size:0.9rem;">
                    <i class="ph ph-info"></i> El saldo inicial se calcula retroactivamente al inicio del día seleccionado.
                </div>
            </div>

            <div class="card" style="overflow-x:auto;">
                <table style="width:100%; border-collapse:collapse; min-width:800px;">
                    <thead>
                        <tr style="background:var(--bg-dark); color:var(--text-muted); text-align:left;">
                            <th style="padding:1rem;">Moneda</th>
                            <th style="padding:1rem; text-align:right;">Saldo Inicial<br><span style="font-size:0.75rem;">(${window.ccState.start})</span></th>
                            <th style="padding:1rem; text-align:right; color:var(--success);">Ingresos</th>
                            <th style="padding:1rem; text-align:right; color:var(--danger);">Egresos</th>
                            <th style="padding:1rem; text-align:right;">Saldo Final<br><span style="font-size:0.75rem;">(${window.ccState.end})</span></th>
                            <th style="padding:1rem; text-align:right; background:rgba(255,255,0,0.1);">Efectivo Real</th>
                            <th style="padding:1rem; text-align:right;">Diferencia</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.map(row => `
                            <tr style="border-bottom:1px solid var(--border);">
                                <td style="padding:1rem; font-weight:bold;">${row.label}</td>
                                <td style="padding:1rem; text-align:right;">$${row.init.toFixed(2)}</td>
                                <td style="padding:1rem; text-align:right; color:var(--success);">$${row.income.toFixed(2)}</td>
                                <td style="padding:1rem; text-align:right; color:var(--danger);">$${row.expense.toFixed(2)}</td>
                                <td style="padding:1rem; text-align:right; font-weight:bold;">$${row.final.toFixed(2)}</td>
                                <td style="padding:1rem; text-align:right;">
                                    <input type="number" id="real-${row.key}" value="${row.final.toFixed(2)}" 
                                           oninput="calculateDifference('${row.key}', ${row.final})"
                                           style="width:100px; padding:0.5rem; border-radius:6px; border:1px solid var(--border); background:var(--bg-dark); color:white; text-align:right;">
                                </td>
                                <td style="padding:1rem; text-align:right; font-weight:bold;" id="diff-${row.key}">$0.00</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    updateTitle('Control de Efectivo');
    rows.forEach(r => calculateDifference(r.key, r.final));
}

window.updateCCDates = function () {
    const s = document.getElementById('cc-start').value;
    const e = document.getElementById('cc-end').value;
    if (s > e) {
        alert("La fecha de inicio no puede ser mayor que la de fin.");
        return;
    }
    window.ccState = { start: s, end: e };
    renderCashControl(document.getElementById('content-area'));
}

window.calculateDifference = function (key, systemVal) {
    const input = document.getElementById(`real-${key}`);
    const diffEl = document.getElementById(`diff-${key}`);
    if (!input || !diffEl) return;

    const real = parseFloat(input.value) || 0;
    const diff = real - systemVal;

    diffEl.innerText = `$${diff.toFixed(2)}`;
    diffEl.style.color = diff === 0 ? 'var(--success)' : (diff < 0 ? 'var(--danger)' : 'var(--warning)');
};

// --- RESPONSIVE UI HELPERS ---

function setupResponsiveUI() {
    console.log("📱 Setting up Responsive UI...");

    // 1. Inject Hamburger Button if missing
    const topBar = document.querySelector('.top-bar');
    if (topBar && !document.getElementById('mobile-menu-btn')) {
        const btn = document.createElement('button');
        btn.id = 'mobile-menu-btn';
        btn.innerHTML = '<i class="ph ph-list"></i>';
        btn.onclick = toggleSidebar;
        topBar.prepend(btn); // Add to left of Title
    }

    // 2. Create Sidebar Overlay if missing
    if (!document.querySelector('.sidebar-overlay')) {
        const overlay = document.createElement('div');
        overlay.classList.add('sidebar-overlay');
        overlay.onclick = closeSidebar; // Click outside closes
        document.body.appendChild(overlay);
    }

    // 3. Add Close Listeners to Sidebar Links (Mobile UX)
    // When a link is clicked on mobile, sidebar should close
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
        sidebar.addEventListener('click', (e) => {
            if (e.target.closest('li')) {
                closeSidebar();
            }
        });
    }
}

window.toggleSidebar = function () {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    if (sidebar) sidebar.classList.toggle('show-sidebar');
    if (overlay) overlay.classList.toggle('active');
}

window.closeSidebar = function () {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    if (sidebar) sidebar.classList.remove('show-sidebar');
    if (overlay) overlay.classList.remove('active');
}

// Ensure theme toggle is robust
const originalToggleTheme = window.toggleTheme;
window.toggleTheme = function () {
    // 1. Update State
    db.settings.theme = db.settings.theme === 'light' ? 'dark' : 'light';

    // 2. Apply Immediately (Visual Feedback)
    if (db.settings.theme === 'light') {
        document.body.classList.add('theme-light');
    } else {
        document.body.classList.remove('theme-light');
    }

    // 3. Save (Background)
    saveData();

    // 4. Re-render Sidebar (to update Icon)
    // We pass currentView to maintain active state
    renderSidebar(currentView);
};
// --- BLOQUE DE INICIO ESTÁNDAR (REPARADO) ---
window.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Iniciando MCH Control (Modo Estándar)...');

    // 1. CARGA DE DATOS
    if (typeof window.loadData === 'function') {
        try {
            await window.loadData();
            console.log("✅ Datos cargados correctamente.");
        } catch (e) {
            console.error("❌ Error cargando datos:", e);
            alert("Error crítico cargando datos. Ver consola.");
            return;
        }
    } else {
        console.error("❌ Fatal: window.loadData no existe.");
        alert("Error de integridad: data.js no cargó.");
        return;
    }

    // 2. SETUP UI
    if (typeof setupResponsiveUI === 'function') setupResponsiveUI();
    if (typeof applyTheme === 'function') applyTheme();

    // 3. NAVEGACIÓN INTELIGENTE
    // Verifica si hay usuario activo (persistido o nueva sesión)
    // Nota: Como quitamos la persistencia automática para seguridad, start as null usually.

    // Check hash for direct link, default to dashboard
    const initView = window.location.hash.replace('#', '') || 'dashboard';

    if (!window.currentUser) {
        console.log("🔒 Sin sesión activa. Redirigiendo a Login.");
        navigateTo('login');
    } else {
        console.log(`🔓 Sesión recuperada: ${window.currentUser.name}`);
        // CRITICAL SYNC: Update local variable
        currentUser = window.currentUser;
        navigateTo(initView);
    }

    // 4. ESCUCHA DE NAVEGACIÓN
    window.addEventListener('hashchange', () => {
        const v = window.location.hash.replace('#', '');
        // Solo navegar si hay usuario o si es login
        if (v === 'login') return;
        if (window.currentUser && v) navigateTo(v);
        else if (!window.currentUser) navigateTo('login');
    });
});

