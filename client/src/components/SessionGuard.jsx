import React, { useState, useEffect } from 'react';
import api from '../api';
import { Clock, Banknote, Loader2, Lock } from 'lucide-react';
import { motion } from 'framer-motion';

export default function SessionGuard({ children }) {
    const [status, setStatus] = useState(null); // null = loading, false = closed, true = open
    const [loading, setLoading] = useState(true);
    const [initialCash, setInitialCash] = useState('');
    const [processing, setProcessing] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        checkSession();
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const checkSession = async () => {
        try {
            const res = await api.get('/sessions/status');
            setStatus(res.data.isOpen);
        } catch (e) {
            console.error("Session check failed", e);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenSession = async (e) => {
        e.preventDefault();
        setProcessing(true);
        try {
            await api.post('/sessions/open', { initial_cash: parseFloat(initialCash) || 0 });
            await checkSession(); // Refresh status
        } catch (e) {
            alert(e.response?.data?.error || "Error al abrir sesión");
        } finally {
            setProcessing(false);
        }
    };

    if (loading) return (
        <div className="h-screen w-full flex items-center justify-center bg-background text-foreground">
            <Loader2 className="animate-spin w-10 h-10 text-primary" />
        </div>
    );

    if (status) return children;

    return (
        <div className="h-screen w-full flex flex-col items-center justify-center bg-background relative overflow-hidden">
            {/* Animated Background Elements */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-background to-background pointer-events-none" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 blur-[120px] rounded-full pointer-events-none animate-pulse" />

            <div className="z-10 text-center space-y-8 max-w-md w-full px-4">
                {/* Clock */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="space-y-2"
                >
                    <h1 className="text-7xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-foreground to-muted-foreground font-mono">
                        {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </h1>
                    <p className="text-xl text-muted-foreground font-medium uppercase tracking-widest flex items-center justify-center gap-2">
                        <Clock className="w-5 h-5" />
                        {currentTime.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}
                    </p>
                </motion.div>

                {/* Open Session Form */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2, duration: 0.4 }}
                    className="glass-card p-8 border border-white/10 shadow-2xl relative overflow-hidden"
                >
                    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />

                    <div className="flex justify-center mb-6">
                        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary border border-primary/20 shadow-inner">
                            <Lock className="w-8 h-8" />
                        </div>
                    </div>

                    <h2 className="text-2xl font-bold mb-2">Iniciar Turno</h2>
                    <p className="text-muted-foreground text-sm mb-6">Ingresa el efectivo inicial en caja para comenzar.</p>

                    <form onSubmit={handleOpenSession} className="space-y-4">
                        <div className="relative group">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold transition-colors group-focus-within:text-primary">$</span>
                            <input
                                type="number"
                                step="0.50"
                                value={initialCash}
                                onChange={(e) => setInitialCash(e.target.value)}
                                placeholder="0.00"
                                className="w-full pl-8 pr-4 py-4 bg-secondary/50 border border-border rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-xl font-mono text-center transition-all"
                                autoFocus
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={processing}
                            className="w-full btn-primary-glow bg-primary text-primary-foreground font-bold py-4 rounded-xl shadow-lg transform transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {processing ? <Loader2 className="animate-spin w-5 h-5" /> : (
                                <>
                                    <Banknote className="w-5 h-5" /> ABRIR SESIÓN
                                </>
                            )}
                        </button>
                    </form>
                </motion.div>
            </div>
        </div>
    );
}
