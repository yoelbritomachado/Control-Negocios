import { useState, useEffect, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeftRight,
    Search,
    Calendar,
    DollarSign,
    Package,
    Building2,
    Check,
    Truck,
    Clock,
    X,
    Undo2,
    Edit3,
    ChevronDown,
    ChevronUp,
    Layers,
    Tag,
    Image as ImageIcon
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useCart } from '../components/CartProvider';
import TransferReversalModal from '../components/TransferReversalModal';
import api from '../api';

export default function HistoryPurchasesPage() {
    const { currentInventory } = useCart();
    const navigate = useNavigate();
    const [purchases, setPurchases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [dateFilter, setDateFilter] = useState('');
    const [selectedTransferForReversal, setSelectedTransferForReversal] = useState(null);
    const [expandedRowId, setExpandedRowId] = useState(null);

    const toggleRow = (id) => {
        setExpandedRowId(prev => prev === id ? null : id);
    };

    useEffect(() => {
        fetchPurchases();
    }, [currentInventory]);

    const fetchPurchases = async () => {
        try {
            setLoading(true);
            const invParam = currentInventory ? `?inventory_id=${encodeURIComponent(currentInventory)}` : '';
            const res = await api.get(`/purchases${invParam}`);
            setPurchases(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error('Error:', err);
            setPurchases([]);
        } finally {
            setLoading(false);
        }
    };

    const handleReceiveTransfer = async (transferId) => {
        try {
            await api.post(`/transfers/${transferId}/receive`);
            alert('Traslado recibido con éxito y stock ingresado.');
            fetchPurchases();
        } catch (err) {
            alert('Error al recibir traslado: ' + (err.response?.data?.error || err.message));
        }
    };

    const filteredPurchases = purchases.filter(purchase => {
        if (!purchase) return false;
        const matchesSearch = !searchQuery || 
            (purchase.supplier && purchase.supplier.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (Array.isArray(purchase.items) && purchase.items.some(p => p?.product_name && p.product_name.toLowerCase().includes(searchQuery.toLowerCase()))) ||
            (Array.isArray(purchase.products) && purchase.products.some(p => p?.name && p.name.toLowerCase().includes(searchQuery.toLowerCase())));
        
        const matchesDate = !dateFilter || 
            (purchase.date && new Date(purchase.date).toISOString().split('T')[0] === dateFilter);
        
        return matchesSearch && matchesDate;
    });

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
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600">
                        <ArrowLeftRight className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold gradient-text">
                            {currentInventory === 'alm' ? 'Historial de Entradas y Compras' : 'Historial de Traslados y Entradas'}
                        </h1>
                        <p className="text-muted-foreground">
                            {currentInventory === 'alm' 
                                ? 'Registro de compras y abastecimiento del almacén central' 
                                : 'Registro de mercancías recibidas y traslados de inventario'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{currentInventory.toUpperCase()}</span>
                </div>
            </div>

            {/* Filters */}
            <div className="glass rounded-2xl p-4 flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={currentInventory === 'alm' ? "Buscar por proveedor o producto..." : "Buscar por emisor/origen o producto..."}
                        className="w-full pl-10 pr-4 py-2 rounded-xl bg-background border border-border focus:border-cyan-500 outline-none"
                    />
                </div>
                <div className="relative sm:w-48">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="date"
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 rounded-xl bg-background border border-border focus:border-cyan-500 outline-none"
                    />
                </div>
            </div>

            {/* Purchases Table */}
            <div className="glass rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-border/50 bg-secondary/20">
                                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Fecha</th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                                    {currentInventory === 'alm' ? 'Proveedor' : 'Origen / Emisor'}
                                </th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Productos</th>
                                <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Total (CUP)</th>
                                <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredPurchases.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-12 text-center text-muted-foreground">
                                        <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                        <p>{currentInventory === 'alm' ? 'No se encontraron compras' : 'No se encontraron traslados ni entradas'}</p>
                                        <p className="text-sm mt-1">
                                            {currentInventory === 'alm' 
                                                ? 'Las compras aparecerán aquí cuando registres entradas de inventario' 
                                                : 'Los traslados recibidos aparecerán aquí'}
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                filteredPurchases.map((purchase) => {
                                    const isExpanded = expandedRowId === purchase.id;
                                    const itemsList = Array.isArray(purchase.items) && purchase.items.length > 0 
                                        ? purchase.items 
                                        : (Array.isArray(purchase.products) ? purchase.products : []);
                                    
                                    const totalQty = itemsList.reduce((sum, it) => sum + (it.quantity || 0), 0);
                                    const totalSaleVal = purchase.total || itemsList.reduce((sum, it) => sum + ((it.quantity || 0) * (it.sale_price || it.price || 0)), 0);
                                    const totalCostVal = purchase.total_cost || itemsList.reduce((sum, it) => sum + ((it.quantity || 0) * (it.cost_price || it.cost || 0)), 0);

                                    return (
                                        <Fragment key={purchase.id}>
                                            <tr 
                                                onClick={() => toggleRow(purchase.id)}
                                                className={cn(
                                                    "border-b border-border/30 transition-colors cursor-pointer select-none",
                                                    isExpanded ? "bg-secondary/40 border-cyan-500/30" : "hover:bg-secondary/20"
                                                )}
                                            >
                                                <td className="py-3 px-4 text-muted-foreground">
                                                    <div className="flex items-center gap-2">
                                                        {isExpanded ? (
                                                            <ChevronUp className="w-4 h-4 text-cyan-400 shrink-0" />
                                                        ) : (
                                                            <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                                                        )}
                                                        <span>{new Date(purchase.date).toLocaleDateString('es-ES')}</span>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4 font-medium">
                                                    <div className="flex flex-col">
                                                        <span className="text-slate-100">{purchase.supplier || (currentInventory === 'alm' ? 'Proveedor Externo' : 'Almacén MCH')}</span>
                                                        {purchase.notes && (
                                                            <span className="text-xs text-muted-foreground truncate max-w-xs">{purchase.notes}</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className="inline-flex items-center gap-1.5 text-sm text-cyan-300 font-medium bg-cyan-500/10 px-2 py-0.5 rounded-lg border border-cyan-500/20">
                                                        <Package className="w-3.5 h-3.5" />
                                                        {itemsList.length} {itemsList.length === 1 ? 'producto' : 'productos'} ({totalQty} uds)
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-right font-medium">
                                                    <div className="flex flex-col items-end">
                                                        <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                                                            <DollarSign className="w-3 h-3" />
                                                            {parseFloat(totalSaleVal).toFixed(2)}
                                                        </span>
                                                        {purchase.record_type === 'transfer' && totalCostVal > 0 && (
                                                            <span className="text-xs text-muted-foreground">
                                                                Costo: ${parseFloat(totalCostVal).toFixed(2)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                                                    <div className="flex items-center justify-center gap-2">
                                                        <span className={cn(
                                                            "inline-flex px-2 py-1 rounded-full text-xs font-medium",
                                                            purchase.status === 'received' || (!purchase.status && purchase.record_type !== 'transfer')
                                                                ? "bg-green-500/20 text-green-400"
                                                                : purchase.status === 'reverted'
                                                                ? "bg-purple-500/20 text-purple-400"
                                                                : purchase.status === 'partially_reverted'
                                                                ? "bg-orange-500/20 text-orange-400"
                                                                : purchase.status === 'cancelled'
                                                                ? "bg-gray-500/20 text-gray-400"
                                                                : "bg-amber-500/20 text-amber-400"
                                                        )}>
                                                            {purchase.status === 'received' || (!purchase.status && purchase.record_type !== 'transfer') 
                                                                ? 'Recibido' 
                                                                : purchase.status === 'reverted'
                                                                ? 'Revertido'
                                                                : purchase.status === 'partially_reverted'
                                                                ? 'Rev. Parcial'
                                                                : purchase.status === 'cancelled'
                                                                ? 'Cancelado'
                                                                : 'Pendiente'}
                                                        </span>

                                                        {purchase.record_type === 'transfer' && purchase.status === 'pending' && purchase.target_inventory === currentInventory && (
                                                            <button
                                                                onClick={() => handleReceiveTransfer(purchase.transfer_id)}
                                                                title="Recibir y confirmar ingreso"
                                                                className="p-1.5 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
                                                            >
                                                                <Check className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}

                                                        {purchase.record_type === 'transfer' && (
                                                            <button
                                                                onClick={() => navigate(`/traslados?edit=${purchase.transfer_id}`)}
                                                                title="Editar traslado en la vista de Traslados"
                                                                className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
                                                            >
                                                                <Edit3 className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}

                                                        {purchase.record_type === 'transfer' && (purchase.status === 'received' || purchase.status === 'pending') && (
                                                            <button
                                                                onClick={() => setSelectedTransferForReversal(purchase.transfer_id)}
                                                                title="Revertir / Cancelar traslado"
                                                                className="p-1.5 rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-colors"
                                                            >
                                                                <Undo2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>

                                            {/* Acordeón Desplegable con los Productos y Detalles */}
                                            {isExpanded && (
                                                <tr className="bg-slate-900/60 border-b border-border/40">
                                                    <td colSpan={5} className="p-4 sm:p-6">
                                                        <motion.div
                                                            initial={{ opacity: 0, height: 0 }}
                                                            animate={{ opacity: 1, height: 'auto' }}
                                                            exit={{ opacity: 0, height: 0 }}
                                                            className="space-y-4"
                                                        >
                                                            {/* Resumen Superior del Desglose */}
                                                            <div className="flex flex-wrap items-center justify-between gap-4 p-3.5 rounded-xl bg-slate-800/80 border border-white/10 text-sm">
                                                                <div className="flex items-center gap-4">
                                                                    <span className="text-muted-foreground">
                                                                        {purchase.record_type === 'transfer' ? 'Tipo: Traslado entre inventarios' : 'Tipo: Entrada / Compra'}
                                                                    </span>
                                                                    {purchase.user_name && (
                                                                        <span className="text-slate-300">
                                                                            👤 Registrado por: <strong className="text-white">{purchase.user_name}</strong>
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="flex items-center gap-6">
                                                                    <div className="text-right">
                                                                        <span className="text-xs text-muted-foreground block">Total Unidades</span>
                                                                        <span className="font-bold text-cyan-400 text-base">{totalQty} uds</span>
                                                                    </div>
                                                                    {purchase.record_type === 'transfer' && totalCostVal > 0 && (
                                                                        <div className="text-right">
                                                                            <span className="text-xs text-muted-foreground block">Total en Coste</span>
                                                                            <span className="font-bold text-slate-300 text-base">${parseFloat(totalCostVal).toFixed(2)}</span>
                                                                        </div>
                                                                    )}
                                                                    <div className="text-right">
                                                                        <span className="text-xs text-muted-foreground block">Total en Venta</span>
                                                                        <span className="font-bold text-emerald-400 text-base">${parseFloat(totalSaleVal).toFixed(2)}</span>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Tabla / Lista de Productos Detallados */}
                                                            {itemsList.length === 0 ? (
                                                                <div className="text-center py-6 text-muted-foreground text-sm bg-slate-800/30 rounded-xl">
                                                                    <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                                                    No hay detalle de productos individual para este registro histórico.
                                                                </div>
                                                            ) : (
                                                                <div className="overflow-x-auto rounded-xl border border-white/5 bg-slate-950/40">
                                                                    <table className="w-full text-sm">
                                                                        <thead>
                                                                            <tr className="border-b border-white/10 bg-slate-800/40 text-xs text-muted-foreground uppercase">
                                                                                <th className="py-2.5 px-3 text-left">Foto</th>
                                                                                <th className="py-2.5 px-3 text-left">Producto</th>
                                                                                <th className="py-2.5 px-3 text-left">Código</th>
                                                                                <th className="py-2.5 px-3 text-center">Cantidad</th>
                                                                                <th className="py-2.5 px-3 text-right">P. Coste</th>
                                                                                <th className="py-2.5 px-3 text-right">P. Venta</th>
                                                                                <th className="py-2.5 px-3 text-right">Total Coste</th>
                                                                                <th className="py-2.5 px-3 text-right">Total Venta</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody className="divide-y divide-white/5">
                                                                            {itemsList.map((item, idx) => {
                                                                                const itemQty = item.quantity || 0;
                                                                                const itemCost = item.cost_price || item.cost || item.unit_price || 0;
                                                                                const itemSale = item.sale_price || item.price || 0;
                                                                                const rowCost = itemQty * itemCost;
                                                                                const rowSale = itemQty * itemSale;

                                                                                return (
                                                                                    <tr key={`${item.id || item.product_id || idx}`} className="hover:bg-white/5 transition-colors">
                                                                                        <td className="py-2 px-3">
                                                                                            <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-800 border border-white/10 flex items-center justify-center shrink-0">
                                                                                                {item.product_image || item.image ? (
                                                                                                    <img 
                                                                                                        src={item.product_image || item.image} 
                                                                                                        alt={item.product_name || item.name} 
                                                                                                        className="w-full h-full object-cover"
                                                                                                        onError={(e) => {
                                                                                                            e.target.style.display = 'none';
                                                                                                            e.target.parentElement.innerHTML = '<span class="text-xs text-slate-500">📦</span>';
                                                                                                        }}
                                                                                                    />
                                                                                                ) : (
                                                                                                    <ImageIcon className="w-4 h-4 text-slate-500" />
                                                                                                )}
                                                                                            </div>
                                                                                        </td>
                                                                                        <td className="py-2 px-3 font-medium text-slate-200">
                                                                                            {item.product_name || item.name || 'Producto sin nombre'}
                                                                                        </td>
                                                                                        <td className="py-2 px-3 font-mono text-xs text-muted-foreground">
                                                                                            {item.product_code || item.code || '-'}
                                                                                        </td>
                                                                                        <td className="py-2 px-3 text-center">
                                                                                            <span className="inline-block px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 font-bold">
                                                                                                {itemQty}
                                                                                            </span>
                                                                                        </td>
                                                                                        <td className="py-2 px-3 text-right text-slate-400">
                                                                                            ${parseFloat(itemCost).toFixed(2)}
                                                                                        </td>
                                                                                        <td className="py-2 px-3 text-right text-slate-200 font-medium">
                                                                                            ${parseFloat(itemSale).toFixed(2)}
                                                                                        </td>
                                                                                        <td className="py-2 px-3 text-right text-slate-400 font-medium">
                                                                                            ${parseFloat(rowCost).toFixed(2)}
                                                                                        </td>
                                                                                        <td className="py-2 px-3 text-right text-emerald-400 font-bold">
                                                                                            ${parseFloat(rowSale).toFixed(2)}
                                                                                        </td>
                                                                                    </tr>
                                                                                );
                                                                            })}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            )}
                                                        </motion.div>
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal de Reversión Inteligente */}
            {selectedTransferForReversal && (
                <TransferReversalModal
                    transferId={selectedTransferForReversal}
                    onClose={() => setSelectedTransferForReversal(null)}
                    onSuccess={() => {
                        fetchPurchases();
                    }}
                />
            )}
        </div>
    );
}
