import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Receipt,
    Search,
    Calendar,
    DollarSign,
    Package,
    Edit3,
    Eye,
    Clock,
    User,
    Store,
    ChevronDown,
    ChevronUp,
    ShoppingBag,
    AlertCircle,
    RotateCcw,
    Save
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../components/CartProvider';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Ventas de ejemplo para demostración
const SAMPLE_SALES = [
    {
        id: 1001,
        date: new Date(Date.now() - 86400000 * 0.5).toISOString(), // Hace 12 horas
        inventory: 'MCH 1',
        seller: 'Vendedor 1',
        seller_id: 2,
        total: 2450.00,
        status: 'closed',
        audited_by: 'Administrador',
        items: [
            { name: 'Vaso Decorativo', quantity: 2, price: 450.00 },
            { name: 'Plato Cerámico', quantity: 1, price: 350.00 },
            { name: 'Jarrón Azul', quantity: 1, price: 1200.00 }
        ],
        payment_method: 'cash',
        notes: 'Venta regular del día'
    },
    {
        id: 1002,
        date: new Date(Date.now() - 86400000 * 1.2).toISOString(), // Ayer
        inventory: 'MCH 1',
        seller: 'Administrador',
        seller_id: 1,
        total: 1890.50,
        status: 'closed',
        audited_by: 'Administrador',
        items: [
            { name: 'Lámpara de Mesa', quantity: 1, price: 890.50 },
            { name: 'Portavelas Set x3', quantity: 2, price: 500.00 }
        ],
        payment_method: 'transfer',
        notes: 'Pago por transferencia'
    },
    {
        id: 1003,
        date: new Date(Date.now() - 86400000 * 2).toISOString(),
        inventory: 'MCH 2',
        seller: 'Vendedor 2',
        seller_id: 3,
        total: 3200.00,
        status: 'closed',
        audited_by: null,
        items: [
            { name: 'Espejo Redondo', quantity: 1, price: 1500.00 },
            { name: 'Repisa Flotante', quantity: 2, price: 850.00 }
        ],
        payment_method: 'cash',
        notes: ''
    },
    {
        id: 1004,
        date: new Date(Date.now() - 86400000 * 0.2).toISOString(), // Hace ~5 horas
        inventory: 'MCH 1',
        seller: 'Vendedor 1',
        seller_id: 2,
        total: 5675.00,
        status: 'pending_review',
        audited_by: null,
        items: [
            { name: 'Mueble Organizador', quantity: 1, price: 3200.00 },
            { name: 'Cajas Decorativas', quantity: 3, price: 450.00 },
            { name: 'Alfombra Tejida', quantity: 1, price: 1125.00 }
        ],
        payment_method: 'mixed',
        notes: 'Pago mixto: $3000 efectivo, resto transfer'
    },
    {
        id: 1005,
        date: new Date(Date.now() - 86400000 * 3).toISOString(),
        inventory: 'MCH 1',
        seller: 'Administrador',
        seller_id: 1,
        total: 890.00,
        status: 'closed',
        audited_by: 'Administrador',
        items: [
            { name: 'Cuadro Decorativo', quantity: 1, price: 890.00 }
        ],
        payment_method: 'cash',
        notes: 'Cliente frecuente'
    },
    {
        id: 1006,
        date: new Date(Date.now() - 86400000 * 0.8).toISOString(), // Hace ~19 horas
        inventory: 'Almacén',
        seller: 'Vendedor 1',
        seller_id: 2,
        total: 12500.00,
        status: 'open',
        audited_by: null,
        items: [
            { name: 'Silla Ergonómica', quantity: 2, price: 2500.00 },
            { name: 'Escritorio Minimal', quantity: 1, price: 4500.00 },
            { name: 'Lámpara LED', quantity: 3, price: 833.33 }
        ],
        payment_method: null,
        notes: 'Venta en proceso - Sesión activa'
    },
    {
        id: 1007,
        date: new Date(Date.now() - 86400000 * 4).toISOString(),
        inventory: 'MCH 2',
        seller: 'Vendedor 2',
        seller_id: 3,
        total: 2100.00,
        status: 'closed',
        audited_by: 'Administrador',
        items: [
            { name: 'Set de Tazas', quantity: 2, price: 450.00 },
            { name: 'Termo Premium', quantity: 1, price: 1200.00 }
        ],
        payment_method: 'transfer',
        notes: ''
    }
];

const STATUS_CONFIG = {
    open: {
        label: 'EN PROCESO',
        color: 'blue',
        icon: Clock,
        description: 'Sesión activa'
    },
    pending_review: {
        label: 'EN REVISIÓN',
        color: 'amber',
        icon: AlertCircle,
        description: 'Esperando aprobación'
    },
    closed: {
        label: 'CERRADA',
        color: 'green',
        icon: Eye,
        description: 'Venta completada'
    }
};

