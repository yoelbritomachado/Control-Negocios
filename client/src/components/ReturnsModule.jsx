import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    ArrowLeftRight, Package2, Plus, X, Camera, Image as ImageIcon, 
    Clipboard, Trash2, Save, AlertTriangle, CheckCircle2, 
    Search, RotateCcw, ChevronDown, ChevronUp
} from 'lucide-react';
import { cn } from '../lib/utils';
import { fetchProducts } from '../api';
import { SearchDropdown } from './SearchDropdown';
import { useCart } from './CartProvider';
import ConfirmModal from './ConfirmModal';

// Tipos de devolución según LEY 4 del MEMORIA_PROYECTO.md
const RETURN_TYPES = [
    {
        id: 'new_product',
        label: 'Devolución con Producto Nuevo',
        description: 'Cliente devuelve producto intacto por cambio de opinión',
        stockEffect: '+1 (Reingresa al inventario)',
        moneyEffect: '-Precio (Se devuelve dinero)',
        icon: Package2,
        color: 'emerald'
    },
    {
        id: 'damaged_product',
        label: 'Devolución con Producto Dañado',
        description: 'Cliente devuelve producto defectuoso (Garantía)',
        stockEffect: '0 (No reingresa - se descarta)',
        moneyEffect: '-Precio (Se devuelve dinero)',
        icon: AlertTriangle,
        color: 'amber'
    },
    {
        id: 'internal_damage',
        label: 'Rotura Interna (Merma)',
        description: 'Accidente del personal, caducidad, robo',
        stockEffect: '-1 (Disminuye stock)',
        moneyEffect: '$0 (Pérdida interna)',
        icon: AlertTriangle,
        color: 'rose'
    }
];

