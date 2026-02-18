import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Truck,
    Package,
    Search,
    ArrowRight,
    Building2,
    Send,
    RotateCcw,
    CheckCircle2,
    Clock,
    AlertCircle,
    Plus,
    Minus,
    Trash2,
    X
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useCart } from '../components/CartProvider';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const INVENTORIES = [
    { id: 'mch1', label: 'MCH 1', type: 'pv' },
    { id: 'mch2', label: 'MCH 2', type: 'pv' },
    { id: 'alm', label: 'Almacén', type: 'alm' },
];

const STATUS_CONFIG = {
    pending: { label: 'Pendiente', color: 'amber', icon: Clock },
    in_transit: { label: 'En Tránsito', color: 'blue', icon: Truck },
    received: { label: 'Recibido', color: 'green', icon: CheckCircle2 },
    rejected: { label: 'Rechazado', color: 'red', icon: X },
};

export default function TrasladosPage() {
    const { currentInventory } = useCart();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    
    // Transfer state
    const [sourceInventory, setSourceInventory] = useState(currentInventory);
    const [targetInventory, setTargetInventory] = useState('');
    const [cart, setCart] = useState([]);
    const [notes, setNotes] = useState('');
    
    // Transfers list
    const [transfers, setTransfers] = useState([]);
    const [showHistory, setShowHistory] = useState(false);

    // Load products from source inventory
    useEffect(() => {
        fetchProducts();
    }, [sourceInventory]);

    const fetchProducts = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${API_URL}/products?inventory=${sourceInventory}`);
            if (!response.ok) throw new Error('Error al cargar productos');
            const data = await response.json();
            setProducts(data);
        } catch (err) {
            console.error('Error:', err);
        } finally {
            setLoading(false);
        }
    };

    // Search functionality
    useEffect(() => {
        if (searchQuery.length >= 1) {
            const filtered = products.filter(p => 
                p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.code?.toLowerCase().includes(searchQuery.toLowerCase())
            ).filter(p => {
                const stock = p.inventory?.[sourceInventory] || 0;
                return stock > 0;
            }).slice(0, 5);
            setSearchResults(filtered);
        } else {
            setSearchResults([]);
        }
    }, [searchQuery, products, sourceInventory]);

    const addToCart = (product, quantity = 1) => {
        const stock = product.inventory?.[sourceInventory] || 0;
        if (stock < quantity) {
            alert(`Stock insuficiente. Solo hay ${stock} unidades disponibles.`);
            return;
        }

        setCart(prev => {
            const existing = prev.find(item => item.id === product.id);
            if (existing) {
                const newQuantity = existing.quantity + quantity;
                if (newQuantity > stock) {
                    alert(`Stock insuficiente. Solo hay ${stock} unidades disponibles.`);
                    return prev;
                }
                return prev.map(item =>
                    item.id === product.id
                        ? { ...item, quantity: newQuantity }
                        : item
                );
            }
            return [...prev, { 
                id: product.id, 
                name: product.name, 
                code: product.code,
                quantity,
                stock,
                image: product.image
            }];
        });
        setSearchQuery('');
        setSearchResults([]);
    };

    const updateQuantity = (productId, delta) => {
        setCart(prev => prev.map(item => {
            if (item.id === productId) {
                const newQuantity = item.quantity + delta;
                if (newQuantity <= 0) return item;
                if (newQuantity > item.stock) {
                    alert(`Stock insuficiente. Solo hay ${item.stock} unidades.`);
                    return item;
                }
                return { ...item, quantity: newQuantity };
            }
            return item;
        }));
    };

    const removeFromCart = (productId) => {
        setCart(prev => prev.filter(item => item.id !== productId));
    };

    const handleSubmitTransfer = async () => {
        if (!targetInventory) {
            alert('Por favor seleccione un inventario destino');
            return;
        }
        if (cart.length === 0) {
            alert('Por favor agregue productos al traslado');
            return;
        }
        if (sourceInventory === targetInventory) {
            alert('El inventario origen y destino no pueden ser el mismo');
            return;
        }

        try {
            const response = await fetch(`${API_URL}/transfers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    source_inventory: sourceInventory,
                    target_inventory: targetInventory,
                    items: cart.map(item => ({
                        product_id: item.id,
                        quantity: item.quantity
                    })),
                    notes
                })
            });

            if (!response.ok) throw new Error('Error al crear traslado');

            const result = await response.json();
            
            // Reset form
            setCart([]);
            setNotes('');
            setTargetInventory('');
            
            alert('Traslado creado exitosamente');
            
            // Refresh transfers list
            fetchTransfers();
        } catch (err) {
            alert('Error: ' + err.message);
        }
    };

    const fetchTransfers = async () => {
        try {
            const response = await fetch(`${API_URL}/transfers`);
            if (!response.ok) throw new Error('Error al cargar traslados');
            const data = await response.json();
            setTransfers(data);
        } catch (err) {
            console.error('Error:', err);
        }
    };

    useEffect(() => {
        fetchTransfers();
    }, []);

    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

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
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600">
                        <Truck className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold gradient-text">Traslados</h1>
                        <p className="text-muted-foreground">
                            Transferir mercancía entre almacenes y puntos de venta
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowHistory(!showHistory)}
                        className={cn(
                            "px-4 py-2 rounded-xl font-medium transition-all",
                            showHistory 
                                ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white" 
                                : "bg-secondary hover:bg-secondary/80"
                        )}
                    >
                        {showHistory ? 'Nuevo Traslado' : 'Historial'}
                    </button>
                </div>
            </motion.div>

            {!showHistory ? (
                <>
                    {/* Inventory Selectors */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="glass rounded-2xl p-6"
                    >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Source */}
                            <div>
                                <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                                    <Building2 className="w-4 h-4 text-muted-foreground" />
                                    Inventario Origen
                                </label>
                                <select
                                    value={sourceInventory}
                                    onChange={(e) => {
                                        setSourceInventory(e.target.value);
                                        setCart([]);
                                    }}
                                    className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
                                >
                                    {INVENTORIES.map(inv => (
                                        <option key={inv.id} value={inv.id}>
                                            {inv.label} ({inv.type === 'pv' ? 'Punto de Venta' : 'Almacén'})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Target */}
                            <div>
                                <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                                    Inventario Destino
                                </label>
                                <select
                                    value={targetInventory}
                                    onChange={(e) => setTargetInventory(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
                                >
                                    <option value="">Seleccionar destino...</option>
                                    {INVENTORIES.filter(inv => inv.id !== sourceInventory).map(inv => (
                                        <option key={inv.id} value={inv.id}>
                                            {inv.label} ({inv.type === 'pv' ? 'Punto de Venta' : 'Almacén'})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </motion.div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Product Selection */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="glass rounded-2xl p-6"
                        >
                            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                <Package className="w-5 h-5 text-cyan-400" />
                                Buscar Productos
                            </h2>

                            {/* Search */}
                            <div className="relative mb-4">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Buscar producto por nombre o código..."
                                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-background border border-border focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
                                />
                                
                                {/* Dropdown */}
                                <AnimatePresence>
                                    {searchResults.length > 0 && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            className="absolute top-full left-0 right-0 mt-2 p-2 rounded-xl bg-slate-900 border border-white/10 shadow-xl z-50"
                                        >
                                            {searchResults.map((product) => {
                                                const stock = product.inventory?.[sourceInventory] || 0;
                                                return (
                                                    <button
                                                        key={product.id}
                                                        onClick={() => addToCart(product)}
                                                        className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors text-left"
                                                    >
                                                        <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                                                            {product.image ? (
                                                                <img src={product.image} alt="" className="w-full h-full object-cover rounded-lg" />
                                                            ) : (
                                                                <Package className="w-5 h-5 text-muted-foreground" />
                                                            )}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-medium truncate">{product.name}</p>
                                                            <p className="text-xs text-muted-foreground">
                                                                Stock: {stock} | Código: {product.code || 'N/A'}
                                                            </p>
                                                        </div>
                                                        <Plus className="w-5 h-5 text-cyan-400" />
                                                    </button>
                                                );
                                            })}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            {/* Products in Cart */}
                            <div className="space-y-2 max-h-[400px] overflow-y-auto">
                                {cart.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">
                                        <Package className="w-12 h-12 mx-auto mb-2 opacity-20" />
                                        <p>Agregue productos al traslado</p>
                                    </div>
                                ) : (
                                    cart.map((item) => (
                                        <motion.div
                                            key={item.id}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50"
                                        >
                                            <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                                                {item.image ? (
                                                    <img src={item.image} alt="" className="w-full h-full object-cover rounded-lg" />
                                                ) : (
                                                    <Package className="w-5 h-5 text-muted-foreground" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-sm truncate">{item.name}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    Stock disponible: {item.stock}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => updateQuantity(item.id, -1)}
                                                    className="w-8 h-8 rounded-lg bg-secondary hover:bg-secondary/80 flex items-center justify-center transition-colors"
                                                >
                                                    <Minus className="w-4 h-4" />
                                                </button>
                                                <span className="w-8 text-center font-medium">{item.quantity}</span>
                                                <button
                                                    onClick={() => updateQuantity(item.id, 1)}
                                                    className="w-8 h-8 rounded-lg bg-secondary hover:bg-secondary/80 flex items-center justify-center transition-colors"
                                                >
                                                    <Plus className="w-4 h-4" />
                                                </button>
                                            </div>
                                            <button
                                                onClick={() => removeFromCart(item.id)}
                                                className="p-2 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </motion.div>
                                    ))
                                )}
                            </div>
                        </motion.div>

                        {/* Transfer Summary */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="glass rounded-2xl p-6"
                        >
                            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                <Truck className="w-5 h-5 text-violet-400" />
                                Resumen del Traslado
                            </h2>

                            {/* Route */}
                            <div className="flex items-center gap-4 mb-6 p-4 rounded-xl bg-secondary/30">
                                <div className="text-center">
                                    <p className="text-xs text-muted-foreground">Origen</p>
                                    <p className="font-medium">
                                        {INVENTORIES.find(i => i.id === sourceInventory)?.label}
                                    </p>
                                </div>
                                <div className="flex-1 flex items-center justify-center">
                                    <div className="h-0.5 flex-1 bg-border" />
                                    <ArrowRight className="w-5 h-5 mx-2 text-muted-foreground" />
                                    <div className="h-0.5 flex-1 bg-border" />
                                </div>
                                <div className="text-center">
                                    <p className="text-xs text-muted-foreground">Destino</p>
                                    <p className="font-medium">
                                        {targetInventory 
                                            ? INVENTORIES.find(i => i.id === targetInventory)?.label 
                                            : '...'}
                                    </p>
                                </div>
                            </div>

                            {/* Stats */}
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="p-4 rounded-xl bg-secondary/30 text-center">
                                    <p className="text-3xl font-bold text-cyan-400">{cart.length}</p>
                                    <p className="text-sm text-muted-foreground">Productos</p>
                                </div>
                                <div className="p-4 rounded-xl bg-secondary/30 text-center">
                                    <p className="text-3xl font-bold text-violet-400">{totalItems}</p>
                                    <p className="text-sm text-muted-foreground">Unidades</p>
                                </div>
                            </div>

                            {/* Notes */}
                            <div className="mb-6">
                                <label className="block text-sm font-medium mb-2">Notas (opcional)</label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Agregue notas sobre el traslado..."
                                    rows={3}
                                    className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none resize-none"
                                />
                            </div>

                            {/* Submit Button */}
                            <button
                                onClick={handleSubmitTransfer}
                                disabled={cart.length === 0 || !targetInventory}
                                className={cn(
                                    "w-full py-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2",
                                    cart.length > 0 && targetInventory
                                        ? "bg-gradient-to-r from-violet-500 to-purple-500 text-white hover:shadow-lg hover:shadow-violet-500/25"
                                        : "bg-secondary text-muted-foreground cursor-not-allowed"
                                )}
                            >
                                <Send className="w-5 h-5" />
                                Enviar Traslado
                            </button>
                        </motion.div>
                    </div>
                </>
            ) : (
                /* Transfer History */
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass rounded-2xl p-6"
                >
                    <h2 className="text-lg font-semibold mb-4">Historial de Traslados</h2>
                    
                    {transfers.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <RotateCcw className="w-12 h-12 mx-auto mb-3 opacity-20" />
                            <p>No hay traslados registrados</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {transfers.map((transfer) => {
                                const status = STATUS_CONFIG[transfer.status] || STATUS_CONFIG.pending;
                                const StatusIcon = status.icon;
                                
                                return (
                                    <div
                                        key={transfer.id}
                                        className="p-4 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className={cn("p-2 rounded-lg", `bg-${status.color}-500/20`)}>
                                                    <StatusIcon className={cn("w-5 h-5", `text-${status.color}-400`)} />
                                                </div>
                                                <div>
                                                    <p className="font-medium">
                                                        Traslado #{transfer.id}
                                                    </p>
                                                    <p className="text-sm text-muted-foreground">
                                                        {INVENTORIES.find(i => i.id === transfer.source_inventory)?.label} 
                                                        {' → '} 
                                                        {INVENTORIES.find(i => i.id === transfer.target_inventory)?.label}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className={cn(
                                                    "inline-flex px-2 py-1 rounded-full text-xs font-medium",
                                                    `bg-${status.color}-500/20 text-${status.color}-400`
                                                )}>
                                                    {status.label}
                                                </span>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    {new Date(transfer.created_at).toLocaleDateString('es-ES')}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </motion.div>
            )}
        </div>
    );
}
