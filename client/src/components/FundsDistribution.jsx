import { useState } from 'react';
import { motion } from 'framer-motion';
import {
    Wallet,
    Building2,
    Download,
    PieChart,
    ArrowUpRight
} from 'lucide-react';
import { cn } from '../lib/utils';

const fundSources = [
    {
        name: 'Efectivo Caja',
        amount: 100000,
        percentage: 100,
        color: '#06b6d4',
        icon: Wallet
    },
    {
        name: 'Transferencias',
        amount: 0,
        percentage: 0,
        color: '#8b5cf6',
        icon: Building2
    },
];

export function FundsDistribution() {
    const [isHovered, setIsHovered] = useState(false);

    const totalFunds = fundSources.reduce((acc, curr) => acc + curr.amount, 0);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4, ease: [0.23, 1, 0.32, 1] }}
            className="glass-card rounded-xl md:rounded-2xl p-4 md:p-6 bg-secondary/30 backdrop-blur-md border border-white/5"
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-4 md:mb-6">
                <div className="flex items-center gap-2 md:gap-3">
                    <div className="p-2 md:p-3 rounded-lg md:rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/10 border border-violet-500/30">
                        <PieChart className="w-4 h-4 md:w-5 md:h-5 text-violet-400" />
                    </div>
                    <div>
                        <h3 className="text-base md:text-lg font-semibold">Distribución de Fondos</h3>
                        <p className="text-xs md:text-sm text-muted-foreground">
                            {fundSources[0].percentage}% CUP
                        </p>
                    </div>
                </div>

                <button className="p-2 rounded-lg hover:bg-secondary transition-colors">
                    <Download className="w-4 h-4 text-muted-foreground" />
                </button>
            </div>

            {/* Progress Bar */}
            <div className="mb-6">
                <div className="h-3 rounded-full bg-secondary overflow-hidden">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: '100%' }}
                        transition={{ duration: 1, delay: 0.5, ease: [0.23, 1, 0.32, 1] }}
                        className="h-full rounded-full relative"
                        style={{
                            background: `linear-gradient(90deg, ${fundSources[0].color} 0%, ${fundSources[0].color} ${fundSources[0].percentage}%, ${fundSources[1].color} ${fundSources[0].percentage}%, ${fundSources[1].color} 100%)`
                        }}
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                    </motion.div>
                </div>

                {/* Legend */}
                <div className="flex items-center justify-between mt-3">
                    {fundSources.map((source) => (
                        <div key={source.name} className="flex items-center gap-2">
                            <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: source.color }}
                            />
                            <span className="text-xs text-muted-foreground">{source.name}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Fund Cards */}
            <div className="space-y-3">
                {fundSources.map((source, index) => (
                    <motion.div
                        key={source.name}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.4, delay: 0.5 + index * 0.1 }}
                        onMouseEnter={() => setIsHovered(true)}
                        onMouseLeave={() => setIsHovered(false)}
                        className={cn(
                            'flex items-center justify-between p-3 md:p-4 rounded-lg md:rounded-xl',
                            'bg-secondary/30 hover:bg-secondary/50',
                            'transition-all duration-300',
                            'group cursor-pointer'
                        )}
                    >
                        <div className="flex items-center gap-3">
                            <div
                                className="p-2 rounded-lg"
                                style={{ backgroundColor: `${source.color}20` }}
                            >
                                <source.icon
                                    className="w-4 h-4"
                                    style={{ color: source.color }}
                                />
                            </div>
                            <div>
                                <p className="text-sm font-medium">{source.name}</p>
                                <p className="text-xs text-muted-foreground">
                                    {source.percentage}% del total
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <p
                                className="text-lg font-bold"
                                style={{ color: source.color }}
                            >
                                ${source.amount.toLocaleString('es-CU')}
                            </p>
                            <ArrowUpRight
                                className={cn(
                                    'w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity',
                                    isHovered && 'text-' + source.color.replace('#', '')
                                )}
                                // Note: simplified color logic for icon hover as tailwind expects classes
                                style={{ color: isHovered ? source.color : undefined }}
                            />
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Total */}
            <div className="mt-4 pt-4 border-t border-border/50">
                <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Total Estimado General</p>
                    <p className="text-2xl font-bold gradient-text">
                        ${totalFunds.toLocaleString('es-CU')}
                    </p>
                </div>
                <div className="flex items-center gap-2 mt-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <p className="text-xs text-emerald-400">
                        Calculado según fondos actuales
                    </p>
                </div>
            </div>
        </motion.div>
    );
}
