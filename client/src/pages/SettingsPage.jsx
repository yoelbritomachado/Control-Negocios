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
    TrendingUp
} from 'lucide-react';
import { cn } from '../lib/utils';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

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

    // Cargar datos
    const fetchData = async () => {
        try {
            const [expenseRes, settingsRes] = await Promise.all([
                fetch(`${API_URL}/expense-types`),
                fetch(`${API_URL}/settings`)
            ]);
            
            if (!expenseRes.ok) throw new Error('Error al cargar tipos de gasto');
            if (!settingsRes.ok) throw new Error('Error al cargar configuración');
            
            const expenseData = await expenseRes.json();
            const settingsData = await settingsRes.json();
            
            setExpenseTypes(expenseData);
            setSettings(settingsData);
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
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            >
                <div>
                    <h1 className="text-2xl font-bold gradient-text">Configuración</h1>
                    <p className="text-muted-foreground">
                        Gestiona los tipos de gastos y tasas de cambio del sistema
                    </p>
                </div>
            </motion.div>

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
        </div>
    );
}
