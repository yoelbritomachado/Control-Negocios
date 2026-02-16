import React, { useState, useEffect, useRef } from 'react';
import { Calculator, Banknote, CreditCard, CheckCircle2, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';

export default function PaymentModal({ total, onClose, onConfirm }) {
    const [amountGiven, setAmountGiven] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('cash'); // 'cash', 'transfer'
    const [change, setChange] = useState(0);
    const inputRef = useRef(null);

    useEffect(() => {
        if (inputRef.current) inputRef.current.focus();
    }, []);

    useEffect(() => {
        const given = parseFloat(amountGiven) || 0;
        setChange(given - total);
    }, [amountGiven, total]);

    const handleConfirm = (e) => {
        e.preventDefault();
        if (paymentMethod === 'cash' && (parseFloat(amountGiven) < total)) {
            return; // Don't allow if insufficient funds
        }
        onConfirm({
            method: paymentMethod,
            amountReceived: parseFloat(amountGiven) || total,
            change: change > 0 ? change : 0
        });
    };

    const suggestedAmounts = [
        Math.ceil(total),
        Math.ceil(total / 50) * 50,
        Math.ceil(total / 100) * 100,
        500,
        1000
    ].filter((val, index, self) => val >= total && self.indexOf(val) === index).slice(0, 4);

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="glass-card w-full max-w-lg border border-white/10 shadow-2xl overflow-hidden bg-[#1A1D21]"
            >
                {/* Header */}
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
                    <h2 className="text-xl font-bold flex items-center gap-3 text-foreground">
                        <Calculator className="text-emerald-400 w-6 h-6" /> Cobrar Venta
                    </h2>
                    <button onClick={onClose} className="text-muted-foreground hover:text-white transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-8 space-y-8">
                    {/* Total Display */}
                    <div className="text-center space-y-2">
                        <p className="text-muted-foreground text-xs uppercase tracking-widest font-bold">Total a Pagar</p>
                        <div className="text-6xl font-black gradient-text-cyan">
                            ${total.toFixed(2)}
                        </div>
                    </div>

                    {/* Payment Method Toggle */}
                    <div className="grid grid-cols-2 gap-3 p-1 bg-secondary/50 rounded-xl border border-white/5">
                        <button
                            type="button"
                            onClick={() => setPaymentMethod('cash')}
                            className={cn(
                                "flex items-center justify-center gap-2 py-3 rounded-lg font-bold transition-all",
                                paymentMethod === 'cash' ? "bg-primary/20 text-primary shadow-sm border border-primary/20" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <Banknote className="w-5 h-5" /> Efectivo
                        </button>
                        <button
                            type="button"
                            onClick={() => { setPaymentMethod('transfer'); setAmountGiven(total.toString()); }}
                            className={cn(
                                "flex items-center justify-center gap-2 py-3 rounded-lg font-bold transition-all",
                                paymentMethod === 'transfer' ? "bg-blue-500/20 text-blue-400 shadow-sm border border-blue-500/20" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <CreditCard className="w-5 h-5" /> Transferencia
                        </button>
                    </div>

                    {/* Inputs */}
                    <form onSubmit={handleConfirm} className="space-y-6">

                        {paymentMethod === 'cash' && (
                            <div className="space-y-4">
                                <div className="relative group">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-xl font-bold group-focus-within:text-white transition-colors">$</span>
                                    <input
                                        ref={inputRef}
                                        type="number"
                                        step="0.50"
                                        placeholder="Monto Recibido"
                                        value={amountGiven}
                                        onChange={(e) => setAmountGiven(e.target.value)}
                                        className="w-full bg-secondary/30 border border-white/10 rounded-xl py-4 pl-10 pr-4 text-3xl font-bold text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all placeholder-muted-foreground"
                                        autoFocus
                                    />
                                </div>

                                {/* Quick Cash Buttons */}
                                <div className="flex gap-2 justify-center">
                                    {suggestedAmounts.map(amt => (
                                        <button
                                            key={amt}
                                            type="button"
                                            onClick={() => setAmountGiven(amt.toString())}
                                            className="px-4 py-2 bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-white rounded-lg text-sm font-mono border border-white/5 transition-colors"
                                        >
                                            ${amt}
                                        </button>
                                    ))}
                                </div>

                                {/* Change Display */}
                                <div className={cn(
                                    "flex justify-between items-center p-4 rounded-xl border transition-colors",
                                    change >= 0 ? "bg-emerald-500/10 border-emerald-500/20" : "bg-red-500/10 border-red-500/20"
                                )}>
                                    <span className="text-muted-foreground font-bold uppercase text-xs">Cambio:</span>
                                    <span className={cn(
                                        "text-2xl font-bold font-mono",
                                        change >= 0 ? "text-emerald-400" : "text-red-400"
                                    )}>
                                        ${change.toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={paymentMethod === 'cash' && change < 0}
                            className="w-full btn-primary-glow text-white font-bold py-4 rounded-xl text-lg shadow-lg transform transition-all active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                        >
                            <CheckCircle2 className="w-6 h-6" /> CONFIRMAR PAGO
                        </button>
                    </form>
                </div>
            </motion.div>
        </div>
    );
}
