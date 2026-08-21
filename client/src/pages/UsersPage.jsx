import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { 
  Users, 
  UserPlus, 
  Shield, 
  Crown, 
  ShoppingBag, 
  Check, 
  X, 
  Search, 
  Lock, 
  Unlock, 
  Edit2, 
  Trash2, 
  KeyRound, 
  AlertCircle, 
  CheckCircle2, 
  UserCheck, 
  UserX,
  Sparkles,
  Layers,
  Settings,
  DollarSign,
  Package,
  TrendingUp,
  Store,
  RefreshCw,
  Phone,
  MapPin,
  IdCard,
  Image as ImageIcon,
  FileText
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useRole, ROLES } from '../hooks/useRole';
import api from '../api';
import ImagePickerWithCamera from '../components/ImagePickerWithCamera';

const API_URL = import.meta.env.VITE_API_URL || '/api';

// Definición de Grupos de Permisos
const PERMISSION_GROUPS = [
  {
    category: 'Ventas y Punto de Venta (POS)',
    icon: Store,
    color: 'text-emerald-400',
    permissions: [
      { key: 'pos_sales', label: 'Realizar ventas en POS', desc: 'Permite registrar cobros y emitir tickets' },
      { key: 'pos_discounts', label: 'Aplicar descuentos manuales', desc: 'Permite rebajar precios al cobrar' },
      { key: 'close_shifts', label: 'Cierre de turno / caja', desc: 'Permite realizar el arqueo preliminar al terminar el turno' }
    ]
  },
  {
    category: 'Inventario y Almacén',
    icon: Package,
    color: 'text-amber-400',
    permissions: [
      { key: 'manage_inventory', label: 'Gestión de productos y stock', desc: 'Crear, editar o ajustar existencias' },
      { key: 'view_costs', label: 'Visualizar costos de compra', desc: 'Ver los precios de costo y márgenes de ganancia' },
      { key: 'manage_purchases', label: 'Registrar compras y entradas', desc: 'Ingresar nueva mercancía al almacén central' },
      { key: 'manage_transfers', label: 'Realizar traslados entre sedes', desc: 'Enviar stock de Almacén a Kioscos o entre kioscos' },
      { key: 'manage_losses', label: 'Registrar mermas y bajas', desc: 'Dar de baja productos dañados o perdidos' }
    ]
  },
  {
    category: 'Administración y Finanzas',
    icon: Shield,
    color: 'text-cyan-400',
    permissions: [
      { key: 'audit_cash_registers', label: 'Auditoría de Cajas y Flujos', desc: 'Ver reportes completos de arqueos e ingresos' },
      { key: 'approve_shifts', label: 'Aprobación oficial de cierres', desc: 'Aprobar o rechazar arqueos de vendedores' },
      { key: 'view_analytics', label: 'Ver métricas e informes globales', desc: 'Dashboard financiero y gráficos de rentabilidad' },
      { key: 'manage_users', label: 'Gestión de usuarios y roles', desc: 'Crear vendedores y asignar permisos' },
      { key: 'manage_settings', label: 'Configuración general del negocio', desc: 'Tasas de cambio y backups del sistema' }
    ]
  },
  {
    category: 'Topología Nodal (Nexus)',
    icon: Layers,
    color: 'text-purple-400',
    permissions: [
      { key: 'view_nexus', label: 'Ver mapa de Nexus Node', desc: 'Visualizar la red organizativa del negocio' },
      { key: 'edit_nexus', label: 'Editar arquitectura Nexus', desc: 'Crear, conectar y archivar nodos' }
    ]
  }
];

