console.log('📦 Data Layer [v10.1] - Iniciando...');

// [ARCHITECT FIX] Finance Agent: Data Migration Skill (Multi-Tenant)
window.populateFromRealInventory = async function () {
  console.log("🔄 Iniciando población de base de datos desde REAL_INVENTORY...");
  if (!window.REAL_INVENTORY) {
    console.warn("⚠️ No hay datos en REAL_INVENTORY");
    return;
  }

  let totalCount = 0;

  for (const [bizKey, items] of Object.entries(window.REAL_INVENTORY)) {
    console.log(`📦 Procesando inventario para: ${bizKey} (${items.length} items)`);

    items.forEach((item, index) => {
      // 1. Ensure Product Exists (Global Catalog)
      let p = db.products.find(prod => prod.name === item.Nombre);
      if (!p) {
        p = {
          id: Date.now() + index + Math.floor(Math.random() * 1000), // Random jitter to avoid collision
          name: item.Nombre,
          category: item.Categoría || 'General',
          cost: parseFloat(item.Costo) || 0,
          price: parseFloat(item.Precio) || 0,
          image: '', status: 'active'
        };
        db.products.push(p);
      }

      // 2. Add/Update Inventory for Specific Business
      let inv = db.inventory.find(i => i.productId === p.id && i.businessId === bizKey);
      if (!inv) {
        db.inventory.push({
          businessId: bizKey,
          productId: p.id,
          quantity: parseFloat(item.Cantidad) || 0
        });
        totalCount++;
      } else {
        // Optional: Update if exists? For now, we respect the CSV snapshot as authority if it's "population"
        inv.quantity = parseFloat(item.Cantidad) || 0;
      }
    });
  }

  console.log(`✅ Población completada. ${totalCount} nuevos registros de inventario.`);
  await window.saveData();
};

// --- GLOBAL CONFIGURATION ---
window.availableModules = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'pos', label: 'Punto de Venta' },
  { id: 'ventas', label: 'Historial Ventas' },
  { id: 'inventory', label: 'Inventario' },
  { id: 'mermas', label: 'Mermas/Dev' },
  { id: 'users', label: 'Usuarios' },
  { id: 'reportes', label: 'Reportes' },
  { id: 'cash-control', label: 'Corte de Caja' },
  { id: 'settings', label: 'Configuración' },
  { id: 'transfer', label: 'Traslados' },
  { id: 'network_editor', label: 'Mapa de Red' }
];

window.rolePermissions = {
  owner: ['dashboard', 'pos', 'ventas', 'inventory', 'transfer', 'mermas', 'users', 'reportes', 'cash-control', 'settings', 'network_editor'],
  admin: ['dashboard', 'pos', 'ventas', 'inventory', 'transfer', 'mermas', 'users', 'reportes', 'cash-control'],
  seller: ['dashboard', 'pos', 'inventory']
};

// Initialize DB immediately to prevent ReferenceErrors in app.js
window.db = {
  products: [],
  inventory: [],
  sales: [],
  users: [],
  notifications: [],
  businesses: [],
  settings: { theme: 'dark' },
  logs: [],
  transfers: [],
  expenseCategories: [
    { id: 'area', label: 'Área' },
    { id: 'limpieza', label: 'Limpieza' },
    { id: 'otros', label: 'Otros' }
  ]
};

