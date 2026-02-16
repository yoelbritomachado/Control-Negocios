import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Configuración de Axios
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para Token
api.interceptors.request.use(config => {
  const token = localStorage.getItem('session_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// --- AUTH ---
export const login = async (username, pin) => {
  const res = await api.post('/login', { username, pin });
  return res.data;
};

// --- INVENTORIES (SEDES) ---
export const fetchInventories = async () => {
  const res = await api.get('/inventories');
  return res.data;
};

// --- PRODUCTS ---
export const fetchProducts = async (search = '') => {
  const res = await api.get(`/products?search=${encodeURIComponent(search)}`);
  return res.data;
  // Retorna array de productos con campo 'inventory' (mapa de stocks) y 'total_quantity'
};

export const createProduct = async (formData) => {
  const res = await api.post('/products', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
};

// --- STOCK ADJUSTMENTS ---
export const adjustStock = async (product_id, inventory_id, quantity, type) => {
  // type: 'set', 'add', 'subtract'
  const res = await api.post('/inventory/adjustment', {
    product_id,
    inventory_id,
    quantity,
    type
  });
  return res.data;
};

export const fetchSettings = async () => {
  const res = await api.get('/settings');
  return res.data;
};

// --- INVENTORY CRUD ---

export const createInventory = async (name) => {
  const res = await api.post('/inventories', { name });
  return res.data;
};

export const deleteInventory = async (id) => {
  await api.delete(`/inventories/${id}`);
};

// Product CRUD (Advanced)
export const updateProduct = async (id, formData) => {
  const res = await api.put(`/products/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
};

export const deleteProduct = async (id) => {
  await api.delete(`/products/${id}`);
};

export const restoreBackup = async (backupData) => {
  const res = await api.post('/restore-json', backupData);
  return res.data;
};

// Migration
export const migrateLegacyData = async () => {
  const res = await api.post('/admin/migrate-legacy');
  return res.data;
};

export const uploadMnxFile = async (formData) => {
  const res = await api.post('/admin/upload-mnx', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return res.data;
};

export const checkLocalMnx = async () => {
  const res = await api.get('/admin/check-mnx');
  return res.data;
};

export const extractLocalMnx = async () => {
  const res = await api.post('/admin/extract-local-mnx');
  return res.data;
};

export default api;
