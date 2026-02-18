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
    DollarSign
} from 'lucide-react';
import { cn } from '../lib/utils';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export default function SettingsPage() {
    const [expenseTypes, setExpenseTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [isCreating, setIsCreating] = useState(false);
    const [formData, setFormData] = useState({ name: '', amount: '' });

    // Cargar tipos de gasto
    const fetchExpenseTypes = async () => {
        try {
            const response = await fetch(`${API_URL}/expense-types`);
            if (!response.ok) throw new Error('Error al cargar tipos de gasto');
            const data = await response.json();
            setExpenseTypes(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchExpenseTypes();
    }, []);

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
            
            await fetchExpenseTypes();
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
            
            await fetchExpenseTypes();
            setEditingId(null);
            setFormData({ name: '', amount: '' });
        } catch (err) {
            alert('Error: ' + err.message);
        }
    };

    // Eliminar tipo de gasto (soft delete)
    const handleDelete = async (id) => {
        if (!confirm('¿Está seguro de eliminar este tipo de gasto?')) return;

        try {
            const response = await fetch(`${API_URL}/expense-types/${id}`, {
                method: 'DELETE'
            });

            if (!response.ok) throw new Error('Error al eliminar tipo de gasto');
            
            await fetchExpenseTypes();
        } catch (err) {
            alert('Error: ' + err.message);
        }
    };

    // Iniciar edición
    const startEdit = (item) => {
        setEditingId(item.id);
        setFormData({ name: item.name, amount: item.amount.toString() });
    };

    // Cancelar edición/creación
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
                        Gestiona los tipos de gastos predefinidos del sistema
                    </p>
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
                                                <td className="py-3 px-4 font-medium">
                                                    {item.name}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-secondary text-sm">
                                                        <DollarSign className="w-3 h-3" />
                                                        {item.amount.toFixed(2)}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <motion.button
                                                            whileHover={{ scale: 1.05 }}
                                                            whileTap={{ scale: 0.95 }}
                                                            onClick={() => startEdit(item)}
                                                            className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition-colors"
                                                            title="Editar"
                                                        >
                                                            <Edit2 className="w-4 h-4" />
                                                        </motion.button>
                                                        <motion.button
                                                            whileHover={{ scale: 1.05 }}
                                                            whileTap={{ scale: 0.95 }}
                                                            onClick={() => handleDelete(item.id)}
                                                            className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
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

                            {/* Empty State */}
                            {expenseTypes.length === 0 && !isCreating && (
                                <tr>
                                    <td colSpan={3} className="py-12 text-center">
                                        <div className="flex flex-col items-center gap-3 text-muted-foreground">
                                            <Receipt className="w-12 h-12 opacity-20" />
                                            <p>No hay tipos de gasto configurados</p>
                                            <p className="text-sm">Haz clic en "Nuevo Gasto" para agregar uno</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Info Note */}
                <div className="mt-6 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-300">
                        <p className="font-medium mb-1">Información</p>
                        <p>
                            Los tipos de gasto configurados aquí aparecerán en la lista desplegable 
                            al registrar un gasto en el Punto de Venta (POS). Los cambios se reflejan 
                            inmediatamente en todas las sesiones.
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
