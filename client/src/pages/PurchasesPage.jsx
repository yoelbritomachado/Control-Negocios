import React, { useState, useEffect, useMemo } from 'react';
import { 
    ShoppingCart, 
    Plus, 
    Search, 
    Trash2, 
    Save, 
    X,
    Package,
    DollarSign,
    CreditCard,
    Banknote,
    Check,
    AlertCircle,
    History
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api';
import ProductForm from '../components/ProductForm';

export default function PurchasesPage() {
    const [products, setProducts] = useState([]);
    const [settings, setSettings] = useState({});
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [cart, setCart] = useState([]);
    const [showProductForm, setShowProductForm] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    
    // Purchase form state
    const [supplier, setSupplier] = useState('');
    const [notes, setNotes] = useState('');
    const [currency, setCurrency] = useState('MN');
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [saving, setSaving] = useState(false);
    
    // Currency rates from settings
    const rates = useMemo(() => ({
        USD_MN: settings.RATE_USD_MN || 550,
        MXN_USD: settings.RATE_MXN_USD || 19,
        EUR_MN: settings.RATE_EUR_MN || 590,
        MXN_MN: settings.RATE_MXN_MN || 17.30
    }), [settings]);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [productsRes, settingsRes] = await Promise.all([
                api.get('/products'),
                api.get('/settings')
            ]);
            setProducts(productsRes.data || []);
            setSettings(settingsRes.data || {});
        } catch (e) {
            console.error('Error loading data:', e);
            alert('Error al cargar datos');
        } finally {
            setLoading(false);
        }
    };

    // Filter products by search
    const filteredProducts = useMemo(() => {
        if (!searchQuery.trim()) return [];
        return products.filter(p => 
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (p.code && p.code.toLowerCase().includes(searchQuery.toLowerCase()))
        ).slice(0, 10);
    }, [searchQuery, products]);

    // Calculate totals
    const totals = useMemo(() => {
        let total = 0;
        cart.forEach(item => {
            const rate = getConversionRate(item.costCurrency, currency);
            total += item.costPrice * item.quantity * rate;
        });
        return total;
    }, [cart, currency]);

    function getConversionRate(fromCurrency, toCurrency) {
        if (fromCurrency === toCurrency) return 1;
        
        const rates = {
            'USD': { 'MN': settings.RATE_USD_MN || 550, 'MXN': 1 / (settings.RATE_MXN_USD || 19) },
            'MXN': { 'MN': settings.RATE_MXN_MN || 17.30, 'USD': settings.RATE_MXN_USD || 19 },
            'EUR': { 'MN': settings.RATE_EUR_MN || 590 },
            'MN': { 'USD': 1 / (settings.RATE_USD_MN || 550), 'MXN': 1 / (settings.RATE_MXN_MN || 17.30), 'EUR': 1 / (settings.RATE_EUR_MN || 590) }
        };
        
        return rates[fromCurrency]?.[toCurrency] || 1;
    }

    const addToCart = (product) => {
        const existing = cart.find(item => item.productId === product.id);
        if (existing) {
            setCart(cart.map(item => 
                item.productId === product.id 
                    ? { ...item, quantity: item.quantity + 1 }
                    : item
            ));
        } else {
            setCart([...cart, {
                productId: product.id,
                name: product.name,
                code: product.code,
                quantity: 1,
                costPrice: product.cost_mx || 0,
                costCurrency: 'MXN',
                existingProduct: true
            }]);
        }
        setSearchQuery('');
    };

    const addNewProductToCart = () => {
        setEditingProduct(null);
        setShowProductForm(true);
    };

    const handleProductFormSubmit = async (formData) => {
        try {
            const response = await api.post('/products', formData);
            if (response.data.success) {
                // Add new product to cart
                const newProduct = {
                    productId: response.data.id,
                    name: formData.get('name'),
                    code: formData.get('code') || '',
                    quantity: parseInt(formData.get('quantity')) || 1,
                    costPrice: parseFloat(formData.get('cost_mx')) || 0,
                    costCurrency: 'MXN',
                    existingProduct: false
                };
                setCart([...cart, newProduct]);
                setShowProductForm(false);
                loadData(); // Refresh products list
            }
        } catch (e) {
            console.error('Error creating product:', e);
            alert('Error al crear producto');
        }
    };

    const updateCartItem = (index, field, value) => {
        const newCart = [...cart];
        newCart[index] = { ...newCart[index], [field]: value };
        setCart(newCart);
    };

    const removeFromCart = (index) => {
        setCart(cart.filter((_, i) => i !== index));
    };

    const handleSavePurchase = async () => {
        if (cart.length === 0) {
            alert('Agrega al menos un producto a la compra');
            return;
        }

        setSaving(true);
        try {
            const items = cart.map(item => ({
                product_id: item.productId,
                quantity: item.quantity,
                cost_price: item.costPrice,
                cost_price_currency: item.costCurrency
            }));

            await api.post('/purchases', {
                supplier,
                items,
                total: totals,
                currency,
                exchange_rate: getConversionRate(currency, 'MN'),
                notes,
                payment_method: paymentMethod
            });

            alert('Compra guardada exitosamente');
            setCart([]);
            setSupplier('');
            setNotes('');
        } catch (e) {
            console.error('Error saving purchase:', e);
            alert('Error al guardar la compra');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Cargando...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-between items-stretch sm:items-center">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <ShoppingCart className="w-6 h-6 text-cyan-400" />
                        Compras / Entradas
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">
                        Registra nuevas compras y reabastece el inventario
                    </p>
                </div>
                <div className="flex gap-2">
                    <a
                        href="#/historial/traslados"
                        className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium transition-colors"
                    >
                        <History className="w-4 h-4" />
                        Historial
                    </a>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column - Search and Cart */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Search */}
                    <div className="glass-card p-4 rounded-2xl border border-white/5">
                        <label className="block text-sm font-medium text-slate-400 mb-2">
                            Buscar producto existente
                        </label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Escribe el nombre o código del producto..."
                                className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-500 focus:border-cyan-500/50 outline-none"
                            />
                        </div>

                        {/* Search Results */}
                        <AnimatePresence>
                            {filteredProducts.length > 0 && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="mt-2 space-y-1 max-h-60 overflow-y-auto"
                                >
                                    {filteredProducts.map(product => (
                                        <button
                                            key={product.id}
                                            onClick={() => addToCart(product)}
                                            className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-left"
                                        >
                                            <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                                                <Package className="w-5 h-5 text-cyan-400" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="font-medium text-white">{product.name}</p>
                                                <p className="text-sm text-slate-400">Stock: {product.total_quantity || 0}</p>
                                            </div>
                                            <Plus className="w-5 h-5 text-cyan-400" />
                                        </button>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Add New Product Button */}
                        <button
                            onClick={addNewProductToCart}
                            className="w-full mt-3 flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-dashed border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 transition-colors"
                        >
                            <Plus className="w-5 h-5" />
                            Agregar nuevo producto
                        </button>
                    </div>

                    {/* Cart Items */}
                    <div className="glass-card p-4 rounded-2xl border border-white/5">
                        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <ShoppingCart className="w-5 h-5 text-cyan-400" />
                            Productos en la compra
                        </h3>

                        {cart.length === 0 ? (
                            <div className="text-center py-12 text-slate-500">
                                <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                <p>No hay productos agregados</p>
                                <p className="text-sm mt-1">Busca y agrega productos existentes o crea uno nuevo</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {cart.map((item, index) => (
                                    <motion.div
                                        key={index}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="flex items-center gap-3 p-3 rounded-xl bg-white/5"
                                    >
                                        <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center shrink-0">
                                            <Package className="w-5 h-5 text-cyan-400" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-white truncate">{item.name}</p>
                                            <p className="text-sm text-slate-400">{item.code}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                value={item.quantity}
                                                onChange={(e) => updateCartItem(index, 'quantity', parseInt(e.target.value) || 0)}
                                                className="w-16 p-2 bg-white/5 border border-white/10 rounded-lg text-center text-white"
                                                min="1"
                                            />
                                            <span className="text-slate-400">×</span>
                                            <div className="flex items-center gap-1">
                                                <input
                                                    type="number"
                                                    value={item.costPrice}
                                                    onChange={(e) => updateCartItem(index, 'costPrice', parseFloat(e.target.value) || 0)}
                                                    className="w-20 p-2 bg-white/5 border border-white/10 rounded-lg text-right text-white"
                                                    step="0.01"
                                                    min="0"
                                                />
                                                <select
                                                    value={item.costCurrency}
                                                    onChange={(e) => updateCartItem(index, 'costCurrency', e.target.value)}
                                                    className="p-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                                                >
                                                    <option value="MN">MN</option>
                                                    <option value="USD">USD</option>
                                                    <option value="MXN">MXN</option>
                                                    <option value="EUR">EUR</option>
                                                </select>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => removeFromCart(index)}
                                            className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column - Purchase Details */}
                <div className="space-y-6">
                    <div className="glass-card p-4 rounded-2xl border border-white/5 sticky top-4">
                        <h3 className="text-lg font-semibold text-white mb-4">
                            Detalles de la compra
                        </h3>

                        <div className="space-y-4">
                            {/* Supplier */}
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">
                                    Proveedor
                                </label>
                                <input
                                    type="text"
                                    value={supplier}
                                    onChange={(e) => setSupplier(e.target.value)}
                                    placeholder="Nombre del proveedor"
                                    className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-500 focus:border-cyan-500/50 outline-none"
                                />
                            </div>

                            {/* Currency */}
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">
                                    Moneda de compra
                                </label>
                                <select
                                    value={currency}
                                    onChange={(e) => setCurrency(e.target.value)}
                                    className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white outline-none"
                                >
                                    <option value="MN">MN (Moneda Nacional)</option>
                                    <option value="USD">USD (Dólar)</option>
                                    <option value="MXN">MXN (Peso Mexicano)</option>
                                    <option value="EUR">EUR (Euro)</option>
                                </select>
                            </div>

                            {/* Payment Method */}
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">
                                    Método de pago
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => setPaymentMethod('cash')}
                                        className={`flex items-center justify-center gap-2 p-3 rounded-xl border transition-colors ${
                                            paymentMethod === 'cash'
                                                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                                                : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                                        }`}
                                    >
                                        <Banknote className="w-4 h-4" />
                                        Efectivo
                                    </button>
                                    <button
                                        onClick={() => setPaymentMethod('transfer')}
                                        className={`flex items-center justify-center gap-2 p-3 rounded-xl border transition-colors ${
                                            paymentMethod === 'transfer'
                                                ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                                                : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                                        }`}
                                    >
                                        <CreditCard className="w-4 h-4" />
                                        Transferencia
                                    </button>
                                </div>
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">
                                    Notas
                                </label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Notas adicionales..."
                                    rows={3}
                                    className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-500 focus:border-cyan-500/50 outline-none resize-none"
                                />
                            </div>

                            {/* Total */}
                            <div className="pt-4 border-t border-white/10">
                                <div className="flex justify-between items-center mb-4">
                                    <span className="text-slate-400">Total:</span>
                                    <span className="text-2xl font-bold text-emerald-400">
                                        ${totals.toFixed(2)} {currency}
                                    </span>
                                </div>

                                <button
                                    onClick={handleSavePurchase}
                                    disabled={cart.length === 0 || saving}
                                    className="w-full flex items-center justify-center gap-2 p-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-all"
                                >
                                    {saving ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Guardando...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="w-5 h-5" />
                                            Guardar Compra
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Product Form Modal */}
            <ProductForm
                isOpen={showProductForm}
                onClose={() => setShowProductForm(false)}
                onSubmit={handleProductFormSubmit}
                initialData={editingProduct}
                settings={settings}
            />
        </div>
    );
}
