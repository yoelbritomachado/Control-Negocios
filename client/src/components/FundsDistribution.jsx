import { motion } from 'framer-motion';
import {
    Wallet,
    Building2,
    PieChart,
    ArrowUpRight
} from 'lucide-react';
import { cn } from '../lib/utils';

export function FundsDistribution({ cash = 0, transfer = 0 }) {
    const totalFunds = cash + transfer;
    const cashPercent = totalFunds > 0 ? Math.round((cash / totalFunds) * 100) : 100;
    const transferPercent = totalFunds > 0 ? 100 - cashPercent : 0;

    const fundSources = [
        {
            name: 'Efectivo en Mano (Caja)',
            amount: cash,
            percentage: cashPercent,
            color: '#06b6d4',
            icon: Wallet
        },
        {
            name: 'Cobros por Transferencia',
            amount: transfer,
            percentage: transferPercent,
            color: '#8b5cf6',
            icon: Building2
        },
    ];

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="glass-card rounded-2xl p-4 md:p-6 bg-slate-900/80 backdrop-blur-md border border-slate-800 shadow-xl"
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/10 border border-violet-500/30">
                        <PieChart className="w-5 h-5 text-violet-400" />
                    </div>
                    <div>
                        <h3 className="text-base md:text-lg font-bold text-white">Flujo por Método de Pago</h3>
                        <p className="text-xs text-slate-400">
                            {cashPercent}% Efectivo | {transferPercent}% Transferencias
                        </p>
                    </div>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-5">
                <div className="h-3 rounded-full bg-slate-800 overflow-hidden">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: '100%' }}
                        transition={{ duration: 0.8 }}
                        className="h-full rounded-full relative"
                        style={{
                            background: `linear-gradient(90deg, #06b6d4 0%, #06b6d4 ${cashPercent}%, #8b5cf6 ${cashPercent}%, #8b5cf6 100%)`
                        }}
                    />
                </div>
            </div>

            {/* Fund Cards */}
            <div className="space-y-3">
                {fundSources.map((source, index) => {
                    const Icon = source.icon;
                    return (
                        <div
                            key={source.name}
                            className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between transition-colors hover:border-slate-700"
                        >
                            <div className="flex items-center gap-3">
                                <div
                                    className="p-2 rounded-lg"
                                    style={{ backgroundColor: `${source.color}20`, color: source.color }}
                                >
                                    <Icon className="w-4 h-4" />
                                </div>
                                <div>
                                    <h4 className="text-xs font-semibold text-white">{source.name}</h4>
                                    <p className="text-[11px] text-slate-400">{source.percentage}% del total recaudado</p>
                                </div>
                            </div>

                            <div className="text-right">
                                <div className="text-sm font-bold text-white">
                                    ${Number(source.amount || 0).toLocaleString('es-CU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                                <span className="text-[10px] text-slate-400">CUP</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </motion.div>
    );
}
