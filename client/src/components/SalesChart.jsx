import { useState, useMemo, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
} from 'recharts';
import { TrendingUp, Download, Filter } from 'lucide-react';
import { cn } from '../lib/utils';

// Generate data once - outside component to prevent regeneration on every render
const generateSalesData = () => {
    const data = [];
    for (let i = 1; i <= 30; i++) {
        const baseValue = 5000 + Math.random() * 3000;
        const weekendFactor = (i % 7 === 0 || i % 7 === 6) ? 0.7 : 1;
        data.push({
            day: i,
            sales: Math.round(baseValue * weekendFactor),
            isToday: i === 30,
        });
    }
    return data;
};

const salesData = generateSalesData();

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        // Simplified tooltip without heavy animations to reduce GPU usage
        return (
            <div className="bg-popover/95 backdrop-blur-xl border border-border/50 rounded-xl p-4 shadow-xl bg-gray-900 border-gray-700 text-white animate-in fade-in duration-150">
                <p className="text-sm font-medium text-gray-400 mb-1">
                    Día {label}
                </p>
                <p className="text-lg font-bold text-cyan-400">
                    ${payload[0].value.toLocaleString('es-CU')}
                </p>
            </div>
        );
    }
    return null;
};

export function SalesChart() {
    const [selectedMonth, setSelectedMonth] = useState('current');
    const [hoveredBar, setHoveredBar] = useState(null);
    const [isMounted, setIsMounted] = useState(false);
    
    // Delay chart render to avoid dimension errors
    useEffect(() => {
        const timer = setTimeout(() => setIsMounted(true), 100);
        return () => clearTimeout(timer);
    }, []);

    // Memoize calculations to prevent recalculation on every render
    const { totalSales, avgSales, maxSales } = useMemo(() => {
        const total = salesData.reduce((acc, curr) => acc + curr.sales, 0);
        return {
            totalSales: total,
            avgSales: total / salesData.length,
            maxSales: Math.max(...salesData.map(d => d.sales))
        };
    }, []);

    // Memoized mouse handlers to prevent unnecessary re-renders
    const handleMouseMove = useCallback((state) => {
        if (state.isTooltipActive && state.activeTooltipIndex !== undefined) {
            setHoveredBar(state.activeTooltipIndex);
        } else {
            setHoveredBar(null);
        }
    }, []);

    const handleMouseLeave = useCallback(() => {
        setHoveredBar(null);
    }, []);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3, ease: [0.23, 1, 0.32, 1] }}
            className="glass-card rounded-2xl p-6 bg-secondary/30 backdrop-blur-md border border-white/5"
        >
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/10 border border-cyan-500/30">
                        <TrendingUp className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold">Evolución de Ventas</h3>
                        <p className="text-sm text-muted-foreground">
                            Ventas diarias - Septiembre 2025
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Month Selector */}
                    <div className="flex bg-secondary/50 rounded-lg p-1">
                        {[
                            { id: 'current', label: 'Mes Actual' },
                            { id: 'history', label: 'Histórico' },
                        ].map((month) => (
                            <button
                                key={month.id}
                                onClick={() => setSelectedMonth(month.id)}
                                className={cn(
                                    'px-4 py-2 rounded-md text-sm font-medium transition-all duration-300',
                                    selectedMonth === month.id
                                        ? 'bg-primary text-primary-foreground shadow-sm bg-cyan-600/20 text-cyan-400'
                                        : 'text-muted-foreground hover:text-foreground'
                                )}
                            >
                                {month.label}
                            </button>
                        ))}
                    </div>

                    <button className="p-2 rounded-lg hover:bg-secondary transition-colors">
                        <Filter className="w-4 h-4 text-muted-foreground" />
                    </button>

                    <button className="p-2 rounded-lg hover:bg-secondary transition-colors">
                        <Download className="w-4 h-4 text-muted-foreground" />
                    </button>
                </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="p-4 rounded-xl bg-secondary/30">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                        Total del Mes
                    </p>
                    <p className="text-xl font-bold text-cyan-400">
                        ${totalSales.toLocaleString('es-CU')}
                    </p>
                </div>
                <div className="p-4 rounded-xl bg-secondary/30">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                        Promedio Diario
                    </p>
                    <p className="text-xl font-bold text-emerald-400">
                        ${Math.round(avgSales).toLocaleString('es-CU')}
                    </p>
                </div>
                <div className="p-4 rounded-xl bg-secondary/30">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                        Mejor Día
                    </p>
                    <p className="text-xl font-bold text-violet-400">
                        ${maxSales.toLocaleString('es-CU')}
                    </p>
                </div>
            </div>

            {/* Chart */}
            <div className="h-80 min-h-[300px] relative">
                {!isMounted ? (
                    <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                        <div className="animate-pulse">Cargando gráfico...</div>
                    </div>
                ) : (
                <ResponsiveContainer width="100%" height="100%" minWidth={300} minHeight={300}>
                    <BarChart
                        data={salesData}
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                        onMouseMove={handleMouseMove}
                        onMouseLeave={handleMouseLeave}
                    >
                        <defs>
                            <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.8} />
                                <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.3} />
                            </linearGradient>
                            <linearGradient id="barGradientToday" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#8b5cf6" stopOpacity={1} />
                                <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.5} />
                            </linearGradient>
                            <linearGradient id="barGradientHover" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#22d3ee" stopOpacity={1} />
                                <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.5} />
                            </linearGradient>
                        </defs>

                        <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="rgba(255,255,255,0.05)"
                            vertical={false}
                        />

                        <XAxis
                            dataKey="day"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                            interval={2}
                        />

                        <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                            tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`}
                        />

                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />

                        <Bar
                            dataKey="sales"
                            radius={[4, 4, 0, 0]}
                            maxBarSize={40}
                        >
                            {salesData.map((entry, index) => {
                                const isHovered = hoveredBar === index;
                                const fill = entry.isToday
                                    ? 'url(#barGradientToday)'
                                    : isHovered
                                        ? 'url(#barGradientHover)'
                                        : 'url(#barGradient)';
                                
                                return (
                                    <Cell
                                        key={`sales-cell-${entry.day}-${index}`}
                                        fill={fill}
                                        style={{
                                            // Simplified hover effect - CSS transition only, no drop-shadow for GPU performance
                                            opacity: isHovered ? 1 : 0.9,
                                            transition: 'opacity 0.15s ease',
                                        }}
                                    />
                                );
                            })}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
                )}
            </div>
        </motion.div>
    );
}
