import { useState, useMemo, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';
import { TrendingUp, BarChart3, Calendar } from 'lucide-react';
import { cn } from '../lib/utils';

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-slate-900/95 backdrop-blur-xl border border-cyan-500/30 rounded-xl p-3 shadow-2xl text-white">
                <p className="text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{label}</span>
                </p>
                <p className="text-base font-bold text-cyan-400">
                    ${Number(payload[0].value || 0).toLocaleString('es-CU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CUP
                </p>
                {data.count !== undefined && (
                    <p className="text-[11px] text-slate-400 mt-0.5">
                        {data.count} venta(s) registrada(s)
                    </p>
                )}
            </div>
        );
    }
    return null;
};

export function SalesChart({ data = [], loading = false }) {
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setIsMounted(true), 100);
        return () => clearTimeout(timer);
    }, []);

    const chartData = useMemo(() => {
        if (!Array.isArray(data) || data.length === 0) return [];
        return data.map(item => ({
            day: item.day,
            sales: Number(item.sales || 0),
            count: item.count || 0
        }));
    }, [data]);

    const { totalSales, avgSales, maxSales } = useMemo(() => {
        if (chartData.length === 0) return { totalSales: 0, avgSales: 0, maxSales: 0 };
        const total = chartData.reduce((acc, curr) => acc + curr.sales, 0);
        return {
            totalSales: total,
            avgSales: total / chartData.length,
            maxSales: Math.max(...chartData.map(d => d.sales), 0)
        };
    }, [chartData]);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="glass-card rounded-2xl p-4 md:p-6 bg-slate-900/80 backdrop-blur-md border border-slate-800 shadow-xl"
        >
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/10 border border-cyan-500/30">
                        <TrendingUp className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div>
                        <h3 className="text-base md:text-lg font-bold text-white">Evolución de Ventas</h3>
                        <p className="text-xs text-slate-400">
                            {chartData.length > 0 ? `${chartData.length} puntos temporales registrados con ingresos` : 'Sin registros de ventas en el período'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3 text-xs">
                    <div className="px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-300">
                        Pico máximo: <span className="font-bold text-cyan-400">${maxSales.toLocaleString('es-CU')}</span>
                    </div>
                </div>
            </div>

            {/* Chart Area */}
            <div className="h-64 sm:h-72 w-full">
                {loading ? (
                    <div className="h-full flex items-center justify-center text-slate-500 text-sm animate-pulse">
                        Cargando estadísticas en tiempo real...
                    </div>
                ) : chartData.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 text-sm space-y-2">
                        <BarChart3 className="w-8 h-8 opacity-40" />
                        <span>No hay datos de ventas para los filtros seleccionados</span>
                    </div>
                ) : isMounted ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                            <XAxis
                                dataKey="day"
                                stroke="#64748b"
                                fontSize={11}
                                tickLine={false}
                                tickFormatter={(val) => {
                                    if (!val) return '';
                                    const parts = String(val).split('-');
                                    return parts.length === 3 ? `${parts[2]}/${parts[1]}` : val;
                                }}
                            />
                            <YAxis
                                stroke="#64748b"
                                fontSize={11}
                                tickLine={false}
                                tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Area
                                type="monotone"
                                dataKey="sales"
                                stroke="#06b6d4"
                                strokeWidth={2.5}
                                fillOpacity={1}
                                fill="url(#salesGradient)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                ) : null}
            </div>
        </motion.div>
    );
}