// --- DEFAULT NETWORK CONFIGURATION (FACTORY SETTINGS) ---
window.DEFAULT_NETWORK_NODES = [
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

window.DEFAULT_NETWORK_CONNECTIONS = [
    { from: 'node-owner-1', to: 'node-company-1' },
    { from: 'node-owner-2', to: 'node-company-1' },
    { from: 'node-company-1', to: 'node-warehouse-1' },
    { from: 'node-company-1', to: 'node-admin-1' },
    { from: 'node-warehouse-1', to: 'node-pos-1' },
    { from: 'node-warehouse-1', to: 'node-pos-2' },
    { from: 'node-pos-1', to: 'node-seller-1' },
    { from: 'node-pos-1', to: 'node-seller-2' },
    { from: 'node-pos-2', to: 'node-seller-2' },
    { from: 'node-pos-2', to: 'node-seller-3' }
];

// --- GLOBAL PERSISTENCE FUNCTIONS (DEFINED EARLY) ---

window.saveData = async function () {
  try {
    localStorage.setItem('bizControlData', JSON.stringify(window.db));
  } catch (e) {
    console.error('Local Save Error:', e);
  }

  try {
    const docRef = doc(dbFirestore, 'system', 'main_db');
    await setDoc(docRef, window.db);
    console.log('☁️ Datos sincronizados en la NUBE');
  } catch (e) {
    console.error('🔥 Error subiendo datos:', e);
  }
};

window.loadData = async function () {
  console.log('🔄 Iniciando carga de datos (desde data.js)...');

  try {
    const docRef = doc(dbFirestore, 'system', 'main_db');
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      console.log('☁️ Datos encontrados en la NUBE. Descargando...');
      const remoteData = docSnap.data();
      Object.keys(window.db).forEach(key => delete window.db[key]);
      Object.assign(window.db, remoteData);
      finalizeLoad();

      onSnapshot(docRef, (snapshot) => {
        const remoteData = snapshot.data();
        if (remoteData) {
          console.log('📡 Actualización remota recibida');
        }
      });

    } else {
      console.log('⚠️ Nube vacía. Buscando datos LOCALES para migrar...');
      await loadFromLocal();
      console.log('🚀 Migrando datos locales a la NUBE...');
      await window.saveData();
    }
  } catch (error) {
    console.error('🔥 Error conectando a Firebase:', error);
    await loadFromLocal();
  }
};

async function loadFromLocal() {
  const raw = localStorage.getItem('bizControlData');
  if (raw) {
    console.log("📂 Datos encontrados en localStorage.");
    try {
      const localData = JSON.parse(raw);
      Object.keys(window.db).forEach(key => delete window.db[key]);
      Object.assign(window.db, localData);
      finalizeLoad();
    } catch (e) {
      console.error("Error parsing local data, resetting:", e);
      await initializeDatabase();
    }
  } else {
    console.log("✨ LocalStorage vacío. Inicializando base de datos nueva...");
    await initializeDatabase();
  }
}

function finalizeLoad() {
  if (!window.db.businesses) window.db.businesses = [];
  if (!window.db.settings) window.db.settings = { theme: 'dark' };

  ['products', 'inventory', 'sales', 'waste', 'extraMovements', 'transactions', 'transfers', 'networkLayout'].forEach(key => {
    if (!window.db[key]) window.db[key] = [];
  });

  // [MOD] Only enforce default users if NO network layout exists
  // If no layout, inject DEFAULT_NETWORK_NODES
  if (!window.db.networkLayout || window.db.networkLayout.length === 0) {
      console.log("🔧 Inicializando Layout de Red por defecto...");
      window.db.networkLayout = [...window.DEFAULT_NETWORK_NODES];
      window.db.networkConnections = [...window.DEFAULT_NETWORK_CONNECTIONS];
  }

  // Ensure DB Users match Network Layout
  const networkUsers = window.db.networkLayout.filter(n => n.type === 'user');
  if (networkUsers.length > 0) {
      // Sync DB Users with Network Nodes
      // Strategy: Ensure every network user node has a db user entry
      networkUsers.forEach(node => {
          let user = window.db.users.find(u => u.id === node.id);
          
          if (!user) {
              // Create missing user
              const role = node.data.role;
              let perms = [];
              // Default Permissions (Simplified)
              if(role === 'owner') perms = ['dashboard', 'pos', 'ventas', 'inventory', 'transfer', 'mermas', 'users', 'reportes', 'cash-control', 'settings', 'network_editor'];
              if(role === 'admin') perms = ['dashboard', 'pos', 'ventas', 'inventory', 'transfer', 'mermas', 'reportes', 'cash-control', 'settings'];
              if(role === 'seller') perms = ['pos', 'ventas', 'inventory', 'mermas'];

              window.db.users.push({
                  id: node.id,
                  name: node.data.name,
                  role: role,
                  pin: '0000',
                  permissions: perms
              });
          } else {
              // Optional: Update name/role if changed in layout default
              user.name = node.data.name;
              user.role = node.data.role;
          }
      });
  }

  if (!window.db.businessFund) window.db.businessFund = { cash: 100000, transfer: 0, usd: 0, eur: 0 };

  if (window.db.businesses) {
    const idMap = { '1': 'alm', '2': 'mch1', '3': 'mch2' };
    window.db.businesses.forEach(b => { if (idMap[String(b.id)]) b.id = idMap[String(b.id)]; });
  }

  // [ARCHITECT FIX] Enforce Critical Businesses Existence
  const defaultBusinesses = [
    { id: 'alm', name: 'Almacén MCH', code: 'ALM', icon: 'ph-warehouse', color: '#58a6ff', type: 'warehouse' },
    { id: 'mch1', name: 'MCH 1', code: 'MCH1', icon: 'ph-storefront', color: '#3fb950', type: 'kiosk' },
    { id: 'mch2', name: 'MCH 2', code: 'MCH2', icon: 'ph-shopping-bag', color: '#d29922', type: 'kiosk' }
  ];

  defaultBusinesses.forEach(defBiz => {
    const exists = window.db.businesses.find(b => String(b.id) === String(defBiz.id));
    if (!exists) {
      window.db.businesses.push(defBiz);
      console.log(`🔧 Negocio restaurado: ${defBiz.name}`);
    }
  });

  console.log('✅ Datos cargados correctamente.');
  if (typeof applyTheme === 'function') applyTheme(window.db ? window.db.settings.theme : 'dark');
  if (typeof renderSidebar === 'function') renderSidebar();
}