// Componente para capturar imagen desde cámara, archivo o portapapeles
const ImageCapture = ({ onImageCapture, capturedImages, onRemoveImage }) => {
    const fileInputRef = useRef(null);
    const [isPasting, setIsPasting] = useState(false);
    const [pasteError, setPasteError] = useState(null);

    // Capturar desde cámara
    const handleCameraCapture = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            // Crear modal de cámara
            const video = document.createElement('video');
            video.srcObject = stream;
            video.play();
            
            // Crear canvas para capturar
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            
            // Mostrar modal de cámara
            const modal = document.createElement('div');
            modal.className = 'fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4';
            modal.innerHTML = `
                <div class="bg-[#0B1120] rounded-2xl p-6 max-w-lg w-full">
                    <h3 class="text-xl font-bold mb-4 flex items-center gap-2">
                        <svg class="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path>
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path>
                        </svg>
                        Capturar desde Cámara
                    </h3>
                    <div class="relative rounded-xl overflow-hidden bg-black mb-4">
                        <video id="camera-video" class="w-full h-64 object-cover" autoplay playsinline></video>
                    </div>
                    <div class="flex gap-3">
                        <button id="btn-capture" class="flex-1 py-3 bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl font-semibold transition-colors">
                            📸 Capturar Foto
                        </button>
                        <button id="btn-cancel" class="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-semibold transition-colors">
                            Cancelar
                        </button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            
            // Conectar video
            const videoEl = modal.querySelector('#camera-video');
            videoEl.srcObject = stream;
            
            // Manejar captura
            modal.querySelector('#btn-capture').onclick = () => {
                canvas.width = videoEl.videoWidth;
                canvas.height = videoEl.videoHeight;
                context.drawImage(videoEl, 0, 0);
                
                canvas.toBlob((blob) => {
                    const file = new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' });
                    onImageCapture(file);
                    stream.getTracks().forEach(track => track.stop());
                    document.body.removeChild(modal);
                }, 'image/jpeg', 0.9);
            };
            
            // Manejar cancelar
            modal.querySelector('#btn-cancel').onclick = () => {
                stream.getTracks().forEach(track => track.stop());
                document.body.removeChild(modal);
            };
            
        } catch (err) {
            console.error('Error accessing camera:', err);
            alert('No se pudo acceder a la cámara. Por favor verifica los permisos.');
        }
    };

    // Capturar desde archivo
    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (file && file.type.startsWith('image/')) {
            onImageCapture(file);
        }
    };

    // Capturar desde portapapeles (Windows)
    const handlePaste = async () => {
        setIsPasting(true);
        setPasteError(null);
        
        try {
            const clipboardItems = await navigator.clipboard.read();
            
            for (const item of clipboardItems) {
                // Buscar tipo de imagen
                const imageType = item.types.find(type => type.startsWith('image/'));
                
                if (imageType) {
                    const blob = await item.getType(imageType);
                    const extension = imageType.split('/')[1] || 'png';
                    const file = new File([blob], `clipboard-${Date.now()}.${extension}`, { type: imageType });
                    onImageCapture(file);
                    setIsPasting(false);
                    return;
                }
            }
            
            setPasteError('No se encontró imagen en el portapapeles');
        } catch (err) {
            console.error('Error reading clipboard:', err);
            setPasteError('Error al leer el portapapeles. Asegúrate de haber copiado una imagen.');
        } finally {
            setIsPasting(false);
        }
    };

    // Escuchar paste global
    useEffect(() => {
        const handleGlobalPaste = async (e) => {
            if (e.clipboardData && e.clipboardData.files.length > 0) {
                const file = e.clipboardData.files[0];
                if (file.type.startsWith('image/')) {
                    e.preventDefault();
                    onImageCapture(file);
                }
            }
        };

        document.addEventListener('paste', handleGlobalPaste);
        return () => document.removeEventListener('paste', handleGlobalPaste);
    }, [onImageCapture]);

    return (
        <div className="space-y-4">
            {/* Botones de captura */}
            <div className="flex flex-wrap gap-2">
                <button
                    onClick={handleCameraCapture}
                    className="flex items-center gap-2 px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 rounded-lg border border-cyan-500/30 transition-colors"
                >
                    <Camera className="w-4 h-4" />
                    Cámara
                </button>
                
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-700/50 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-600 transition-colors"
                >
                    <ImageIcon className="w-4 h-4" />
                    Archivo
                </button>
                
                <button
                    onClick={handlePaste}
                    disabled={isPasting}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-700/50 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-600 transition-colors disabled:opacity-50"
                >
                    <Clipboard className="w-4 h-4" />
                    {isPasting ? 'Leyendo...' : 'Portapapeles'}
                </button>
                
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                />
            </div>

            {/* Error de portapapeles */}
            {pasteError && (
                <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-400 text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    {pasteError}
                </div>
            )}

            {/* Vista previa de imágenes capturadas */}
            {capturedImages.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                    {capturedImages.map((image, index) => (
                        <div key={index} className="relative group">
                            <img
                                src={URL.createObjectURL(image)}
                                alt={`Evidencia ${index + 1}`}
                                className="w-full h-24 object-cover rounded-lg border border-slate-600"
                            />
                            <button
                                onClick={() => onRemoveImage(index)}
                                className="absolute -top-2 -right-2 w-6 h-6 bg-rose-500 hover:bg-rose-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <X className="w-3 h-3" />
                            </button>
                            <span className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/60 text-white text-xs rounded">
                                {index + 1}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* Instrucción de atajo */}
            <p className="text-xs text-slate-500">
                💡 También puedes pegar una imagen directamente (Ctrl+V) en cualquier parte de esta ventana
            </p>
        </div>
    );
};

// Componente principal de Devoluciones
export default function ReturnsModule({ onClose, onSave }) {
    const { currentInventory } = useCart();
    
    // Estados
    const [returnType, setReturnType] = useState('new_product');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [returnItems, setReturnItems] = useState([]);
    const [capturedImages, setCapturedImages] = useState([]);
    const [notes, setNotes] = useState('');
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [expandedType, setExpandedType] = useState(true);
    
    const searchInputRef = useRef(null);
    const searchTimeoutRef = useRef(null);

    // Buscar productos
    useEffect(() => {
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        if (searchQuery.trim().length >= 2) {
            searchTimeoutRef.current = setTimeout(async () => {
                try {
                    const products = await fetchProducts(searchQuery);
                    setSearchResults(products.slice(0, 8));
                    setIsDropdownOpen(true);
                } catch (e) {
                    console.error('Error searching products:', e);
                }
            }, 300);
        } else {
            setSearchResults([]);
            setIsDropdownOpen(false);
        }

        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, [searchQuery]);

    // Agregar producto al carrito de devolución
    const handleSelectProduct = (product) => {
        // Verificar si ya existe
        const existing = returnItems.find(item => item.id === product.id);
        if (existing) {
            // Incrementar cantidad
            setReturnItems(prev => prev.map(item => 
                item.id === product.id 
                    ? { ...item, quantity: item.quantity + 1 }
                    : item
            ));
        } else {
            // Agregar nuevo
            setReturnItems(prev => [...prev, {
                ...product,
                quantity: 1,
                returnPrice: product.sale_price_manual || 0
            }]);
        }
        setSearchQuery('');
        setIsDropdownOpen(false);
    };

    // Actualizar cantidad
    const updateQuantity = (productId, delta) => {
        setReturnItems(prev => prev.map(item => {
            if (item.id === productId) {
                const newQuantity = item.quantity + delta;
                return newQuantity > 0 ? { ...item, quantity: newQuantity } : item;
            }
            return item;
        }));
    };

    // Actualizar precio de devolución
    const updateReturnPrice = (productId, price) => {
        setReturnItems(prev => prev.map(item => 
            item.id === productId 
                ? { ...item, returnPrice: parseFloat(price) || 0 }
                : item
        ));
    };

    // Eliminar producto del carrito
    const removeItem = (productId) => {
        setReturnItems(prev => prev.filter(item => item.id !== productId));
    };

    // Calcular total a devolver
    const totalReturnAmount = returnItems.reduce((sum, item) => {
        return sum + (item.returnPrice * item.quantity);
    }, 0);

    // Manejar captura de imagen
    const handleImageCapture = (file) => {
        setCapturedImages(prev => [...prev, file]);
    };

    // Eliminar imagen
    const handleRemoveImage = (index) => {
        setCapturedImages(prev => prev.filter((_, i) => i !== index));
    };

    // Enviar devolución
    const handleSubmit = async () => {
        if (returnItems.length === 0) {
            alert('Debes agregar al menos un producto para la devolución');
            return;
        }

        setIsSubmitting(true);
        
        try {
            const returnData = {
                type: returnType,
                items: returnItems.map(item => ({
                    product_id: item.id,
                    quantity: item.quantity,
                    return_price: item.returnPrice
                })),
                total_amount: totalReturnAmount,
                images: capturedImages,
                notes: notes,
                inventory_id: currentInventory,
                date: new Date().toISOString()
            };

            await onSave(returnData);
            onClose();
        } catch (e) {
            console.error('Error saving return:', e);
            alert('Error al guardar la devolución');
        } finally {
            setIsSubmitting(false);
        }
    };

    const selectedType = RETURN_TYPES.find(t => t.id === returnType);
    const TypeIcon = selectedType?.icon || Package2;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="glass-card w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
            >
                {/* Header */}
                <div className="p-6 border-b border-slate-700/50 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center border border-amber-500/30">
                            <ArrowLeftRight className="w-6 h-6 text-amber-400" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold">Devolución / Merma</h2>
                            <p className="text-sm text-slate-400">Registro de devoluciones y pérdidas de productos</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    
                    {/* Selector de Tipo de Devolución */}
                    <div className="space-y-3">
                        <button
                            onClick={() => setExpandedType(!expandedType)}
                            className="w-full flex items-center justify-between p-4 rounded-xl bg-slate-800/50 border border-slate-700 hover:border-slate-600 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <div className={cn(
                                    "w-10 h-10 rounded-lg flex items-center justify-center",
                                    `bg-${selectedType.color}-500/20 border border-${selectedType.color}-500/30`
                                )}>
                                    <TypeIcon className={cn("w-5 h-5", `text-${selectedType.color}-400`)} />
                                </div>
                                <div className="text-left">
                                    <p className="font-semibold">{selectedType.label}</p>
                                    <p className="text-sm text-slate-400">{selectedType.description}</p>
                                </div>
                            </div>
                            {expandedType ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                        </button>

                        <AnimatePresence>
                            {expandedType && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div className="grid grid-cols-1 gap-2 p-2 rounded-xl bg-slate-900/50 border border-slate-800">
                                        {RETURN_TYPES.map((type) => {
                                            const Icon = type.icon;
                                            const isSelected = returnType === type.id;
                                            return (
                                                <button
                                                    key={type.id}
                                                    onClick={() => {
                                                        setReturnType(type.id);
                                                        setExpandedType(false);
                                                    }}
                                                    className={cn(
                                                        "flex items-start gap-3 p-3 rounded-lg text-left transition-all",
                                                        isSelected 
                                                            ? `bg-${type.color}-500/10 border border-${type.color}-500/30` 
                                                            : "hover:bg-slate-800 border border-transparent"
                                                    )}
                                                >
                                                    <div className={cn(
                                                        "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                                                        `bg-${type.color}-500/20`
                                                    )}>
                                                        <Icon className={cn("w-5 h-5", `text-${type.color}-400`)} />
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className={cn("font-semibold", isSelected && `text-${type.color}-400`)}>
                                                            {type.label}
                                                        </p>
                                                        <p className="text-sm text-slate-400">{type.description}</p>
                                                        <div className="flex gap-4 mt-2 text-xs">
                                                            <span className="text-slate-500">Stock: <span className={cn(`text-${type.color}-400`)}>{type.stockEffect}</span></span>
                                                            <span className="text-slate-500">Dinero: <span className={cn(`text-${type.color}-400`)}>{type.moneyEffect}</span></span>
                                                        </div>
                                                    </div>
                                                    {isSelected && <CheckCircle2 className={cn("w-5 h-5", `text-${type.color}-400`)} />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Búsqueda de Productos */}
                    <div className="space-y-3">
                        <label className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                            <Search className="w-4 h-4" />
                            Buscar Productos
                        </label>
                        <div className="relative">
                            <input
                                ref={searchInputRef}
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Escribe para buscar productos..."
                                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50"
                            />
                            <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                        </div>
                        
                        <SearchDropdown
                            isOpen={isDropdownOpen}
                            onClose={() => setIsDropdownOpen(false)}
                            searchResults={searchResults}
                            currentInventory={currentInventory}
                            onSelectProduct={handleSelectProduct}
                            inputRef={searchInputRef}
                        />
                    </div>

                    {/* Lista de Productos en Devolución */}
                    {returnItems.length > 0 && (
                        <div className="space-y-3">
                            <h3 className="text-sm font-semibold text-slate-300">Productos a Devolver</h3>
                            <div className="space-y-2">
                                {returnItems.map((item) => (
                                    <motion.div
                                        key={item.id}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="flex items-center gap-4 p-4 rounded-xl bg-slate-800/50 border border-slate-700"
                                    >
                                        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center border border-cyan-500/30 shrink-0">
                                            <Package2 className="w-6 h-6 text-cyan-400" />
                                        </div>
                                        
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold truncate">{item.name}</p>
                                            <p className="text-xs text-slate-400 font-mono">{item.code || 'SIN CÓDIGO'}</p>
                                        </div>

                                        {/* Control de Cantidad */}
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => updateQuantity(item.id, -1)}
                                                className="w-8 h-8 rounded-lg bg-slate-700 hover:bg-slate-600 flex items-center justify-center transition-colors"
                                            >
                                                <Minus className="w-4 h-4" />
                                            </button>
                                            <span className="w-10 text-center font-semibold">{item.quantity}</span>
                                            <button
                                                onClick={() => updateQuantity(item.id, 1)}
                                                className="w-8 h-8 rounded-lg bg-slate-700 hover:bg-slate-600 flex items-center justify-center transition-colors"
                                            >
                                                <Plus className="w-4 h-4" />
                                            </button>
                                        </div>

                                        {/* Precio de Devolución */}
                                        <div className="flex items-center gap-2">
                                            <span className="text-slate-400">$</span>
                                            <input
                                                type="number"
                                                value={item.returnPrice}
                                                onChange={(e) => updateReturnPrice(item.id, e.target.value)}
                                                className="w-24 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-right font-mono"
                                                step="0.01"
                                                min="0"
                                            />
                                        </div>

                                        {/* Subtotal */}
                                        <div className="text-right min-w-[80px]">
                                            <p className="font-bold text-emerald-400 font-mono">
                                                ${(item.returnPrice * item.quantity).toFixed(2)}
                                            </p>
                                        </div>

                                        {/* Eliminar */}
                                        <button
                                            onClick={() => removeItem(item.id)}
                                            className="p-2 rounded-lg text-rose-400 hover:bg-rose-500/20 transition-colors"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </motion.div>
                                ))}
                            </div>

                            {/* Total */}
                            <div className="flex justify-between items-center p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/30">
                                <span className="font-semibold">Total a Devolver:</span>
                                <span className="text-2xl font-bold text-emerald-400 font-mono">
                                    ${totalReturnAmount.toFixed(2)}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Captura de Evidencia */}
                    <div className="space-y-3">
                        <label className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                            <Camera className="w-4 h-4" />
                            Evidencia Fotográfica
                        </label>
                        <ImageCapture
                            onImageCapture={handleImageCapture}
                            capturedImages={capturedImages}
                            onRemoveImage={handleRemoveImage}
                        />
                    </div>

                    {/* Notas */}
                    <div className="space-y-3">
                        <label className="text-sm font-semibold text-slate-300">Notas Adicionales</label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Describe el motivo de la devolución, estado del producto, etc."
                            rows={3}
                            className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 resize-none"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-700/50 flex justify-end gap-3 shrink-0">
                    <button
                        onClick={onClose}
                        className="px-6 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-semibold transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={() => setShowConfirmModal(true)}
                        disabled={returnItems.length === 0 || isSubmitting}
                        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? (
                            <>
                                <RotateCcw className="w-5 h-5 animate-spin" />
                                Guardando...
                            </>
                        ) : (
                            <>
                                <Save className="w-5 h-5" />
                                Guardar Devolución
                            </>
                        )}
                    </button>
                </div>
            </motion.div>

            {/* Modal de Confirmación */}
            <ConfirmModal
                isOpen={showConfirmModal}
                onClose={() => setShowConfirmModal(false)}
                onConfirm={handleSubmit}
                title="Confirmar Devolución"
                message={`Estás a punto de registrar una devolución de ${returnItems.length} producto(s) por un total de $${totalReturnAmount.toFixed(2)}. ¿Deseas continuar?`}
                confirmText="Confirmar Devolución"
                variant="warning"
            />
        </div>
    );
}
