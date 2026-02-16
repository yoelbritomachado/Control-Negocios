import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle, ShoppingCart, Save, CheckCircle, Trash2 } from 'lucide-react';

export default function ConfirmModal({ 
    isOpen, 
    onClose, 
    onConfirm, 
    title, 
    message, 
    confirmText = 'Confirmar', 
    cancelText = 'Cancelar',
    type = 'warning',
    icon: Icon = AlertTriangle
}) {
    if (!isOpen) return null;

    const colors = {
        warning: 'from-amber-500/20 to-orange-500/20 border-amber-500/30 text-amber-400',
        danger: 'from-rose-500/20 to-red-500/20 border-rose-500/30 text-rose-400',
        info: 'from-cyan-500/20 to-blue-500/20 border-cyan-500/30 text-cyan-400',
        success: 'from-emerald-500/20 to-green-500/20 border-emerald-500/30 text-emerald-400'
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={onClose}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            className="glass-card w-full max-w-md overflow-hidden relative"
                            onClick={e => e.stopPropagation()}
                        >
                            <button
                                onClick={onClose}
                                className="absolute top-4 right-4 p-2 rounded-lg text-muted-foreground hover:text-white hover:bg-white/10 transition-all"
                            >
                                <X className="w-5 h-5" />
                            </button>

                            <div className="p-6 space-y-6">
                                <div className="flex items-center gap-4">
                                    <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${colors[type]} flex items-center justify-center border`}>
                                        <Icon className="w-7 h-7" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-white">{title}</h3>
                                    </div>
                                </div>

                                <div className="text-muted-foreground leading-relaxed">
                                    {message}
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <button
                                        onClick={onClose}
                                        className="flex-1 px-4 py-3 rounded-xl text-muted-foreground hover:text-white hover:bg-white/5 font-medium transition-all border border-white/10"
                                    >
                                        {cancelText}
                                    </button>
                                    <button
                                        onClick={() => { onConfirm(); onClose(); }}
                                        className={`flex-1 px-4 py-3 bg-gradient-to-r ${colors[type].split(' ')[0].replace('/20', '').replace('from-', 'from-').replace('to-', 'to-')} text-white rounded-xl font-semibold hover:shadow-lg transition-all`}
                                    >
                                        {confirmText}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
