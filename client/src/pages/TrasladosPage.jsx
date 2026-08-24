import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Truck,
    Package,
    Search,
    ArrowRight,
    Building2,
    Send,
    RotateCcw,
    Plus,
    Minus,
    Trash2,
    X,
    Edit3,
    Save,
    QrCode
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useCart } from '../components/CartProvider';
import api from '../api';
import QRGeneratorModal from '../components/QRGeneratorModal';
import { prepareTransferQRPayload } from '../lib/qrOfflineService';
import { getProductsLocal, savePendingTransfer } from '../lib/localDB';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const DEFAULT_INVENTORIES = [
    { id: 'alm', label: 'Almacén', type: 'alm' },
    { id: 'mch1', label: 'MCH 1', type: 'pv' },
    { id: 'mch2', label: 'MCH 2', type: 'pv' },
];

export default function TrasladosPage() {
    const { currentInventory } = useCart();
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const editIdParam = searchParams.get('edit');

    const [inventoriesList, setInventoriesList] = useState(DEFAULT_INVENTORIES);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    
    // Transfer state
    const [sourceInventory, setSourceInventory] = useState(currentInventory || 'alm');
    const [targetInventory, setTargetInventory] = useState('');
    const [cart, setCart] = useState([]);
    const [notes, setNotes] = useState('');
    const [qrModalOpen, setQrModalOpen] = useState(false);
    const [qrPayload, setQrPayload] = useState(null);
    const [editingTransfer, setEditingTransfer] = useState(null); // Objeto completo si estamos editando

    // Cargar lista dinámica de inventarios desde el backend
    useEffect(() => {
        const loadInventories = async () => {
            try {
                const res = await api.get('/inventories');
                if (Array.isArray(res.data) && res.data.length > 0) {
                    const formatted = res.data.map(inv => ({
                        id: inv.id,
                        label: inv.name || inv.id,
                        type: inv.type === 'warehouse' || inv.id === 'alm' ? 'alm' : 'pv'
                    }));
                    setInventoriesList(formatted);
                }
            } catch (e) {
                console.error("Error fetching inventories:", e);
            }
        };
        loadInventories();
    }, []);

    // Si viene param ?edit=ID, cargar el traslado para edición
    useEffect(() => {
        if (editIdParam) {
            loadTransferForEdit(editIdParam);
        } else {
            setEditingTransfer(null);
        }
    }, [editIdParam]);

    const loadTransferForEdit = async (id) => {
        try {
            setLoading(true);
            const res = await api.get(`/transfers/${id}`);
            const t = res.data;
            setEditingTransfer(t);
            setSourceInventory(t.source_inventory);
            setTargetInventory(t.target_inventory);
            setNotes(t.notes || '');

            // Reconstruir cart con items
            const loadedCart = (t.items || []).map(item => ({
                id: item.product_id,
                name: item.product_name,
                code: item.product_code || '',
                quantity: item.quantity,
                stock: (item.source_current_stock || 0) + item.quantity, // Stock disponible original
                image: item.product_image
            }));
            setCart(loadedCart);
        } catch (err) {
            alert('Error al cargar traslado para edición: ' + (err.response?.data?.error || err.message));
            cancelEditing();
        } finally {
            setLoading(false);
        }
    };

    const cancelEditing = () => {
        setEditingTransfer(null);
        setCart([]);
        setNotes('');
        setTargetInventory('');
        setSearchParams({});
    };

    // Load products from source inventory
    useEffect(() => {
        fetchProducts();
    }, [sourceInventory]);

    const fetchProducts = async () => {
        try {
            setLoading(true);
            const response = await api.get(`/products?inventory=${sourceInventory}`, { timeout: 3000 });
            const list = Array.isArray(response.data) ? response.data : [];
            if (list.length > 0) {
                setProducts(list);
            } else {
                const local = await getProductsLocal();
                setProducts(local);
            }
        } catch (err) {
            console.warn('[Traslados] Servidor no disponible, cargando productos desde almacén local IndexedDB:', err.message);
            const local = await getProductsLocal();
            setProducts(local);
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
                if (item.stock !== undefined && newQuantity > item.stock) {
                    alert(`Stock insuficiente en origen. Solo hay ${item.stock} unidades disponibles en total para este movimiento.`);
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

        const transferData = {
            source_inventory: sourceInventory,
            target_inventory: targetInventory,
            items: cart.map(item => ({
                product_id: item.id,
                name: item.name,
                code: item.code,
                quantity: item.quantity
            })),
            notes
        };

        try {
            if (editingTransfer) {
                // Guardar cambios en traslado existente
                await api.put(`/transfers/${editingTransfer.id}`, {
                    target_inventory: targetInventory,
                    notes,
                    items: cart.map(item => ({
                        product_id: item.id,
                        quantity: Number(item.quantity)
                    }))
                });

                alert(`Traslado #${editingTransfer.id} actualizado exitosamente.`);
                cancelEditing();
                navigate('/historial/traslados');
            } else {
                // Intentar enviar al backend con timeout
                try {
                    await api.post('/transfers', transferData, { timeout: 3500 });
                    alert('Traslado creado exitosamente en el servidor.');
                } catch (netErr) {
                    console.warn('[Traslado] Red offline o falla de servidor. Guardando en local y preparando QR:', netErr.message);
                    await savePendingTransfer(transferData);
                    
                    // Generar QR de contingencia inmediatamente
                    const payload = prepareTransferQRPayload(transferData);
                    setQrPayload(payload);
                    setQrModalOpen(true);
                    
                    alert('⚠️ Sin conexión con el servidor. El traslado fue guardado en tu dispositivo localmente. Mostrá el código QR para que la sede destino lo reciba.');
                }

                // Reset form
                setCart([]);
                setNotes('');
                setTargetInventory('');
            }
            
            // Refresh products list
            fetchProducts();
        } catch (err) {
            alert('Error: ' + (err.response?.data?.error || err.message));
        }
    };

    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className={cn(
                        "p-2 rounded-xl text-white",
                        editingTransfer
                            ? "bg-gradient-to-br from-amber-500 to-orange-600 animate-pulse"
                            : "bg-gradient-to-br from-violet-500 to-purple-600"
                    )}>
                        {editingTransfer ? <Edit3 className="w-5 h-5" /> : <Truck className="w-5 h-5" />}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold gradient-text">
                                {editingTransfer ? `Editando Traslado #${editingTransfer.id}` : 'Traslados'}
                            </h1>
                            {editingTransfer && (
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                    Modo Edición ({editingTransfer.status === 'received' ? 'Recibido' : 'Pendiente'})
                                </span>
                            )}
                        </div>
                        <p className="text-muted-foreground">
                            {editingTransfer 
                                ? 'Modifique cantidades, destino o notas. El inventario se recalculará automáticamente.' 
                                : 'Transferir mercancía entre almacenes y puntos de venta'}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    {editingTransfer && (
                        <button
                            onClick={cancelEditing}
                            className="px-4 py-2 rounded-xl font-medium bg-secondary hover:bg-secondary/80 text-muted-foreground transition-all flex items-center gap-1.5 text-sm"
                        >
                            <X className="w-4 h-4" />
                            Cancelar Edición
                        </button>
                    )}
                    <button
                        onClick={() => navigate('/historial/traslados')}
                        className="px-4 py-2 rounded-xl font-medium transition-all bg-secondary hover:bg-secondary/80 text-slate-200 flex items-center gap-2"
                    >
                        <RotateCcw className="w-4 h-4" />
                        Ver Historial de Traslados
                    </button>
                </div>
            </div>

            {/* Formulario Principal de Traslados / Edición */}
            <>
                {/* Inventory Selectors */}
                    <div className="glass rounded-2xl p-6">
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
                                    {inventoriesList.map(inv => (
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
                                    {inventoriesList.filter(inv => inv.id !== sourceInventory).map(inv => (
                                        <option key={inv.id} value={inv.id}>
                                            {inv.label} ({inv.type === 'pv' ? 'Punto de Venta' : 'Almacén'})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

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
                                            {searchResults.map((product, index) => {
                                                const stock = product.inventory?.[sourceInventory] || 0;
                                                return (
                                                    <button
                                                        key={`${product.id || 'no-id'}-${index}`}
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
                                        {inventoriesList.find(i => i.id === sourceInventory)?.label || sourceInventory}
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
                                            ? (inventoriesList.find(i => i.id === targetInventory)?.label || targetInventory)
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

                            {/* Submit Button & QR Button */}
                            <div className="space-y-2">
                                <button
                                    onClick={handleSubmitTransfer}
                                    disabled={cart.length === 0 || !targetInventory}
                                    className={cn(
                                        "w-full py-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2",
                                        cart.length > 0 && targetInventory
                                            ? editingTransfer
                                                ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:shadow-lg hover:shadow-orange-500/25"
                                                : "bg-gradient-to-r from-violet-500 to-purple-500 text-white hover:shadow-lg hover:shadow-violet-500/25"
                                            : "bg-secondary text-muted-foreground cursor-not-allowed"
                                    )}
                                >
                                    {editingTransfer ? (
                                        <>
                                            <Save className="w-5 h-5" />
                                            Guardar Cambios del Traslado
                                        </>
                                    ) : (
                                        <>
                                            <Send className="w-5 h-5" />
                                            Enviar Traslado
                                        </>
                                    )}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        if (cart.length === 0 || !targetInventory) {
                                            alert('Seleccione destino y agregue productos para generar el QR');
                                            return;
                                        }
                                        const payload = prepareTransferQRPayload(
                                            {
                                                id: editingTransfer ? editingTransfer.id : `TRF-${Date.now()}`,
                                                source_inventory: sourceInventory,
                                                target_inventory: targetInventory,
                                                notes
                                            },
                                            cart
                                        );
                                        setQrPayload(payload);
                                        setQrModalOpen(true);
                                    }}
                                    disabled={cart.length === 0 || !targetInventory}
                                    className={cn(
                                        "w-full py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 text-sm border",
                                        cart.length > 0 && targetInventory
                                            ? "border-pink-500/40 bg-pink-500/10 hover:bg-pink-500/20 text-pink-300"
                                            : "border-slate-800 bg-secondary/30 text-muted-foreground cursor-not-allowed"
                                    )}
                                >
                                    <QrCode className="w-4 h-4 text-pink-400" />
                                    Generar Código QR (Traspaso Offline)
                                </button>
                            </div>
                        </motion.div>
                    </div>
                </>

                {/* Modal QR */}
                <QRGeneratorModal
                    isOpen={qrModalOpen}
                    onClose={() => setQrModalOpen(false)}
                    title={editingTransfer ? `QR Traslado #${editingTransfer.id}` : "QR Traslado Offline"}
                    subtitle={`Origen: ${sourceInventory.toUpperCase()} ➔ Destino: ${targetInventory?.toUpperCase()}`}
                    type="TRF"
                    payload={qrPayload}
                />
            </div>
        );
    }
