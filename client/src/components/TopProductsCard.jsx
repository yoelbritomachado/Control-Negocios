import { motion } from 'framer-motion';
import { Award, PackageCheck, TrendingUp } from 'lucide-react';

export function TopProductsCard({ products = [] }) {
    const list = Array.isArray(products) ? products : [];
    const maxRevenue = list.length > 0 ? Math.max(...list.map(p => p.revenue || 0), 1) : 1;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.35 }}
            className="glass-card rounded-2xl p-4 md:p-6 bg-slate-900/80 backdrop-blur-md border border-slate-800 shadow-xl"
        >
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/30">
                        <Award className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                        <h3 className="text-base md:text-lg font-bold text-white">Top 5 Productos Más Vendidos</h3>
                        <p className="text-xs text-slate-400">Por volumen de recaudación en el período</p>
                    </div>
                </div>
            </div>

            {list.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                    No hay ventas registradas para generar el ranking de productos.
                </div>
            ) : (
                <div className="space-y-3.5">
                    {list.map((product, idx) => {
                        const percent = Math.min(100, Math.round(((product.revenue || 0) / maxRevenue) * 100));
                        return (
                            <div key={product.id || idx} className="space-y-1.5">
                                <div className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2 truncate max-w-[70%]">
                                        <span className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-bold text-amber-400 shrink-0">
                                            #{idx + 1}
                                        </span>
                                        <span className="font-semibold text-white truncate">{product.name}</span>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <span className="font-bold text-cyan-400">
                                            ${Number(product.revenue || 0).toLocaleString('es-CU')} CUP
                                        </span>
                                        <span className="text-[10px] text-slate-400 ml-1.5">
                                            ({product.qty_sold} u.)
                                        </span>
                                    </div>
                                </div>
                                <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${percent}%` }}
                                        transition={{ duration: 0.6, delay: 0.1 * idx }}
                                        className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500"
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </motion.div>
    );
}
