import { useState, useEffect, useCallback } from 'react';
import { X, Check, Ban, Wallet, Loader2, Clock } from 'lucide-react';
import api from '../api';
import { cn } from '../lib/utils';

/**
 * KANB-E: Panel de solicitudes de pago de salario por período.
 * Dueño/Admin: ve todas, aprueba o rechaza. Abierto desde el header.
 */
export default function WageRequestsPanel({ isOpen, onClose, isAdmin }) {
    const [requests, setRequests] = useState(null); // null = cargando
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState('pending');
    const [processing, setProcessing] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get(`/wage-requests${filter ? `?status=${filter}` : ''}`, { timeout: 10000 });
            setRequests(Array.isArray(res.data) ? res.data : []);
        } catch (e) {
            console.error('Error cargando solicitudes de salario:', e);
            setRequests([]);
        }
        setLoading(false);
    }, [filter]);

    useEffect(() => {
        if (!isOpen) return;
        let cancelled = false;
        api.get(`/wage-requests${filter ? `?status=${filter}` : ''}`, { timeout: 10000 })
            .then(res => { if (!cancelled) setRequests(Array.isArray(res.data) ? res.data : []); })
            .catch(e => { console.error('Error cargando solicitudes de salario:', e); if (!cancelled) setRequests([]); });
        return () => { cancelled = true; };
    }, [isOpen, filter]);

    const review = async (id, status) => {
        setProcessing(id);
        try {
            await api.patch(`/wage-requests/${id}/review`, { status }, { timeout: 10000 });
            setRequests(prev => prev.filter(r => r.id !== id));
            load();
        } catch (e) {
            console.error('Error revisando solicitud:', e);
        }
        setProcessing(null);
    };

    if (!isOpen) return null;

    const statusLabel = { pending: 'Pendientes', approved: 'Aprobadas', rejected: 'Rechazadas', '': 'Todas' };

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-card border border-border/60 rounded-2xl w-full max-w-2xl shadow-2xl relative overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-border/40">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400">
                            <Wallet className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-bold text-foreground text-lg">Solicitudes de Pago de Salario</h3>
                            <p className="text-xs text-muted-foreground">Pagos sugeridos por vendedores por período</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Filtros */}
                <div className="flex items-center gap-2 px-5 pt-4">
                    {['pending', 'approved', 'rejected', ''].map(f => (
                        <button
                            key={f || 'all'}
                            onClick={() => setFilter(f)}
                            className={cn(
                                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                                filter === f
                                    ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                            )}
                        >
                            {statusLabel[f]}
                        </button>
                    ))}
                </div>

                {/* Lista */}
                <div className="p-5 max-h-[60vh] overflow-y-auto space-y-3">
                    {loading ? (
                        <div className="flex items-center justify-center py-10 text-muted-foreground">
                            <Loader2 className="w-5 h-5 animate-spin" />
                        </div>
                    ) : requests.length === 0 ? (
                        <div className="text-center py-10 text-muted-foreground text-sm">
                            <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
                            No hay solicitudes {statusLabel[filter]?.toLowerCase()}.
                        </div>
                    ) : (
                        requests.map(r => (
                            <div
                                key={r.id}
                                className="p-4 rounded-xl bg-secondary/30 border border-border/40 flex items-center justify-between gap-3"
                            >
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 text-sm">
                                        <span className="font-bold text-foreground">{r.seller_name || `Vendedor #${r.seller_id}`}</span>
                                        <span className="text-muted-foreground text-xs">•</span>
                                        <span className="text-xs text-muted-foreground font-mono">
                                            {String(r.period_start).slice(0, 10)} → {String(r.period_end).slice(0, 10)}
                                        </span>
                                    </div>
                                    <div className="text-2xl font-bold font-mono text-violet-300 mt-1">
                                        ${Number(r.amount || 0).toFixed(2)}
                                    </div>
                                    {r.notes && (
                                        <div className="text-xs text-muted-foreground mt-0.5 truncate">{r.notes}</div>
                                    )}
                                </div>

                                {isAdmin && r.status === 'pending' && (
                                    <div className="flex items-center gap-2 shrink-0">
                                        {processing === r.id ? (
                                            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => review(r.id, 'approved')}
                                                    className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 transition-all"
                                                    title="Aprobar pago"
                                                >
                                                    <Check className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => review(r.id, 'rejected')}
                                                    className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 hover:bg-rose-500/25 transition-all"
                                                    title="Rechazar pago"
                                                >
                                                    <Ban className="w-4 h-4" />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                )}

                                {r.status !== 'pending' && (
                                    <div className={cn(
                                        "px-3 py-1.5 rounded-lg text-xs font-bold shrink-0",
                                        r.status === 'approved' && "bg-emerald-500/15 text-emerald-400",
                                        r.status === 'rejected' && "bg-rose-500/15 text-rose-400"
                                    )}>
                                        {r.status === 'approved' ? 'Aprobada' : 'Rechazada'}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
