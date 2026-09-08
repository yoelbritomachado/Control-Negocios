import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import {
    Wallet, TrendingUp, TrendingDown, RefreshCw, Loader2, Calendar,
    DollarSign, ArrowDownToLine, ArrowUpFromLine, Repeat, CircleDollarSign,
    Info, ChevronDown
} from 'lucide-react';

const RANGES = [
    { id: 'today', label: 'Hoy' },
    { id: 'week', label: 'Semana' },
    { id: 'month', label: 'Mes' },
    { id: 'year', label: 'Año' },
    { id: 'custom', label: 'Personalizado' },
];

const INVENTORIES = [
    { id: '', label: 'Todas las sedes' },
    { id: 'mch1', label: 'MCH 1' },
    { id: 'mch2', label: 'MCH 2' },
    { id: 'alm', label: 'Almacén' },
];

const fmtMoney = (v) => (v || 0).toLocaleString('es-CU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function CashControlPage() {
    const [range, setRange] = useState('month');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [inventoryId, setInventoryId] = useState('');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showCirculating, setShowCirculating] = useState(false);

    const load = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({ range });
            if (range === 'custom') {
                if (!from || !to) { setLoading(false); return; }
                params.set('from', from);
                params.set('to', to);
            }
            if (inventoryId) params.set('inventory_id', inventoryId);
            const res = await api.get(`/cash-control?${params.toString()}`, { timeout: 8000 });
            setData(res.data);
        } catch (e) {
            setError(e.response?.data?.error || e.message);
        } finally {
            setLoading(false);
        }
    }, [range, from, to, inventoryId]);

    useEffect(() => { load(); }, [load]);

    // Auto-refresh en tiempo real cada 30s si el período no tiene fecha final
    useEffect(() => {
        if (!data?.real_time) return;
        const t = setInterval(() => load(true), 30000);
        return () => clearInterval(t);
    }, [data?.real_time, load]);

    const summaryCards = data ? [
        {
            title: 'Saldo Inicial',
            value: fmtMoney(data.opening_balance),
            sub: 'Fondo heredado del período anterior',
            icon: ArrowDownToLine,
            color: 'text-slate-300',
            bg: 'from-slate-500/10 to-slate-600/5 border-slate-500/20'
        },
        {
            title: 'Total Ingresos',
            value: fmtMoney(data.income.total_cash),
            sub: `Ventas efectivo ${fmtMoney(data.income.sales_cash)} + inyecciones ${fmtMoney(data.income.injections)}`,
            icon: TrendingUp,
            color: 'text-emerald-400',
            bg: 'from-emerald-500/10 to-emerald-600/5 border-emerald-500/20'
        },
        {
            title: 'Total Egresos',
            value: fmtMoney((data.expenses.cash || 0) + (data.returns_cash || 0)),
            sub: `Gastos ${fmtMoney(data.expenses.cash)} + devoluciones ${fmtMoney(data.returns_cash)}`,
            icon: TrendingDown,
            color: 'text-rose-400',
            bg: 'from-rose-500/10 to-rose-600/5 border-rose-500/20'
        },
        {
            title: 'Saldo Final',
            value: fmtMoney(data.closing_balance),
            sub: data.real_time ? 'En tiempo real (incluye sesiones abiertas)' : 'Período cerrado',
            icon: Wallet,
            color: 'text-cyan-400',
            bg: 'from-cyan-500/10 to-cyan-600/5 border-cyan-500/20'
        },
    ] : [];

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Wallet className="w-6 h-6 text-cyan-400" /> Control de Efectivo
                    </h1>
                    <p className="text-sm text-slate-400 mt-1">
                        {data ? `${data.period.label}: ${new Date(data.period.start).toLocaleDateString('es-ES')} → ${data.period.end ? new Date(data.period.end).toLocaleDateString('es-ES') : 'ahora'}` : 'Cargando...'}
                    </p>
                </div>
                <button
                    onClick={() => load()}
                    className="btn-secondary flex items-center gap-2 self-start"
                    title="Actualizar"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar
                </button>
            </div>

            {/* Filtros */}
            <div className="glass-card p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    {RANGES.map(r => (
                        <button
                            key={r.id}
                            onClick={() => setRange(r.id)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${range === r.id
                                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                                : 'bg-secondary/40 text-slate-400 border border-transparent hover:bg-secondary/70'
                            }`}
                        >
                            {r.label}
                        </button>
                    ))}
                </div>
                {range === 'custom' && (
                    <div className="flex flex-wrap items-center gap-3">
                        <div>
                            <label className="text-xs text-slate-400 block mb-1">Desde</label>
                            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                                className="bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm" />
                        </div>
                        <div>
                            <label className="text-xs text-slate-400 block mb-1">Hasta</label>
                            <input type="date" value={to} onChange={e => setTo(e.target.value)}
                                className="bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm" />
                        </div>
                    </div>
                )}
                <div className="flex flex-wrap items-center gap-3">
                    <div>
                        <label className="text-xs text-slate-400 block mb-1">Sede</label>
                        <select value={inventoryId} onChange={e => setInventoryId(e.target.value)}
                            className="bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm">
                            {INVENTORIES.map(i => (
                                <option key={i.id} value={i.id}>{i.label}</option>
                            ))}
                        </select>
                    </div>
                    {data?.real_time && (
                        <div className="flex items-center gap-1.5 text-xs text-emerald-400 mt-4">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            Tiempo real · auto-refresco 30s
                        </div>
                    )}
                </div>
            </div>

            {loading && !data ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
                </div>
            ) : error ? (
                <div className="glass-card p-8 text-center text-rose-400">
                    <Info className="w-8 h-8 mx-auto mb-2" /> {error}
                </div>
            ) : data && (
                <>
                    {/* Tarjetas resumen */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {summaryCards.map(c => (
                            <div key={c.title} className={`p-4 rounded-xl bg-gradient-to-br ${c.bg}`}>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">{c.title}</span>
                                    <c.icon className={`w-5 h-5 ${c.color}`} />
                                </div>
                                <div className={`text-2xl font-black font-mono ${c.color}`}>${c.value}</div>
                                <p className="text-[11px] text-slate-500 mt-1">{c.sub}</p>
                            </div>
                        ))}
                    </div>

                    {/* Detalle: tabla estilo libro mayor */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Ingresos */}
                        <div className="glass-card p-5">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-400 mb-4 flex items-center gap-2">
                                <ArrowDownToLine className="w-4 h-4" /> Ingresos
                            </h3>
                            <div className="space-y-3 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Ventas en efectivo <span className="text-slate-600">({data.income.sales_count})</span></span>
                                    <span className="font-mono text-emerald-400">+${fmtMoney(data.income.sales_cash)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Ventas por transferencia <span className="text-slate-600">({data.income.sales_count})</span></span>
                                    <span className="font-mono text-blue-400">+${fmtMoney(data.income.sales_transfer)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Inyecciones de efectivo <span className="text-slate-600">({data.income.injections_count})</span></span>
                                    <span className="font-mono text-cyan-400">+${fmtMoney(data.income.injections)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Egresos */}
                        <div className="glass-card p-5">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-rose-400 mb-4 flex items-center gap-2">
                                <ArrowUpFromLine className="w-4 h-4" /> Egresos
                            </h3>
                            <div className="space-y-3 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Gastos en efectivo <span className="text-slate-600">({data.expenses.count})</span></span>
                                    <span className="font-mono text-rose-400">-${fmtMoney(data.expenses.cash)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Devoluciones en efectivo <span className="text-slate-600">({data.returns_count})</span></span>
                                    <span className="font-mono text-rose-400">-${fmtMoney(data.returns_cash)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Gastos por transferencia</span>
                                    <span className="font-mono text-orange-400">-${fmtMoney(data.expenses.transfer)}</span>
                                </div>
                                {(data.currency_purchases || []).map(cp => (
                                    <div key={cp.currency} className="flex justify-between">
                                        <span className="text-slate-400 flex items-center gap-1">
                                            <CircleDollarSign className="w-3.5 h-3.5 text-amber-400" />
                                            Compra de divisas {cp.currency}
                                        </span>
                                        <span className="font-mono text-amber-400">-${fmtMoney(cp.mn_spent)} <span className="text-slate-500 text-xs">→ {fmtMoney(cp.divisas_bought)} {cp.currency}</span></span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Efectivo circulante (sesiones abiertas) */}
                    <div className="glass-card overflow-hidden">
                        <button
                            onClick={() => setShowCirculating(!showCirculating)}
                            className="w-full p-5 flex items-center justify-between text-left"
                        >
                            <div>
                                <h3 className="text-sm font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                                    <Repeat className="w-4 h-4" /> Efectivo Circulante (en sesiones abiertas)
                                </h3>
                                <p className="text-xs text-slate-500 mt-1">
                                    Dinero vivo en turnos aún no cerrados — no forma parte del saldo final hasta su cierre y aprobación.
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-xl font-black font-mono text-amber-400">${fmtMoney(data.circulating_total)}</span>
                                <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${showCirculating ? 'rotate-180' : ''}`} />
                            </div>
                        </button>
                        {showCirculating && data.circulating_sessions.length > 0 && (
                            <div className="px-5 pb-5 space-y-2">
                                {data.circulating_sessions.map(s => (
                                    <div key={s.session_id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/40 border border-border">
                                        <div>
                                            <span className="text-sm font-semibold">{(s.inventory_id || '—').toUpperCase()}</span>
                                            <span className="text-xs text-slate-500 ml-2">
                                                Sesión #{s.session_id} · desde {new Date(s.start_time).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <span className="font-mono text-amber-400 font-bold">${fmtMoney(s.circulating_cash)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                        {showCirculating && data.circulating_sessions.length === 0 && (
                            <p className="px-5 pb-5 text-sm text-slate-500">No hay sesiones abiertas en este momento.</p>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
