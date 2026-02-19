import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    Trash2,
    Search,
    Calendar,
    Package,
    AlertTriangle,
    RotateCcw,
    AlertCircle,
    Camera,
    Building2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useCart } from '../components/CartProvider';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const MERMA_TYPE_CONFIG = {
    rotura_interna: {
        label: 'Rotura Interna',
        icon: Trash2,
        color: 'red',
        description: 'Stock -, Dinero 0'
    },
    devolucion_nuevo: {
        label: 'Devolución Nuevo',
        icon: RotateCcw,
        color: 'green',
        description: 'Stock +, Dinero -'
    },
    devolucion_danado: {
        label: 'Devolución Dañado',
        icon: AlertCircle,
        color: 'amber',
        description: 'Stock 0, Dinero -'
    }
};

export default function HistoryMermasPage() {
    const { currentInventory } = useCart();
    const [mermas, setMermas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [dateFilter, setDateFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState('');

    useEffect(() => {
        fetchMermas();
    }, [currentInventory]);

    const fetchMermas = async () => {
        try {
            const response = await fetch(`${API_URL}/mermas?inventory=${currentInventory}`);
            if (!response.ok) throw new Error('Error al cargar mermas');
            const data = await response.json();
            setMermas(data);
        } catch (err) {
            console.error('Error:', err);
            // Datos de ejemplo para demostración
            setMermas([
                {
                    id: 1,
                    type: 'rotura_interna',
                    product_name: 'Vaso de Cristal',
                    quantity: 2,
                    date: new Date().toISOString(),
                    reason: 'Se cayó al limpiar',
                    has_evidence: true,
                    inventory: 'mch1'
                },
                {
                    id: 2,
                    type: 'devolucion_nuevo',
                    product_name: 'Plato Decorativo',
                    quantity: 1,
                    date: new Date(Date.now() - 86400000).toISOString(),
                    reason: 'Cliente no le gustó el color',
                    has_evidence: false,
                    inventory: 'mch1'
                }
            ]);
        } finally {
            setLoading(false);
        }
    };

    const filteredMermas = mermas.filter(merma => {
        const matchesSearch = !searchQuery || 
            merma.product_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            merma.reason?.toLowerCase().includes(searchQuery.toLowerCase());
        
        const matchesDate = !dateFilter || 
            new Date(merma.date).toISOString().split('T')[0] === dateFilter;
        
        const matchesType = !typeFilter || merma.type === typeFilter;
        
        return matchesSearch && matchesDate && matchesType;
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
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            >
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-red-500 to-orange-600">
                        <Trash2 className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold gradient-text">Historial de Mermas</h1>
                        <p className="text-muted-foreground">
                            Registro de todas las pérdidas y devoluciones
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{currentInventory.toUpperCase()}</span>
                </div>
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
                        placeholder="Buscar por producto o motivo..."
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
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="px-4 py-2 rounded-xl bg-background border border-border focus:border-cyan-500 outline-none"
                >
                    <option value="">Todos los tipos</option>
                    <option value="rotura_interna">Rotura Interna</option>
                    <option value="devolucion_nuevo">Devolución Nuevo</option>
                    <option value="devolucion_danado">Devolución Dañado</option>
                </select>
            </motion.div>

            {/* Mermas Table */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="glass rounded-2xl overflow-hidden"
            >
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-border/50 bg-secondary/20">
                                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Fecha</th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Tipo</th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Producto</th>
                                <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Cantidad</th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Motivo</th>
                                <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Evidencia</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredMermas.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-12 text-center text-muted-foreground">
                                        <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                        <p>No se encontraron mermas</p>
                                        <p className="text-sm mt-1">Las mermas aparecerán aquí cuando las registres</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredMermas.map((merma) => {
                                    const config = MERMA_TYPE_CONFIG[merma.type] || MERMA_TYPE_CONFIG.rotura_interna;
                                    const Icon = config.icon;
                                    
                                    return (
                                        <tr key={merma.id} className="border-b border-border/30 hover:bg-secondary/20 transition-colors">
                                            <td className="py-3 px-4 text-muted-foreground">
                                                {new Date(merma.date).toLocaleDateString('es-ES')}
                                            </td>
                                            <td className="py-3 px-4">
                                                <div className="flex items-center gap-2">
                                                    <div className={cn(
                                                        "p-1.5 rounded-lg",
                                                        `bg-${config.color}-500/20 text-${config.color}-400`
                                                    )}>
                                                        <Icon className="w-4 h-4" />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-medium">{config.label}</p>
                                                        <p className="text-xs text-muted-foreground">{config.description}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 font-medium">
                                                {merma.product_name}
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <span className="inline-flex px-2 py-1 rounded-lg bg-secondary font-medium">
                                                    {merma.quantity}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-sm text-muted-foreground max-w-xs truncate">
                                                {merma.reason || '-'}
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                {merma.has_evidence ? (
                                                    <div className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-cyan-500/20 text-cyan-400 text-xs">
                                                        <Camera className="w-3 h-3" />
                                                        Sí
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground text-xs">No</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </motion.div>

            {/* Summary */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="grid grid-cols-1 sm:grid-cols-3 gap-4"
            >
                <div className="glass rounded-2xl p-4 flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-red-500/20 text-red-400">
                        <Trash2 className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold">
                            {mermas.filter(m => m.type === 'rotura_interna').reduce((acc, m) => acc + m.quantity, 0)}
                        </p>
                        <p className="text-sm text-muted-foreground">Roturas Internas</p>
                    </div>
                </div>
                <div className="glass rounded-2xl p-4 flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-green-500/20 text-green-400">
                        <RotateCcw className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold">
                            {mermas.filter(m => m.type === 'devolucion_nuevo').reduce((acc, m) => acc + m.quantity, 0)}
                        </p>
                        <p className="text-sm text-muted-foreground">Devoluciones Nuevas</p>
                    </div>
                </div>
                <div className="glass rounded-2xl p-4 flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-amber-500/20 text-amber-400">
                        <AlertCircle className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold">
                            {mermas.filter(m => m.type === 'devolucion_danado').reduce((acc, m) => acc + m.quantity, 0)}
                        </p>
                        <p className="text-sm text-muted-foreground">Devoluciones Dañadas</p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
