import { motion } from 'framer-motion';
import {
    Package,
    AlertTriangle,
    CheckCircle2,
    TrendingUp,
    Box
} from 'lucide-react';
import { cn } from '../lib/utils';

const inventoryMetrics = [
    { label: 'Operatividad', value: 85, total: 100, color: '#10b981' },
    { label: 'Reservas', value: 45, total: 100, color: '#8b5cf6' },
];

export function InventoryHealth() {
    const overallHealth = Math.round(
        inventoryMetrics.reduce((acc, m) => acc + (m.value / m.total) * 50, 0)
    );

    const getHealthStatus = (health) => {
        if (health >= 80) return { label: 'Óptimo', color: 'text-emerald-400', icon: CheckCircle2 };
        if (health >= 60) return { label: 'Bueno', color: 'text-cyan-400', icon: TrendingUp };
        if (health >= 40) return { label: 'Regular', color: 'text-amber-400', icon: AlertTriangle };
        return { label: 'Crítico', color: 'text-rose-400', icon: AlertTriangle };
    };

    const status = getHealthStatus(overallHealth);
    const StatusIcon = status.icon;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5, ease: [0.23, 1, 0.32, 1] }}
            className="glass-card rounded-xl md:rounded-2xl p-4 md:p-6 bg-secondary/30 backdrop-blur-md border border-white/5"
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-4 md:mb-6">
                <div className="flex items-center gap-2 md:gap-3">
                    <div className="p-2 md:p-3 rounded-lg md:rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30">
                        <Package className="w-4 h-4 md:w-5 md:h-5 text-emerald-400" />
                    </div>
                    <div>
                        <h3 className="text-base md:text-lg font-semibold">Salud del Inventario</h3>
                        <p className="text-xs md:text-sm text-muted-foreground">
                            Estado actual del stock
                        </p>
                    </div>
                </div>

                <div className={cn(
                    'flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-1 md:py-1.5 rounded-full',
                    'bg-secondary/50'
                )}>
                    <StatusIcon className={cn('w-4 h-4', status.color)} />
                    <span className={cn('text-sm font-medium', status.color)}>
                        {overallHealth}% {status.label}
                    </span>
                </div>
            </div>

            {/* Overall Progress */}
            <div className="mb-6">
                <div className="h-4 rounded-full bg-secondary overflow-hidden">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${overallHealth}%` }}
                        transition={{ duration: 1, delay: 0.6, ease: [0.23, 1, 0.32, 1] }}
                        className={cn(
                            'h-full rounded-full relative',
                            overallHealth >= 80 && 'bg-gradient-to-r from-emerald-500 to-teal-500',
                            overallHealth >= 60 && overallHealth < 80 && 'bg-gradient-to-r from-cyan-500 to-blue-500',
                            overallHealth >= 40 && overallHealth < 60 && 'bg-gradient-to-r from-amber-500 to-orange-500',
                            overallHealth < 40 && 'bg-gradient-to-r from-rose-500 to-red-500'
                        )}
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                    </motion.div>
                </div>
            </div>

            {/* Metrics */}
            <div className="space-y-4">
                {inventoryMetrics.map((metric, index) => (
                    <motion.div
                        key={metric.label}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.4, delay: 0.7 + index * 0.1 }}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <Box className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm font-medium">{metric.label}</span>
                            </div>
                            <span
                                className="text-sm font-bold"
                                style={{ color: metric.color }}
                            >
                                {metric.value}%
                            </span>
                        </div>

                        <div className="h-2 rounded-full bg-secondary overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${metric.value}%` }}
                                transition={{ duration: 0.8, delay: 0.8 + index * 0.1, ease: [0.23, 1, 0.32, 1] }}
                                className="h-full rounded-full relative"
                                style={{ backgroundColor: metric.color }}
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                            </motion.div>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Quick Stats */}
            <div className="mt-4 md:mt-6 pt-3 md:pt-4 border-t border-border/50 grid grid-cols-2 gap-2 md:gap-4">
                <div className="p-2 md:p-3 rounded-lg md:rounded-xl bg-secondary/30">
                    <p className="text-[10px] md:text-xs text-muted-foreground mb-0.5 md:mb-1">Productos</p>
                    <p className="text-base md:text-lg font-bold text-cyan-400">247</p>
                </div>
                <div className="p-2 md:p-3 rounded-lg md:rounded-xl bg-secondary/30">
                    <p className="text-[10px] md:text-xs text-muted-foreground mb-0.5 md:mb-1">Alertas</p>
                    <p className="text-base md:text-lg font-bold text-amber-400">3</p>
                </div>
            </div>
        </motion.div>
    );
}