export default function UsersPage() {
  const [searchParams] = useSearchParams();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Form states
  const [activeTab, setActiveTab] = useState('account'); // 'account' | 'identity' | 'permissions'
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    pin: '',
    role: 'seller',
    authorized_to_work: true,
    dni_number: '',
    phone: '',
    address: '',
    dni_front: null,
    dni_back: null,
    avatar_url: null,
    permissions: {}
  });

  const { isAdmin, isOwner } = useRole();

  // Cargar usuarios
  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/users');
      setUsers(res.data || []);
      return res.data || [];
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      setError(msg);
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers().then((fetchedUsers) => {
      // Si viene por parámetro URL (ej. ?edit=1 o ?name=admin o ?role=owner)
      const editId = searchParams.get('edit');
      const editName = searchParams.get('name');
      const editRole = searchParams.get('role');

      if (fetchedUsers && fetchedUsers.length > 0) {
        let target = null;
        if (editId) {
          target = fetchedUsers.find(u => String(u.id) === String(editId));
        } else if (editName) {
          target = fetchedUsers.find(u => u.username?.toLowerCase() === editName.toLowerCase());
        } else if (editRole) {
          target = fetchedUsers.find(u => u.role?.toLowerCase() === editRole.toLowerCase());
        }

        if (target) {
          openEditModal(target);
        }
      }
    });
  }, [searchParams]);

  const openCreateModal = () => {
    setEditingUser(null);
    setActiveTab('account');
    setFormData({
      username: '',
      email: '',
      pin: '',
      role: 'seller',
      authorized_to_work: true,
      dni_number: '',
      phone: '',
      address: '',
      dni_front: null,
      dni_back: null,
      avatar_url: null,
      permissions: {
        pos_sales: true,
        pos_discounts: false,
        manage_inventory: false,
        view_costs: false,
        manage_purchases: false,
        manage_transfers: false,
        manage_losses: false,
        manage_users: false,
        manage_settings: false,
        view_analytics: false,
        view_nexus: false,
        edit_nexus: false,
        audit_cash_registers: false,
        close_shifts: true,
        approve_shifts: false
      }
    });
    setModalOpen(true);
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setActiveTab('account');
    setFormData({
      username: user.username || '',
      email: user.email || '',
      pin: '', // Dejar vacío salvo que se quiera cambiar
      role: user.role || 'seller',
      authorized_to_work: user.authorized_to_work !== false,
      dni_number: user.dni_number || '',
      phone: user.phone || '',
      address: user.address || '',
      dni_front: user.dni_front || null,
      dni_back: user.dni_back || null,
      avatar_url: user.avatar_url || null,
      permissions: user.permissions || {}
    });
    setModalOpen(true);
  };

  // Manejar cambio rápido de autorización a trabajar (Toggle Switch en tabla)
  const toggleAuthorize = async (user, e) => {
    e.stopPropagation();
    try {
      const nextStatus = !user.authorized_to_work;
      await api.patch(`/users/${user.id}`, { authorized_to_work: nextStatus });
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, authorized_to_work: nextStatus } : u));
    } catch (err) {
      alert('Error: ' + (err.response?.data?.error || err.message));
    }
  };

  // Guardar usuario (Creación o Edición)
  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.username.trim()) {
      alert('Por favor ingresa un nombre de usuario');
      return;
    }

    // Validación de Carnet de Identidad de Cuba (Exactamente 11 dígitos numéricos)
    if (formData.dni_number && formData.dni_number.trim()) {
      const cleanDni = formData.dni_number.trim();
      if (!/^\d{11}$/.test(cleanDni)) {
        alert('El Carnet de Identidad cubano debe tener exactamente 11 dígitos numéricos.');
        return;
      }
    }

    // Validación de Teléfono Móvil de Cuba (+53 5XXXXXXX o 5XXXXXXX)
    if (formData.phone && formData.phone.trim()) {
      const cleanPhone = formData.phone.replace(/[\s\-\(\)]/g, '');
      const cubanPhoneRegex = /^(\+?53)?[56]\d{7}$/;
      if (!cubanPhoneRegex.test(cleanPhone)) {
        alert('El número de teléfono móvil de Cuba debe ser válido (Ejemplo: +53 52123456 o 52123456 de 8 dígitos empezando por 5 o 6).');
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        username: formData.username.trim(),
        email: formData.email.trim() || undefined,
        role: formData.role,
        authorized_to_work: formData.authorized_to_work,
        dni_number: formData.dni_number.trim() || null,
        phone: formData.phone.trim() || null,
        address: formData.address.trim() || null,
        dni_front: formData.dni_front || null,
        dni_back: formData.dni_back || null,
        avatar_url: formData.avatar_url || null,
        permissions: formData.permissions
      };

      if (formData.pin.trim()) {
        payload.pin = formData.pin.trim();
      }

      if (editingUser) {
        await api.patch(`/users/${editingUser.id}`, payload);
      } else {
        await api.post('/users', payload);
      }

      setModalOpen(false);
      loadUsers();
    } catch (err) {
      alert('Error: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  // Eliminar usuario
  const handleDelete = async (user, e) => {
    e.stopPropagation();
    if (user.id === 1) {
      alert('No se puede eliminar el usuario administrador principal.');
      return;
    }

    if (!confirm(`¿Estás seguro de que deseas eliminar al usuario "${user.username}"? Esta acción también removerá su nodo en Nexus.`)) {
      return;
    }

    try {
      await api.delete(`/users/${user.id}`);
      loadUsers();
    } catch (err) {
      alert('Error: ' + (err.response?.data?.error || err.message));
    }
  };

  // Auto-ajustar permisos según el rol seleccionado
  const handleRoleChange = (newRole) => {
    let newPerms = { ...formData.permissions };
    if (newRole === 'owner') {
      PERMISSION_GROUPS.forEach(g => g.permissions.forEach(p => { newPerms[p.key] = true; }));
    } else if (newRole === 'admin') {
      PERMISSION_GROUPS.forEach(g => g.permissions.forEach(p => { 
        newPerms[p.key] = p.key !== 'manage_settings'; 
      }));
    } else {
      // Seller
      PERMISSION_GROUPS.forEach(g => g.permissions.forEach(p => {
        newPerms[p.key] = ['pos_sales', 'close_shifts'].includes(p.key);
      }));
    }

    setFormData(prev => ({
      ...prev,
      role: newRole,
      permissions: newPerms
    }));
  };

  const togglePermission = (permKey) => {
    setFormData(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [permKey]: !prev.permissions[permKey]
      }
    }));
  };

  // Filtrado de usuarios
  const filteredUsers = users.filter(u => {
    const matchesSearch = (u.username || '').toLowerCase().includes(search.toLowerCase()) || 
                          (u.email || '').toLowerCase().includes(search.toLowerCase());
    const matchesRole = selectedRoleFilter === 'all' || u.role?.toLowerCase() === selectedRoleFilter.toLowerCase();
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6">
      {/* Barra de Acciones y Filtros */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-2xl border border-slate-800/80 backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar por usuario o email..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-slate-800/60 p-1 rounded-xl border border-slate-700/60 text-xs">
            {['all', 'owner', 'admin', 'seller'].map((roleKey) => (
              <button
                key={roleKey}
                onClick={() => setSelectedRoleFilter(roleKey)}
                className={cn(
                  'px-3 py-1.5 rounded-lg font-medium transition-all',
                  selectedRoleFilter === roleKey 
                    ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                )}
              >
                {roleKey === 'all' ? 'Todos' : roleKey === 'owner' ? 'Dueños' : roleKey === 'admin' ? 'Administradores' : 'Vendedores'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button 
            onClick={loadUsers} 
            className="p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
            title="Recargar usuarios"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin text-cyan-400")} />
          </button>
          
          <button
            onClick={openCreateModal}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium text-sm shadow-lg shadow-cyan-500/25 transition-all"
          >
            <UserPlus className="w-4 h-4" />
            <span>Nuevo Usuario</span>
          </button>
        </div>
      </div>

      {/* Tabla / Tarjetas de Usuarios */}
      {loading && users.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-slate-900/40 rounded-2xl border border-slate-800">
          <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mb-3" />
          <p className="text-slate-400 text-sm">Cargando personal y permisos...</p>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center p-12 bg-slate-900/40 rounded-2xl border border-slate-800">
          <Users className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-white font-semibold text-base mb-1">No se encontraron usuarios</h3>
          <p className="text-slate-400 text-xs">Ajusta el filtro de búsqueda o crea un nuevo usuario.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredUsers.map((u) => {
            const isUOwner = ['owner', 'dueño'].includes(u.role?.toLowerCase());
            const isUAdmin = ['admin', 'administrador', 'administrator'].includes(u.role?.toLowerCase());
            const roleLabel = isUOwner ? 'Dueño' : isUAdmin ? 'Administrador' : 'Vendedor';
            const roleColor = isUOwner ? 'text-amber-400 border-amber-500/30 bg-amber-500/10' : isUAdmin ? 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10' : 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
            const RoleIcon = isUOwner ? Crown : isUAdmin ? Shield : ShoppingBag;

            // Cantidad de permisos activos
            const activePermsCount = Object.values(u.permissions || {}).filter(Boolean).length;

            return (
              <motion.div
                key={u.id}
                layout
                whileHover={{ scale: 1.01 }}
                className={cn(
                  "relative p-5 rounded-2xl border transition-all duration-200 backdrop-blur-md flex flex-col justify-between",
                  u.authorized_to_work 
                    ? "bg-slate-900/70 border-slate-800 hover:border-slate-700 shadow-xl" 
                    : "bg-slate-950/80 border-rose-950/40 opacity-75"
                )}
              >
                {/* Header Card */}
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {u.avatar_url ? (
                        <img 
                          src={u.avatar_url.startsWith('http') ? u.avatar_url : `http://localhost:3002${u.avatar_url}`}
                          alt={u.username}
                          className="w-10 h-10 rounded-xl object-cover border border-slate-700 flex-shrink-0"
                        />
                      ) : (
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center border flex-shrink-0", roleColor)}>
                          <RoleIcon className="w-5 h-5" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <h3 className="text-white font-bold text-base truncate flex items-center gap-2">
                          {u.username}
                          {u.id === 1 && (
                            <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700">Root</span>
                          )}
                        </h3>
                        <p className="text-slate-400 text-xs truncate">{u.email}</p>
                      </div>
                    </div>

                    <span className={cn("px-2.5 py-1 rounded-lg text-xs font-semibold border flex items-center gap-1.5", roleColor)}>
                      <RoleIcon className="w-3.5 h-3.5" />
                      {roleLabel}
                    </span>
                  </div>

                  {/* Switch Autorizado a Trabajar */}
                  <div className="my-4 p-3 rounded-xl bg-slate-800/40 border border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {u.authorized_to_work ? (
                        <UserCheck className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <UserX className="w-4 h-4 text-rose-400" />
                      )}
                      <div>
                        <p className="text-xs font-semibold text-white">Autorizado a Trabajar</p>
                        <p className="text-[10px] text-slate-400">
                          {u.authorized_to_work ? 'Acceso activo al sistema y POS' : 'Acceso bloqueado / suspendido'}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={(e) => toggleAuthorize(u, e)}
                      className={cn(
                        "relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-cyan-500",
                        u.authorized_to_work ? "bg-emerald-500" : "bg-slate-700"
                      )}
                    >
                      <span 
                        className={cn(
                          "absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform duration-200 shadow-md",
                          u.authorized_to_work ? "translate-x-5" : "translate-x-0"
                        )} 
                      />
                    </button>
                  </div>

                  {/* Resumen de Permisos */}
                  <div className="grid grid-cols-2 gap-2 text-xs mb-4">
                    <div className="p-2 rounded-lg bg-slate-800/30 border border-slate-800/60">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Permisos</p>
                      <p className="text-white font-bold">{activePermsCount} activos</p>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-800/30 border border-slate-800/60">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">PIN de Acceso</p>
                      <p className="text-white font-mono">{u.pin || 'Configurado'}</p>
                    </div>
                  </div>
                </div>

                {/* Acciones */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">
                    ID: #{u.id} • {u.role}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => openEditModal(u)}
                      className="px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-xs font-medium border border-cyan-500/30 flex items-center gap-1.5 transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      Configurar
                    </button>

                    {u.id !== 1 && (
                      <button
                        onClick={(e) => handleDelete(u, e)}
                        className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-colors"
                        title="Eliminar usuario"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Modal de Configuración / Creación de Usuario y Permisos */}
      <AnimatePresence>
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                    {editingUser ? <Edit2 className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">
                      {editingUser ? `Configurar: ${editingUser.username}` : 'Crear Nuevo Usuario'}
                    </h2>
                    <p className="text-xs text-slate-400">
                      Asigna rol, credenciales y matriz granular de permisos
                    </p>
                  </div>
                </div>

                <button 
                  onClick={() => setModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleSave} className="p-6 space-y-6 max-h-[calc(85vh-120px)] overflow-y-auto custom-scrollbar">
                {/* Tabs de Navegación del Modal */}
                <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                  <button
                    type="button"
                    onClick={() => setActiveTab('account')}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all",
                      activeTab === 'account'
                        ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/25"
                        : "text-slate-400 hover:text-white hover:bg-slate-800"
                    )}
                  >
                    <Shield className="w-4 h-4" />
                    <span>Cuenta y Rol</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('identity')}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all",
                      activeTab === 'identity'
                        ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/25"
                        : "text-slate-400 hover:text-white hover:bg-slate-800"
                    )}
                  >
                    <IdCard className="w-4 h-4" />
                    <span>Carnet de Identidad y Perfil</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('permissions')}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all",
                      activeTab === 'permissions'
                        ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/25"
                        : "text-slate-400 hover:text-white hover:bg-slate-800"
                    )}
                  >
                    <KeyRound className="w-4 h-4" />
                    <span>Permisos Granulares</span>
                  </button>
                </div>

                {/* TAB 1: Cuenta y Rol */}
                {activeTab === 'account' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                          Nombre de Usuario *
                        </label>
                        <input 
                          type="text" 
                          required
                          placeholder="Ej. Keila"
                          value={formData.username}
                          onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                          className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                          Correo Electrónico (Opcional)
                        </label>
                        <input 
                          type="email" 
                          placeholder="usuario@mch.local"
                          value={formData.email}
                          onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                          className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                          PIN de Seguridad POS {editingUser && '(Dejar vacío para mantener)'}
                        </label>
                        <div className="relative">
                          <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input 
                            type="text" 
                            maxLength={6}
                            placeholder={editingUser ? "••••" : "Ej. 1234"}
                            value={formData.pin}
                            onChange={(e) => setFormData(prev => ({ ...prev, pin: e.target.value }))}
                            className="w-full bg-slate-800/90 border border-slate-700 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                          Rol Asignado
                        </label>
                        <select
                          value={formData.role}
                          onChange={(e) => handleRoleChange(e.target.value)}
                          className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                        >
                          <option value="seller">Vendedor</option>
                          <option value="admin">Administrador</option>
                          <option value="owner">Dueño</option>
                        </select>
                      </div>
                    </div>

                    {/* Switch Autorizado a Trabajar */}
                    <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/60 flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                          <UserCheck className="w-4 h-4 text-cyan-400" />
                          Autorizado a Trabajar
                        </h4>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Habilita o suspende temporalmente la cuenta sin necesidad de borrarla
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, authorized_to_work: !prev.authorized_to_work }))}
                        className={cn(
                          "relative w-12 h-6 rounded-full transition-colors duration-200",
                          formData.authorized_to_work ? "bg-emerald-500" : "bg-slate-700"
                        )}
                      >
                        <span 
                          className={cn(
                            "absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform duration-200 shadow-md",
                            formData.authorized_to_work ? "translate-x-6" : "translate-x-0"
                          )} 
                        />
                      </button>
                    </div>
                  </div>
                )}

                {/* TAB 2: Carnet de Identidad y Perfil */}
                {activeTab === 'identity' && (
                  <div className="space-y-6">
                    {/* Foto de Perfil / Avatar */}
                    <ImagePickerWithCamera
                      label="Foto de Perfil / Avatar"
                      subLabel="Visible en el POS, tickets y barra de navegación"
                      value={formData.avatar_url}
                      type="avatar"
                      aspectRatio="square"
                      onChange={(url) => setFormData(prev => ({ ...prev, avatar_url: url }))}
                      onRemove={() => setFormData(prev => ({ ...prev, avatar_url: null }))}
                    />

                    {/* Datos de Contacto y Carnet */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                            <IdCard className="w-3.5 h-3.5 text-cyan-400" />
                            Carnet de Identidad (Cuba)
                          </label>
                          <span className={cn(
                            "text-[10px] font-mono",
                            formData.dni_number && formData.dni_number.replace(/\D/g, '').length === 11 
                              ? "text-emerald-400" 
                              : formData.dni_number ? "text-amber-400" : "text-slate-500"
                          )}>
                            {formData.dni_number ? `${formData.dni_number.replace(/\D/g, '').length}/11 dígitos` : '11 dígitos'}
                          </span>
                        </div>
                        <input 
                          type="text" 
                          maxLength={11}
                          placeholder="Ej. 95081234567"
                          value={formData.dni_number}
                          onChange={(e) => setFormData(prev => ({ ...prev, dni_number: e.target.value.replace(/\D/g, '').slice(0, 11) }))}
                          className={cn(
                            "w-full bg-slate-800/90 border rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none font-mono transition-colors",
                            formData.dni_number && formData.dni_number.length === 11 
                              ? "border-emerald-500/60 focus:border-emerald-400" 
                              : formData.dni_number ? "border-amber-500/50 focus:border-amber-400" : "border-slate-700 focus:border-cyan-500"
                          )}
                        />
                        {formData.dni_number && formData.dni_number.length > 0 && formData.dni_number.length < 11 && (
                          <p className="text-[10px] text-amber-400 mt-1">
                            Debe tener exactamente 11 dígitos (faltan {11 - formData.dni_number.length}).
                          </p>
                        )}
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-emerald-400" />
                            Teléfono Celular
                          </label>
                          <span className="text-[10px] text-slate-500">Móvil Cuba (+53)</span>
                        </div>
                        <input 
                          type="text" 
                          placeholder="+53 52123456"
                          value={formData.phone}
                          onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                          className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-amber-400" />
                          Dirección Particular
                        </label>
                        <input 
                          type="text" 
                          placeholder="Calle, Número, e/ Calles, Municipio, Provincia"
                          value={formData.address}
                          onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                          className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                    </div>

                    {/* Carnet de Identidad Frente y Dorso */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                        <FileText className="w-4 h-4 text-cyan-400" />
                        Fotos del Carnet de Identidad (Frente y Dorso)
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Podés tomar la foto en vivo con la cámara o elegirla desde la galería/archivos.
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                        <ImagePickerWithCamera
                          label="Carnet de Identidad (Frente)"
                          subLabel="Foto nítida del frente con datos y foto"
                          value={formData.dni_front}
                          type="dni_front"
                          aspectRatio="video"
                          onChange={(url) => setFormData(prev => ({ ...prev, dni_front: url }))}
                          onRemove={() => setFormData(prev => ({ ...prev, dni_front: null }))}
                        />

                        <ImagePickerWithCamera
                          label="Carnet de Identidad (Dorso)"
                          subLabel="Foto nítida del reverso con dirección"
                          value={formData.dni_back}
                          type="dni_back"
                          aspectRatio="video"
                          onChange={(url) => setFormData(prev => ({ ...prev, dni_back: url }))}
                          onRemove={() => setFormData(prev => ({ ...prev, dni_back: null }))}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 3: Permisos Granulares */}
                {activeTab === 'permissions' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <Shield className="w-4 h-4 text-cyan-400" />
                        Permisos y Accesos por Módulo
                      </h3>
                      <span className="text-xs text-slate-400">
                        Rol: <strong className="text-cyan-400 uppercase">{formData.role}</strong>
                      </span>
                    </div>

                    <div className="space-y-4">
                      {PERMISSION_GROUPS.map((group, gIdx) => {
                        const Icon = group.icon;
                        return (
                          <div key={gIdx} className="bg-slate-950/40 rounded-xl border border-slate-800/80 p-3.5 space-y-2.5">
                            <div className="flex items-center gap-2 mb-1">
                              <Icon className={cn("w-4 h-4", group.color)} />
                              <h4 className="text-xs font-bold text-slate-300">{group.category}</h4>
                            </div>

                            <div className="space-y-2">
                              {group.permissions.map((p) => {
                                const isChecked = Boolean(formData.permissions[p.key]);
                                return (
                                  <label 
                                    key={p.key}
                                    onClick={() => togglePermission(p.key)}
                                    className={cn(
                                      "flex items-start justify-between p-2.5 rounded-lg border cursor-pointer transition-all",
                                      isChecked 
                                        ? "bg-slate-800/80 border-cyan-500/30 text-white" 
                                        : "bg-slate-900/30 border-slate-800/40 text-slate-400 hover:bg-slate-800/40"
                                    )}
                                  >
                                    <div className="pr-3">
                                      <p className="text-xs font-semibold">{p.label}</p>
                                      <p className="text-[11px] text-slate-500 leading-tight mt-0.5">{p.desc}</p>
                                    </div>

                                    <div className={cn(
                                      "w-5 h-5 rounded-md flex items-center justify-center border transition-colors flex-shrink-0 mt-0.5",
                                      isChecked ? "bg-cyan-500 border-cyan-400 text-white" : "border-slate-700 bg-slate-800"
                                    )}>
                                      {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Footer del Form */}
                <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3 sticky bottom-0 bg-slate-900/95 py-2 backdrop-blur-md">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium text-xs shadow-lg shadow-cyan-500/25 transition-all disabled:opacity-50"
                  >
                    {saving ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Guardando...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>{editingUser ? 'Guardar Cambios' : 'Crear Usuario'}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
