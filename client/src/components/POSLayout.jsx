import React, { useState, useEffect } from 'react';
import { useCart } from './CartProvider';
import InventorySelector from './InventorySelector';
import api from '../api';
import SessionGuard from './SessionGuard';
import PaymentModal from './PaymentModal';
import {
    ShoppingCart, Trash2, Banknote, Save, RotateCcw,
    Receipt, Search, History, LogOut, Loader2,
    CheckCircle2, Camera, Store, Package2, X, Plus, Minus,
    AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';

// --- SUBCOMPONENTS (MODALS) ---

const ModalOverlay = ({ children, onClose }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="glass-card w-full max-w-md overflow-hidden relative"
        >
            <button
                onClick={onClose}
                className="absolute top-4 right-4 text-muted-foreground hover:text-white transition-colors"
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

    return (
        <ModalOverlay onClose={onClose}>
            <div className="p-6 space-y-6">
                <h3 className="text-xl font-bold flex items-center gap-2 text-white">
                    <Receipt className="text-yellow-500 w-6 h-6" /> Registrar Gasto
                </h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-muted-foreground uppercase">Tipo</label>
                        <select
                            value={type}
                            onChange={e => setType(e.target.value)}
                            className="w-full bg-secondary/30 border border-white/10 rounded-xl p-3 text-white focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 outline-none transition-all"
                        >
                            <option value="other">Otros</option>
                            <option value="area">Pago de Área ($3000)</option>
                            <option value="cleaning">Limpieza ($100)</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-muted-foreground uppercase">Monto</label>
                        <input
                            type="number"
                            placeholder="0.00"
                            value={amount}
                            onChange={e => setAmount(e.target.value)}
                            className="w-full bg-secondary/30 border border-white/10 rounded-xl p-3 text-white focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 outline-none transition-all font-mono"
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-muted-foreground uppercase">Descripción</label>
                        <input
                            type="text"
                            placeholder="Detalle del gasto"
                            value={desc}
                            onChange={e => setDesc(e.target.value)}
                            className="w-full bg-secondary/30 border border-white/10 rounded-xl p-3 text-white focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 outline-none transition-all"
                        />
                    </div>
                    <div className="flex gap-2 justify-end pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-muted-foreground hover:text-white font-medium transition-colors">Cancelar</button>
                        <button type="submit" className="px-6 py-2 bg-yellow-600/20 text-yellow-500 border border-yellow-500/50 rounded-xl font-bold hover:bg-yellow-600/30 transition-all shadow-lg shadow-yellow-900/10">Registrar</button>
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

    return (
        <ModalOverlay onClose={onClose}>
            <div className="p-6 space-y-6">
                <h3 className="text-xl font-bold flex items-center gap-2 text-white">
                    <RotateCcw className="text-red-500 w-6 h-6" /> Registrar Devolución
                </h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-muted-foreground uppercase">Motivo</label>
                        <select value={type} onChange={e => setType(e.target.value)} className="w-full bg-secondary/30 border border-white/10 rounded-xl p-3 text-white focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all">
                            <option value="broken_business">Rotura (Negocio)</option>
                            <option value="broken_client">Rotura (Cliente)</option>
                            <option value="taste">Gusto (Cliente)</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-muted-foreground uppercase">Monto a Devolver</label>
                        <input type="number" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} className="w-full bg-secondary/30 border border-white/10 rounded-xl p-3 text-white focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all font-mono" required />
                    </div>

                    <div className="flex gap-4 text-sm text-gray-400 py-2">
                        <label className="flex items-center gap-2 cursor-pointer hover:text-white transition-colors">
                            <input type="radio" name="action" value="discard" checked={action === 'discard'} onChange={() => setAction('discard')} className="accent-red-500 w-4 h-4" /> Descartar
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer hover:text-white transition-colors">
                            <input type="radio" name="action" value="restock" checked={action === 'restock'} onChange={() => setAction('restock')} className="accent-red-500 w-4 h-4" /> Re-stock (Inventario)
                        </label>
                    </div>

                    <div className="border border-dashed border-white/20 hover:border-white/40 bg-white/5 hover:bg-white/10 p-6 rounded-xl text-center cursor-pointer relative transition-all group">
                        <input type="file" accept="image/*" onChange={e => setImage(e.target.files[0])} className="absolute inset-0 opacity-0 cursor-pointer" required />
                        <div className="flex flex-col items-center gap-2 text-gray-400 group-hover:text-white transition-colors">
                            {image ? (
                                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                            ) : (
                                <Camera className="w-8 h-8" />
                            )}
                            <span className="text-xs font-medium">{image ? image.name : "Subir Evidencia (Obligatorio)"}</span>
                        </div>
                    </div>

                    <div className="flex gap-2 justify-end pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-muted-foreground hover:text-white font-medium transition-colors">Cancelar</button>
                        <button type="submit" disabled={loading} className="px-6 py-2 bg-red-600/20 text-red-500 border border-red-500/50 rounded-xl font-bold flex items-center gap-2 hover:bg-red-600/30 transition-all shadow-lg shadow-red-900/10">
                            {loading && <Loader2 className="animate-spin w-4 h-4" />} Procesar
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
                <h3 className="text-xl font-bold text-pink-500 flex items-center gap-2">
                    <LogOut className="w-6 h-6" /> Cerrar Turno
                </h3>
                <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Ventas del Turno:</span>
                        <span className="text-white font-bold text-lg font-mono">${metrics?.currentSales || '0.00'}</span>
                    </div>
                </div>
                <form onSubmit={(e) => { e.preventDefault(); onSave(cash, notes); }} className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-muted-foreground uppercase">Efectivo en Caja</label>
                        <input type="number" placeholder="0.00" value={cash} onChange={e => setCash(e.target.value)} className="w-full bg-secondary/30 border border-white/10 rounded-xl p-3 text-white focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none transition-all font-mono" required />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-muted-foreground uppercase">Notas</label>
                        <textarea placeholder="Observaciones del turno..." value={notes} onChange={e => setNotes(e.target.value)} className="w-full bg-secondary/30 border border-white/10 rounded-xl p-3 text-white focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none transition-all h-24 resize-none"></textarea>
                    </div>
                    <div className="flex gap-2 justify-end pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-muted-foreground hover:text-white font-medium transition-colors">Cancelar</button>
                        <button type="submit" className="px-6 py-2 btn-primary-glow bg-pink-600 text-white rounded-xl font-bold hover:bg-pink-500 transition-all shadow-lg shadow-pink-900/20">Cerrar y Calcular</button>
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

    // Modals
    const [showExpense, setShowExpense] = useState(false);
    const [showReturn, setShowReturn] = useState(false);
    const [showClose, setShowClose] = useState(false);
    const [showPayment, setShowPayment] = useState(false);
    const [sessionMetrics, setSessionMetrics] = useState(null);

    // State
    const [recentSales, setRecentSales] = useState([]);
    const [checkoutProcessing, setCheckoutProcessing] = useState(false);

    // Logic
    const handleSearch = async (e) => {
        if (e.key === 'Enter' && search.trim()) {
            setLoadingProduct(true);
            try {
                const products = await api.fetchProducts(search.trim());
                if (products && products.length > 0) {
                    const p = products[0];
                    if (p.quantity > 0) { addToCart(p); setSearch(''); }
                    else { alert("Producto agotado"); }
                } else { alert("Producto no encontrado"); }
            } catch (err) { console.error(err); }
            finally { setLoadingProduct(false); }
        }
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
            {/* ROOT CONTAINER */}
            <div className="flex flex-col h-screen w-full bg-background text-foreground font-sans overflow-hidden select-none">

                {/* --- HEADER --- */}
                <header className="h-16 flex-none flex items-center justify-between px-6 z-30 border-b border-border bg-card/50 backdrop-blur-lg">
                    <div className="flex items-center gap-4">
                        <div className="w-9 h-9 bg-gradient-to-br from-pink-500 to-rose-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-pink-500/20">
                            <Store className="w-5 h-5" />
                        </div>
                        <div className="flex flex-col">
                            <h1 className="text-lg font-bold tracking-tight leading-none">BizControl <span className="text-pink-500">POS</span></h1>
                            <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Premium System</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <InventorySelector minimal />
                    </div>
                </header>

                {/* --- CONTENT AREA --- */}
                <div className="flex flex-1 overflow-hidden relative">

                    {/* LEFT COLUMN: Cart (65%) */}
                    <div className="w-[65%] flex flex-col h-full border-r border-border bg-background/50 relative">
                        {/* Background Effect */}
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />

                        {/* Search Bar */}
                        <div className="h-20 flex-none px-6 flex items-center gap-4 border-b border-white/5 bg-white/5 relative z-10">
                            <Search className="text-muted-foreground w-6 h-6" />
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                onKeyDown={handleSearch}
                                placeholder="Escanear o buscar producto..."
                                className="bg-transparent border-none focus:outline-none text-foreground w-full placeholder-muted-foreground text-xl font-medium h-full"
                                autoFocus
                            />
                            {loadingProduct && <Loader2 className="animate-spin text-pink-500 w-6 h-6" />}
                        </div>

                        {/* Cart List */}
                        <div className="flex-1 overflow-y-auto relative p-0 scrollbar-hide">
                            <table className="w-full text-left border-collapse">
                                <thead className="text-muted-foreground text-[11px] uppercase border-b border-white/5 sticky top-0 bg-background/95 backdrop-blur-md z-10 font-bold">
                                    <tr>
                                        <th className="py-4 pl-6 tracking-wider w-32">Cantidad</th>
                                        <th className="py-4 tracking-wider">Producto</th>
                                        <th className="py-4 text-right tracking-wider">Precio</th>
                                        <th className="py-4 text-right tracking-wider pr-6">Total</th>
                                        <th className="w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm font-medium divide-y divide-white/5">
                                    <AnimatePresence>
                                        {cart.map(item => (
                                            <motion.tr
                                                key={item.id}
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: 20 }}
                                                className="hover:bg-white/5 transition-colors group"
                                            >
                                                <td className="py-4 pl-6">
                                                    <div className="flex items-center gap-1 bg-secondary/50 match-input w-max px-1 py-1 rounded-lg border border-white/10">
                                                        <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-white hover:bg-white/10 rounded-md transition-all"><Minus className="w-4 h-4" /></button>
                                                        <span className="w-8 text-center font-bold text-base tabular-nums">{item.quantity}</span>
                                                        <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-white hover:bg-white/10 rounded-md transition-all"><Plus className="w-4 h-4" /></button>
                                                    </div>
                                                </td>
                                                <td className="py-4">
                                                    <div className="font-bold text-base">{item.name}</div>
                                                    <div className="text-[10px] text-muted-foreground font-mono mt-1 flex items-center gap-1">
                                                        <Package2 className="w-3 h-3" /> {item.code || 'SIN CODIGO'}
                                                    </div>
                                                </td>
                                                <td className="py-4 text-right font-mono opacity-80">${item.sale_price_manual}</td>
                                                <td className="py-4 text-right font-bold text-emerald-400 font-mono text-lg pr-6">${(item.sale_price_manual * item.quantity).toFixed(2)}</td>
                                                <td className="py-4 text-center pr-4">
                                                    <button onClick={() => removeFromCart(item.id)} className="text-muted-foreground hover:text-red-500 p-2 rounded-lg hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </motion.tr>
                                        ))}
                                    </AnimatePresence>
                                </tbody>
                            </table>
                            {cart.length === 0 && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground/20 gap-4">
                                    <div className="w-32 h-32 rounded-full border-2 border-dashed border-current flex items-center justify-center">
                                        <ShoppingCart className="w-12 h-12" />
                                    </div>
                                    <p className="text-xl font-bold tracking-[0.3em] uppercase">Esperando Productos</p>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="h-24 flex-none bg-card/30 backdrop-blur-md border-t border-white/10 px-8 flex items-center justify-between gap-6 shadow-[0_-10px_40px_rgba(0,0,0,0.2)] z-20">
                            <div className="flex flex-col justify-center">
                                <div className="text-muted-foreground text-[10px] uppercase font-bold tracking-widest mb-1">Total a Pagar</div>
                                <div className="text-5xl font-black text-foreground tracking-tighter flex items-start gap-1">
                                    <span className="text-2xl text-emerald-500 mt-2 font-normal">$</span>
                                    {total.toFixed(2)}
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <button className="h-14 px-6 bg-secondary/50 border border-white/5 hover:bg-secondary hover:border-white/10 rounded-xl flex items-center gap-3 text-muted-foreground hover:text-white transition-all group">
                                    <Save className="w-5 h-5 group-hover:scale-110 transition-transform group-hover:text-blue-400" />
                                    <span className="text-xs font-bold tracking-wider">GUARDAR (F2)</span>
                                </button>

                                <button
                                    onClick={handleCheckoutClick}
                                    disabled={cart.length === 0 || checkoutProcessing}
                                    className="h-14 px-10 btn-primary-glow bg-primary text-primary-foreground rounded-xl flex items-center gap-4 font-bold shadow-lg shadow-primary/20 hover:shadow-primary/40 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                                >
                                    {checkoutProcessing ? <Loader2 className="animate-spin w-6 h-6" /> : <Banknote className="w-6 h-6" />}
                                    <span className="text-base tracking-widest">COBRAR</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: History (35%) */}
                    <div className="w-[35%] flex flex-col h-full bg-[#0F1115] border-l border-white/5 relative">
                        {/* Header */}
                        <div className="h-16 flex-none px-6 border-b border-white/5 flex justify-between items-center bg-white/5">
                            <h3 className="font-bold text-muted-foreground flex items-center gap-2 text-[11px] uppercase tracking-[0.1em]">
                                <History className="w-4 h-4" /> Tickets Recientes
                            </h3>
                            <button onClick={fetchMetrics} className="text-muted-foreground hover:text-red-400 text-[10px] font-bold flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5 hover:bg-red-500/10 hover:border-red-500/20 transition-all">
                                <LogOut className="w-3 h-3" /> CERRAR TURNO
                            </button>
                        </div>

                        {/* List */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            <AnimatePresence>
                                {recentSales.map(sale => (
                                    <motion.div
                                        key={sale.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="bg-card/50 p-4 rounded-xl border border-white/5 flex justify-between items-center group hover:bg-card hover:border-white/10 cursor-pointer shadow-sm transition-all"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20 group-hover:scale-110 transition-transform">
                                                <CheckCircle2 className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-white group-hover:text-primary transition-colors">Venta #{sale.id}</div>
                                                <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-wide">{sale.time} • {sale.method === 'transfer' ? 'Transf' : 'Efectivo'}</div>
                                            </div>
                                        </div>
                                        <div className="font-bold text-white font-mono text-lg">${sale.total?.toFixed(2)}</div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                            {recentSales.length === 0 && (
                                <div className="flex flex-col items-center justify-center h-full text-muted-foreground space-y-3 opacity-40">
                                    <History className="w-8 h-8" />
                                    <p className="text-xs italic tracking-wide">Sin registros en este turno</p>
                                </div>
                            )}
                        </div>

                        {/* Quick Actions */}
                        <div className="h-20 flex-none p-4 grid grid-cols-2 gap-3 border-t border-white/10 bg-card/30 z-20">
                            <button onClick={() => setShowExpense(true)} className="bg-secondary/30 border border-yellow-500/20 text-yellow-500 rounded-xl font-bold hover:bg-yellow-500/10 hover:border-yellow-500/40 transition-all flex flex-col items-center justify-center gap-0.5 active:scale-95 group">
                                <Receipt className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" />
                                <span className="text-[10px] tracking-widest mt-1">GASTOS</span>
                            </button>
                            <button onClick={() => setShowReturn(true)} className="bg-secondary/30 border border-red-500/20 text-red-500 rounded-xl font-bold hover:bg-red-500/10 hover:border-red-500/40 transition-all flex flex-col items-center justify-center gap-0.5 active:scale-95 group">
                                <RotateCcw className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" />
                                <span className="text-[10px] tracking-widest mt-1">DEVOLUCIÓN</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Modals Container */}
                <AnimatePresence>
                    {showExpense && <ExpenseModal onClose={() => setShowExpense(false)} onSave={async (data) => { try { await api.post('/expenses', data); setShowExpense(false); alert("Gasto registrado"); } catch (e) { alert("Error"); } }} />}
                    {showReturn && <ReturnModal onClose={() => setShowReturn(false)} onSave={async (formData) => { formData.append('inventoryId', currentInventory); try { await api.post('/returns', formData); setShowReturn(false); alert("Devolución registrada"); } catch (e) { alert(e.response?.data?.error || "Error"); } }} />}
                    {showClose && <CloseSessionModal metrics={sessionMetrics} onClose={() => setShowClose(false)} onSave={handleCloseSession} />}
                    {showPayment && <PaymentModal total={total} onClose={() => setShowPayment(false)} onConfirm={processPayment} />}
                </AnimatePresence>
            </div>
        </SessionGuard>
    );
}
