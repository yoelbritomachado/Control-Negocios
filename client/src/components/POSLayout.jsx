import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useCart } from './CartProvider';
import InventorySelector from './InventorySelector';
import api, { fetchProducts } from '../api';
import SessionGuard from './SessionGuard';
import PaymentModal from './PaymentModal';
import SearchBar from './SearchBar';
import SearchDropdown from './SearchDropdown'; // Mantenido para compatibilidad
import ConfirmModal from './ConfirmModal';
import AlertModal from './AlertModal';
import ReturnsModule from './ReturnsModule';
import { useRole } from '../hooks/useRole';
import {
    ShoppingCart, Trash2, Banknote, Save, RotateCcw,
    Receipt, Search, History, LogOut, Loader2,
    CheckCircle2, Camera, Package2, X, Plus, Minus,
    Sparkles, TrendingUp, ArrowRight, Wallet, Edit, AlertTriangle,
    CreditCard, Calendar, QrCode
} from 'lucide-react';
import QRGeneratorModal from './QRGeneratorModal';
import { prepareSaleQRPayload } from '../lib/qrOfflineService';
import { savePendingSale } from '../lib/localDB';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';

// Helper para generar keys únicas y seguras (evita keys vacías que causan errores en React)
// NOTA: NUNCA usar Date.now() en keys - causa re-renders infinitos y pérdida de estado
const generateSafeKey = (prefix, item, index) => {
    const itemId = item?.id || item?.code || item?.product_id || item?.sale_id || item?.name;
    const safeId = itemId && String(itemId).trim() !== '' ? String(itemId) : `idx-${index}`;
    return `${prefix}-${safeId}`;
};

// Helper para verificar si un ID es temporal
const isTempId = (id) => {
    if (!id) return true;
    const strId = String(id);
    return strId.startsWith('session_') || strId.startsWith('temp_');
};

// --- SUBCOMPONENTS (MODALS) ---

const ModalOverlay = ({ children, onClose, className }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
        <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className={cn("glass-card w-full max-w-md overflow-hidden relative", className)}
        >
            <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-lg text-muted-foreground hover:text-white hover:bg-white/10 transition-all"
            >
                <X className="w-5 h-5" />
            </button>
            {children}
        </motion.div>
    </div>
);

