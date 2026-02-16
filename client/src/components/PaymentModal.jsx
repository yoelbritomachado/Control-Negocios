import React, { useState, useEffect, useRef } from 'react';
import { Calculator, Banknote, CreditCard, CheckCircle2, X, Loader2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';

export default function PaymentModal({ total, onClose, onConfirm }) {
    const [cashAmount, setCashAmount] = useState('');
    const [transferAmount, setTransferAmount] = useState('');
    const [activeInput, setActiveInput] = useState('cash'); // 'cash', 'transfer', 'both'
    const inputRef = useRef(null);

    const totalCash = parseFloat(cashAmount) || 0;
    const totalTransfer = parseFloat(transferAmount) || 0;
    const totalReceived = totalCash + totalTransfer;
    const remaining = total - totalReceived;
    const change = totalReceived > total ? totalReceived - total : 0;

    useEffect(() => {
        if (inputRef.current) inputRef.current.focus();
    }, [activeInput]);

    const handleConfirm = (e) => {
        e.preventDefault();
        if (totalReceived < total) {
            alert('El monto recibido es menor al total a pagar');
            return;
        }
        
        let method = 'cash';
        if (totalCash > 0 && totalTransfer > 0) {
            method = 'mixed';
        } else if (totalTransfer > 0) {
            method = 'transfer';
        }

        onConfirm({
            method,
            cashAmount: totalCash,
            transferAmount: totalTransfer,
            amountReceived: totalReceived,
            change: change
        });
    };

    const setFullAmount = (type) => {
        if (type === 'cash') {
            setCashAmount(total.toFixed(2));
            setTransferAmount('');
        } else {
            setTransferAmount(total.toFixed(2));
            setCashAmount('');
        }
    };

    const clearAll = () => {
        setCashAmount('');
        setTransferAmount('');
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-md">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="glass-card w-full max-w-md border border-white/10 shadow-2xl overflow-hidden bg-[#0f1115]"
            >
                {/* Header */}
                <div className="p-5 border-b border-white/5 flex justify-between items-center bg-gradient-to-r from-cyan-500/10 to-blue-500/10">
                    <h2 className="text-xl font-bold flex items-center gap-3 text-foreground">
                        <Calculator className="text-cyan-400 w-6 h-6" /> Cobrar Venta
                    </h2>
                    <button onClick={onClose} className="text-muted-foreground hover:text-white transition-colors p-1 hover:bg-white/10 rounded-lg">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Total a Pagar */}
                    <div className="text-center space-y-1 p-4 rounded-xl bg-white/5 border border-white/10">
                        <p className="text-muted-foreground text-xs uppercase tracking-widest font-semibold">Total a Pagar</p>
                        <div className="text-5xl font-black text-cyan-400">
                            ${total.toFixed(2)}
                        </div>
                    </div>

                    {/* Alerta si falta dinero */}
                    {remaining > 0 && (
                        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-rose-400" />
                            <span className="text-rose-400 text-sm">Faltan ${remaining.toFixed(2)}</span>
                        </div>
                    )}

                    {/* Alerta si sobra dinero */}
                    {change > 0 && (
                        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            <span className="text-emerald-400 text-sm">Cambio: ${change.toFixed(2)}</span>
                        </div>
                    )}

                    {/* Formulario de pago */}
                    <form onSubmit={handleConfirm} className="space-y-4">
                        {/* Efectivo */}
                        <div className={cn(
                            "p-4 rounded-xl border transition-all",
                            totalCash > 0 ? "bg-emerald-500/5 border-emerald-500/30" : "bg-white/5 border-white/10"
                        )}>
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                                        <Banknote className="w-5 h-5 text-emerald-400" />
                                    </div>
                                    <span className="font-semibold">Efectivo</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setFullAmount('cash')}
                                    className="text-xs text-cyan-400 hover:text-cyan-300 font-medium"
                                >
                                    Todo en efectivo
                                </button>
                            </div>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-lg font-bold">$</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={cashAmount}
                                    onChange={(e) => setCashAmount(e.target.value)}
                                    className="w-full bg-secondary/30 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-xl font-bold text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
                                />
                            </div>
                        </div>

                        {/* Transferencia */}
                        <div className={cn(
                            "p-4 rounded-xl border transition-all",
                            totalTransfer > 0 ? "bg-blue-500/5 border-blue-500/30" : "bg-white/5 border-white/10"
                        )}>
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                                        <CreditCard className="w-5 h-5 text-blue-400" />
                                    </div>
                                    <span className="font-semibold">Transferencia</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setFullAmount('transfer')}
                                    className="text-xs text-cyan-400 hover:text-cyan-300 font-medium"
                                >
                                    Todo en transferencia
                                </button>
                            </div>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-lg font-bold">$</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={transferAmount}
                                    onChange={(e) => setTransferAmount(e.target.value)}
                                    className="w-full bg-secondary/30 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-xl font-bold text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                                />
                            </div>
                        </div>

                        {/* Resumen */}
                        <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Recibido:</span>
                                <span className="font-mono font-bold">${totalReceived.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Total:</span>
                                <span className="font-mono font-bold text-cyan-400">${total.toFixed(2)}</span>
                            </div>
                            {change > 0 && (
                                <div className="flex justify-between text-sm pt-2 border-t border-white/10">
                                    <span className="text-emerald-400">Cambio:</span>
                                    <span className="font-mono font-bold text-emerald-400">${change.toFixed(2)}</span>
                                </div>
                            )}
                        </div>

                        {/* Botones de acción */}
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={clearAll}
                                className="flex-1 py-3 rounded-xl bg-secondary/50 text-muted-foreground font-semibold hover:bg-secondary hover:text-white transition-all"
                            >
                                Limpiar
                            </button>
                            <button
                                type="submit"
                                disabled={totalReceived < total}
                                className={cn(
                                    "flex-[2] py-3 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all",
                                    totalReceived >= total
                                        ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40"
                                        : "bg-secondary/50 text-muted-foreground cursor-not-allowed"
                                )}
                            >
                                <CheckCircle2 className="w-5 h-5" />
                                CONFIRMAR
                            </button>
                        </div>
                    </form>
                </div>
            </motion.div>
        </div>
    );
}
