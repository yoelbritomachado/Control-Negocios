import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    AlertTriangle,
    Plus,
    Search,
    Trash2,
    Package,
    Camera,
    X,
    Save,
    RotateCcw,
    ArrowRightLeft,
    AlertCircle,
    Check
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useCart } from '../components/CartProvider';
import { SafeImage } from '../components/SafeImage';

const API_URL = import.meta.env.VITE_API_URL || '/api';

// Tipos de merma según SYSTEM_LOGIC_RULES.md
const MERMA_TYPES = [
    {
        id: 'rotura_interna',
        label: 'Rotura Interna',
        description: 'Producto roto/caducado por el personal. Disminuye stock, sin movimiento de dinero.',
        icon: Trash2,
        color: 'red'
    },
    {
        id: 'devolucion_nuevo',
        label: 'Devolución - Producto Nuevo',
        description: 'Cliente devuelve producto en buen estado. Aumenta stock, devuelve dinero.',
        icon: RotateCcw,
        color: 'green'
    },
    {
        id: 'devolucion_danado',
        label: 'Devolución - Producto Dañado',
        description: 'Cliente devuelve producto roto. Stock neutral, devuelve dinero.',
        icon: AlertCircle,
        color: 'amber'
    }
];

export default function MermasPage() {
    const { currentInventory } = useCart();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [showSearchDropdown, setShowSearchDropdown] = useState(false);
    
    // Form state
    const [selectedType, setSelectedType] = useState(null);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [quantity, setQuantity] = useState(1);
    const [reason, setReason] = useState('');
    const [evidence, setEvidence] = useState(null);
    const [previewImage, setPreviewImage] = useState(null);

    // Load products
    useEffect(() => {
        fetchProducts();
    }, [currentInventory]);

    const fetchProducts = async () => {
        try {
            const response = await fetch(`${API_URL}/products?inventory=${currentInventory}`);
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
            ).slice(0, 5);
            setSearchResults(filtered);
            setShowSearchDropdown(true);
        } else {
            setSearchResults([]);
            setShowSearchDropdown(false);
        }
    }, [searchQuery, products]);

    const handleProductSelect = (product) => {
        setSelectedProduct(product);
        setSearchQuery(product.name);
        setShowSearchDropdown(false);
    };

    const handleImageCapture = (e) => {
        const file = e.target.files[0];
        if (file) {
            setEvidence(file);
            const reader = new FileReader();
            reader.onloadend = () => setPreviewImage(reader.result);
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async () => {
        if (!selectedType || !selectedProduct || quantity < 1) {
            alert('Por favor complete todos los campos obligatorios');
            return;
        }

        const formData = new FormData();
        formData.append('type', selectedType);
        formData.append('product_id', selectedProduct.id);
        formData.append('quantity', quantity);
        formData.append('reason', reason);
        formData.append('inventory', currentInventory);
        if (evidence) formData.append('evidence', evidence);

        try {
            const response = await fetch(`${API_URL}/mermas`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error('Error al registrar merma');

            alert('Merma registrada correctamente');
            resetForm();
        } catch (err) {
            alert('Error: ' + err.message);
        }
    };

    const resetForm = () => {
        setSelectedType(null);
        setSelectedProduct(null);
        setSearchQuery('');
        setQuantity(1);
        setReason('');
        setEvidence(null);
        setPreviewImage(null);
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
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold gradient-text">Registro de Mermas</h1>
                    <p className="text-muted-foreground">
                        Registra roturas, devoluciones y pérdidas de inventario
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Type Selection */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="glass rounded-2xl p-6"
                >
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-red-500 to-orange-600">
                            <AlertTriangle className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold">Tipo de Merma</h2>
                            <p className="text-sm text-muted-foreground">Seleccione el tipo de incidente</p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {MERMA_TYPES.map((type) => {
                            const Icon = type.icon;
                            const isSelected = selectedType === type.id;
                            
                            return (
                                <motion.button
                                    key={type.id}
                                    whileHover={{ scale: 1.01 }}
                                    whileTap={{ scale: 0.99 }}
                                    onClick={() => setSelectedType(type.id)}
                                    className={cn(
                                        'w-full p-4 rounded-xl border-2 transition-all text-left',
                                        isSelected
                                            ? `border-${type.color}-500 bg-${type.color}-500/10`
                                            : 'border-border/50 hover:border-border hover:bg-secondary/30'
                                    )}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className={cn(
                                            'p-2 rounded-lg',
                                            `bg-${type.color}-500/20 text-${type.color}-400`
                                        )}>
                                            <Icon className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium">{type.label}</span>
                                                {isSelected && (
                                                    <Check className="w-4 h-4 text-green-400" />
                                                )}
                                            </div>
                                            <p className="text-sm text-muted-foreground mt-1">
                                                {type.description}
                                            </p>
                                        </div>
                                    </div>
                                </motion.button>
                            );
                        })}
                    </div>
                </motion.div>

                {/* Product Selection */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="glass rounded-2xl p-6"
                >
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600">
                            <Package className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold">Producto</h2>
                            <p className="text-sm text-muted-foreground">Busque y seleccione el producto</p>
                        </div>
                    </div>

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
                            {showSearchDropdown && searchResults.length > 0 && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="absolute top-full left-0 right-0 mt-2 p-2 rounded-xl bg-slate-900 border border-white/10 shadow-xl z-50"
                                >
                                    {searchResults.map((product, index) => (
                                        <button
                                            key={product?.id || product?.code || `merma-prod-${index}`}
                                            onClick={() => handleProductSelect(product)}
                                            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors text-left"
                                        >
                                            <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                                                <SafeImage
                                                    src={product.image}
                                                    alt=""
                                                    containerClassName="w-full h-full"
                                                    className="rounded-lg"
                                                    placeholder={<Package className="w-5 h-5 text-muted-foreground" />}
                                                />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium truncate">{product.name}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    Stock: {product.quantity} | ${product.sale_price}
                                                </p>
                                            </div>
                                        </button>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Selected Product */}
                    {selectedProduct && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/30"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center">
                                    <SafeImage
                                        src={selectedProduct.image}
                                        alt=""
                                        containerClassName="w-full h-full"
                                        className="rounded-lg"
                                        placeholder={<Package className="w-6 h-6 text-muted-foreground" />}
                                    />
                                </div>
                                <div className="flex-1">
                                    <p className="font-medium">{selectedProduct.name}</p>
                                    <p className="text-sm text-muted-foreground">
                                        Stock actual: {selectedProduct.quantity} unidades
                                    </p>
                                </div>
                                <button
                                    onClick={() => {
                                        setSelectedProduct(null);
                                        setSearchQuery('');
                                    }}
                                    className="p-2 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {/* Quantity */}
                    <div className="mt-4">
                        <label className="block text-sm font-medium mb-2">Cantidad</label>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                className="w-10 h-10 rounded-xl bg-secondary hover:bg-secondary/80 flex items-center justify-center transition-colors"
                            >
                                -
                            </button>
                            <input
                                type="number"
                                value={quantity}
                                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                                className="w-20 text-center py-2 rounded-xl bg-background border border-border focus:border-cyan-500 outline-none"
                            />
                            <button
                                onClick={() => setQuantity(quantity + 1)}
                                className="w-10 h-10 rounded-xl bg-secondary hover:bg-secondary/80 flex items-center justify-center transition-colors"
                            >
                                +
                            </button>
                        </div>
                    </div>
                </motion.div>

                {/* Details & Evidence */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="glass rounded-2xl p-6"
                >
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600">
                            <AlertCircle className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold">Detalles</h2>
                            <p className="text-sm text-muted-foreground">Motivo y evidencia (opcional)</p>
                        </div>
                    </div>

                    {/* Reason */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium mb-2">Motivo / Descripción</label>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Describa el motivo de la merma..."
                            rows={3}
                            className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none resize-none"
                        />
                    </div>

                    {/* Evidence Upload */}
                    <div>
                        <label className="block text-sm font-medium mb-2">Evidencia Fotográfica</label>
                        <div className="relative">
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleImageCapture}
                                className="hidden"
                                id="evidence-upload"
                            />
                            <label
                                htmlFor="evidence-upload"
                                className="flex items-center justify-center gap-3 p-6 border-2 border-dashed border-border rounded-xl hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-colors cursor-pointer"
                            >
                                {previewImage ? (
                                    <img src={previewImage} alt="Preview" className="w-20 h-20 object-cover rounded-lg" />
                                ) : (
                                    <>
                                        <Camera className="w-6 h-6 text-muted-foreground" />
                                        <span className="text-muted-foreground">Subir foto o capturar imagen</span>
                                    </>
                                )}
                            </label>
                        </div>
                    </div>
                </motion.div>

                {/* Summary & Submit */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="glass rounded-2xl p-6"
                >
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600">
                            <Save className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold">Resumen</h2>
                            <p className="text-sm text-muted-foreground">Verifique antes de guardar</p>
                        </div>
                    </div>

                    <div className="space-y-3 mb-6">
                        <div className="flex justify-between py-2 border-b border-border/30">
                            <span className="text-muted-foreground">Tipo:</span>
                            <span className="font-medium">
                                {selectedType ? MERMA_TYPES.find(t => t.id === selectedType)?.label : '-'}
                            </span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-border/30">
                            <span className="text-muted-foreground">Producto:</span>
                            <span className="font-medium truncate max-w-[200px]">
                                {selectedProduct?.name || '-'}
                            </span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-border/30">
                            <span className="text-muted-foreground">Cantidad:</span>
                            <span className="font-medium">{quantity}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-border/30">
                            <span className="text-muted-foreground">Evidencia:</span>
                            <span className="font-medium">{evidence ? 'Adjunta' : 'No'}</span>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={resetForm}
                            className="flex-1 px-4 py-3 rounded-xl bg-secondary hover:bg-secondary/80 font-medium transition-colors"
                        >
                            Cancelar
                        </motion.button>
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleSubmit}
                            disabled={!selectedType || !selectedProduct}
                            className={cn(
                                "flex-1 px-4 py-3 rounded-xl font-medium transition-all",
                                "bg-gradient-to-r from-cyan-500 to-blue-500 text-white",
                                "hover:shadow-lg hover:shadow-cyan-500/25",
                                "disabled:opacity-50 disabled:cursor-not-allowed"
                            )}
                        >
                            Registrar Merma
                        </motion.button>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
