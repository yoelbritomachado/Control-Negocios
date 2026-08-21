import { motion } from 'framer-motion';
import {
    Package,
    AlertTriangle,
    CheckCircle2,
    TrendingUp,
    Box,
    Layers,
    DollarSign
} from 'lucide-react';
import { cn } from '../lib/utils';

export function InventoryHealth({ health = {} }) {
    const totalCatalog = health.totalCatalog || 0;
    const totalUnits = health.totalUnits || 0;
    const valuation = health.inventoryValuation || 0;
    const outOfStock = health.outOfStock || 0;
    const lowStock = health.lowStock || 0;
    const optimalStock = health.optimalStock || 0;

    // Calcular score de salud (0 a 100)
    let healthScore = 100;
    if (totalCatalog > 0) {
        const outRatio = (outOfStock / totalCatalog) * 100;
        const lowRatio = (lowStock / totalCatalog) * 50;
        healthScore = Math.max(0, Math.min(100, Math.round(100 - outRatio - lowRatio)));
    }

    const getHealthStatus = (score) => {
        if (score >= 80) return { label: 'Óptimo', color: 'text-emerald-400', icon: CheckCircle2, bg: 'bg-emerald-500/10 border-emerald-500/30' };
        if (score >= 60) return { label: 'Bueno', color: 'text-cyan-400', icon: TrendingUp, bg: 'bg-cyan-500/10 border-cyan-500/30' };
        if (score >= 40) return { label: 'Atención', color: 'text-amber-400', icon: AlertTriangle, bg: 'bg-amber-500/10 border-amber-500/30' };
        return { label: 'Crítico', color: 'text-rose-400', icon: AlertTriangle, bg: 'bg-rose-500/10 border-rose-500/30' };
    };

    const status = getHealthStatus(healthScore);
    const StatusIcon = status.icon;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="glass-card rounded-2xl p-4 md:p-6 bg-slate-900/80 backdrop-blur-md border border-slate-800 shadow-xl"
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30">
                        <Package className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                        <h3 className="text-base md:text-lg font-bold text-white">Salud del Inventario</h3>
                        <p className="text-xs text-slate-400">
                            {totalUnits.toLocaleString('es-CU')} unidades físicas en stock
                        </p>
                    </div>
                </div>

                <div className={cn(
                    'flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold',
                    status.bg,
                    status.color
                )}>
                    <StatusIcon className="w-4 h-4" />
                    <span>{healthScore}% {status.label}</span>
                </div>
            </div>

            {/* Overall Progress */}
            <div className="mb-5">
                <div className="h-3 rounded-full bg-slate-800 overflow-hidden">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${healthScore}%` }}
                        transition={{ duration: 0.8 }}
                        className={cn(
                            'h-full rounded-full relative',
                            healthScore >= 80 && 'bg-gradient-to-r from-emerald-500 to-teal-400',
                            healthScore >= 60 && healthScore < 80 && 'bg-gradient-to-r from-cyan-500 to-blue-400',
                            healthScore >= 40 && healthScore < 60 && 'bg-gradient-to-r from-amber-500 to-orange-400',
                            healthScore < 40 && 'bg-gradient-to-r from-rose-500 to-red-400'
                        )}
                    />
                </div>
            </div>

            {/* Metrics List */}
            <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                    <span className="text-[11px] text-slate-400 block mb-0.5">Catálogo Activo</span>
                    <span className="text-sm font-bold text-white">{totalCatalog} productos</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                    <span className="text-[11px] text-slate-400 block mb-0.5">Valorización PV</span>
                    <span className="text-sm font-bold text-cyan-400">${Number(valuation).toLocaleString('es-CU')}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                    <span className="text-[11px] text-slate-400 block mb-0.5">Stock Crítico (≤3)</span>
                    <span className="text-sm font-bold text-amber-400">{lowStock} productos</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                    <span className="text-[11px] text-slate-400 block mb-0.5">Agotados (0)</span>
                    <span className="text-sm font-bold text-rose-400">{outOfStock} productos</span>
                </div>
            </div>
        </motion.div>
    );
}
