import React, { useState, useEffect } from 'react';
import api from '../api';
import { Clock, Banknote, Loader2, Lock, History, Plus, Info } from 'lucide-react';
import { motion } from 'framer-motion';

export default function SessionGuard({ children }) {
    const [status, setStatus] = useState(null); // null = loading, false = closed, true = open
    const [loading, setLoading] = useState(true);
    const [initialCash, setInitialCash] = useState('');
    const [processing, setProcessing] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());
    // KANB-F: fondo heredado de la sesión anterior en esta sede
    const [carryover, setCarryover] = useState({ amount: 0, from_session_id: null, from_session_end: null });
    const [currentInventory, setCurrentInventory] = useState(() => localStorage.getItem('mch_current_inventory') || '');

    useEffect(() => {
        checkSession();
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const checkSession = async () => {
        if (!navigator.onLine) {
            // En modo offline, verificar si hay un estado de sesión local guardado
            const localSession = localStorage.getItem('mch_offline_session_open');
            setStatus(localSession === 'true');
            setLoading(false);
            return;
        }

        try {
            const res = await api.get('/sessions/status', { timeout: 2000 });
            setStatus(res.data.isOpen);
            localStorage.setItem('mch_offline_session_open', res.data.isOpen ? 'true' : 'false');
            // KANB-F: consultar fondo heredado para esta sede
            fetchCarryover();
        } catch (e) {
            // Si hay error de red o timeout, consultar estado local
            console.warn("Session check fallback to local offline mode:", e.message);
            const localSession = localStorage.getItem('mch_offline_session_open');
            setStatus(localSession === 'true');
        } finally {
            setLoading(false);
        }
    };

    // KANB-F: fondo dejado por la última sesión cerrada en esta sede
    const fetchCarryover = async () => {
        try {
            const invId = localStorage.getItem('mch_current_inventory') || localStorage.getItem('mch_inventory_id') || '';
            if (!invId) return;
            setCurrentInventory(invId);
            const res = await api.get(`/sessions/carryover?inventory_id=${encodeURIComponent(invId)}`, { timeout: 3000 });
            setCarryover({
                amount: res.data.carryover || 0,
                from_session_id: res.data.from_session_id,
                from_session_end: res.data.from_session_end
            });
            // Precargar el fondo heredado como base del campo
            if (res.data.carryover > 0) {
                setInitialCash(String(res.data.carryover));
            }
        } catch (e) {
            console.warn('No se pudo consultar fondo heredado:', e.message);
        }
    };

    const handleOpenSession = async (e) => {
        e.preventDefault();
        setProcessing(true);
        try {
            // Limpiar editing_session al abrir nueva sesión (no es edición, es venta nueva)
            localStorage.removeItem('editing_session');
            localStorage.setItem('mch_offline_session_open', 'true');

            const cashValue = parseFloat(initialCash) || 0;
            const isCarryoverOnly = carryover.amount > 0 && Math.abs(cashValue - carryover.amount) < 0.01;

            if (navigator.onLine) {
                try {
                    await api.post('/sessions/open', {
                        initial_cash: cashValue,
                        // KANB-F: registrar la sede para herencia de fondo
                        inventory_id: localStorage.getItem('mch_current_inventory') || localStorage.getItem('mch_inventory_id') || null,
                        carryover_from: isCarryoverOnly ? carryover.from_session_id : null
                    }, { timeout: 2500 });
                } catch (netErr) {
                    console.warn("No se pudo registrar apertura en el servidor (modo offline):", netErr.message);
                }
            }
            setStatus(true);
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

                    {/* KANB-F: Banner de fondo heredado de la sesión anterior */}
                    {carryover.amount > 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mb-5 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-left"
                        >
                            <div className="flex items-center gap-2 mb-1.5">
                                <History className="w-4 h-4 text-emerald-400" />
                                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                                    Efectivo dejado del turno anterior
                                </span>
                            </div>
                            <div className="text-3xl font-black text-emerald-400 font-mono">
                                ${carryover.amount.toFixed(2)}
                            </div>
                            {carryover.from_session_end && (
                                <p className="text-[11px] text-slate-400 mt-1.5">
                                    De la sesión #{carryover.from_session_id} cerrada el{' '}
                                    {new Date(carryover.from_session_end).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })} a las{' '}
                                    {new Date(carryover.from_session_end).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            )}
                            <p className="text-[11px] text-slate-500 mt-1">
                                Este monto fue confirmado por la administración. Ya está precargado; podés sumarle fondo adicional si te entregaron más efectivo.
                            </p>
                        </motion.div>
                    )}

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

                        {/* KANB-F: indicador de fondo adicional si lo modificado supera el heredado */}
                        {carryover.amount > 0 && (parseFloat(initialCash) || 0) > carryover.amount && (
                            <div className="flex items-center justify-center gap-1.5 text-xs text-cyan-400">
                                <Plus className="w-3.5 h-3.5" />
                                <span>
                                    Fondo adicional del admin: <span className="font-mono font-bold">${((parseFloat(initialCash) || 0) - carryover.amount).toFixed(2)}</span>
                                </span>
                            </div>
                        )}
                        {carryover.amount > 0 && (parseFloat(initialCash) || 0) < carryover.amount && (
                            <div className="flex items-center justify-center gap-1.5 text-xs text-amber-400">
                                <Info className="w-3.5 h-3.5" />
                                <span>El monto es menor al fondo dejado. Verificá el efectivo en caja.</span>
                            </div>
                        )}

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
                        {carryover.amount > 0 && (
                            <p className="text-[10px] text-slate-500 text-center">
                                Al abrir la sesión confirmás que recibiste el efectivo indicado. No se puede revertir.
                            </p>
                        )}
                    </form>
                </motion.div>
            </div>
        </div>
    );
}