async function initializeDatabase() {
  window.db.businesses = [
    { id: 'alm', name: 'Almacén MCH', code: 'ALM', icon: 'ph-warehouse', color: '#58a6ff', type: 'warehouse' },
    { id: 'mch1', name: 'MCH 1', code: 'MCH1', icon: 'ph-storefront', color: '#3fb950', type: 'kiosk' },
    { id: 'mch2', name: 'MCH 2', code: 'MCH2', icon: 'ph-shopping-bag', color: '#d29922', type: 'kiosk' }
  ];
  finalizeLoad();
  await window.saveData();
}

// --- REST OF DATA.JS CONTINUE HERE ---

window.cajasBalance = {
  usd: 0,
  eur: 0,
  mn: 0,
  transfer: 0
};

window.actualizarSaldo = function (moneda, monto) {
  // Normalize key
  const key = moneda.toLowerCase().trim();
  if (window.cajasBalance.hasOwnProperty(key)) {
    window.cajasBalance[key] += parseFloat(monto) || 0;
    console.log(`[Caja] Saldo de ${key.toUpperCase()} actualizado: ${window.cajasBalance[key]}`);
    return true;
  } else {
    console.error(`[Caja] Moneda ${moneda} no válida.`);
    return false;
  }
};


// --- SEED DATABASE FUNCTION ---
window.seedDatabase = async function () {
  console.log('🌱 Sembrando base de datos desde REAL_INVENTORY...');
  const db = window.db;
  db.products = [];
  db.inventory = [];

  const inventoryData = window.REAL_INVENTORY || {};
  let productIdCounter = 1;
  const nameToId = {};

  for (const bizId in inventoryData) {
    inventoryData[bizId].forEach(item => {
      let pId;
      if (nameToId[item.Nombre]) {
        pId = nameToId[item.Nombre];
      } else {
        pId = productIdCounter++;
        nameToId[item.Nombre] = pId;
        db.products.push({
          id: pId,
          name: item.Nombre,
          cost: parseFloat(item.Costo) || 0,
          price: parseFloat(item.Precio) || 0,
          category: item["Categoría"] || 'Misceláneos',
          image: null
        });
      }
      db.inventory.push({
        businessId: bizId,
        productId: pId,
        quantity: parseFloat(item.Cantidad) || 0
      });
    });
  }

  // Asegurar que existan negocios
  if (!db.businesses || db.businesses.length === 0) {
    db.businesses = [
      { id: 'alm', name: 'Almacén MCH', code: 'ALM', icon: 'ph-warehouse', color: '#58a6ff', type: 'warehouse' },
      { id: 'mch1', name: 'MCH 1', code: 'MCH1', icon: 'ph-storefront', color: '#3fb950', type: 'kiosk' },
      { id: 'mch2', name: 'MCH 2', code: 'MCH2', icon: 'ph-shopping-bag', color: '#d29922', type: 'kiosk' }
    ];
  }

  console.log(`✅ Sembrado completado: ${db.products.length} productos, ${db.inventory.length} registros de inventario.`);
  await window.saveData();
  return true;
};





