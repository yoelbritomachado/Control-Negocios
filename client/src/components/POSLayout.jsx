import React, { useState, useEffect, useRef } from 'react';
import { useCart } from './CartProvider';
import InventorySelector from './InventorySelector';
import api, { fetchProducts } from '../api';
import SessionGuard from './SessionGuard';
import PaymentModal from './PaymentModal';
import SearchDropdown from './SearchDropdown';
import ConfirmModal from './ConfirmModal';
import AlertModal from './AlertModal';
import ReturnsModule from './ReturnsModule';
import {
    ShoppingCart, Trash2, Banknote, Save, RotateCcw,
    Receipt, Search, History, LogOut, Loader2,
    CheckCircle2, Camera, Package2, X, Plus, Minus,
    Sparkles, TrendingUp, ArrowRight, Wallet, Edit, AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';

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
            description: isCustomExpense() ? desc : selectedType?.name 
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
                            {expenseTypes.map((expenseType) => (
                                <option key={expenseType.id} value={expenseType.id} className="bg-gray-900">
                                    {expenseType.name} (${expenseType.amount.toFixed(2)})
                                </option>
                            ))}
                        </select>
                    </div>

                    {isCustomExpense() && (
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nombre del Gasto</label>
                            <input
                                type="text"
                                placeholder="Ej: Compra de material de oficina..."
                                value={desc}
                                onChange={e => setDesc(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 outline-none transition-all"
                                required={isCustomExpense()}
                            />
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Monto</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-mono">$</span>
                            <input
                                type="number"
                                placeholder="0.00"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-4 py-3 text-white focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 outline-none transition-all font-mono text-lg"
                                required
                            />
                        </div>
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

const CloseSessionModal = ({ onClose, onSave, metrics }) => {
    const [cash, setCash] = useState('');
    const [notes, setNotes] = useState('');

    return (
        <ModalOverlay onClose={onClose}>
            <div className="p-6 space-y-6">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center">
                        <LogOut className="w-6 h-6 text-violet-500" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-white">Cerrar Sesión</h3>
                        <p className="text-sm text-muted-foreground">Finaliza tu sesión de trabajo</p>
                    </div>
                </div>

                <div className="p-4 rounded-xl bg-gradient-to-br from-violet-500/10 to-purple-500/10 border border-violet-500/20">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center">
                                <TrendingUp className="w-5 h-5 text-violet-400" />
                            </div>
                            <div>
                                <div className="text-xs text-muted-foreground uppercase tracking-wider">Ventas del Turno</div>
                                <div className="text-2xl font-bold text-white font-mono">${metrics?.currentSales || '0.00'}</div>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-xs text-muted-foreground">Tu 5%</div>
                            <div className="text-lg font-bold text-violet-400 font-mono">${((metrics?.currentSales || 0) * 0.05).toFixed(2)}</div>
                        </div>
                    </div>
                </div>

                <form onSubmit={(e) => { e.preventDefault(); onSave(cash, notes); }} className="space-y-5">
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
                            className="flex-1 px-4 py-3 bg-gradient-to-r from-violet-600 to-purple-500 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-violet-500/25 transition-all flex items-center justify-center gap-2"
                        >
                            <LogOut className="w-4 h-4" />
                            Cerrar y Calcular
                        </button>
                    </div>
                </form>
            </div>
        </ModalOverlay>
    );
};

// --- MAIN LAYOUT ---

export default function POSLayout() {
    const { cart, setCart, removeFromCart, updateQuantity, total, clearCart, addToCart, currentInventory } = useCart();
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
    const [sessionMetrics, setSessionMetrics] = useState(null);
    
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

    // Search with debounce
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (search.trim().length >= 2) {
                performSearch(search.trim());
            } else {
                setSearchResults([]);
                setShowSearchDropdown(false);
            }
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [search]);

    const performSearch = async (query) => {
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
    };

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

        const savedSale = {
            id: `S-${Date.now()}`,
            items: [...cart],
            total: total,
            time: new Date().toLocaleTimeString(),
            status: 'saved',
            inventoryId: currentInventory
        };

        setSavedSales(prev => [savedSale, ...prev]);
        clearCart();
        setAlertModal({
            isOpen: true,
            title: 'Venta guardada',
            message: 'Venta guardada. No se suma al total de la sesion hasta que se cobre.',
            type: 'info'
        });
    };

    const handleEditSavedSale = (sale) => {
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
                        id: Date.now(),
                        items: [...cart],
                        total: total,
                        time: new Date().toLocaleTimeString(),
                        date: new Date().toISOString()
                    };
                    setSavedSales(prev => [savedSale, ...prev]);
                    
                    // Cargar items de la venta al carrito
                    sale.items.forEach(item => {
                        addToCart(item, item.quantity);
                    });
                    // Eliminar la venta guardada
                    setSavedSales(prev => prev.filter(s => s.id !== sale.id));
                }
            });
            return;
        }
        
        // Cargar items de la venta al carrito
        sale.items.forEach(item => {
            addToCart(item, item.quantity);
        });
        // Eliminar la venta guardada
        setSavedSales(prev => prev.filter(s => s.id !== sale.id));
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
                        id: Date.now(),
                        items: [...cart],
                        total: total,
                        time: new Date().toLocaleTimeString(),
                        date: new Date().toISOString()
                    };
                    setSavedSales(prev => [savedSale, ...prev]);
                    
                    // Reemplazar completamente el carrito con los items de la venta
                    // Usar setCart directamente para evitar problemas de sincronización
                    const newCartItems = sale.items.map(item => ({
                        id: item.id,
                        name: item.name,
                        code: item.code,
                        sale_price_manual: item.sale_price_manual || item.price,
                        cost_mn: item.cost_mn || item.cost,
                        quantity: item.quantity
                    }));
                    setCart(newCartItems);
                    
                    // Eliminar la venta original
                    setRecentSales(prev => prev.filter(s => s.id !== sale.id));
                }
            });
            return;
        }
        
        // Cargar items de la venta al carrito (reemplazo completo)
        const newCartItems = sale.items.map(item => ({
            id: item.id,
            name: item.name,
            code: item.code,
            sale_price_manual: item.sale_price_manual || item.price,
            cost_mn: item.cost_mn || item.cost,
            quantity: item.quantity
        }));
        setCart(newCartItems);
        // Eliminar la venta original
        setRecentSales(prev => prev.filter(s => s.id !== sale.id));
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
            // Validar que todos los items tengan ID válido
            const invalidItems = cart.filter(item => !item.id);
            if (invalidItems.length > 0) {
                throw new Error(`Hay ${invalidItems.length} producto(s) sin ID válido. Por favor elimínelos y vuelva a agregarlos.`);
            }

            // Determinar el método de pago principal
            let paymentMethod = 'cash';
            if (paymentData.method === 'mixed') {
                paymentMethod = 'mixed';
            } else if (paymentData.transferAmount > 0) {
                paymentMethod = 'transfer';
            }

            const res = await api.post('/sales', {
                items: cart,
                total: total,
                paymentMethod: paymentMethod,
                amountReceived: paymentData.amountReceived,
                change: paymentData.change,
                inventoryId: currentInventory,
                cashAmount: paymentData.cashAmount,
                transferAmount: paymentData.transferAmount
            });
            
            if (!res || !res.data) {
                throw new Error('No se recibió respuesta del servidor');
            }
            
            if (res.data.success) {
                // Guardar la venta con sus items para poder editarla después
                const completedSale = {
                    id: res.data.saleId,
                    items: cart.map(item => ({
                        id: item.id,
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
            }
        } catch (e) {
            console.error('Error al cobrar:', e);
            setAlertModal({
                isOpen: true,
                title: 'Error al cobrar',
                message: e.response?.data?.error || "Error al cobrar",
                type: 'danger'
            });
        }
        finally {
            setCheckoutProcessing(false);
        }
    };

    const handleCloseSession = async (cash, notes) => {
        try {
            const res = await api.post('/sessions/close', { declared_cash: cash, notes });
            setAlertModal({
                isOpen: true,
                title: 'Sesión cerrada',
                message: `Sesion Cerrada. Salario Calculado: $${res.data.wage}`,
                type: 'success',
                onClose: () => window.location.reload()
            });
        } catch (e) { 
            setAlertModal({
                isOpen: true,
                title: 'Error',
                message: "Error al cerrar sesion",
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
        const res = await api.get('/sessions/status');
        setSessionMetrics(res.data);
        setShowClose(true);
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
            <div className="h-[calc(100vh-8rem)] w-full bg-background text-foreground font-sans overflow-hidden rounded-2xl border border-border/50">

                {/* --- CONTENT AREA --- */}
                <div className="flex h-full">

                    {/* LEFT COLUMN: Cart (60%) */}
                    <div className="w-[60%] flex flex-col h-full border-r border-border/50 bg-gradient-to-br from-background via-background to-card/30 relative">

                        {/* Search Bar Premium */}
                        <div className="h-16 flex-none px-4 flex items-center gap-4 border-b border-border/50 bg-card/30 backdrop-blur-sm">
                            <div className="relative flex-1">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    onKeyDown={handleSearchKeyDown}
                                    placeholder="Escanear código o buscar producto..."
                                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-12 py-2.5 text-foreground placeholder:text-muted-foreground/60 text-base font-medium focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-all"
                                    autoFocus
                                />
                                {loadingProduct && (
                                    <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-cyan-500 w-5 h-5" />
                                )}

                                {/* Search Results Dropdown usando Portal */}
                                <SearchDropdown
                                    isOpen={showSearchDropdown && searchResults.length > 0}
                                    onClose={() => setShowSearchDropdown(false)}
                                    searchResults={searchResults}
                                    currentInventory={currentInventory}
                                    onSelectProduct={handleSelectProduct}
                                    inputRef={inputRef}
                                />
                            </div>
                        </div>

                        {/* Cart List Premium */}
                        <div className="flex-1 overflow-y-auto p-3 scrollbar-thin">
                            {cart.length > 0 ? (
                                <div className="space-y-2">
                                    <AnimatePresence mode="popLayout">
                                        {cart.map((item, index) => (
                                            <motion.div
                                                key={item.id || `item-${index}`}
                                                layout
                                                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                exit={{ opacity: 0, x: -100, scale: 0.9 }}
                                                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                                                className="group relative p-3 rounded-xl bg-card/50 border border-border/50 hover:border-cyan-500/30 hover:bg-card/80 transition-all"
                                            >
                                                <div className="flex items-center gap-3">
                                                    {/* Quantity Controls */}
                                                    <div className="flex items-center gap-1 bg-secondary/50 rounded-lg p-1 border border-white/5">
                                                        <button
                                                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                                            className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-white hover:bg-white/10 transition-all"
                                                        >
                                                            <Minus className="w-3.5 h-3.5" />
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
                                                            className="w-10 text-center font-bold tabular-nums bg-transparent border-none outline-none text-foreground"
                                                        />
                                                        <button
                                                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                                            className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-white hover:bg-white/10 transition-all"
                                                        >
                                                            <Plus className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>

                                                    {/* Product Info */}
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="font-semibold text-foreground truncate text-sm">{item.name}</h4>
                                                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                                            <Package2 className="w-3 h-3" />
                                                            <span className="font-mono">{item.code || 'SIN CÓDIGO'}</span>
                                                        </div>
                                                    </div>

                                                    {/* Prices */}
                                                    <div className="text-right">
                                                        <div className="font-bold text-emerald-400 font-mono">${(item.sale_price_manual * item.quantity).toFixed(2)}</div>
                                                        <div className="text-xs text-muted-foreground">${item.sale_price_manual} c/u</div>
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

                        {/* Footer Premium */}
                        <div className="h-20 flex-none bg-card/80 backdrop-blur-xl border-t border-border/50 px-4 flex items-center justify-between">
                            <div>
                                <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-0.5">Total a Pagar</div>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-xl text-emerald-500 font-medium">$</span>
                                    <span className="text-4xl font-black text-foreground tracking-tight tabular-nums">{total.toFixed(2)}</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleSaveSale}
                                    disabled={cart.length === 0}
                                    className="h-12 px-4 rounded-xl bg-secondary/50 border border-white/5 text-muted-foreground hover:text-foreground hover:bg-secondary hover:border-white/10 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Save className="w-4 h-4" />
                                    <span className="text-sm font-semibold">Guardar</span>
                                </button>

                                <button
                                    onClick={handleCheckoutClick}
                                    disabled={cart.length === 0 || checkoutProcessing}
                                    className="h-12 px-6 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-semibold shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {checkoutProcessing ? (
                                        <Loader2 className="animate-spin w-4 h-4" />
                                    ) : (
                                        <Banknote className="w-4 h-4" />
                                    )}
                                    <span className="text-base">Cobrar</span>
                                    <ArrowRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Sidebar (40%) */}
                    <div className="w-[40%] flex flex-col h-full bg-card/30">

                        {/* Session Info */}
                        <div className="h-14 flex-none px-4 border-b border-border/50 flex items-center justify-between bg-card/50">
                            <div className="flex items-center gap-2">
                                <History className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm font-semibold text-muted-foreground">Tickets Recientes</span>
                            </div>
                            <button
                                onClick={fetchMetrics}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold hover:bg-rose-500/20 transition-all"
                            >
                                <LogOut className="w-3 h-3" />
                                Cerrar Sesión
                            </button>
                        </div>

                        {/* Recent Sales List */}
                        <div className="flex-1 overflow-y-auto p-3 space-y-2">
                            {/* Ventas Guardadas (Pendientes) */}
                            <AnimatePresence>
                                {savedSales.map((sale, index) => (
                                    <motion.div
                                        key={sale.id}
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
                                                        Venta #{sale.id}
                                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/20 text-amber-400">GUARDADA</span>
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">{sale.time} • Pendiente de cobro</div>
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
                                        key={`expense-${expense.id}`}
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
                                        key={sale.id}
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
                            onClose={() => setShowExpense(false)}
                            onSave={async (data) => {
                                try {
                                    await api.post('/expenses', data);
                                    // Agregar el gasto a la lista local
                                    const newExpense = {
                                        id: Date.now(),
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
                            metrics={sessionMetrics}
                            onClose={() => setShowClose(false)}
                            onSave={handleCloseSession}
                        />
                    )}
                    {showPayment && (
                        <PaymentModal
                            total={total}
                            onClose={() => setShowPayment(false)}
                            onConfirm={processPayment}
                        />
                    )}
                    
                    {/* Confirm Modals */}
                    {showCartConfirm && (
                        <ConfirmModal
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
                </AnimatePresence>
            </div>
        </SessionGuard>
    );
}
