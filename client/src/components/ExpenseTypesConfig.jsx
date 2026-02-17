import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Plus, 
    Trash2, 
    Edit2, 
    Save, 
    X, 
    Receipt, 
    CreditCard, 
    Banknote,
    AlertCircle,
    Loader2
} from 'lucide-react';
import { cn } from '../lib/utils';
import api from '../api';

export default function ExpenseTypesConfig() {
    const [expenseTypes, setExpenseTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [editing, setEditing] = useState(null);
    const [isCreating, setIsCreating] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        amount: '',
        payment_method: 'cash'
    });

    // Cargar tipos de gasto
    useEffect(() => {
        loadExpenseTypes();
    }, []);

    const loadExpenseTypes = async () => {
        try {
            setLoading(true);
            const res = await api.get('/expense-types');
            setExpenseTypes(res.data);
        } catch (err) {
            setError('Error al cargar tipos de gasto');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            await api.post('/expense-types', {
                name: formData.name,
                amount: parseFloat(formData.amount) || 0,
                payment_method: formData.payment_method
            });
            setFormData({ name: '', amount: '', payment_method: 'cash' });
            setIsCreating(false);
            loadExpenseTypes();
        } catch (err) {
            setError('Error al crear tipo de gasto');
            console.error(err);
        }
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        try {
            await api.put(`/expense-types/${editing.id}`, {
                name: formData.name,
                amount: parseFloat(formData.amount) || 0,
                payment_method: formData.payment_method,
                is_active: 1
            });
            setEditing(null);
            setFormData({ name: '', amount: '', payment_method: 'cash' });
            loadExpenseTypes();
        } catch (err) {
            setError('Error al actualizar tipo de gasto');
            console.error(err);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('¿Estás seguro de eliminar este tipo de gasto?')) return;
        try {
            await api.delete(`/expense-types/${id}`);
            loadExpenseTypes();
        } catch (err) {
            setError('Error al eliminar tipo de gasto');
            console.error(err);
        }
    };

    const startEdit = (type) => {
        setEditing(type);
        setFormData({
            name: type.name,
            amount: type.amount.toString(),
            payment_method: type.payment_method || 'cash'
        });
        setIsCreating(false);
    };

    const cancelEdit = () => {
        setEditing(null);
        setIsCreating(false);
        setFormData({ name: '', amount: '', payment_method: 'cash' });
    };

    const getPaymentMethodIcon = (method) => {
        return method === 'transfer' ? 
            <CreditCard className="w-4 h-4 text-blue-400" /> : 
            <Banknote className="w-4 h-4 text-emerald-400" />;
    };

    const getPaymentMethodLabel = (method) => {
        return method === 'transfer' ? 'Transferencia' : 'Efectivo';
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white">Configuración de Gastos</h2>
                    <p className="text-slate-400 text-sm mt-1">
                        Define los tipos de gastos predeterminados para los vendedores
                    </p>
                </div>
                <button
                    onClick={() => {
                        setIsCreating(true);
                        setEditing(null);
                        setFormData({ name: '', amount: '', payment_method: 'cash' });
                    }}
                    className="btn-primary-glow flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-medium transition-all"
                >
                    <Plus className="w-5 h-5" />
                    Nuevo Gasto
                </button>
            </div>

            {/* Error */}
            {error && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400"
                >
                    <AlertCircle className="w-5 h-5" />
                    {error}
                    <button onClick={() => setError(null)} className="ml-auto">
                        <X className="w-4 h-4" />
                    </button>
                </motion.div>
            )}

            {/* Formulario de Creación/Edición */}
            <AnimatePresence>
                {(isCreating || editing) && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="glass-card p-6 rounded-2xl border border-cyan-500/20"
                    >
                        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            {editing ? <Edit2 className="w-5 h-5 text-cyan-400" /> : <Plus className="w-5 h-5 text-cyan-400" />}
                            {editing ? 'Editar Tipo de Gasto' : 'Nuevo Tipo de Gasto'}
                        </h3>

                        <form onSubmit={editing ? handleUpdate : handleCreate} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* Nombre */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">
                                        Nombre del Gasto
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="Ej: Área, Limpieza, Transporte..."
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-slate-500 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 outline-none transition-all"
                                        required
                                    />
                                </div>

                                {/* Monto */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">
                                        Monto Fijo ($)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.amount}
                                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                        placeholder="0.00"
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-slate-500 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 outline-none transition-all"
                                        required
                                    />
                                </div>

                                {/* Método de Pago */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">
                                        Método de Pago
                                    </label>
                                    <select
                                        value={formData.payment_method}
                                        onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 outline-none transition-all appearance-none cursor-pointer"
                                    >
                                        <option value="cash" className="bg-slate-900">💵 Efectivo</option>
                                        <option value="transfer" className="bg-slate-900">💳 Transferencia</option>
                                    </select>
                                </div>
                            </div>

                            {/* Botones */}
                            <div className="flex items-center gap-3 pt-2">
                                <button
                                    type="submit"
                                    className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl font-medium transition-all"
                                >
                                    <Save className="w-4 h-4" />
                                    {editing ? 'Guardar Cambios' : 'Crear Gasto'}
                                </button>
                                <button
                                    type="button"
                                    onClick={cancelEdit}
                                    className="flex items-center gap-2 px-4 py-2.5 text-slate-400 hover:text-white transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                    Cancelar
                                </button>
                            </div>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Lista de Gastos */}
            <div className="space-y-3">
                {expenseTypes.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                        <Receipt className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>No hay tipos de gasto configurados</p>
                        <p className="text-sm mt-1">Haz clic en "Nuevo Gasto" para agregar uno</p>
                    </div>
                ) : (
                    expenseTypes.map((type, index) => (
                        <motion.div
                            key={type.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="glass-card p-4 rounded-xl border border-white/5 hover:border-cyan-500/20 transition-all group"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
                                        <Receipt className="w-5 h-5 text-cyan-400" />
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-white">{type.name}</h4>
                                        <div className="flex items-center gap-3 text-sm text-slate-400 mt-1">
                                            <span className="font-mono text-emerald-400">
                                                ${parseFloat(type.amount).toFixed(2)}
                                            </span>
                                            <span className="w-1 h-1 rounded-full bg-slate-600" />
                                            <span className="flex items-center gap-1">
                                                {getPaymentMethodIcon(type.payment_method)}
                                                {getPaymentMethodLabel(type.payment_method)}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => startEdit(type)}
                                        className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-cyan-400 transition-colors"
                                        title="Editar"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(type.id)}
                                        className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-rose-400 transition-colors"
                                        title="Eliminar"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    ))
                )}
            </div>

            {/* Info */}
            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm">
                <p className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <span>
                        <strong>Nota:</strong> Los gastos configurados aparecerán en el desplegable del Punto de Venta. 
                        El gasto "Otros" siempre está disponible y permite al vendedor agregar una descripción personalizada.
                        Los gastos se restarán automáticamente del cierre de caja según su método de pago.
                    </span>
                </p>
            </div>
        </div>
    );
}