export default function HistorySalesPage() {
    const navigate = useNavigate();
    const { cart, setCart, setSavedSales } = useCart();
    const [sales, setSales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [dateFilter, setDateFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [expandedSale, setExpandedSale] = useState(null);
    const [showEditConfirm, setShowEditConfirm] = useState(null);

    useEffect(() => {
        // Simular carga de datos
        setTimeout(() => {
            setSales(SAMPLE_SALES);
            setLoading(false);
        }, 500);
    }, []);

    const filteredSales = sales.filter(sale => {
        const matchesSearch = !searchQuery || 
            sale.id.toString().includes(searchQuery) ||
            sale.seller.toLowerCase().includes(searchQuery.toLowerCase()) ||
            sale.items.some(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()));
        
        const matchesDate = !dateFilter || 
            new Date(sale.date).toISOString().split('T')[0] === dateFilter;
        
        const matchesStatus = !statusFilter || sale.status === statusFilter;
        
        return matchesSearch && matchesDate && matchesStatus;
    });

    const handleEditSession = (sale) => {
        // Si hay productos en el carrito actual, guardarlos primero
        if (cart.length > 0) {
            setShowEditConfirm(sale);
            return;
        }
        
        // Si no hay carrito, ir directo al POS con la sesión
        loadSessionInPOS(sale);
    };

    const confirmEditWithSave = () => {
        const sale = showEditConfirm;
        
        // Guardar carrito actual como ticket pendiente
        if (cart.length > 0) {
            const savedSale = {
                id: Date.now(),
                items: [...cart],
                total: cart.reduce((sum, item) => sum + (item.sale_price_manual * item.quantity), 0),
                time: new Date().toLocaleTimeString(),
                date: new Date().toISOString(),
                status: 'saved',
                inventoryId: sale.inventory.toLowerCase().replace(' ', '')
            };
            setSavedSales(prev => [savedSale, ...prev]);
        }
        
        setShowEditConfirm(null);
        loadSessionInPOS(sale);
    };

    const loadSessionInPOS = (sale) => {
        // Cargar los items de la venta en el carrito
        const cartItems = sale.items.map(item => ({
            id: `session_${item.name}`,
            name: item.name,
            code: '',
            sale_price_manual: item.price,
            cost_mn: item.price * 0.6, // Estimado
            quantity: item.quantity
        }));
        
        setCart(cartItems);
        
        // Guardar info de la sesión en localStorage para el POS
        localStorage.setItem('editing_session', JSON.stringify({
            sale_id: sale.id,
            inventory: sale.inventory,
            seller: sale.seller,
            status: sale.status,
            original_total: sale.total
        }));
        
        // Navegar al POS
        navigate('/pos');
    };

    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
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
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            >
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600">
                        <Receipt className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold gradient-text">Historial de Ventas</h1>
                        <p className="text-muted-foreground">
                            Consulta y gestiona todas las ventas realizadas
                        </p>
                    </div>
                </div>
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => navigate('/pos')}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 text-white font-medium hover:shadow-lg hover:shadow-pink-500/25 transition-all"
                >
                    <ShoppingBag className="w-4 h-4" />
                    Nueva Venta
                </motion.button>
            </motion.div>

            {/* Filters */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="glass rounded-2xl p-4 flex flex-col sm:flex-row gap-4"
            >
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Buscar por vendedor, producto o #venta..."
                        className="w-full pl-10 pr-4 py-2 rounded-xl bg-background border border-border focus:border-cyan-500 outline-none"
                    />
                </div>
                <div className="relative sm:w-40">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="date"
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 rounded-xl bg-background border border-border focus:border-cyan-500 outline-none"
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-4 py-2 rounded-xl bg-background border border-border focus:border-cyan-500 outline-none"
                >
                    <option value="">Todos los estados</option>
                    <option value="open">En Proceso</option>
                    <option value="pending_review">En Revisión</option>
                    <option value="closed">Cerradas</option>
                </select>
            </motion.div>

            {/* Sales List */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="space-y-3"
            >
                {filteredSales.length === 0 ? (
                    <div className="glass rounded-2xl p-12 text-center text-muted-foreground">
                        <Package className="w-16 h-16 mx-auto mb-4 opacity-20" />
                        <p className="text-lg">No se encontraron ventas</p>
                        <p className="text-sm mt-1">Intenta con otros filtros</p>
                    </div>
                ) : (
                    filteredSales.map((sale) => {
                        const status = STATUS_CONFIG[sale.status];
                        const StatusIcon = status.icon;
                        const isExpanded = expandedSale === sale.id;

                        return (
                            <motion.div
                                key={sale.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={cn(
                                    "glass rounded-2xl overflow-hidden transition-all",
                                    sale.status === 'open' && "border-l-4 border-l-cyan-500",
                                    sale.status === 'pending_review' && "border-l-4 border-l-amber-500"
                                )}
                            >
                                {/* Main Row */}
                                <div 
                                    className="p-4 cursor-pointer hover:bg-secondary/20 transition-colors"
                                    onClick={() => setExpandedSale(isExpanded ? null : sale.id)}
                                >
                                    <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                                        {/* Date & Session */}
                                        <div className="flex items-start gap-3 lg:w-1/4">
                                            <div className="p-2 rounded-lg bg-secondary">
                                                <Clock className="w-4 h-4 text-muted-foreground" />
                                            </div>
                                            <div>
                                                <p className="font-medium">{formatDate(sale.date)}</p>
                                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                    <Receipt className="w-3 h-3" />
                                                    Venta #{sale.id}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Business */}
                                        <div className="flex items-center gap-2 lg:w-1/6">
                                            <Store className="w-4 h-4 text-muted-foreground" />
                                            <span className="text-sm">{sale.inventory}</span>
                                        </div>

                                        {/* Seller */}
                                        <div className="flex items-center gap-2 lg:w-1/6">
                                            <User className="w-4 h-4 text-muted-foreground" />
                                            <span className="text-sm">{sale.seller}</span>
                                        </div>

                                        {/* Status */}
                                        <div className="lg:w-1/6">
                                            <span className={cn(
                                                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium",
                                                `bg-${status.color}-500/20 text-${status.color}-400 border border-${status.color}-500/30`
                                            )}>
                                                <StatusIcon className="w-3 h-3" />
                                                {status.label}
                                            </span>
                                            {sale.audited_by && (
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    Auditado: {sale.audited_by}
                                                </p>
                                            )}
                                        </div>

                                        {/* Total & Actions */}
                                        <div className="flex items-center justify-between lg:justify-end gap-4 lg:w-1/4">
                                            <span className="text-xl font-bold">
                                                ${parseFloat(sale.total).toFixed(2)}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                {/* Edit Session Button */}
                                                <motion.button
                                                    whileHover={{ scale: 1.05 }}
                                                    whileTap={{ scale: 0.95 }}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleEditSession(sale);
                                                    }}
                                                    className={cn(
                                                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                                                        sale.status === 'open'
                                                            ? "bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30"
                                                            : "bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground"
                                                    )}
                                                    title={sale.status === 'open' ? 'Continuar sesión' : 'Editar sesión'}
                                                >
                                                    <Edit3 className="w-4 h-4" />
                                                    {sale.status === 'open' ? 'Continuar' : 'Editar'}
                                                </motion.button>
                                                
                                                <motion.button
                                                    whileHover={{ scale: 1.05 }}
                                                    whileTap={{ scale: 0.95 }}
                                                    className="p-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
                                                >
                                                    {isExpanded ? (
                                                        <ChevronUp className="w-4 h-4" />
                                                    ) : (
                                                        <ChevronDown className="w-4 h-4" />
                                                    )}
                                                </motion.button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Expanded Details */}
                                <AnimatePresence>
                                    {isExpanded && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="border-t border-border/30 bg-secondary/10"
                                        >
                                            <div className="p-4 space-y-4">
                                                {/* Items List */}
                                                <div>
                                                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                                                        <Package className="w-4 h-4 text-muted-foreground" />
                                                        Productos ({sale.items.length})
                                                    </h4>
                                                    <div className="space-y-2">
                                                        {sale.items.map((item, idx) => (
                                                            <div 
                                                                key={idx}
                                                                className="flex items-center justify-between py-2 px-3 rounded-lg bg-background/50"
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    <span className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-xs text-muted-foreground">
                                                                        {item.quantity}
                                                                    </span>
                                                                    <span className="text-sm">{item.name}</span>
                                                                </div>
                                                                <span className="text-sm font-medium">
                                                                    ${parseFloat(item.price).toFixed(2)}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Payment Info */}
                                                {sale.payment_method && (
                                                    <div className="flex items-center gap-4 text-sm">
                                                        <span className="text-muted-foreground">Método de pago:</span>
                                                        <span className="px-2 py-1 rounded-lg bg-secondary capitalize">
                                                            {sale.payment_method === 'cash' ? 'Efectivo' : 
                                                             sale.payment_method === 'transfer' ? 'Transferencia' : 
                                                             sale.payment_method === 'mixed' ? 'Mixto' : sale.payment_method}
                                                        </span>
                                                    </div>
                                                )}

                                                {/* Notes */}
                                                {sale.notes && (
                                                    <div className="text-sm text-muted-foreground">
                                                        <span className="font-medium text-foreground">Notas:</span> {sale.notes}
                                                    </div>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        );
                    })
                )}
            </motion.div>

            {/* Confirm Modal */}
            <AnimatePresence>
                {showEditConfirm && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => setShowEditConfirm(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="glass rounded-2xl p-6 max-w-md w-full"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-3 rounded-xl bg-amber-500/20">
                                    <Save className="w-6 h-6 text-amber-400" />
                                </div>
                                <h3 className="text-xl font-bold">Carrito con productos</h3>
                            </div>
                            
                            <p className="text-muted-foreground mb-6">
                                Tienes <strong>{cart.length} producto(s)</strong> en el carrito actual. 
                                ¿Deseas guardarlos como ticket pendiente antes de editar la sesión 
                                <strong>#{showEditConfirm.id}</strong>?
                            </p>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowEditConfirm(null)}
                                    className="flex-1 px-4 py-3 rounded-xl bg-secondary hover:bg-secondary/80 font-medium transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={confirmEditWithSave}
                                    className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium hover:shadow-lg hover:shadow-cyan-500/25 transition-all"
                                >
                                    Guardar y Continuar
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