const ExpenseModal = ({ onClose, onSave }) => {
    const [type, setType] = useState('');
    const [amount, setAmount] = useState('');
    const [desc, setDesc] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [expenseTypes, setExpenseTypes] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadExpenseTypes();
    }, []);

    const loadExpenseTypes = async () => {
        try {
            const res = await api.get('/expense-types');
            setExpenseTypes(res.data);
            // Set first type as default if available
            if (res.data.length > 0) {
                setType(res.data[0].id.toString());
                setAmount(res.data[0].amount.toString());
                setPaymentMethod(res.data[0].payment_method || 'cash');
            }
        } catch (e) {
            console.error('Error loading expense types:', e);
        }
        setLoading(false);
    };

    const handleTypeChange = (typeId) => {
        setType(typeId);
        const selectedType = expenseTypes.find(t => t.id.toString() === typeId);
        if (selectedType) {
            setAmount(selectedType.amount.toString());
            setPaymentMethod(selectedType.payment_method || 'cash');
            // Limpiar descripción al cambiar de tipo
            setDesc('');
        }
    };

    const isCustomExpense = () => {
        const selectedType = expenseTypes.find(t => t.id.toString() === type);
        return selectedType?.name?.toLowerCase().includes('otro') ||
            selectedType?.name?.toLowerCase().includes('otros') ||
            selectedType?.amount === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const selectedType = expenseTypes.find(t => t.id.toString() === type);
        await onSave({
            type: selectedType?.name || 'Otro',
            amount: parseFloat(amount),
            description: isCustomExpense() ? desc : selectedType?.name,
            payment_method: paymentMethod
        });
    };

    return (
        <ModalOverlay onClose={onClose}>
            <div className="p-6 space-y-6">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                        <Receipt className="w-6 h-6 text-amber-500" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-white">Registrar Gasto</h3>
                        <p className="text-sm text-muted-foreground">Registra un gasto del turno actual</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tipo de Gasto</label>
                        <select
                            value={type}
                            onChange={(e) => handleTypeChange(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 outline-none transition-all"
                        >
                            {expenseTypes.map((expenseType, index) => (
                                <option key={generateSafeKey('expense-type', expenseType, index)} value={expenseType?.id} className="bg-gray-900">
                                    {expenseType.name} (${expenseType.amount.toFixed(2)})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Descripción para gasto "Otros" */}
                    {isCustomExpense() && (
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Descripción del Gasto
                            </label>
                            <textarea
                                placeholder="Describe el gasto... Ej: Compra de material de oficina, reparación de equipo, etc."
                                value={desc}
                                onChange={e => setDesc(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 outline-none transition-all h-20 resize-none"
                                required={isCustomExpense()}
                            />
                            <p className="text-xs text-slate-500">
                                El tipo se registrará como "Otros" con esta descripción
                            </p>
                        </div>
                    )}

                    {/* Monto */}
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Monto</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-mono">$</span>
                            <input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-4 py-3 text-white focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 outline-none transition-all font-mono text-lg"
                                required
                            />
                        </div>
                    </div>

                    {/* Método de Pago */}
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Método de Pago
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setPaymentMethod('cash')}
                                className={cn(
                                    "flex items-center justify-center gap-2 px-4 py-3 rounded-xl border transition-all",
                                    paymentMethod === 'cash'
                                        ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400"
                                        : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10"
                                )}
                            >
                                <Banknote className="w-5 h-5" />
                                Efectivo
                            </button>
                            <button
                                type="button"
                                onClick={() => setPaymentMethod('transfer')}
                                className={cn(
                                    "flex items-center justify-center gap-2 px-4 py-3 rounded-xl border transition-all",
                                    paymentMethod === 'transfer'
                                        ? "bg-blue-500/20 border-blue-500/50 text-blue-400"
                                        : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10"
                                )}
                            >
                                <CreditCard className="w-5 h-5" />
                                Transferencia
                            </button>
                        </div>
                        <p className="text-xs text-slate-500 mt-2">
                            Este gasto se restará del {paymentMethod === 'cash' ? 'efectivo' : 'transferencia'} al cerrar la sesión
                        </p>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-3 rounded-xl text-muted-foreground hover:text-white hover:bg-white/5 font-medium transition-all"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-4 py-3 bg-gradient-to-r from-amber-600 to-amber-500 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-amber-500/25 transition-all"
                        >
                            Registrar
                        </button>
                    </div>
                </form>
            </div>
        </ModalOverlay>
    );
};

const CloseSessionModal = ({ onClose, onSave, metrics, summary, role }) => {
    const [cash, setCash] = useState('');
    const [notes, setNotes] = useState('');
    const [requestWagePayment, setRequestWagePayment] = useState(false);
    const [wagePaymentMethod, setWagePaymentMethod] = useState('cash');
    const isSeller = role === 'seller';

    // Support both old format (summary) and new format (metrics.current)
    const data = metrics?.current || summary || {};
    const accumulated = metrics?.accumulated || {};
    const finalData = metrics?.final || {};
    
    // Extract values from the correct format
    const cashSales = data.sales?.cash || 0;
    const transferSales = data.sales?.transfer || 0;
    const totalSales = data.sales?.total || 0;
    const totalCost = data.cost?.total || 0;
    const cashExpenses = data.expenses?.cash || 0;
    const transferExpenses = data.expenses?.transfer || 0;
    const totalExpenses = data.expenses?.total || 0;
    
    // Calculate derived values
    const profit = Math.max(0, totalSales - totalCost);
    const currentWage = data.wage || (profit * 0.05);
    
    // Final amounts to deliver
    const finalCash = finalData.cash || (cashSales - cashExpenses);
    const finalTransfer = finalData.transfer || (transferSales - transferExpenses);
    
    // Accumulated wage (all unpaid sessions)
    const totalPendingWage = accumulated.total_pending_wage || currentWage;
    const previousWage = accumulated.previous_sessions_wage || 0;
    const pendingSessions = accumulated.pending_sessions_count || 0;

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(cash, notes, requestWagePayment, wagePaymentMethod, totalPendingWage);
    };

    return (
        <ModalOverlay onClose={onClose}>
            <div className="p-6 space-y-5 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center gap-3">
                    <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center",
                        isSeller ? "bg-emerald-500/20" : "bg-violet-500/20"
                    )}>
                        <LogOut className={cn("w-6 h-6", isSeller ? "text-emerald-500" : "text-violet-500")} />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-white">
                            {isSeller ? 'Enviar Sesión' : 'Cerrar Sesión'}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            {isSeller ? 'Envía tu sesión para revisión del administrador' : 'Finaliza la sesión de trabajo'}
                        </p>
                    </div>
                </div>
                
                {/* Banner informativo para vendedor */}
                {isSeller && (
                    <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                        <p className="text-sm text-emerald-400">
                            Al enviar tu sesión, el administrador podrá revisar tus ventas y aprobar el cierre.
                        </p>
                    </div>
                )}

                {/* Resumen Detallado */}
                <div className="space-y-3">
                    {/* Ventas */}
                    <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-emerald-600/10 border border-emerald-500/20">
                        <div className="text-xs text-emerald-400 uppercase tracking-wider mb-2 font-semibold">Ventas del Turno</div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <div className="text-xs text-slate-400">Efectivo</div>
                                <div className="text-lg font-bold text-white font-mono">${cashSales.toFixed(2)}</div>
                            </div>
                            <div>
                                <div className="text-xs text-slate-400">Transferencia</div>
                                <div className="text-lg font-bold text-white font-mono">${transferSales.toFixed(2)}</div>
                            </div>
                        </div>
                    </div>

                    {/* Gastos */}
                    {totalExpenses > 0 && (
                        <div className="p-4 rounded-xl bg-gradient-to-br from-rose-500/10 to-rose-600/10 border border-rose-500/20">
                            <div className="text-xs text-rose-400 uppercase tracking-wider mb-2 font-semibold">Gastos Registrados</div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <div className="text-xs text-slate-400">Efectivo</div>
                                    <div className="text-lg font-bold text-rose-400 font-mono">-${cashExpenses.toFixed(2)}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-slate-400">Transferencia</div>
                                    <div className="text-lg font-bold text-rose-400 font-mono">-${transferExpenses.toFixed(2)}</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Totales a Entregar */}
                    <div className="p-4 rounded-xl bg-gradient-to-br from-violet-500/10 to-purple-500/10 border border-violet-500/20">
                        <div className="text-xs text-violet-400 uppercase tracking-wider mb-2 font-semibold">Total a Entregar</div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <div className="text-xs text-slate-400">Efectivo Neto</div>
                                <div className="text-xl font-bold text-emerald-400 font-mono">${finalCash.toFixed(2)}</div>
                            </div>
                            <div>
                                <div className="text-xs text-slate-400">Transferencia</div>
                                <div className="text-xl font-bold text-blue-400 font-mono">${finalTransfer.toFixed(2)}</div>
                            </div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-white/10">
                            <div className="text-xs text-slate-400">Total General</div>
                            <div className="text-2xl font-bold text-white font-mono">${(finalCash + finalTransfer).toFixed(2)}</div>
                        </div>
                    </div>

                    {/* Comisión - 5% de ganancia real */}
                    <div className="p-4 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20">
                        <div className="flex items-center justify-between mb-2">
                            <div className="text-xs text-amber-400 uppercase tracking-wider font-semibold">
                                Tu Salario Acumulado ({pendingSessions > 1 ? `${pendingSessions} sesiones` : 'Esta sesión'})
                            </div>
                            <div className="text-lg font-bold text-amber-400 font-mono">${totalPendingWage.toFixed(2)}</div>
                        </div>
                        
                        {/* Breakdown */}
                        <div className="space-y-2 text-xs border-t border-white/10 pt-2 mt-2">
                            <div className="flex justify-between">
                                <span className="text-slate-400">Esta sesión:</span>
                                <span className="text-white font-mono">${currentWage.toFixed(2)}</span>
                            </div>
                            {previousWage > 0 && (
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Sesiones anteriores:</span>
                                    <span className="text-amber-300 font-mono">${previousWage.toFixed(2)}</span>
                                </div>
                            )}
                            <div className="flex justify-between border-t border-white/10 pt-1 mt-1">
                                <span className="text-emerald-400">Total a cobrar:</span>
                                <span className="text-emerald-400 font-bold font-mono">${totalPendingWage.toFixed(2)}</span>
                            </div>
                        </div>
                        
                        {/* Cálculo de esta sesión */}
                        <div className="mt-3 pt-2 border-t border-white/10">
                            <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Cálculo esta sesión</div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="text-slate-400">Ventas: <span className="text-white">${totalSales.toFixed(2)}</span></div>
                                <div className="text-slate-400">Costos: <span className="text-rose-400">-${totalCost.toFixed(2)}</span></div>
                                <div className="text-slate-400 col-span-2">Ganancia: <span className="text-emerald-400">${profit.toFixed(2)} × 5% = ${currentWage.toFixed(2)}</span></div>
                            </div>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Opción de solicitar pago - Solo para vendedores */}
                    {isSeller && totalPendingWage > 0 && (
                        <div className="space-y-3 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={requestWagePayment}
                                    onChange={(e) => setRequestWagePayment(e.target.checked)}
                                    className="w-5 h-5 rounded border-emerald-500/50 bg-white/5 text-emerald-500 focus:ring-emerald-500/50"
                                />
                                <span className="text-sm font-medium text-emerald-400">
                                    Solicitar pago de mi salario acumulado (${totalPendingWage.toFixed(2)})
                                </span>
                            </label>
                            
                            {requestWagePayment && (
                                <div className="pl-8 space-y-2">
                                    <label className="text-xs text-slate-400">Método de pago preferido</label>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setWagePaymentMethod('cash')}
                                            className={cn(
                                                "flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                                                wagePaymentMethod === 'cash'
                                                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50"
                                                    : "bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10"
                                            )}
                                        >
                                            Efectivo
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setWagePaymentMethod('transfer')}
                                            className={cn(
                                                "flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                                                wagePaymentMethod === 'transfer'
                                                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50"
                                                    : "bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10"
                                            )}
                                        >
                                            Transferencia
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Efectivo en Caja</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-mono">$</span>
                            <input
                                type="number"
                                placeholder="0.00"
                                value={cash}
                                onChange={e => setCash(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-4 py-3 text-white focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 outline-none transition-all font-mono text-lg"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Notas del Turno</label>
                        <textarea
                            placeholder="Observaciones, incidencias, etc..."
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 outline-none transition-all h-24 resize-none"
                        />
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-3 rounded-xl text-muted-foreground hover:text-white hover:bg-white/5 font-medium transition-all"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className={cn(
                                "flex-1 px-4 py-3 rounded-xl font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2",
                                isSeller 
                                    ? "bg-gradient-to-r from-emerald-600 to-teal-500 hover:shadow-emerald-500/25 text-white"
                                    : "bg-gradient-to-r from-violet-600 to-purple-500 hover:shadow-violet-500/25 text-white"
                            )}
                        >
                            <LogOut className="w-4 h-4" />
                            {isSeller ? 'Enviar para Revisión' : 'Cerrar y Calcular'}
                        </button>
                    </div>
                </form>
            </div>
        </ModalOverlay>
    );
};

// --- MAIN LAYOUT ---

export default function POSLayout() {
    const { cart, setCart, removeFromCart, updateQuantity, total, clearCart, addToCart, currentInventory, editingSession, setEditingSession } = useCart();
    const { isSeller, currentRole } = useRole();
    const [search, setSearch] = useState('');
    const [loadingProduct, setLoadingProduct] = useState(false);
    const [searchResults, setSearchResults] = useState([]);
    const [showSearchDropdown, setShowSearchDropdown] = useState(false);
    const inputRef = useRef(null);

    // Modals
    const [showExpense, setShowExpense] = useState(false);
    const [showReturn, setShowReturn] = useState(false);
    const [showClose, setShowClose] = useState(false);
    const [showPayment, setShowPayment] = useState(false);
    const [showSaveTicketModal, setShowSaveTicketModal] = useState(false);
    const [ticketCustomName, setTicketCustomName] = useState('');
    // Ticket que se está editando: al guardarlo conserva el mismo nombre e ID.
    const [editingSavedSale, setEditingSavedSale] = useState(null);
    const [sessionMetrics, setSessionMetrics] = useState(null);
    const [qrModalOpen, setQrModalOpen] = useState(false);
    const [qrPayload, setQrPayload] = useState(null);
    const [showQuickSaleModal, setShowQuickSaleModal] = useState(false);
    const [quickSaleData, setQuickSaleData] = useState({ name: '', price: '', quantity: 1 });

    // Confirm Modals
    const [showCartConfirm, setShowCartConfirm] = useState(false);
    const [showSavedConfirm, setShowSavedConfirm] = useState(false);
    const [pendingAction, setPendingAction] = useState(null);

    // Alert Modals
    const [alertModal, setAlertModal] = useState({ isOpen: false, title: '', message: '', type: 'info' });
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null, type: 'warning' });

    // State
    const [recentSales, setRecentSales] = useState([]);
    const [savedSales, setSavedSales] = useState([]); // Ventas guardadas (pendientes)
    const [expenses, setExpenses] = useState([]); // Gastos del turno
    const [checkoutProcessing, setCheckoutProcessing] = useState(false);
    const [serverDate, setServerDate] = useState(null); // Fecha del servidor (no del dispositivo)

    // Cargar fecha del servidor al montarse
    useEffect(() => {
        if (navigator.onLine) {
            api.get('/sessions/status', { timeout: 2000 }).then(res => {
                if (res.data.serverDate) setServerDate(res.data.serverDate);
            }).catch(() => {});
        }
    }, []);

    // Mobile view state
    const [mobileView, setMobileView] = useState('cart'); // 'cart' | 'tickets'

    // Nota: La búsqueda ahora la maneja el componente SearchBar internamente
    // con debounce y búsqueda desde la primera letra

    const performSearch = useCallback(async (query) => {
        if (!query || query.length < 1) {
            setSearchResults([]);
            setShowSearchDropdown(false);
            return;
        }
        setLoadingProduct(true);
        try {
            const products = await fetchProducts(query);
            // Filter products that have stock in current inventory
            const availableProducts = products.filter(p => {
                const stock = p.inventory?.[currentInventory] || 0;
                return stock > 0;
            });
            setSearchResults(availableProducts);
            setShowSearchDropdown(availableProducts.length > 0);
        } catch (err) {
            console.error(err);
            setSearchResults([]);
        } finally {
            setLoadingProduct(false);
        }
    }, [currentInventory]);

    const handleSearchKeyDown = async (e) => {
        if (e.key === 'Enter' && search.trim()) {
            setShowSearchDropdown(false);
            setLoadingProduct(true);
            try {
                const products = await fetchProducts(search.trim());
                if (products && products.length > 0) {
                    const p = products[0];
                    const stock = p.inventory?.[currentInventory] || 0;
                    if (stock > 0) {
                        addToCart(p);
                        setSearch('');
                        setSearchResults([]);
                    }
                    else {
                        setAlertModal({
                            isOpen: true,
                            title: 'Producto agotado',
                            message: 'Producto agotado en esta sede',
                            type: 'warning'
                        });
                    }
                } else {
                    setAlertModal({
                        isOpen: true,
                        title: 'Producto no encontrado',
                        message: 'No se encontró el producto buscado',
                        type: 'warning'
                    });
                }
            } catch (err) {
                console.error(err);
            }
            finally {
                setLoadingProduct(false);
            }
        }
    };

    const handleSelectProduct = (product) => {
        addToCart(product);
        setSearch('');
        setSearchResults([]);
        setShowSearchDropdown(false);
    };

    const handleSaveSale = () => {
        if (cart.length === 0) return;
        // Si el carrito proviene de un ticket editado, conservar su cliente/referencia.
        // Solo se inicia vacío al crear un ticket nuevo.
        setTicketCustomName(prev => editingSavedSale?.name || prev || '');
        setShowSaveTicketModal(true);
    };

    const confirmSaveSale = (customName) => {
        if (cart.length === 0) return;

        const defaultLabel = `Ticket #${savedSales.length + 1}`;
        const finalName = (customName && customName.trim() !== '') ? customName.trim() : defaultLabel;

        const savedSale = {
            id: `saved-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: finalName,
            items: [...cart],
            total: total,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            status: 'saved',
            inventoryId: currentInventory
        };

        setSavedSales(prev => editingSavedSale
            ? [{ ...savedSale, id: editingSavedSale.id, name: finalName }, ...prev.filter(s => s.id !== editingSavedSale.id)]
            : [savedSale, ...prev]
        );
        clearCart();
        setEditingSavedSale(null);
        setShowSaveTicketModal(false);
        setTicketCustomName('');
        setAlertModal({
            isOpen: true,
            title: 'Ticket Guardado',
            message: `Ticket "${finalName}" guardado con éxito. Puedes recuperarlo en cualquier momento desde la lista lateral.`,
            type: 'info'
        });
    };

    const handleEditSavedSale = async (sale) => {
        // Conservar el ticket original: al guardar de nuevo se actualizará, no se duplicará.
        setEditingSavedSale(sale);
        setTicketCustomName(sale.name || `Ticket #${sale.id}`);
        // Verificar si hay items con IDs temporales
        const itemsWithTempIds = sale.items?.filter(item => isTempId(item.id) && isTempId(item.product_id)) || [];
        if (itemsWithTempIds.length > 0) {
            setAlertModal({
                isOpen: true,
                title: 'Venta no editable',
                message: `Esta venta guardada tiene ${itemsWithTempIds.length} producto(s) con ID temporal (${itemsWithTempIds[0].name}). Por favor elimine esta venta guardada y cree una nueva desde el catálogo.`,
                type: 'warning'
            });
            return;
        }

        // Validación de stock en tiempo real antes de cargar
        let availableItems = [];
        let stockWarnings = [];

        try {
            const currentCatalog = await fetchProducts('');
            const catalogMap = new Map(currentCatalog.map(p => [p.id, p]));

            for (const item of (sale.items || [])) {
                const prodId = item.product_id || item.id;
                const freshProduct = catalogMap.get(prodId);
                const currentStock = freshProduct?.inventory?.[currentInventory] ?? freshProduct?.total_quantity ?? 0;

                if (!freshProduct || currentStock <= 0) {
                    stockWarnings.push(`• ${item.name || 'Producto'}: Agotado en este momento (0 disponibles).`);
                } else if (currentStock < item.quantity) {
                    stockWarnings.push(`• ${item.name || 'Producto'}: Se ajustó de ${item.quantity} a ${currentStock} uds por disponibilidad.`);
                    availableItems.push({
                        ...item,
                        id: prodId,
                        quantity: currentStock
                    });
                } else {
                    availableItems.push({
                        ...item,
                        id: prodId
                    });
                }
            }
        } catch (e) {
            console.warn('No se pudo verificar el stock fresco, cargando items guardados:', e);
            availableItems = (sale.items || []).map(item => ({
                ...item,
                id: item.product_id || item.id
            }));
        }

        if (availableItems.length === 0) {
            setAlertModal({
                isOpen: true,
                title: 'Productos No Disponibles',
                message: (
                    <div className="space-y-2">
                        <p className="text-rose-400 font-medium">Ninguno de los productos de este ticket tiene stock disponible actualmente en esta sede:</p>
                        <div className="text-xs text-muted-foreground space-y-1 bg-secondary/30 p-2 rounded-lg">
                            {stockWarnings.map((w, idx) => <div key={idx}>{w}</div>)}
                        </div>
                    </div>
                ),
                type: 'danger'
            });
            return;
        }

        const proceedLoadingCart = () => {
            setCart(availableItems);
            setSavedSales(prev => prev.filter(s => s.id !== sale.id));
            if (stockWarnings.length > 0) {
                setAlertModal({
                    isOpen: true,
                    title: 'Ajuste de Disponibilidad',
                    message: (
                        <div className="space-y-2">
                            <p className="text-amber-400 font-medium">Algunos productos cambiaron de stock mientras el ticket estaba en espera:</p>
                            <div className="text-xs text-muted-foreground space-y-1 bg-secondary/30 p-2 rounded-lg">
                                {stockWarnings.map((w, idx) => <div key={idx}>{w}</div>)}
                            </div>
                        </div>
                    ),
                    type: 'warning'
                });
            }
        };

        // Si hay productos en el carrito actual, preguntar qué hacer
        if (cart.length > 0) {
            setConfirmModal({
                isOpen: true,
                title: 'Carrito con productos',
                message: 'Tienes productos en el carrito actual. ¿Deseas guardar el carrito actual como ticket pendiente y cargar este ticket guardado?',
                type: 'warning',
                onConfirm: () => {
                    const savedCurrent = {
                        id: `pending-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        name: sale.name || `Ticket #${savedSales.length + 1}`,
                        items: [...cart],
                        total: total,
                        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        status: 'saved',
                        inventoryId: currentInventory
                    };
                    setSavedSales(prev => [savedCurrent, ...prev.filter(s => s.id !== sale.id)]);
                    setCart(availableItems);
                    if (stockWarnings.length > 0) {
                        setAlertModal({
                            isOpen: true,
                            title: 'Ajuste de Disponibilidad',
                            message: (
                                <div className="space-y-2">
                                    <p className="text-amber-400 font-medium">Algunos productos cambiaron de stock mientras el ticket estaba en espera:</p>
                                    <div className="text-xs text-muted-foreground space-y-1 bg-secondary/30 p-2 rounded-lg">
                                        {stockWarnings.map((w, idx) => <div key={idx}>{w}</div>)}
                                    </div>
                                </div>
                            ),
                            type: 'warning'
                        });
                    }
                }
            });
            return;
        }

        proceedLoadingCart();
    };

    const handleDeleteSavedSale = (saleId) => {
        setConfirmModal({
            isOpen: true,
            title: 'Eliminar venta guardada',
            message: '¿Eliminar esta venta guardada?',
            type: 'danger',
            onConfirm: () => {
                setSavedSales(prev => prev.filter(s => s.id !== saleId));
            }
        });
    };

    const handleEditSale = (sale) => {
        if (!sale.items || sale.items.length === 0) {
            setAlertModal({
                isOpen: true,
                title: 'Venta no editable',
                message: 'Esta venta no puede ser editada porque no tiene items guardados.',
                type: 'warning'
            });
            return;
        }

        // Verificar si hay items con IDs temporales
        const itemsWithTempIds = sale.items.filter(item => isTempId(item.id) && isTempId(item.product_id));
        if (itemsWithTempIds.length > 0) {
            setAlertModal({
                isOpen: true,
                title: 'Venta no editable',
                message: `Esta venta tiene ${itemsWithTempIds.length} producto(s) con ID temporal (${itemsWithTempIds[0].name}). No se puede editar ventas antiguas con este problema.`,
                type: 'warning'
            });
            return;
        }

        // Si hay productos en el carrito, guardarlos primero como venta guardada
        if (cart.length > 0) {
            setConfirmModal({
                isOpen: true,
                title: 'Carrito con productos',
                message: 'Tienes productos en el carrito. ¿Guardar el carrito actual como ticket pendiente y cargar esta venta?',
                type: 'warning',
                onConfirm: () => {
                    // Guardar carrito actual como venta guardada
                    const savedSale = {
                        id: `pending-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        items: [...cart],
                        total: total,
                        time: new Date().toLocaleTimeString(),
                        date: new Date().toISOString()
                    };
                    setSavedSales(prev => [savedSale, ...prev]);

                    // Reemplazar completamente el carrito con los items de la venta
                    const newCartItems = sale.items.map((item) => ({
                        ...item,
                        id: item.product_id || item.id
                    }));
                    setCart(newCartItems);

                    // Eliminar la venta original
                    setRecentSales(prev => prev.filter(s => s.id !== sale.id));
                }
            });
            return;
        }

        // Cargar items de la venta al carrito (reemplazo completo)
        const newCartItems = sale.items.map((item) => ({
            ...item,
            id: item.product_id || item.id
        }));
        setCart(newCartItems);
        // Eliminar la venta original
        setRecentSales(prev => prev.filter(s => s.id !== sale.id));
    };

    const handleGenerateSaleQR = (sale) => {
        const payload = prepareSaleQRPayload(
            {
                id: sale.id,
                ticket_code: `VTA-${sale.id}`,
                inventory_id: currentInventory,
                total_amount: sale.total,
                payment_method: sale.method || 'cash',
                cash_received: sale.cashAmount || (sale.method === 'cash' ? sale.total : 0),
                transfer_received: sale.transferAmount || (sale.method === 'transfer' ? sale.total : 0),
                created_at: new Date().toISOString()
            },
            (sale.items || []).map(i => ({
                product_id: i.product_id || i.id,
                name: i.name || 'Producto',
                quantity: i.quantity,
                sale_price: i.sale_price_manual || i.price,
                total_price: (i.quantity || 1) * (i.sale_price_manual || i.price || 0)
            }))
        );
        setQrPayload(payload);
        setQrModalOpen(true);
    };

    const handleAddQuickSale = (e) => {
        e.preventDefault();
        const price = parseFloat(quickSaleData.price);
        const qty = parseInt(quickSaleData.quantity, 10) || 1;
        if (!price || price <= 0) {
            alert('Ingrese un precio válido');
            return;
        }
        const quickProduct = {
            id: Number(Date.now().toString().slice(-6)), // ID numérico de contingencia
            name: quickSaleData.name.trim() || 'Venta Rápida / Comodín',
            code: 'RAPIDO',
            sale_price_manual: price,
            cost_mn: 0,
            inventory: { [currentInventory]: 999 }
        };
        addToCart(quickProduct, qty);
        setShowQuickSaleModal(false);
        setQuickSaleData({ name: '', price: '', quantity: 1 });
    };

    const handleDeleteSale = (saleId) => {
        setConfirmModal({
            isOpen: true,
            title: 'Eliminar venta',
            message: '¿Eliminar esta venta? Esta accion no se puede deshacer.',
            type: 'danger',
            onConfirm: () => {
                setRecentSales(prev => prev.filter(s => s.id !== saleId));
                // TODO: Llamar al backend para eliminar la venta de la base de datos
            }
        });
    };

    const handleCheckoutClick = () => { if (cart.length > 0) setShowPayment(true); };

    const processPayment = async (paymentData) => {
        setCheckoutProcessing(true);
        try {
            // Validar que todos los items tengan ID válido (no temporal)
            const tempIdItems = cart.filter(item => 
                !item.id || 
                String(item.id).startsWith('session_') || 
                String(item.id).startsWith('temp_')
            );
            if (tempIdItems.length > 0) {
                throw new Error(
                    `Hay ${tempIdItems.length} producto(s) con ID temporal (${tempIdItems[0].name}). ` +
                    `Por favor elimine estos productos y agréguelos nuevamente desde el catálogo.`
                );
            }

            // Determinar el método de pago principal
            let paymentMethod = 'cash';
            if (paymentData.method === 'mixed') {
                paymentMethod = 'mixed';
            } else if (paymentData.transferAmount > 0) {
                paymentMethod = 'transfer';
            }

            // Preparar items para el backend
            const itemsForBackend = cart.map(item => ({
                ...item,
                id: item.id
            }));

            let res = null;
            let isOfflineRecorded = false;
            let localSaleId = null;

            try {
                res = await api.post('/sales', {
                    items: itemsForBackend,
                    total: total,
                    paymentMethod: paymentMethod,
                    amountReceived: paymentData.amountReceived,
                    change: paymentData.change,
                    inventoryId: currentInventory,
                    cashAmount: paymentData.cashAmount,
                    transferAmount: paymentData.transferAmount
                }, { timeout: 3500 });
            } catch (networkError) {
                console.warn('[POS] Sin conexión al servidor, guardando venta localmente (Offline)...');
                const offlineRecord = await savePendingSale({
                    items: itemsForBackend,
                    total: total,
                    payment_method: paymentMethod,
                    amount_received: paymentData.amountReceived,
                    change: paymentData.change,
                    inventory_id: currentInventory,
                    cash_amount: paymentData.cashAmount,
                    transfer_amount: paymentData.transferAmount,
                    created_at: new Date().toISOString()
                });
                isOfflineRecorded = true;
                localSaleId = offlineRecord.local_id;
            }

            if (isOfflineRecorded || (res && res.data && res.data.success)) {
                const saleIdToUse = isOfflineRecorded ? localSaleId : res.data.saleId;
                const completedSale = {
                    id: saleIdToUse,
                    is_offline: isOfflineRecorded,
                    items: cart.map(item => ({
                        id: item.product_id || item.id,
                        product_id: item.product_id || item.id,
                        name: item.name,
                        code: item.code,
                        quantity: item.quantity,
                        sale_price_manual: item.sale_price_manual,
                        cost_mn: item.cost_mn
                    })),
                    total: total,
                    time: new Date().toLocaleTimeString(),
                    method: paymentMethod,
                    cashAmount: paymentData.cashAmount,
                    transferAmount: paymentData.transferAmount
                };

                setRecentSales(prev => [completedSale, ...prev]);
                clearCart();
                setShowPayment(false);

                if (isOfflineRecorded) {
                    setAlertModal({
                        isOpen: true,
                        title: '⚡ Venta Guardada Offline',
                        message: 'La venta se registró localmente en este dispositivo. Podrás sincronizarla con el servidor o por código QR desde el botón Sincronizar.',
                        type: 'info'
                    });
                }
            } else {
                throw new Error('No se pudo procesar la venta');
            }
        } catch (e) {
            console.error('Error al cobrar:', e);
            setAlertModal({
                isOpen: true,
                title: 'Error al cobrar',
                message: e.response?.data?.error || e.message || "Error al cobrar",
                type: 'danger'
            });
        }
        finally {
            setCheckoutProcessing(false);
        }
    };

    const [closeSummary, setCloseSummary] = useState(null);

    const handleCloseSession = async (cash, notes, requestWagePayment = false, wagePaymentMethod = 'cash', totalPendingWage = 0) => {
        try {
            localStorage.setItem('mch_offline_session_open', 'false');
            
            if (!navigator.onLine) {
                setAlertModal({
                    isOpen: true,
                    title: 'Turno Finalizado (Offline)',
                    message: 'El turno se ha cerrado localmente en este dispositivo. Cuando vuelvas a tener conexión se sincronizarán los registros.',
                    type: 'success',
                    onClose: () => window.location.reload()
                });
                return;
            }

            // Usar endpoint diferente según el rol
            const endpoint = isSeller ? '/sessions/send-for-review' : '/sessions/close';
            const res = await api.post(endpoint, { declared_cash: cash, notes }, { timeout: 3000 });
            setCloseSummary(res.data.summary);
            
            // Obtener salario acumulado de la respuesta o usar el pasado al modal
            const responseTotalWage = res.data.accumulated?.total_pending_wage || res.data.wage || totalPendingWage;
            
            // Si es vendedor y solicitó pago de salario, crear solicitud
            if (isSeller && requestWagePayment && responseTotalWage > 0) {
                try {
                    await api.post('/wages/request', {
                        session_id: res.data.session_id,
                        amount: responseTotalWage,
                        payment_method: wagePaymentMethod
                    });
                } catch (wageError) {
                    console.error('Error requesting wage payment:', wageError);
                    // No bloquear el cierre por error en solicitud de salario
                }
            }
            
            if (isSeller) {
                // Mensaje para vendedor que envía sesión
                setAlertModal({
                    isOpen: true,
                    title: 'Sesión enviada para revisión',
                    message: (
                        <div className="space-y-2">
                            <p className="text-emerald-400">Tu sesión ha sido enviada al administrador para revisión.</p>
                            <div className="grid grid-cols-2 gap-2 text-sm pt-2 border-t border-white/10">
                                <div className="text-slate-400">Ventas:</div>
                                <div className="text-right font-mono">${res.data.summary?.sales?.total?.toFixed(2) || '0.00'}</div>
                                <div className="text-slate-400">Gastos:</div>
                                <div className="text-right font-mono text-rose-400">-${res.data.summary?.expenses?.total?.toFixed(2) || '0.00'}</div>
                                <div className="text-slate-400">Neto Efectivo:</div>
                                <div className="text-right font-mono text-emerald-400">${res.data.summary?.final?.cash?.toFixed(2) || '0.00'}</div>
                                <div className="text-slate-400">Transferencia:</div>
                                <div className="text-right font-mono text-blue-400">${res.data.summary?.final?.transfer?.toFixed(2) || '0.00'}</div>
                            </div>
                            <p className="pt-2 border-t border-white/10">
                                Salario de esta sesión (5%): <span className="text-violet-400 font-mono">${res.data.wage?.toFixed(2)}</span>
                            </p>
                            {(res.data.accumulated?.total_pending_wage || totalPendingWage) > res.data.wage && (
                                <p className="text-xs text-amber-400">
                                    Total acumulado pendiente: <span className="font-mono font-bold">${(res.data.accumulated?.total_pending_wage || totalPendingWage).toFixed(2)}</span>
                                    {res.data.accumulated?.pending_sessions_count > 1 && (
                                        <span className="ml-1">({res.data.accumulated.pending_sessions_count} sesiones)</span>
                                    )}
                                </p>
                            )}
                            {requestWagePayment && <p className="text-emerald-400 text-xs">✓ Solicitud de pago enviada</p>}
                            <p className="text-xs text-muted-foreground mt-2">Recibirás una notificación cuando sea aprobada.</p>
                        </div>
                    ),
                    type: 'success',
                    onClose: () => window.location.reload()
                });
            } else {
                // Mensaje para admin/dueño que cierra sesión
                setAlertModal({
                    isOpen: true,
                    title: 'Sesión cerrada exitosamente',
                    message: (
                        <div className="space-y-2">
                            <p>Resumen del turno:</p>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <div className="text-slate-400">Ventas:</div>
                                <div className="text-right font-mono">${res.data.summary?.sales?.total?.toFixed(2) || '0.00'}</div>
                                <div className="text-slate-400">Gastos:</div>
                                <div className="text-right font-mono text-rose-400">-${res.data.summary?.expenses?.total?.toFixed(2) || '0.00'}</div>
                                <div className="text-slate-400">Neto Efectivo:</div>
                                <div className="text-right font-mono text-emerald-400">${res.data.summary?.final?.cash?.toFixed(2) || '0.00'}</div>
                                <div className="text-slate-400">Transferencia:</div>
                                <div className="text-right font-mono text-blue-400">${res.data.summary?.final?.transfer?.toFixed(2) || '0.00'}</div>
                            </div>
                            <p className="pt-2 border-t border-white/10">Salario del vendedor (5%): <span className="text-violet-400 font-mono">${res.data.wage?.toFixed(2)}</span></p>
                        </div>
                    ),
                    type: 'success',
                    onClose: () => window.location.reload()
                });
            }
        } catch (e) {
            setAlertModal({
                isOpen: true,
                title: 'Error',
                message: isSeller ? "Error al enviar sesión" : "Error al cerrar sesion",
                type: 'danger'
            });
        }
    };

    const checkBeforeCloseSession = () => {
        // Verificar si hay items en el carrito
        if (cart.length > 0) {
            setShowCartConfirm(true);
            return false;
        }

        // Verificar si hay ventas guardadas
        if (savedSales.length > 0) {
            setShowSavedConfirm(true);
            return false;
        }

        // Si llegamos aquí, no hay nada pendiente
        return true;
    };

    const handleCartConfirm = (shouldPay) => {
        if (shouldPay) {
            // Volver al POS para cobrar
            setShowCartConfirm(false);
        } else {
            // Borrar carrito y verificar ventas guardadas
            setCart([]);
            setShowCartConfirm(false);
            // Verificar si hay ventas guardadas después de borrar carrito
            setTimeout(() => {
                if (savedSales.length > 0) {
                    setShowSavedConfirm(true);
                } else {
                    // No hay nada pendiente, mostrar modal de cierre
                    fetchMetricsDirect();
                }
            }, 100);
        }
    };

    const handleSavedConfirm = (shouldPay) => {
        if (shouldPay) {
            // Volver al POS para cobrar las ventas guardadas
            setShowSavedConfirm(false);
        } else {
            // Eliminar ventas guardadas
            setSavedSales([]);
            setShowSavedConfirm(false);
            // Mostrar modal de cierre
            fetchMetricsDirect();
        }
    };

    const fetchMetricsDirect = async () => {
        if (!navigator.onLine) {
            setSessionMetrics({
                isOpen: true,
                salesCount: recentSales.length,
                totalSales: recentSales.reduce((acc, s) => acc + (s.total || 0), 0),
                totalExpenses: expenses.reduce((acc, e) => acc + (e.amount || 0), 0)
            });
            setShowClose(true);
            return;
        }

        try {
            // Use the new detailed metrics endpoint
            const res = await api.get('/sessions/metrics', { timeout: 2000 });
            setSessionMetrics(res.data);
            setShowClose(true);
        } catch (e) {
            console.error('Error fetching metrics:', e);
            // Fallback to basic status endpoint
            try {
                const res = await api.get('/sessions/status', { timeout: 1500 });
                setSessionMetrics(res.data);
            } catch (_) {
                setSessionMetrics({
                    isOpen: true,
                    salesCount: recentSales.length,
                    totalSales: recentSales.reduce((acc, s) => acc + (s.total || 0), 0)
                });
            }
            setShowClose(true);
        }
    };

    const fetchMetrics = async () => {
        // Verificar si hay items pendientes antes de mostrar el modal
        if (!checkBeforeCloseSession()) {
            return; // No mostrar el modal, se mostrarán los confirm
        }

        await fetchMetricsDirect();
    };

    return (
        <SessionGuard>
            <div className="h-[calc(100vh-6rem)] sm:h-[calc(100vh-8rem)] w-full bg-background text-foreground font-sans overflow-hidden rounded-2xl border border-border/50">

                {/* Editing Session Banner */}
                {editingSession && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border-b border-cyan-500/30 px-4 py-2 flex items-center justify-between"
                    >
                        <div className="flex items-center gap-3">
                            <RotateCcw className="w-4 h-4 text-cyan-400" />
                            <span className="text-sm">
                                <strong>Editando sesión #{editingSession.sale_id}</strong> • {editingSession.inventory} • {editingSession.seller}
                            </span>
                        </div>
                        <button
                            onClick={() => {
                                setEditingSession(null);
                                clearCart();
                            }}
                            className="text-xs px-3 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 transition-colors"
                        >
                            Terminar edición
                        </button>
                    </motion.div>
                )}

                {/* --- CONTENT AREA --- */}
                <div className={cn("flex flex-col lg:flex-row", editingSession ? "h-[calc(100%-40px)]" : "h-full")}>

                    {/* LEFT COLUMN: Cart - Full width on mobile, 60% on desktop */}
                    <div className="w-full lg:w-[60%] flex flex-col h-full border-b lg:border-b-0 lg:border-r border-border/50 bg-gradient-to-br from-background via-background to-card/30 relative">

                        {/* Search Bar Premium - Componente Modular */}
                        <div className="h-12 sm:h-16 flex-none px-2 sm:px-4 flex items-center gap-2 sm:gap-4 border-b border-border/50 bg-card/30 backdrop-blur-sm relative z-30">
                            <div className="relative flex-1 min-w-0">
                                <SearchBar
                                    ref={inputRef}
                                    value={search}
                                    onChange={setSearch}
                                    onSearch={useCallback((query, isNumber) => {
                                        if (query.length >= 1) {
                                            performSearch(query);
                                        } else {
                                            setSearchResults([]);
                                        }
                                    }, [performSearch])}
                                    onSelect={handleSelectProduct}
                                    results={searchResults}
                                    loading={loadingProduct}
                                    placeholder="Buscar producto..."
                                    variant="large"
                                    showDropdown={true}
                                    autoFocus={true}
                                    renderResult={(product, index) => {
                                        const stock = product.inventory?.[currentInventory] || 0;
                                        return (
                                            <motion.div
                                                key={generateSafeKey('prod-result', product, index)}
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: index * 0.03 }}
                                                className="w-full flex items-center gap-3 p-3 rounded-lg bg-slate-800/80 hover:bg-cyan-950/50 border border-slate-700 hover:border-cyan-500/40 transition-all text-left group"
                                            >
                                                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center border border-cyan-500/30 shrink-0">
                                                    <Package2 className="w-5 h-5 text-cyan-400" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-semibold text-foreground text-sm truncate group-hover:text-cyan-400 transition-colors">
                                                        {product.name}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                                                        <span>{product.code || 'S/C'}</span>
                                                        <span className="w-1 h-1 rounded-full bg-muted-foreground/50"></span>
                                                        <span className={stock <= 0 ? "text-amber-400 font-medium" : "text-emerald-400 font-medium"}>
                                                            Stock: {stock} {stock <= 0 && '(Venta contingencia)'}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <div className="font-bold text-foreground text-sm font-mono">
                                                        ${product.sale_price_manual?.toFixed(2) || '0.00'}
                                                    </div>
                                                    <div className="text-[10px] text-muted-foreground">MN</div>
                                                </div>
                                            </motion.div>
                                        );
                                    }}
                                />
                            </div>

                            {/* Botón de Venta Rápida / Comodín */}
                            <button
                                onClick={() => setShowQuickSaleModal(true)}
                                className="h-10 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-medium text-xs flex items-center gap-1.5 transition-all whitespace-nowrap shadow-sm"
                                title="Venta rápida manual / comodín sin catálogo"
                            >
                                <Sparkles className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Venta Rápida</span>
                            </button>
                        </div>

                        {/* Cart List Premium - Hidden on mobile when viewing tickets */}
                        <div className={cn(
                            "flex-1 overflow-y-auto p-2 sm:p-3 scrollbar-thin relative z-0 pb-24 lg:pb-0",
                            mobileView !== 'cart' && "hidden lg:block"
                        )}>
                            {cart.length > 0 ? (
                                <div className="space-y-2" style={{ position: 'relative', zIndex: 0 }}>
                                    <AnimatePresence mode="popLayout">
                                        {cart.map((item, index) => (
                                            <motion.div
                                                key={generateSafeKey('cart-item', item, index)}
                                                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                exit={{ opacity: 0, x: -100, scale: 0.9 }}
                                                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                                                className="group relative p-2 sm:p-3 rounded-xl bg-slate-800 border border-slate-700 hover:border-cyan-500/30 hover:bg-slate-700 transition-all"
                                            >
                                                <div className="flex items-center gap-2 sm:gap-3">
                                                    {/* Quantity Controls */}
                                                    <div className="flex items-center gap-1 bg-secondary/50 rounded-lg p-1 border border-white/5">
                                                        <button
                                                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                                            className="w-9 h-9 sm:w-7 sm:h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-white hover:bg-white/10 transition-all min-w-[36px] min-h-[36px] sm:min-w-0 sm:min-h-0"
                                                        >
                                                            <Minus className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                                                        </button>
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            value={item.quantity}
                                                            onChange={(e) => {
                                                                const val = parseInt(e.target.value);
                                                                if (val > 0) updateQuantity(item.id, val);
                                                            }}
                                                            onBlur={(e) => {
                                                                const val = parseInt(e.target.value);
                                                                if (!val || val < 1) updateQuantity(item.id, 1);
                                                            }}
                                                            className="w-10 text-center font-bold tabular-nums bg-transparent border-none outline-none text-foreground text-base sm:text-sm"
                                                        />
                                                        <button
                                                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                                            className="w-9 h-9 sm:w-7 sm:h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-white hover:bg-white/10 transition-all min-w-[36px] min-h-[36px] sm:min-w-0 sm:min-h-0"
                                                        >
                                                            <Plus className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                                                        </button>
                                                    </div>

                                                    {/* Product Info */}
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="font-semibold text-foreground truncate text-sm leading-tight">{item.name}</h4>
                                                    </div>

                                                    {/* Prices */}
                                                    <div className="text-right">
                                                        <div className="font-bold text-emerald-400 font-mono">${(item.sale_price_manual * item.quantity).toFixed(2)}</div>
                                                        <div className="text-xs text-slate-500">
                                                            {(item.inventory?.[currentInventory] || 0) - item.quantity} en stock
                                                        </div>
                                                    </div>

                                                    {/* Delete Button */}
                                                    <button
                                                        onClick={() => removeFromCart(item.id)}
                                                        className="p-2 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-all"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-muted-foreground/40">
                                    <motion.div
                                        initial={{ scale: 0.8, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        className="w-20 h-20 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 flex items-center justify-center mb-3"
                                    >
                                        <ShoppingCart className="w-8 h-8 text-cyan-500/50" />
                                    </motion.div>
                                    <p className="text-base font-medium">Carrito vacío</p>
                                    <p className="text-xs">Escanea un producto para comenzar</p>
                                </div>
                            )}
                        </div>

                        {/* Mobile View Tabs - Only visible on mobile */}
                        <div className="lg:hidden fixed bottom-[72px] left-0 right-0 z-50 h-11 flex-none bg-card/95 backdrop-blur-xl border-y border-border/50 flex shadow-[0_-6px_20px_rgba(0,0,0,0.25)]">
                            <button
                                onClick={() => setMobileView('cart')}
                                className={cn(
                                    "flex-1 flex items-center justify-center gap-1.5 text-xs font-medium transition-all",
                                    mobileView === 'cart'
                                        ? "bg-cyan-500/10 text-cyan-400 border-b-2 border-cyan-500"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <ShoppingCart className="w-3.5 h-3.5" />
                                Carrito {cart.length > 0 && <span className="bg-cyan-500 text-white text-[10px] px-1.5 py-0 rounded-full">{cart.length}</span>}
                            </button>
                            <button
                                onClick={() => setMobileView('tickets')}
                                className={cn(
                                    "flex-1 flex items-center justify-center gap-1.5 text-xs font-medium transition-all",
                                    mobileView === 'tickets'
                                        ? "bg-violet-500/10 text-violet-400 border-b-2 border-violet-500"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <History className="w-3.5 h-3.5" />
                                Tickets {recentSales.length > 0 && <span className="bg-violet-500 text-white text-[10px] px-1.5 py-0 rounded-full">{recentSales.length}</span>}
                            </button>
                        </div>

                        {/* Footer Premium - Fixed Bottom Bar on Mobile */}
                        <div className="fixed bottom-0 left-0 right-0 lg:static lg:h-16 lg:sm:h-20 min-h-[72px] lg:min-h-0 flex-none bg-card/95 lg:bg-card/80 backdrop-blur-xl border-t border-border/50 px-3 sm:px-4 flex items-center justify-between z-40 lg:z-auto pb-safe">
                            {/* Total Display */}
                            <div className="flex flex-col justify-center">
                                <div className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-0.5">Total</div>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-base sm:text-xl text-emerald-500 font-medium">$</span>
                                    <span className="text-xl sm:text-4xl font-black text-foreground tracking-tight tabular-nums">{total.toFixed(2)}</span>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-2 sm:gap-3">
                                {/* Save Button */}
                                <button
                                    onClick={handleSaveSale}
                                    disabled={cart.length === 0}
                                    className="h-12 sm:h-12 min-h-[48px] min-w-[48px] px-3 sm:px-4 rounded-xl bg-secondary/50 border border-white/5 text-muted-foreground hover:text-foreground hover:bg-secondary hover:border-white/10 transition-all flex items-center justify-center gap-1.5 sm:gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    aria-label="Guardar venta"
                                >
                                    <Save className="w-5 h-5 sm:w-4 sm:h-4" />
                                    <span className="text-xs sm:text-sm font-semibold hidden sm:inline">Guardar</span>
                                </button>

                                {/* Checkout Button */}
                                <button
                                    onClick={handleCheckoutClick}
                                    disabled={cart.length === 0 || checkoutProcessing}
                                    className="h-12 sm:h-12 min-h-[48px] min-w-[100px] sm:min-w-0 px-4 sm:px-6 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-semibold shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {checkoutProcessing ? (
                                        <Loader2 className="animate-spin w-5 h-5 sm:w-4 sm:h-4" />
                                    ) : (
                                        <Banknote className="w-5 h-5 sm:w-4 sm:h-4" />
                                    )}
                                    <span className="text-sm sm:text-base whitespace-nowrap">Cobrar</span>
                                    <ArrowRight className="w-4 h-4 hidden sm:block" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Sidebar - Full width on mobile when viewing tickets, 40% on desktop */}
                    <div className={cn(
                        "flex-col h-full bg-card/30",
                        mobileView === 'tickets' ? "flex lg:hidden w-full" : "hidden lg:flex lg:w-[40%]"
                    )}>

                        {/* Session Info */}
                        <div className="h-14 flex-none px-4 border-b border-border/50 flex items-center justify-between bg-card/50">
                            <div className="flex items-center gap-2">
                                <History className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm font-semibold text-muted-foreground">Tickets y ventas del turno</span>
                            </div>
                            <button
                                onClick={fetchMetrics}
                                className={cn(
                                    "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                                    isSeller
                                        ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
                                        : "bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20"
                                )}
                            >
                                <LogOut className="w-3 h-3" />
                                {isSeller ? 'Enviar Sesión' : 'Cerrar Sesión'}
                            </button>
                        </div>

                        {/* Recent Sales List */}
                        <div className="flex-1 overflow-y-auto p-3 space-y-2 pb-24 lg:pb-3">
                            {/* Ventas Guardadas (Pendientes) */}
                            <AnimatePresence>
                                {savedSales.map((sale, index) => (
                                    <motion.div
                                        key={generateSafeKey('saved-sale', sale, index)}
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        transition={{ delay: index * 0.05 }}
                                        className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 hover:border-amber-500/40 transition-all group"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                                                    <Save className="w-4 h-4 text-amber-400" />
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-foreground text-sm flex items-center gap-2">
                                                        <span>{sale.name || `Ticket #${sale.id}`}</span>
                                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/20 text-amber-400">EN ESPERA</span>
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">{sale.time} • {sale.items?.length || 0} producto(s)</div>
                                                </div>
                                            </div>
                                            <div className="font-bold font-mono text-foreground">${sale.total?.toFixed(2)}</div>
                                        </div>
                                        <div className="flex gap-2 mt-2">
                                            <button
                                                onClick={() => handleEditSavedSale(sale)}
                                                className="flex-1 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 text-xs font-semibold hover:bg-cyan-500/30 transition-all flex items-center justify-center gap-1"
                                            >
                                                <Edit className="w-3 h-3" /> Editar
                                            </button>
                                            <button
                                                onClick={() => handleDeleteSavedSale(sale.id)}
                                                className="px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-400 text-xs font-semibold hover:bg-rose-500/30 transition-all flex items-center justify-center gap-1"
                                            >
                                                <Trash2 className="w-3 h-3" /> Eliminar
                                            </button>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>

                            {/* Gastos */}
                            <AnimatePresence>
                                {expenses.map((expense, index) => (
                                    <motion.div
                                        key={generateSafeKey('expense', expense, index)}
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        transition={{ delay: index * 0.05 }}
                                        className="p-3 rounded-xl bg-card/50 border border-border/50 hover:border-rose-500/30 hover:bg-card/80 transition-all"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                                                    <Receipt className="w-4 h-4 text-rose-500" />
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-foreground text-sm">{expense.name}</div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {expense.time} • {expense.description || 'Gasto registrado'}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="font-bold font-mono text-rose-400">-${expense.amount?.toFixed(2)}</div>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>

                            {/* Ventas Cobradas */}
                            <AnimatePresence>
                                {recentSales.map((sale, index) => (
                                    <motion.div
                                        key={generateSafeKey('recent-sale', sale, index)}
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        transition={{ delay: index * 0.05 }}
                                        className="p-3 rounded-xl bg-card/50 border border-border/50 hover:border-emerald-500/30 hover:bg-card/80 transition-all cursor-pointer group"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                                                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-foreground text-sm">Venta #{sale.id}</div>
                                                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                                                        <span>{sale.time}</span>
                                                        <span className="w-1 h-1 rounded-full bg-muted-foreground/50"></span>
                                                        <span className={cn(
                                                            "px-1.5 py-0.5 rounded text-[10px] font-medium uppercase",
                                                            sale.method === 'transfer'
                                                                ? "bg-blue-500/10 text-blue-400"
                                                                : "bg-emerald-500/10 text-emerald-400"
                                                        )}>
                                                            {sale.method === 'transfer' ? 'Transf' : 'Efectivo'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="font-bold font-mono text-foreground">${sale.total?.toFixed(2)}</div>
                                        </div>
                                        <div className="flex gap-2 mt-2">
                                            <button
                                                onClick={() => handleGenerateSaleQR(sale)}
                                                className="px-2.5 py-1.5 rounded-lg bg-pink-500/20 text-pink-400 text-xs font-semibold hover:bg-pink-500/30 transition-all flex items-center justify-center gap-1"
                                                title="Generar QR de esta venta para sincronizar al Admin"
                                            >
                                                <QrCode className="w-3 h-3" /> QR
                                            </button>
                                            <button
                                                onClick={() => handleEditSale(sale)}
                                                className="flex-1 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 text-xs font-semibold hover:bg-cyan-500/30 transition-all flex items-center justify-center gap-1"
                                            >
                                                <Edit className="w-3 h-3" /> Editar
                                            </button>
                                            <button
                                                onClick={() => handleDeleteSale(sale.id)}
                                                className="px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-400 text-xs font-semibold hover:bg-rose-500/30 transition-all flex items-center justify-center gap-1"
                                            >
                                                <Trash2 className="w-3 h-3" /> Borrar
                                            </button>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>

                            {recentSales.length === 0 && savedSales.length === 0 && expenses.length === 0 && (
                                <div className="h-full flex flex-col items-center justify-center text-muted-foreground/40 py-8">
                                    <History className="w-10 h-10 mb-2 opacity-50" />
                                    <p className="text-sm">Sin ventas en este turno</p>
                                </div>
                            )}
                        </div>

                        {/* Quick Actions */}
                        <div className="h-20 flex-none p-3 border-t border-border/50 bg-card/50">
                            <div className="grid grid-cols-2 gap-2 h-full">
                                <button
                                    onClick={() => setShowExpense(true)}
                                    className="flex items-center gap-2 px-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 hover:bg-amber-500/20 transition-all group"
                                >
                                    <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <Receipt className="w-4 h-4" />
                                    </div>
                                    <div className="text-left">
                                        <div className="font-semibold text-sm">Gastos</div>
                                        <div className="text-[10px] text-amber-400/70">Registrar</div>
                                    </div>
                                </button>

                                <button
                                    onClick={() => setShowReturn(true)}
                                    className="flex items-center gap-2 px-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 hover:bg-rose-500/20 transition-all group"
                                >
                                    <div className="w-8 h-8 rounded-lg bg-rose-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <RotateCcw className="w-4 h-4" />
                                    </div>
                                    <div className="text-left">
                                        <div className="font-semibold text-sm">Devolución</div>
                                        <div className="text-[10px] text-rose-400/70">Procesar</div>
                                    </div>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Modals */}
                <AnimatePresence>
                    {showExpense && (
                        <ExpenseModal
                            key="expense-modal"
                            onClose={() => setShowExpense(false)}
                            onSave={async (data) => {
                                try {
                                    await api.post('/expenses', data);
                                    // Agregar el gasto a la lista local
                                    const newExpense = {
                                        id: `exp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                                        type: 'expense',
                                        name: data.type,
                                        amount: data.amount,
                                        description: data.description,
                                        time: new Date().toLocaleTimeString(),
                                        isExpense: true
                                    };
                                    setExpenses(prev => [newExpense, ...prev]);
                                    setShowExpense(false);
                                } catch (e) {
                                    setAlertModal({
                                        isOpen: true,
                                        title: 'Error',
                                        message: "Error al registrar el gasto",
                                        type: 'danger'
                                    });
                                }
                            }}
                        />
                    )}
                    {showReturn && (
                        <ReturnsModule
                            key="returns-module"
                            onClose={() => setShowReturn(false)}
                            onSave={async (returnData) => {
                                try {
                                    // Crear FormData para enviar imágenes
                                    const formData = new FormData();
                                    formData.append('type', returnData.type);
                                    formData.append('items', JSON.stringify(returnData.items));
                                    formData.append('total_amount', returnData.total_amount);
                                    formData.append('notes', returnData.notes);
                                    formData.append('inventory_id', returnData.inventory_id);

                                    // Agregar imágenes
                                    returnData.images.forEach((image, index) => {
                                        formData.append(`evidence_${index}`, image);
                                    });

                                    await api.post('/returns', formData, {
                                        headers: { 'Content-Type': 'multipart/form-data' }
                                    });

                                    setShowReturn(false);
                                    setAlertModal({
                                        isOpen: true,
                                        title: 'Devolución registrada',
                                        message: 'Devolución registrada exitosamente',
                                        type: 'success'
                                    });
                                } catch (e) {
                                    console.error('Error saving return:', e);
                                    setAlertModal({
                                        isOpen: true,
                                        title: 'Error',
                                        message: e.response?.data?.error || 'Error al registrar la devolución',
                                        type: 'danger'
                                    });
                                }
                            }}
                        />
                    )}
                    {showClose && (
                        <CloseSessionModal
                            key="close-session-modal"
                            metrics={sessionMetrics}
                            summary={closeSummary}
                            onClose={() => setShowClose(false)}
                            onSave={handleCloseSession}
                            role={currentRole}
                        />
                    )}
                    {showPayment && (
                        <PaymentModal
                            key="payment-modal"
                            total={total}
                            onClose={() => setShowPayment(false)}
                            onConfirm={processPayment}
                        />
                    )}

                    {/* Modal Guardar Ticket con Nombre Personalizado */}
                    {showSaveTicketModal && (
                        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="bg-card border border-border/60 rounded-2xl p-6 w-full max-w-md shadow-2xl relative"
                            >
                                <div className="flex items-center justify-between pb-3 border-b border-border/40">
                                    <div className="flex items-center gap-2.5">
                                        <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                                            <Save className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-foreground text-lg">{editingSavedSale ? 'Actualizar Ticket' : 'Guardar Ticket'}</h3>
                                            <p className="text-xs text-muted-foreground">{editingSavedSale ? 'Conservá el nombre o cambialo si hace falta' : 'Ponle un nombre o referencia para identificarlo'}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => { setShowSaveTicketModal(false); setEditingSavedSale(null); setTicketCustomName(''); }}
                                                                                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>

                                <form
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        confirmSaveSale(ticketCustomName);
                                    }}
                                    className="mt-4 space-y-4"
                                >
                                    <div>
                                        <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                                            Nombre del Cliente o Referencia:
                                        </label>
                                        <input
                                            type="text"
                                            autoFocus
                                            value={ticketCustomName}
                                            onChange={(e) => setTicketCustomName(e.target.value)}
                                            placeholder={`Ej: Cliente Juan / Ticket #${savedSales.length + 1}`}
                                            className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 text-foreground text-sm outline-none transition-all placeholder:text-muted-foreground/50"
                                        />
                                        <span className="text-[11px] text-muted-foreground mt-1 block">
                                            Si lo dejas vacío, se guardará como <strong>Ticket #{savedSales.length + 1}</strong>.
                                        </span>
                                    </div>

                                    <div className="bg-secondary/30 rounded-xl p-3 border border-white/5 flex items-center justify-between text-xs">
                                        <span className="text-muted-foreground">Productos en ticket: <strong>{cart.length}</strong></span>
                                        <span className="text-amber-400 font-bold font-mono text-sm">${total.toFixed(2)} CUP</span>
                                    </div>

                                    <div className="flex items-center justify-end gap-2 pt-2">
                                        <button
                                            type="button"
                                            onClick={() => { setShowSaveTicketModal(false); setEditingSavedSale(null); setTicketCustomName(''); }}
                                                                                        className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="submit"
                                            className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-1.5"
                                        >
                                            <Save className="w-4 h-4" />
                                            Guardar Ticket
                                        </button>
                                    </div>
                                </form>
                            </motion.div>
                        </div>
                    )}

                    {/* Confirm Modals */}
                    {showCartConfirm && (
                        <ConfirmModal
                            key="cart-confirm"
                            isOpen={showCartConfirm}
                            onClose={() => setShowCartConfirm(false)}
                            onConfirm={() => handleCartConfirm(true)}
                            title="Carrito con productos"
                            message={
                                <>
                                    Tienes <strong>{cart.length} producto(s)</strong> en el carrito por <strong>${total.toFixed(2)}</strong>.
                                    <br /><br />
                                    ¿Deseas <strong>COBRAR</strong> esta venta antes de cerrar sesión?
                                </>
                            }
                            confirmText="Cobrar venta"
                            cancelText="Borrar carrito"
                            type="warning"
                            icon={ShoppingCart}
                        />
                    )}

                    {showSavedConfirm && (
                        <ConfirmModal
                            key="saved-confirm"
                            isOpen={showSavedConfirm}
                            onClose={() => setShowSavedConfirm(false)}
                            onConfirm={() => handleSavedConfirm(true)}
                            title="Ventas guardadas pendientes"
                            message={
                                <>
                                    Tienes <strong>{savedSales.length} venta(s) guardada(s)</strong> por <strong>${savedSales.reduce((sum, s) => sum + s.total, 0).toFixed(2)}</strong>.
                                    <br /><br />
                                    ¿Deseas <strong>COBRARLAS</strong> antes de cerrar sesión?
                                </>
                            }
                            confirmText="Cobrar ventas"
                            cancelText="Eliminar guardadas"
                            type="info"
                            icon={Save}
                        />
                    )}

                    {/* Dynamic Alert Modal */}
                    <AlertModal
                        key="alert-modal"
                        isOpen={alertModal.isOpen}
                        onClose={() => {
                            if (alertModal.onClose) {
                                alertModal.onClose();
                            }
                            setAlertModal({ ...alertModal, isOpen: false });
                        }}
                        title={alertModal.title}
                        message={alertModal.message}
                        type={alertModal.type}
                    />

                    {/* Dynamic Confirm Modal */}
                    <ConfirmModal
                        key="confirm-modal"
                        isOpen={confirmModal.isOpen}
                        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                        onConfirm={() => {
                            if (confirmModal.onConfirm) {
                                confirmModal.onConfirm();
                            }
                            setConfirmModal({ ...confirmModal, isOpen: false });
                        }}
                        title={confirmModal.title}
                        message={confirmModal.message}
                        type={confirmModal.type}
                    />

                    {/* Modal Generador de QR para la Venta/Cierre */}
                    {qrModalOpen && qrPayload && (
                        <QRGeneratorModal
                            isOpen={qrModalOpen}
                            onClose={() => setQrModalOpen(false)}
                            payload={qrPayload}
                            title="Código QR de Venta / Sincronización"
                            type="SALE"
                        />
                    )}

                    {/* Modal de Venta Rápida / Contingencia */}
                    {showQuickSaleModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
                            <form onSubmit={handleAddQuickSale} className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-amber-400 font-bold">
                                        <Sparkles className="w-5 h-5" />
                                        <span>Venta Rápida / Contingencia</span>
                                    </div>
                                    <button 
                                        type="button" 
                                        onClick={() => setShowQuickSaleModal(false)}
                                        className="text-slate-400 hover:text-white"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                                <p className="text-xs text-slate-400">
                                    Agregá un producto de contingencia o precio libre al carrito de inmediato.
                                </p>
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-xs text-slate-300 font-medium mb-1 block">Descripción (opcional):</label>
                                        <input
                                            type="text"
                                            value={quickSaleData.name}
                                            onChange={(e) => setQuickSaleData({ ...quickSaleData, name: e.target.value })}
                                            placeholder="Ej. Bolso de playa, Accesorio, etc."
                                            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:border-amber-500 outline-none"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs text-slate-300 font-medium mb-1 block">Precio ($ MN): *</label>
                                            <input
                                                type="number"
                                                step="any"
                                                required
                                                autoFocus
                                                value={quickSaleData.price}
                                                onChange={(e) => setQuickSaleData({ ...quickSaleData, price: e.target.value })}
                                                placeholder="0.00"
                                                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm font-mono focus:border-amber-500 outline-none font-bold"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-slate-300 font-medium mb-1 block">Cantidad:</label>
                                            <input
                                                type="number"
                                                min="1"
                                                value={quickSaleData.quantity}
                                                onChange={(e) => setQuickSaleData({ ...quickSaleData, quantity: e.target.value })}
                                                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm font-mono focus:border-amber-500 outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowQuickSaleModal(false)}
                                        className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black font-bold text-sm transition-all shadow-lg shadow-amber-500/20"
                                    >
                                        Agregar al Carrito
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </SessionGuard>
    );
}
