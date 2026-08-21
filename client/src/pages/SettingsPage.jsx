import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Settings,
    Plus,
    Edit2,
    Trash2,
    Save,
    X,
    Receipt,
    AlertCircle,
    DollarSign,
    RefreshCw,
    Globe,
    TrendingUp,
    Database,
    Download,
    Upload,
    Archive,
    RotateCcw,
    FileArchive,
    HardDriveDownload
} from 'lucide-react';
import { cn } from '../lib/utils';
const API_URL = import.meta.env.VITE_API_URL || '/api';

export default function SettingsPage() {
    const [expenseTypes, setExpenseTypes] = useState([]);
    const [settings, setSettings] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [isCreating, setIsCreating] = useState(false);
    const [formData, setFormData] = useState({ name: '', amount: '' });
    
    // Currency settings
    const [currencyRates, setCurrencyRates] = useState({
        RATE_USD_MN: 550,
        RATE_MXN_USD: 19,
        RATE_EUR_MN: 590,
        RATE_MXN_MN: 17.30,
        MARGIN_MULTIPLIER: 3.5
    });
    const [savingRates, setSavingRates] = useState(false);

    // Backup states
    const [backups, setBackups] = useState([]);
    const [backupLoading, setBackupLoading] = useState(false);
    const [backupError, setBackupError] = useState(null);
    const [backupSuccess, setBackupSuccess] = useState(null);
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [restoreFile, setRestoreFile] = useState(null);

    // Selective Reset states
    const [showSelectiveResetModal, setShowSelectiveResetModal] = useState(false);
    const [selectiveResetConfig, setSelectiveResetConfig] = useState({
        inventoryId: 'all',
        clearSales: false,
        clearPurchases: false,
        clearTransfers: false,
        clearLosses: false,
        clearInventory: false
    });
    const [inventoriesList, setInventoriesList] = useState([]);

    // Cargar datos
    const fetchData = async () => {
        try {
            const [expenseRes, settingsRes, invRes] = await Promise.all([
                fetch(`${API_URL}/expense-types`),
                fetch(`${API_URL}/settings`),
                fetch(`${API_URL}/inventories`)
            ]);
            
            if (!expenseRes.ok) throw new Error('Error al cargar tipos de gasto');
            if (!settingsRes.ok) throw new Error('Error al cargar configuración');
            
            const expenseData = await expenseRes.json();
            const settingsData = await settingsRes.json();
            const invData = invRes.ok ? await invRes.json() : [];
            
            setExpenseTypes(expenseData);
            setSettings(settingsData);
            setInventoriesList(invData);
            setCurrencyRates({
                RATE_USD_MN: settingsData.RATE_USD_MN || 550,
                RATE_MXN_USD: settingsData.RATE_MXN_USD || 19,
                RATE_EUR_MN: settingsData.RATE_EUR_MN || 590,
                RATE_MXN_MN: settingsData.RATE_MXN_MN || 17.30,
                MARGIN_MULTIPLIER: settingsData.MARGIN_MULTIPLIER || 3.5
            });
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Guardar tasas de cambio
    const handleSaveRates = async () => {
        setSavingRates(true);
        try {
            const response = await fetch(`${API_URL}/settings`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(currencyRates)
            });
            
            if (!response.ok) throw new Error('Error al guardar tasas de cambio');
            
            alert('Tasas de cambio actualizadas correctamente');
        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            setSavingRates(false);
        }
    };

    // Crear nuevo tipo de gasto
    const handleCreate = async () => {
        if (!formData.name.trim() || !formData.amount) {
            alert('Por favor complete todos los campos');
            return;
        }

        try {
            const response = await fetch(`${API_URL}/expense-types`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: formData.name.trim(),
                    amount: parseFloat(formData.amount),
                    payment_method: 'cash'
                })
            });

            if (!response.ok) throw new Error('Error al crear tipo de gasto');
            
            await fetchData();
            setIsCreating(false);
            setFormData({ name: '', amount: '' });
        } catch (err) {
            alert('Error: ' + err.message);
        }
    };

    // Actualizar tipo de gasto
    const handleUpdate = async (id) => {
        if (!formData.name.trim() || !formData.amount) {
            alert('Por favor complete todos los campos');
            return;
        }

        try {
            const response = await fetch(`${API_URL}/expense-types/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: formData.name.trim(),
                    amount: parseFloat(formData.amount),
                    is_active: 1,
                    payment_method: 'cash'
                })
            });

            if (!response.ok) throw new Error('Error al actualizar tipo de gasto');
            
            await fetchData();
            setEditingId(null);
            setFormData({ name: '', amount: '' });
        } catch (err) {
            alert('Error: ' + err.message);
        }
    };

    // Eliminar tipo de gasto
    const handleDelete = async (id) => {
        if (!confirm('¿Está seguro de eliminar este tipo de gasto?')) return;

        try {
            const response = await fetch(`${API_URL}/expense-types/${id}`, {
                method: 'DELETE'
            });

            if (!response.ok) throw new Error('Error al eliminar tipo de gasto');
            
            await fetchData();
        } catch (err) {
            alert('Error: ' + err.message);
        }
    };

    const startEdit = (item) => {
        setEditingId(item.id);
        setFormData({ name: item.name, amount: item.amount.toString() });
    };

    const cancelEdit = () => {
        setEditingId(null);
        setIsCreating(false);
        setFormData({ name: '', amount: '' });
    };

    // ==================== BACKUP FUNCTIONS ====================
    const fetchBackups = async () => {
        setBackupLoading(true);
        setBackupError(null);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/backup/list`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Error al cargar backups');
            const data = await res.json();
            setBackups(data);
        } catch (e) {
            setBackupError(e.message);
        } finally {
            setBackupLoading(false);
        }
    };

    const createBackup = async () => {
        setBackupLoading(true);
        setBackupError(null);
        setBackupSuccess(null);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/backup/create`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Error al crear backup');
            const data = await res.json();
            setBackupSuccess(`Backup creado: ${data.filename} (${data.sizeFormatted})`);
            fetchBackups();
        } catch (e) {
            setBackupError(e.message);
        } finally {
            setBackupLoading(false);
        }
    };

    const restoreBackup = async (filename) => {
        if (!confirm(`¿Estás seguro de restaurar el backup "${filename}"? Esto reemplazará TODOS los datos actuales. El servidor se reiniciará.`)) return;
        setBackupLoading(true);
        setBackupError(null);
        setBackupSuccess(null);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/backup/restore/${filename}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Error al restaurar backup');
            const data = await res.json();
            setBackupSuccess(`${data.message} El servidor se reiniciará en unos segundos.`);
        } catch (e) {
            setBackupError(e.message);
        } finally {
            setBackupLoading(false);
        }
    };

    const restoreFromFile = async () => {
        if (!restoreFile) return;
        if (!confirm('¿Estás seguro de restaurar desde este archivo? Esto reemplazará TODOS los datos actuales. El servidor se reiniciará.')) return;
        setBackupLoading(true);
        setBackupError(null);
        setBackupSuccess(null);
        try {
            const token = localStorage.getItem('token');
            const formData = new FormData();
            formData.append('backup', restoreFile);
            const res = await fetch(`${API_URL}/backup/restore`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            if (!res.ok) throw new Error('Error al restaurar backup');
            const data = await res.json();
            setBackupSuccess(`${data.message} El servidor se reiniciará en unos segundos.`);
            setRestoreFile(null);
        } catch (e) {
            setBackupError(e.message);
        } finally {
            setBackupLoading(false);
        }
    };

    const deleteBackup = async (filename) => {
        if (!confirm(`¿Eliminar el backup "${filename}"?`)) return;
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/backup/${filename}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Error al eliminar backup');
            fetchBackups();
        } catch (e) {
            setBackupError(e.message);
        }
    };

    const downloadBackup = async (filename) => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/backup/download/${filename}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Error al descargar backup');
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            setBackupError(e.message);
        }
    };

    const executeSelectiveReset = async () => {
        const { clearSales, clearPurchases, clearTransfers, clearLosses, clearInventory, inventoryId } = selectiveResetConfig;
        if (!clearSales && !clearPurchases && !clearTransfers && !clearLosses && !clearInventory) {
            alert('Por favor selecciona al menos una categoría para resetear.');
            return;
        }

        const invLabel = inventoryId === 'all' ? 'TODO EL SISTEMA (Global)' : (inventoriesList.find(i => i.id === inventoryId)?.name || inventoryId);
        
        let msg = `⚠️ CONFIRMACIÓN DE LIMPIEZA / RESET\n\nUbicación seleccionada: ${invLabel}\n\nSe borrará permanentemente:\n`;
        if (clearSales) msg += '• Historial de Ventas y Sesiones de Caja\n';
        if (clearPurchases) msg += '• Historial de Entradas / Compras\n';
        if (clearTransfers) msg += '• Historial de Traslados\n';
        if (clearLosses) msg += '• Mermas y Pérdidas\n';
        if (clearInventory) {
            if (inventoryId === 'all') msg += '• Catálogo completo de Productos y Existencias\n';
            else msg += `• Poner en 0 las existencias del inventario ${invLabel}\n`;
        }
        msg += '\nSe creará un respaldo de seguridad automático antes de ejecutar.\n¿Deseas continuar?';

        if (!confirm(msg)) return;

        setBackupLoading(true);
        setBackupError(null);
        setBackupSuccess(null);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/backup/selective-reset`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(selectiveResetConfig)
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || 'Error al ejecutar reseteo selectivo');
            }

            const data = await res.json();
            setBackupSuccess(`${data.message} | Respaldo de seguridad creado: ${data.safetyBackup}`);
            setShowSelectiveResetModal(false);
            fetchBackups();
            alert(`✅ ${data.message}\n\n🛡️ Respaldo de seguridad creado:\n${data.safetyBackup}`);
        } catch (e) {
            setBackupError(e.message);
            alert(`❌ Error al ejecutar la limpieza:\n${e.message}`);
        } finally {
            setBackupLoading(false);
        }
    };

    const resetDatabase = async () => {
        if (!confirm('¿ESTÁS TOTALMENTE SEGURO? Esto BORRARÁ todos los productos, ventas, sesiones e imágenes. Se conservará el usuario admin, inventarios y tipos de gastos. Se creará un backup de seguridad automáticamente.')) return;
        if (!confirm('ÚLTIMA CONFIRMACIÓN: ¿Borrar TODO y empezar de cero?')) return;
        setBackupLoading(true);
        setBackupError(null);
        setBackupSuccess(null);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/backup/reset`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Error al resetear');
            const data = await res.json();
            setBackupSuccess(`Base de datos reseteada. Backup de seguridad: ${data.safetyBackup}`);
            setShowResetConfirm(false);
            fetchBackups();
        } catch (e) {
            setBackupError(e.message);
        } finally {
            setBackupLoading(false);
        }
    };

    // Cargar backups al montar
    useEffect(() => {
        fetchBackups();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full"
                />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold gradient-text">Configuración</h1>
                    <p className="text-muted-foreground">
                        Gestiona los tipos de gastos y tasas de cambio del sistema
                    </p>
                </div>
            </div>

            {/* Currency Settings Section */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="glass rounded-2xl p-6"
            >
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600">
                        <Globe className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold">Tasas de Cambio</h2>
                        <p className="text-sm text-muted-foreground">
                            Configure las tasas de conversión entre monedas
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                    {/* USD to MN */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground">
                            1 USD = ? MN
                        </label>
                        <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                                type="number"
                                value={currencyRates.RATE_USD_MN}
                                onChange={(e) => setCurrencyRates({ ...currencyRates, RATE_USD_MN: parseFloat(e.target.value) || 0 })}
                                className="w-full pl-9 pr-3 py-2 rounded-lg bg-background border border-border focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
                                step="0.01"
                            />
                        </div>
                    </div>

                    {/* MXN to USD */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground">
                            1 MXN = ? USD
                        </label>
                        <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                                type="number"
                                value={currencyRates.RATE_MXN_USD}
                                onChange={(e) => setCurrencyRates({ ...currencyRates, RATE_MXN_USD: parseFloat(e.target.value) || 0 })}
                                className="w-full pl-9 pr-3 py-2 rounded-lg bg-background border border-border focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
                                step="0.01"
                            />
                        </div>
                    </div>

                    {/* EUR to MN */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground">
                            1 EUR = ? MN
                        </label>
                        <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                                type="number"
                                value={currencyRates.RATE_EUR_MN}
                                onChange={(e) => setCurrencyRates({ ...currencyRates, RATE_EUR_MN: parseFloat(e.target.value) || 0 })}
                                className="w-full pl-9 pr-3 py-2 rounded-lg bg-background border border-border focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
                                step="0.01"
                            />
                        </div>
                    </div>

                    {/* MXN to MN */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground">
                            1 MXN = ? MN
                        </label>
                        <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                                type="number"
                                value={currencyRates.RATE_MXN_MN}
                                onChange={(e) => setCurrencyRates({ ...currencyRates, RATE_MXN_MN: parseFloat(e.target.value) || 0 })}
                                className="w-full pl-9 pr-3 py-2 rounded-lg bg-background border border-border focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
                                step="0.01"
                            />
                        </div>
                    </div>

                    {/* Margin Multiplier */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground">
                            Multiplicador de Margen
                        </label>
                        <div className="relative">
                            <TrendingUp className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                                type="number"
                                value={currencyRates.MARGIN_MULTIPLIER}
                                onChange={(e) => setCurrencyRates({ ...currencyRates, MARGIN_MULTIPLIER: parseFloat(e.target.value) || 0 })}
                                className="w-full pl-9 pr-3 py-2 rounded-lg bg-background border border-border focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
                                step="0.1"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleSaveRates}
                        disabled={savingRates}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all",
                            "bg-gradient-to-r from-emerald-500 to-teal-500 text-white",
                            "hover:shadow-lg hover:shadow-emerald-500/25",
                            "disabled:opacity-50 disabled:cursor-not-allowed"
                        )}
                    >
                        {savingRates ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                            <Save className="w-4 h-4" />
                        )}
                        Guardar Tasas
                    </motion.button>
                </div>
            </motion.div>

            {/* Expense Types Section */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="glass rounded-2xl p-6"
            >
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600">
                            <Receipt className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold">Tipos de Gastos</h2>
                            <p className="text-sm text-muted-foreground">
                                Configure los gastos predefinidos que aparecerán en el POS
                            </p>
                        </div>
                    </div>
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setIsCreating(true)}
                        disabled={isCreating}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all",
                            "bg-gradient-to-r from-cyan-500 to-blue-500 text-white",
                            "hover:shadow-lg hover:shadow-cyan-500/25",
                            "disabled:opacity-50 disabled:cursor-not-allowed"
                        )}
                    >
                        <Plus className="w-4 h-4" />
                        Nuevo Gasto
                    </motion.button>
                </div>

                {error && (
                    <div className="mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-red-400">
                        <AlertCircle className="w-5 h-5" />
                        {error}
                    </div>
                )}

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-border/50">
                                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                                    Nombre del Gasto
                                </th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                                    Monto (MN)
                                </th>
                                <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">
                                    Acciones
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <AnimatePresence mode="popLayout">
                                {/* Create Row */}
                                {isCreating && (
                                    <motion.tr
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="border-b border-border/30 bg-cyan-500/5"
                                    >
                                        <td className="py-3 px-4">
                                            <input
                                                type="text"
                                                value={formData.name}
                                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                placeholder="Ej: Limpieza"
                                                className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
                                                autoFocus
                                            />
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="relative">
                                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                                <input
                                                    type="number"
                                                    value={formData.amount}
                                                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                                    placeholder="0.00"
                                                    className="w-full pl-9 pr-3 py-2 rounded-lg bg-background border border-border focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
                                                />
                                            </div>
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="flex items-center justify-end gap-2">
                                                <motion.button
                                                    whileHover={{ scale: 1.05 }}
                                                    whileTap={{ scale: 0.95 }}
                                                    onClick={handleCreate}
                                                    className="p-2 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
                                                    title="Guardar"
                                                >
                                                    <Save className="w-4 h-4" />
                                                </motion.button>
                                                <motion.button
                                                    whileHover={{ scale: 1.05 }}
                                                    whileTap={{ scale: 0.95 }}
                                                    onClick={cancelEdit}
                                                    className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                                                    title="Cancelar"
                                                >
                                                    <X className="w-4 h-4" />
                                                </motion.button>
                                            </div>
                                        </td>
                                    </motion.tr>
                                )}

                                {/* Data Rows */}
                                {expenseTypes.map((item) => (
                                    <motion.tr
                                        key={item.id}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className={cn(
                                            "border-b border-border/30 hover:bg-secondary/30 transition-colors",
                                            editingId === item.id && "bg-cyan-500/5"
                                        )}
                                    >
                                        {editingId === item.id ? (
                                            <>
                                                <td className="py-3 px-4">
                                                    <input
                                                        type="text"
                                                        value={formData.name}
                                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                        className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
                                                        autoFocus
                                                    />
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="relative">
                                                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                                        <input
                                                            type="number"
                                                            value={formData.amount}
                                                            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                                            className="w-full pl-9 pr-3 py-2 rounded-lg bg-background border border-border focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
                                                        />
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <motion.button
                                                            whileHover={{ scale: 1.05 }}
                                                            whileTap={{ scale: 0.95 }}
                                                            onClick={() => handleUpdate(item.id)}
                                                            className="p-2 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
                                                            title="Guardar"
                                                        >
                                                            <Save className="w-4 h-4" />
                                                        </motion.button>
                                                        <motion.button
                                                            whileHover={{ scale: 1.05 }}
                                                            whileTap={{ scale: 0.95 }}
                                                            onClick={cancelEdit}
                                                            className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                                                            title="Cancelar"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </motion.button>
                                                    </div>
                                                </td>
                                            </>
                                        ) : (
                                            <>
                                                <td className="py-3 px-4 font-medium">{item.name}</td>
                                                <td className="py-3 px-4 text-muted-foreground">
                                                    ${item.amount.toFixed(2)}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <motion.button
                                                            whileHover={{ scale: 1.05 }}
                                                            whileTap={{ scale: 0.95 }}
                                                            onClick={() => startEdit(item)}
                                                            className="p-2 rounded-lg hover:bg-secondary transition-colors"
                                                            title="Editar"
                                                        >
                                                            <Edit2 className="w-4 h-4" />
                                                        </motion.button>
                                                        <motion.button
                                                            whileHover={{ scale: 1.05 }}
                                                            whileTap={{ scale: 0.95 }}
                                                            onClick={() => handleDelete(item.id)}
                                                            className="p-2 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors"
                                                            title="Eliminar"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </motion.button>
                                                    </div>
                                                </td>
                                            </>
                                        )}
                                    </motion.tr>
                                ))}
                            </AnimatePresence>
                        </tbody>
                    </table>
                </div>
            </motion.div>

            {/* ==================== BACKUP / RESTORE SECTION ==================== */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="glass rounded-2xl p-6"
            >
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600">
                        <Database className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold">Backup y Restauración</h2>
                        <p className="text-sm text-muted-foreground">
                            Crea, descarga y restaura backups completos del sistema
                        </p>
                    </div>
                </div>

                {/* Alertas */}
                {backupError && (
                    <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        {backupError}
                    </div>
                )}
                {backupSuccess && (
                    <div className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-500 text-sm flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 flex-shrink-0" />
                        {backupSuccess}
                    </div>
                )}

                {/* Acciones principales */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    {/* Crear backup */}
                    <button
                        onClick={createBackup}
                        disabled={backupLoading}
                        className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 hover:border-cyan-500/40 transition-all disabled:opacity-50"
                    >
                        <div className="p-3 rounded-xl bg-cyan-500/20">
                            <Archive className="w-6 h-6 text-cyan-400" />
                        </div>
                        <div className="text-center">
                            <div className="font-semibold text-sm">Crear Backup</div>
                            <div className="text-xs text-muted-foreground">Inventario, ventas, usuarios, imágenes</div>
                        </div>
                    </button>

                    {/* Restaurar desde archivo */}
                    <label className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 hover:border-amber-500/40 transition-all cursor-pointer">
                        <div className="p-3 rounded-xl bg-amber-500/20">
                            <Upload className="w-6 h-6 text-amber-400" />
                        </div>
                        <div className="text-center">
                            <div className="font-semibold text-sm">Restaurar desde Archivo</div>
                            <div className="text-xs text-muted-foreground">Subir un backup .zip</div>
                        </div>
                        <input
                            type="file"
                            accept=".zip"
                            className="hidden"
                            onChange={(e) => {
                                if (e.target.files[0]) {
                                    setRestoreFile(e.target.files[0]);
                                    setTimeout(() => restoreFromFile(), 100);
                                }
                            }}
                        />
                    </label>

                    {/* Resetear Selectivo / Modular */}
                    <button
                        onClick={() => setShowSelectiveResetModal(true)}
                        disabled={backupLoading}
                        className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-orange-500/20 hover:border-orange-500/40 transition-all disabled:opacity-50"
                    >
                        <div className="p-3 rounded-xl bg-orange-500/20">
                            <RotateCcw className="w-6 h-6 text-orange-400" />
                        </div>
                        <div className="text-center">
                            <div className="font-semibold text-sm">Limpieza / Reset Selectivo</div>
                            <div className="text-xs text-muted-foreground">Elegir qué módulos y ubicación borrar</div>
                        </div>
                    </button>

                    {/* Resetear DB Total */}
                    <button
                        onClick={resetDatabase}
                        disabled={backupLoading}
                        className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gradient-to-br from-red-500/10 to-rose-500/10 border border-red-500/20 hover:border-red-500/40 transition-all disabled:opacity-50"
                    >
                        <div className="p-3 rounded-xl bg-red-500/20">
                            <Trash2 className="w-6 h-6 text-red-400" />
                        </div>
                        <div className="text-center">
                            <div className="font-semibold text-sm">Reset Total de Fábrica</div>
                            <div className="text-xs text-muted-foreground">Borra todo (crea backup automático)</div>
                        </div>
                    </button>
                </div>

                {/* Loading indicator */}
                {backupLoading && (
                    <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span className="text-sm">Procesando...</span>
                    </div>
                )}

                {/* Lista de backups existentes */}
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <HardDriveDownload className="w-4 h-4 text-muted-foreground" />
                        <h3 className="text-sm font-semibold">Backups Disponibles</h3>
                        <span className="text-xs text-muted-foreground">({backups.length})</span>
                    </div>

                    {backups.length === 0 ? (
                        <div className="text-center py-6 text-muted-foreground text-sm">
                            <FileArchive className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            No hay backups creados todavía
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                            {backups.map((backup, idx) => (
                                <div
                                    key={backup.filename}
                                    className={cn(
                                        "flex items-center justify-between p-3 rounded-lg border transition-all",
                                        idx === 0
                                            ? "bg-green-500/5 border-green-500/20"
                                            : "bg-secondary/30 border-border/30"
                                    )}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <FileArchive className="w-5 h-5 text-violet-400 flex-shrink-0" />
                                        <div className="min-w-0">
                                            <div className="text-sm font-medium truncate">{backup.filename}</div>
                                            <div className="text-xs text-muted-foreground">
                                                {backup.dateFormatted} • {backup.sizeFormatted}
                                                {idx === 0 && <span className="ml-2 text-green-500">● Más reciente</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        <button
                                            onClick={() => downloadBackup(backup.filename)}
                                            className="p-2 rounded-lg hover:bg-cyan-500/20 text-cyan-400 transition-colors"
                                            title="Descargar"
                                        >
                                            <Download className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => restoreBackup(backup.filename)}
                                            className="p-2 rounded-lg hover:bg-amber-500/20 text-amber-400 transition-colors"
                                            title="Restaurar"
                                        >
                                            <RotateCcw className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => deleteBackup(backup.filename)}
                                            className="p-2 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors"
                                            title="Eliminar"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="mt-4 p-3 rounded-lg bg-blue-500/5 border border-blue-500/10 text-xs text-muted-foreground">
                    <strong className="text-blue-400">ℹ️ Información:</strong> Los backups incluyen la base de datos completa (inventario, historial de ventas, usuarios, configuraciones) y todas las imágenes de productos. Al restaurar, el servidor se reiniciará automáticamente.
                </div>
            </motion.div>

            {/* MODAL RESET SELECTIVO / MODULAR */}
            <AnimatePresence>
                {showSelectiveResetModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 text-slate-200"
                        >
                            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                                <div className="flex items-center gap-2 text-orange-400 font-bold text-lg">
                                    <RotateCcw className="w-5 h-5" />
                                    <span>Limpieza y Reset Modular</span>
                                </div>
                                <button
                                    onClick={() => setShowSelectiveResetModal(false)}
                                    className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Selector de Inventario / Nodo */}
                            <div className="space-y-2">
                                <label className="text-xs uppercase font-semibold text-slate-400 tracking-wider">
                                    1. Selecciona la Ubicación / Nodo
                                </label>
                                <select
                                    value={selectiveResetConfig.inventoryId}
                                    onChange={(e) => setSelectiveResetConfig(prev => ({ ...prev, inventoryId: e.target.value }))}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-500 text-white"
                                >
                                    <option value="all">🌐 Todo el Negocio (Global: Almacén + Puntos de Venta)</option>
                                    {inventoriesList.map(inv => (
                                        <option key={inv.id} value={inv.id}>
                                            {inv.type === 'warehouse' ? '📦 ' : '🏪 '} {inv.name} ({inv.code})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Checkboxes de módulos */}
                            <div className="space-y-2">
                                <label className="text-xs uppercase font-semibold text-slate-400 tracking-wider">
                                    2. ¿Qué elementos deseas borrar?
                                </label>
                                <div className="space-y-2 bg-slate-800/60 p-3 rounded-xl border border-slate-700/60 text-sm">
                                    <label className="flex items-center gap-3 cursor-pointer hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={selectiveResetConfig.clearSales}
                                            onChange={(e) => setSelectiveResetConfig(prev => ({ ...prev, clearSales: e.target.checked }))}
                                            className="w-4 h-4 rounded text-orange-500 focus:ring-orange-500 bg-slate-900 border-slate-700"
                                        />
                                        <div>
                                            <div className="font-medium text-slate-200">🛒 Historial de Ventas y Cajas</div>
                                            <div className="text-xs text-slate-400">Borra ventas, recibos y turnos (el stock actual NO se altera).</div>
                                        </div>
                                    </label>

                                    <label className="flex items-center gap-3 cursor-pointer hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={selectiveResetConfig.clearPurchases}
                                            onChange={(e) => setSelectiveResetConfig(prev => ({ ...prev, clearPurchases: e.target.checked }))}
                                            className="w-4 h-4 rounded text-orange-500 focus:ring-orange-500 bg-slate-900 border-slate-700"
                                        />
                                        <div>
                                            <div className="font-medium text-slate-200">📦 Historial de Entradas / Compras</div>
                                            <div className="text-xs text-slate-400">Borra registros de compras a proveedores (el stock NO se altera).</div>
                                        </div>
                                    </label>

                                    <label className="flex items-center gap-3 cursor-pointer hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={selectiveResetConfig.clearTransfers}
                                            onChange={(e) => setSelectiveResetConfig(prev => ({ ...prev, clearTransfers: e.target.checked }))}
                                            className="w-4 h-4 rounded text-orange-500 focus:ring-orange-500 bg-slate-900 border-slate-700"
                                        />
                                        <div>
                                            <div className="font-medium text-slate-200">🚚 Historial de Traslados</div>
                                            <div className="text-xs text-slate-400">Borra la bitácora de envíos entre almacén y kioscos (el stock NO se altera).</div>
                                        </div>
                                    </label>

                                    <label className="flex items-center gap-3 cursor-pointer hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={selectiveResetConfig.clearLosses}
                                            onChange={(e) => setSelectiveResetConfig(prev => ({ ...prev, clearLosses: e.target.checked }))}
                                            className="w-4 h-4 rounded text-orange-500 focus:ring-orange-500 bg-slate-900 border-slate-700"
                                        />
                                        <div>
                                            <div className="font-medium text-slate-200">⚠️ Mermas y Pérdidas</div>
                                            <div className="text-xs text-slate-400">Borra el historial de mermas reportadas.</div>
                                        </div>
                                    </label>

                                    <label className="flex items-center gap-3 cursor-pointer hover:text-white p-1.5 rounded-lg hover:bg-red-500/10 border-t border-slate-700/60 pt-2 transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={selectiveResetConfig.clearInventory}
                                            onChange={(e) => setSelectiveResetConfig(prev => ({ ...prev, clearInventory: e.target.checked }))}
                                            className="w-4 h-4 rounded text-red-500 focus:ring-red-500 bg-slate-900 border-slate-700"
                                        />
                                        <div>
                                            <div className="font-medium text-red-400">🏷️ Inventario / Existencias Físicas</div>
                                            <div className="text-xs text-slate-400">
                                                {selectiveResetConfig.inventoryId === 'all'
                                                    ? 'Borra TODO el catálogo de productos y fotos.'
                                                    : 'Pone en 0 las cantidades de este inventario (mantiene nombres y fotos).'}
                                            </div>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300 flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                <span>Se creará un <strong>respaldo de seguridad automático</strong> de toda la base de datos antes de limpiar.</span>
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowSelectiveResetModal(false)}
                                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-medium transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    onClick={executeSelectiveReset}
                                    disabled={backupLoading}
                                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white text-sm font-semibold shadow-lg shadow-orange-500/20 disabled:opacity-50 transition-all flex items-center gap-2"
                                >
                                    {backupLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                                    <span>Ejecutar Limpieza</span>
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
