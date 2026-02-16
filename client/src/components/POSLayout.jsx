import React, { useState, useEffect } from 'react';
import { useCart } from './CartProvider';
import InventorySelector from './InventorySelector';
import api from '../api';
import SessionGuard from './SessionGuard';
import PaymentModal from './PaymentModal';
import {
    ShoppingCart, Trash2, Banknote, Save, RotateCcw,
    Receipt, Search, History, LogOut, Loader2,
    CheckCircle2, Camera, Package2, X, Plus, Minus,
    Sparkles, TrendingUp, ArrowRight, Wallet
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
    const [type, setType] = useState('other');
    const [amount, setAmount] = useState('');
    const [desc, setDesc] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        await onSave({ type, amount: parseFloat(amount), description: desc });
    };

    const expenseTypes = [
        { value: 'other', label: 'Otros', icon: Receipt },
        { value: 'area', label: 'Pago de Área', icon: Wallet },
        { value: 'cleaning', label: 'Limpieza', icon: Sparkles },
    ];

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
                        <div className="grid grid-cols-3 gap-2">
                            {expenseTypes.map(({ value, label, icon: Icon }) => (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => setType(value)}
                                    className={cn(
                                        "flex flex-col items-center gap-2 p-3 rounded-xl border transition-all",
                                        type === value 
                                            ? "bg-amber-500/20 border-amber-500/50 text-amber-400" 
                                            : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10"
                                    )}
                                >
                                    <Icon className="w-5 h-5" />
                                    <span className="text-[10px] font-medium">{label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

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

                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Descripción</label>
                        <input
                            type="text"
                            placeholder="Detalle del gasto..."
                            value={desc}
                            onChange={e => setDesc(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 outline-none transition-all"
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

const ReturnModal = ({ onClose, onSave }) => {
    const [type, setType] = useState('broken_business');
    const [amount, setAmount] = useState('');
    const [action, setAction] = useState('discard');
    const [image, setImage] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        const formData = new FormData();
        formData.append('type', type);
        formData.append('amount', amount);
        formData.append('action', action);
        if (image) formData.append('evidence', image);
        await onSave(formData);
        setLoading(false);
    };

    const returnReasons = [
        { value: 'broken_business', label: 'Rotura (Negocio)', desc: 'Producto dañado en el local' },
        { value: 'broken_client', label: 'Rotura (Cliente)', desc: 'Producto dañado por el cliente' },
        { value: 'taste', label: 'Gusto (Cliente)', desc: 'No le gustó al cliente' },
    ];

    return (
        <ModalOverlay onClose={onClose}>
            <div className="p-6 space-y-6">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-rose-500/20 flex items-center justify-center">
                        <RotateCcw className="w-6 h-6 text-rose-500" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-white">Registrar Devolución</h3>
                        <p className="text-sm text-muted-foreground">Procesa una devolución de producto</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Motivo</label>
                        <div className="space-y-2">
                            {returnReasons.map(({ value, label, desc }) => (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => setType(value)}
                                    className={cn(
                                        "w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left",
                                        type === value 
                                            ? "bg-rose-500/10 border-rose-500/50" 
                                            : "bg-white/5 border-white/10 hover:bg-white/10"
                                    )}
                                >
                                    <div className={cn(
                                        "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                                        type === value ? "border-rose-500" : "border-white/30"
                                    )}>
                                        {type === value && <div className="w-2 h-2 rounded-full bg-rose-500" />}
                                    </div>
                                    <div>
                                        <div className={cn("font-medium", type === value ? "text-rose-400" : "text-white")}>{label}</div>
                                        <div className="text-xs text-muted-foreground">{desc}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Monto a Devolver</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-mono">$</span>
                            <input 
                                type="number" 
                                placeholder="0.00" 
                                value={amount} 
                                onChange={e => setAmount(e.target.value)} 
                                className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-4 py-3 text-white focus:border-rose-500/50 focus:ring-1 focus:ring-rose-500/50 outline-none transition-all font-mono text-lg"
                                required 
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Acción</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setAction('discard')}
                                className={cn(
                                    "flex items-center justify-center gap-2 p-3 rounded-xl border transition-all",
                                    action === 'discard'
                                        ? "bg-rose-500/20 border-rose-500/50 text-rose-400"
                                        : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10"
                                )}
                            >
                                <Trash2 className="w-4 h-4" />
                                <span className="text-sm font-medium">Descartar</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setAction('restock')}
                                className={cn(
                                    "flex items-center justify-center gap-2 p-3 rounded-xl border transition-all",
                                    action === 'restock'
                                        ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400"
                                        : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10"
                                )}
                            >
                                <Package2 className="w-4 h-4" />
                                <span className="text-sm font-medium">Re-stock</span>
                            </button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Evidencia Fotográfica</label>
                        <div className="border-2 border-dashed border-white/20 hover:border-rose-500/50 bg-white/5 hover:bg-rose-500/5 p-6 rounded-xl text-center cursor-pointer relative transition-all group">
                            <input type="file" accept="image/*" onChange={e => setImage(e.target.files[0])} className="absolute inset-0 opacity-0 cursor-pointer" required />
                            <div className="flex flex-col items-center gap-3 text-muted-foreground group-hover:text-rose-400 transition-colors">
                                {image ? (
                                    <>
                                        <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                                        <span className="text-sm font-medium text-white">{image.name}</span>
                                    </>
                                ) : (
                                    <>
                                        <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                                            <Camera className="w-6 h-6" />
                                        </div>
                                        <span className="text-sm font-medium">Subir foto del producto</span>
                                        <span className="text-xs text-muted-foreground">Obligatorio para devoluciones</span>
                                    </>
                                )}
                            </div>
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
                            disabled={loading}
                            className="flex-1 px-4 py-3 bg-gradient-to-r from-rose-600 to-rose-500 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-rose-500/25 transition-all flex items-center justify-center gap-2"
                        >
                            {loading && <Loader2 className="animate-spin w-4 h-4" />}
                            Procesar
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
                        <h3 className="text-xl font-bold text-white">Cerrar Turno</h3>
                        <p className="text-sm text-muted-foreground">Finaliza tu sesión y calcula tu salario</p>
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
    const { cart, removeFromCart, updateQuantity, total, clearCart, addToCart, currentInventory } = useCart();
    const [search, setSearch] = useState('');
    const [loadingProduct, setLoadingProduct] = useState(false);
    const [searchResults, setSearchResults] = useState([]);
    const [showSearchDropdown, setShowSearchDropdown] = useState(false);

    // Modals
    const [showExpense, setShowExpense] = useState(false);
    const [showReturn, setShowReturn] = useState(false);
    const [showClose, setShowClose] = useState(false);
    const [showPayment, setShowPayment] = useState(false);
    const [sessionMetrics, setSessionMetrics] = useState(null);

    // State
    const [recentSales, setRecentSales] = useState([]);
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
            const products = await api.fetchProducts(query);
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
                const products = await api.fetchProducts(search.trim());
                if (products && products.length > 0) {
                    const p = products[0];
                    const stock = p.inventory?.[currentInventory] || 0;
                    if (stock > 0) { 
                        addToCart(p); 
                        setSearch(''); 
                        setSearchResults([]);
                    }
                    else { 
                        alert("Producto agotado en esta sede"); 
                    }
                } else { 
                    alert("Producto no encontrado"); 
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

    const handleCheckoutClick = () => { if (cart.length > 0) setShowPayment(true); };

    const processPayment = async (paymentData) => {
        setCheckoutProcessing(true);
        try {
            const res = await api.post('/sales', {
                items: cart,
                total: total,
                paymentMethod: paymentData.method,
                amountReceived: paymentData.amountReceived,
                change: paymentData.change,
                inventoryId: currentInventory
            });
            if (res.data.success) {
                setRecentSales(prev => [{ id: res.data.saleId, total, time: new Date().toLocaleTimeString(), method: paymentData.method }, ...prev]);
                clearCart();
                setShowPayment(false);
            }
        } catch (e) { alert(e.response?.data?.error || "Error al cobrar"); }
        finally { setCheckoutProcessing(false); }
    };

    const handleCloseSession = async (cash, notes) => {
        try {
            const res = await api.post('/sessions/close', { declared_cash: cash, notes });
            alert(`Sesión Cerrada. Salario Calculado: $${res.data.wage}`);
            window.location.reload();
        } catch (e) { alert("Error al cerrar sesión"); }
    };

    const fetchMetrics = async () => {
        const res = await api.get('/sessions/status');
        setSessionMetrics(res.data);
        setShowClose(true);
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
                                
                                {/* Search Results Dropdown */}
                                <AnimatePresence>
                                    {showSearchDropdown && searchResults.length > 0 && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            className="absolute top-full left-0 right-0 mt-2 bg-card/95 backdrop-blur-xl border border-border/50 rounded-xl shadow-2xl z-50 max-h-64 overflow-y-auto"
                                        >
                                            <div className="p-2 space-y-1">
                                                {searchResults.map((product) => {
                                                    const stock = product.inventory?.[currentInventory] || 0;
                                                    return (
                                                        <button
                                                            key={product.id}
                                                            onClick={() => handleSelectProduct(product)}
                                                            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-all text-left group"
                                                        >
                                                            <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                                                                <Package2 className="w-5 h-5 text-cyan-500" />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="font-medium text-foreground truncate">{product.name}</div>
                                                                <div className="text-xs text-muted-foreground flex items-center gap-2">
                                                                    <span className="font-mono">{product.code || 'SIN CÓDIGO'}</span>
                                                                    <span className="w-1 h-1 rounded-full bg-muted-foreground/50"></span>
                                                                    <span className={stock < 5 ? "text-rose-400" : "text-emerald-400"}>
                                                                        Stock: {stock}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <div className="text-right">
                                                                <div className="font-bold text-emerald-400 font-mono">${product.sale_price_manual}</div>
                                                                <div className="text-xs text-muted-foreground">${product.cost_mx} costo</div>
                                                            </div>
                                                            <Plus className="w-5 h-5 text-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>

                        {/* Cart List Premium */}
                        <div className="flex-1 overflow-y-auto p-3 scrollbar-thin">
                            {cart.length > 0 ? (
                                <div className="space-y-2">
                                    <AnimatePresence mode="popLayout">
                                        {cart.map((item) => (
                                            <motion.div
                                                key={item.id}
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
                                                        <span className="w-8 text-center font-bold tabular-nums">{item.quantity}</span>
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
                                                        className="opacity-0 group-hover:opacity-100 p-2 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-all"
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
                                <button className="h-12 px-4 rounded-xl bg-secondary/50 border border-white/5 text-muted-foreground hover:text-foreground hover:bg-secondary hover:border-white/10 transition-all flex items-center gap-2">
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
                                Cerrar Turno
                            </button>
                        </div>

                        {/* Recent Sales List */}
                        <div className="flex-1 overflow-y-auto p-3 space-y-2">
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
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                            
                            {recentSales.length === 0 && (
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
                                    setShowExpense(false); 
                                    alert("Gasto registrado"); 
                                } catch (e) { 
                                    alert("Error"); 
                                } 
                            }} 
                        />
                    )}
                    {showReturn && (
                        <ReturnModal 
                            onClose={() => setShowReturn(false)} 
                            onSave={async (formData) => { 
                                formData.append('inventoryId', currentInventory); 
                                try { 
                                    await api.post('/returns', formData); 
                                    setShowReturn(false); 
                                    alert("Devolución registrada"); 
                                } catch (e) { 
                                    alert(e.response?.data?.error || "Error"); 
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
                </AnimatePresence>
            </div>
        </SessionGuard>
    );
}
