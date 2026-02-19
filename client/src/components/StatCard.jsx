import { useEffect, useState, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '../lib/utils';

const variantStyles = {
    success: {
        gradient: 'from-emerald-500/20 to-teal-500/10',
        border: 'border-emerald-500/30',
        iconBg: 'bg-emerald-500/20',
        iconColor: 'text-emerald-400',
        glow: 'shadow-emerald-500/20',
    },
    danger: {
        gradient: 'from-rose-500/20 to-red-500/10',
        border: 'border-rose-500/30',
        iconBg: 'bg-rose-500/20',
        iconColor: 'text-rose-400',
        glow: 'shadow-rose-500/20',
    },
    info: {
        gradient: 'from-cyan-500/20 to-blue-500/10',
        border: 'border-cyan-500/30',
        iconBg: 'bg-cyan-500/20',
        iconColor: 'text-cyan-400',
        glow: 'shadow-cyan-500/20',
    },
    warning: {
        gradient: 'from-amber-500/20 to-orange-500/10',
        border: 'border-amber-500/30',
        iconBg: 'bg-amber-500/20',
        iconColor: 'text-amber-400',
        glow: 'shadow-amber-500/20',
    },
    purple: {
        gradient: 'from-violet-500/20 to-purple-500/10',
        border: 'border-violet-500/30',
        iconBg: 'bg-violet-500/20',
        iconColor: 'text-violet-400',
        glow: 'shadow-violet-500/20',
    },
};

function AnimatedNumber({
    value,
    prefix = '',
    suffix = '',
    decimals = 0,
    isCurrency = false
}) {
    const [displayValue, setDisplayValue] = useState(0);
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true });

    useEffect(() => {
        if (!isInView) return;

        const duration = 1500;
        const steps = 60;
        const increment = value / steps;
        let current = 0;

        const timer = setInterval(() => {
            current += increment;
            if (current >= value) {
                setDisplayValue(value);
                clearInterval(timer);
            } else {
                setDisplayValue(current);
            }
        }, duration / steps);

        return () => clearInterval(timer);
    }, [value, isInView]);

    const formatNumber = (num) => {
        if (isCurrency) {
            return new Intl.NumberFormat('es-CU', {
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals,
            }).format(num);
        }
        return num.toFixed(decimals);
    };

    return (
        <span ref={ref} className="tabular-nums">
            {prefix}{formatNumber(displayValue)}{suffix}
        </span>
    );
}

export function StatCard({
    title,
    value,
    prefix = '',
    suffix = '',
    decimals = 0,
    trend,
    trendLabel,
    icon: Icon,
    variant = 'info',
    delay = 0,
    isCurrency = false,
}) {
    const styles = variantStyles[variant];

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
                duration: 0.5,
                delay: delay,
                ease: [0.23, 1, 0.32, 1]
            }}
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
            className={cn(
                'relative overflow-hidden rounded-xl md:rounded-2xl p-3 md:p-4 lg:p-6',
                'bg-gradient-to-br',
                styles.gradient,
                'border',
                styles.border,
                'transition-all duration-300',
                'hover:shadow-lg',
                styles.glow
            )}
        >
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-30">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-white/10 to-transparent rounded-full blur-2xl transform translate-x-16 -translate-y-16" />
            </div>

            {/* Content */}
            <div className="relative z-10">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                    <div className={cn(
                        'p-2 md:p-2.5 lg:p-3 rounded-lg md:rounded-xl',
                        styles.iconBg
                    )}>
                        <Icon className={cn('w-4 h-4 md:w-5 md:h-5', styles.iconColor)} />
                    </div>

                    {trend !== undefined && (
                        <div className={cn(
                            'flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
                            trend > 0
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : trend < 0
                                    ? 'bg-rose-500/20 text-rose-400'
                                    : 'bg-gray-500/20 text-gray-400'
                        )}>
                            {trend > 0 ? (
                                <TrendingUp className="w-3 h-3" />
                            ) : trend < 0 ? (
                                <TrendingDown className="w-3 h-3" />
                            ) : (
                                <Minus className="w-3 h-3" />
                            )}
                            <span>{Math.abs(trend)}%</span>
                        </div>
                    )}
                </div>

                {/* Title */}
                <p className="text-[10px] md:text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 md:mb-2 truncate">
                    {title}
                </p>

                {/* Value */}
                <h3 className={cn(
                    'text-lg md:text-2xl lg:text-3xl font-bold tracking-tight mb-0.5 md:mb-1',
                    variant === 'success' && 'text-emerald-400',
                    variant === 'danger' && 'text-rose-400',
                    variant === 'info' && 'text-cyan-400',
                    variant === 'warning' && 'text-amber-400',
                    variant === 'purple' && 'text-violet-400',
                )}>
                    <AnimatedNumber
                        value={value}
                        prefix={prefix}
                        suffix={suffix}
                        decimals={decimals}
                        isCurrency={isCurrency}
                    />
                </h3>

                {/* Trend Label */}
                {trendLabel && (
                    <p className="text-[10px] md:text-xs text-muted-foreground mt-1 md:mt-2 truncate">
                        {trendLabel}
                    </p>
                )}
            </div>

            {/* Bottom Glow */}
            <div className={cn(
                'absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-current to-transparent opacity-50',
                styles.iconColor
            )} />
        </motion.div>
    );
}
