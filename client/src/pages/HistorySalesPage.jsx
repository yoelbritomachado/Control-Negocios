import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    Receipt,
    Search,
    Calendar,
    DollarSign,
    Package
} from 'lucide-react';
import { cn } from '../lib/utils';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export default function HistorySalesPage() {
    const [sales, setSales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [dateFilter, setDateFilter] = useState('');

    useEffect(() => {
        fetchSales();
    }, []);

    const fetchSales = async () => {
        try {
            const response = await fetch(`${API_URL}/sales`);
            if (!response.ok) throw new Error('Error al cargar ventas');
            const data = await response.json();
            setSales(data);
        } catch (err) {
            console.error('Error:', err);
        } finally {
            setLoading(false);
        }
    };

    const filteredSales = sales.filter(sale => {
        const matchesSearch = !searchQuery || 
            sale.id?.toString().includes(searchQuery) ||
            sale.items?.some(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()));
        
        const matchesDate = !dateFilter || 
            new Date(sale.date).toISOString().split('T')[0] === dateFilter;
        
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
                            Consulta todas las ventas realizadas
                        </p>
                    </div>
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
                        placeholder="Buscar por número de venta o producto..."
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
            </motion.div>

            {/* Sales Table */}
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
                                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Venta #</th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Fecha</th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Productos</th>
                                <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Total</th>
                                <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredSales.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-12 text-center text-muted-foreground">
                                        <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                        <p>No se encontraron ventas</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredSales.map((sale) => (
                                    <tr key={sale.id} className="border-b border-border/30 hover:bg-secondary/20 transition-colors">
                                        <td className="py-3 px-4 font-medium">#{sale.id}</td>
                                        <td className="py-3 px-4 text-muted-foreground">
                                            {new Date(sale.date).toLocaleDateString('es-ES')}
                                        </td>
                                        <td className="py-3 px-4">
                                            <span className="text-sm text-muted-foreground">
                                                {sale.items?.length || 0} productos
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-right font-medium">
                                            <span className="inline-flex items-center gap-1">
                                                <DollarSign className="w-3 h-3" />
                                                {parseFloat(sale.total).toFixed(2)}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <span className={cn(
                                                "inline-flex px-2 py-1 rounded-full text-xs font-medium",
                                                sale.status === 'completed' 
                                                    ? "bg-green-500/20 text-green-400"
                                                    : "bg-amber-500/20 text-amber-400"
                                            )}>
                                                {sale.status === 'completed' ? 'Completada' : 'Pendiente'}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </motion.div>
        </div>
    );
}
