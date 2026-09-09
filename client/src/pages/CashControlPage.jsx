import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { useRole } from '../hooks/useRole';
import {
    Wallet, TrendingUp, TrendingDown, RefreshCw, Loader2, Calendar,
    ArrowDownToLine, ArrowUpFromLine, Repeat, CircleDollarSign,
    Info, Scale, BadgeCheck, AlertTriangle, Coins, Landmark, Receipt,
    Banknote, Send, Upload, Users, PiggyBank
} from 'lucide-react';

const BUSINESS_LABELS = { MCH: 'MCH', 'M&R': 'M&R' };

const fmtMoney = (v) => {
    const n = Number(v ?? 0);
    if (Number.isNaN(n)) return '0.00';
    return n.toLocaleString('es-CU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const num = (v) => {
    const n = Number(v);
    return Number.isNaN(n) ? 0 : n;
};

const currentMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const BAG_META = [
    { key: 'mn', label: 'MN', symbol: '$', color: 'text-emerald-400', header: 'bg-emerald-500/10', icon: Wallet },
    { key: 'usd', label: 'USD', symbol: 'USD', color: 'text-cyan-400', header: 'bg-cyan-500/10', icon: Coins },
    { key: 'eur', label: 'EUR', symbol: 'EUR', color: 'text-amber-400', header: 'bg-amber-500/10', icon: CircleDollarSign },
    { key: 'transfers', label: 'Transferencias', symbol: '$', color: 'text-blue-400', header: 'bg-blue-500/10', icon: Landmark },
];

// Defensivo: normaliza cualquier forma de bags (contrato nuevo opening/income/expenses/balance
// o legado saldo_anterior/ingresos/egresos/saldo; key 'transfers' o 'transfer') a una forma única.
const firstDef = (...vals) => vals.find(v => v !== undefined && v !== null);
const normalizeBags = (raw) => {
    const bags = raw || {};
    const out = {};
    BAG_META.forEach(({ key }) => {
        const b = bags[key] || (key === 'transfers' ? bags.transfer : null) || {};
        out[key] = {
            opening: num(firstDef(b.opening, b.saldo_anterior, 0)),
            income: num(firstDef(b.income, b.ingresos, 0)),
            expenses: num(firstDef(b.expenses, b.egresos, 0)),
            balance: num(firstDef(b.balance, b.saldo, 0)),
            detalle: b.detalle || null,
        };
    });
    return out;
};

const CURRENCY_SYMBOL = { MN: '$', USD: 'USD', EUR: 'EUR' };
const currencyFmt = (currency, amount) => `${CURRENCY_SYMBOL[currency] || '$'} ${fmtMoney(amount)}`;

export default function CashControlPage() {
    const { isAdmin } = useRole();
    // Ámbito híbrido: '' = Todo (consolidado), 'MCH' / 'M&R' = bloque individual
    const [scope, setScope] = useState('MCH');
    const [period, setPeriod] = useState(currentMonth());
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [newApi, setNewApi] = useState(true);

    const load = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({ period });
            if (scope) params.set('business', scope);
            const res = await api.get(`/cash-control?${params.toString()}`, { timeout: 8000 });
            const hasNewContract = Array.isArray(res.data?.deliveries) || res.data?.admin_salary_opening != null;
            setData({
                ...res.data,
                period: res.data?.period ?? period,
                bags: normalizeBags(res.data?.bags),
                deliveries: Array.isArray(res.data?.deliveries) ? res.data.deliveries : [],
                external_income: Array.isArray(res.data?.external_income) ? res.data.external_income : [],
                admin_salary_opening: { amount: num(res.data?.admin_salary_opening?.amount) },
                physical_counts: Array.isArray(res.data?.physical_counts) ? res.data.physical_counts : [],
            });
            setNewApi(hasNewContract);
        } catch (e) {
            if (e.response?.status === 404) {
                // Endpoint nuevo aún no desplegado (backend en paralelo): UI con vacíos, sin crash
                setNewApi(false);
                setData({
                    bags: normalizeBags(null),
                    deliveries: [],
                    external_income: [],
                    admin_salary_opening: { amount: 0 },
                    physical_counts: [],
                });
            } else {
                setError(e.response?.data?.error || e.message);
            }
        } finally {
            setLoading(false);
        }
    }, [period, scope]);

    useEffect(() => { load(); }, [load]);

    // --- Salario Admin ---
    const [salaryInput, setSalaryInput] = useState('');
    const [salaryMsg, setSalaryMsg] = useState(null);
    const salaryAmount = data?.admin_salary_opening?.amount || 0;

    useEffect(() => {
        // Reflejar el valor del backend cuando cambia el bloque (sin pisar lo que está tipeando)
        setSalaryInput(num(salaryAmount) ? String(num(salaryAmount)) : '');
        setSalaryMsg(null);
    }, [salaryAmount]);

    const saveSalary = async () => {
        setSalaryMsg(null);
        try {
            const res = await api.put('/cash-control/admin-salary', {
                period,
                business: scope || null,
                amount: num(salaryInput),
            });
            const rounded = num(res.data?.amount) || num(res.data?.admin_salary_opening?.amount);
            setSalaryMsg({
                ok: true,
                text: `Guardado · redondeado a centenas: $ ${fmtMoney(rounded)}`,
            });
            load(true);
        } catch (e) {
            setSalaryMsg({ ok: false, text: e.response?.data?.error || 'Error al guardar el salario admin' });
        }
    };

    // --- Entregas de efectivo (Kiosco → Caja) ---
    const [delivery, setDelivery] = useState({ currency: 'MN', amount: '', note: '' });
    const [deliveryMsg, setDeliveryMsg] = useState(null);
    const [deliverySaving, setDeliverySaving] = useState(false);

    const saveDelivery = async () => {
        const amount = num(delivery.amount);
        if (amount <= 0) { setDeliveryMsg({ ok: false, text: 'Ingresá un monto mayor a cero' }); return; }
        setDeliverySaving(true);
        setDeliveryMsg(null);
        try {
            await api.post('/cash-deliveries', {
                business: scope,
                currency: delivery.currency,
                amount,
                note: delivery.note.trim(),
            });
            setDeliveryMsg({ ok: true, text: 'Entrega registrada' });
            setDelivery({ currency: 'MN', amount: '', note: '' });
            load(true);
        } catch (e) {
            setDeliveryMsg({ ok: false, text: e.response?.data?.error || 'Error al registrar la entrega' });
        } finally {
            setDeliverySaving(false);
        }
    };

    // --- Efectivo entregado en USA (ingreso externo) ---
    const [external, setExternal] = useState({ currency: 'USD', amount: '', description: '' });
    const [externalMsg, setExternalMsg] = useState(null);
    const [externalSaving, setExternalSaving] = useState(false);

    const saveExternal = async () => {
        const amount = num(external.amount);
        if (amount <= 0) { setExternalMsg({ ok: false, text: 'Ingresá un monto mayor a cero' }); return; }
        setExternalSaving(true);
        setExternalMsg(null);
        try {
            await api.post('/external-income', {
                business: scope,
                currency: external.currency,
                amount,
                description: external.description.trim(),
            });
            setExternalMsg({ ok: true, text: 'Ingreso registrado' });
            setExternal({ currency: 'USD', amount: '', description: '' });
            load(true);
        } catch (e) {
            setExternalMsg({ ok: false, text: e.response?.data?.error || 'Error al registrar el ingreso' });
        } finally {
            setExternalSaving(false);
        }
    };

    // --- Auditoría de salarios (wages/diff) ---
    const [wages, setWages] = useState([]);
    const [wagesUnavailable, setWagesUnavailable] = useState(false);

    const loadWages = useCallback(async () => {
        try {
            const res = await api.get(`/wages/diff?period=${period}`, { timeout: 8000 });
            const rows = Array.isArray(res.data) ? res.data : (Array.isArray(res.data?.items) ? res.data.items : []);
            setWages(rows);
            setWagesUnavailable(false);
        } catch (e) {
            if (e.response?.status === 404) setWages([]);
            setWagesUnavailable(true);
        }
    }, [period]);

    useEffect(() => { loadWages(); }, [loadWages]);

    const bags = data?.bags || normalizeBags(null);
    const mnBag = bags.mn || { opening: 0, income: 0, expenses: 0, balance: 0 };
    const scopeTitle = scope ? BUSINESS_LABELS[scope] : 'Todo · consolidado';
    const singleBusiness = scope !== '';

    useEffect(() => {
        if (!newApi && data) {
            setError(null);
        }
    }, [newApi, data]);

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Wallet className="w-6 h-6 text-cyan-400" /> Control de Efectivo
                    </h1>
                    <p className="text-sm text-slate-400 mt-1">
                        {scopeTitle} · período {period}
                        {newApi ? ' · contrato híbrido' : ' · backend híbrido aún no disponible (vista con vacíos)'}
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

            {/* Pestañas negocio + período */}
            <div className="glass-card p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold mr-1">Negocio</span>
                    {['', 'MCH', 'M&R'].map((s) => (
                        <button
                            key={s || 'todo'}
                            onClick={() => setScope(s)}
                            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${scope === s
                                ? (s ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'bg-violet-500/20 text-violet-300 border border-violet-500/40')
                                : 'bg-secondary/40 text-slate-400 border border-transparent hover:bg-secondary/70'
                            }`}
                        >
                            {s ? BUSINESS_LABELS[s] : 'Todo'}
                        </button>
                    ))}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <div>
                        <label className="text-xs text-slate-400 block mb-1">Período (mes)</label>
                        <input
                            type="month"
                            value={period}
                            onChange={e => setPeriod(e.target.value)}
                            className="bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm" />
                    </div>
                    {!newApi && (
                        <p className="text-xs text-amber-400/90 mt-4">
                            ⚠ Los endpoints híbridos no responden aún (404). Esta vista muestra vacíos; refrescá cuando el backend termine.
                        </p>
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
                    {/* Resumen: bolsa MN (la columna principal del bloque) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <SummaryCard title="Saldo Mes Anterior" value={`$ ${fmtMoney(mnBag.opening)}`}
                            sub="Apertura heredada del mes previo" icon={ArrowDownToLine} color="text-slate-300"
                            bg="from-slate-500/10 to-slate-600/5 border-slate-500/20" />
                        <SummaryCard title="+ Ingresos" value={`$ ${fmtMoney(mnBag.income)}`}
                            sub="Bolsa MN: ventas + inyecciones + ingresos externos" icon={TrendingUp} color="text-emerald-400"
                            bg="from-emerald-500/10 to-emerald-600/5 border-emerald-500/20" />
                        <SummaryCard title="− Egresos" value={`$ ${fmtMoney(mnBag.expenses)}`}
                            sub="Bolsa MN: gastos · incluye salario admin" icon={TrendingDown} color="text-rose-400"
                            bg="from-rose-500/10 to-rose-600/5 border-rose-500/20" />
                        <SummaryCard title="= Saldo del Mes" value={`$ ${fmtMoney(mnBag.balance)}`}
                            sub="Saldo final bolsa MN" icon={Wallet} color="text-cyan-400"
                            bg="from-cyan-500/10 to-cyan-600/5 border-cyan-500/20" />
                    </div>

                    {/* Control definitivo: 4 bolsas + conteo físico */}
                    <DefinitiveControl data={data} bags={bags} scope={scope} period={period}
                        isAdmin={isAdmin} onCountSaved={load} salaryAmount={salaryAmount} />

                    {/* Entregas de efectivo + Efectivo en USA (lado a lado en pantallas anchas) */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <DeliveriesCard scope={scope} singleBusiness={singleBusiness}
                            delivery={delivery} setDelivery={setDelivery}
                            deliverySaving={deliverySaving} deliveryMsg={deliveryMsg}
                            onSave={saveDelivery} deliveries={data.deliveries} />

                        <ExternalIncomeCard scope={scope} singleBusiness={singleBusiness}
                            external={external} setExternal={setExternal}
                            externalSaving={externalSaving} externalMsg={externalMsg}
                            onSave={saveExternal} items={data.external_income} />
                    </div>

                    {/* Salario admin + Auditoría salarios */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <AdminSalaryCard scopeTitle={scopeTitle} isAdmin={isAdmin}
                            value={salaryInput} setValue={setSalaryInput}
                            salaryMsg={salaryMsg} savingMsg={false}
                            onSave={saveSalary} salaryAmount={salaryAmount} />

                        <WagesAuditCard wages={wages} period={period} wagesUnavailable={wagesUnavailable} />
                    </div>
                </>
            )}
        </div>
    );
}

function SummaryCard({ title, value, sub, icon: Icon, color, bg }) {
    return (
        <div className={`p-4 rounded-xl bg-gradient-to-br ${bg}`}>
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">{title}</span>
                <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <div className={`text-2xl font-black font-mono ${color}`}>{value}</div>
            <p className="text-[11px] text-slate-500 mt-1">{sub}</p>
        </div>
    );
}

// --- CONTROL DEFINITIVO: bolsas MN / USD / EUR / Transferencias + efectivo real ---
function DefinitiveControl({ data, bags, scope, period, isAdmin, onCountSaved, salaryAmount }) {
    const [counts, setCounts] = useState({ mn: '', usd: '', eur: '', transfers: '' });
    const [saving, setSaving] = useState(false);
    const [countMsg, setCountMsg] = useState(null);

    const diffFor = (key) => {
        const c = num(counts[key]);
        if (counts[key] === '' || counts[key] === null) return null;
        const saldo = bags[key]?.balance || 0;
        return Math.round((c - saldo) * 100) / 100;
    };

    const diffs = ['mn', 'usd', 'eur', 'transfers'].map(diffFor);
    const allCounted = diffs.every(d => d !== null) && counts.mn !== '' && counts.usd !== '' && counts.eur !== '' && counts.transfers !== '';
    const balanced = allCounted && diffs.every(d => Math.abs(d) < 0.01);

    const saveCount = async () => {
        setSaving(true);
        setCountMsg(null);
        try {
            const res = await api.post('/cash-control/physical-count', {
                period_month: period,
                business: scope || null,
                inventory_id: null,
                counted_mn: num(counts.mn),
                counted_usd: num(counts.usd),
                counted_eur: num(counts.eur),
                counted_transfer: num(counts.transfers),
            });
            setCountMsg({
                ok: true,
                text: `Conteo guardado. Diff MN: $${fmtMoney(res.data?.diff?.mn)} · USD: ${fmtMoney(res.data?.diff?.usd)} · EUR: ${fmtMoney(res.data?.diff?.eur)} · Transf: $${fmtMoney(res.data?.diff?.transfer || res.data?.diff?.transfers)}`
            });
            if (onCountSaved) onCountSaved(true);
        } catch (e) {
            setCountMsg({ ok: false, text: e.response?.data?.error || 'Error al guardar el conteo' });
        } finally {
            setSaving(false);
        }
    };

    const mnDetalle = bags.mn?.detalle;

    return (
        <div className="glass-card p-5 space-y-4">
            <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-violet-400 flex items-center gap-2">
                    <Scale className="w-4 h-4" /> Control Definitivo · Bolsas de Moneda
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                    Saldo anterior auto-heredado del cierre del mes anterior (calculado) · período: {period}
                    {scope ? ` · negocio ${BUSINESS_LABELS[scope]}` : ' · consolidado (todos los negocios)'}
                </p>
            </div>

            {/* Tabla estilo Excel: saldo anterior + ingresos − egresos = saldo */}
            <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[640px]">
                    <thead>
                        <tr className="text-left text-xs uppercase tracking-wider text-slate-400 border-b border-border">
                            <th className="py-2 px-2">Bolsa</th>
                            <th className="py-2 px-2 text-right">Saldo Mes Anterior</th>
                            <th className="py-2 px-2 text-right text-emerald-400">+ Ingresos</th>
                            <th className="py-2 px-2 text-right text-rose-400">− Egresos</th>
                            <th className="py-2 px-2 text-right">= Saldo del Mes</th>
                        </tr>
                    </thead>
                    <tbody>
                        {BAG_META.map(({ key, label, symbol, color, header, icon: BagIcon }) => {
                            const bag = bags[key] || {};
                            return (
                                <tr key={key} className="border-b border-border/50 hover:bg-white/[0.02]">
                                    <td className={`py-3 px-2 font-semibold ${color}`}>
                                        <span className={`inline-flex items-center gap-2 px-2 py-1 rounded-lg ${header}`}>
                                            <BagIcon className="w-4 h-4" /> {label}
                                        </span>
                                    </td>
                                    <td className="py-3 px-2 text-right font-mono text-slate-300">{symbol} {fmtMoney(bag.opening)}</td>
                                    <td className="py-3 px-2 text-right font-mono text-emerald-400">+{symbol} {fmtMoney(bag.income)}</td>
                                    <td className="py-3 px-2 text-right font-mono text-rose-400">−{symbol} {fmtMoney(bag.expenses)}</td>
                                    <td className={`py-3 px-2 text-right font-mono font-black text-lg ${color}`}>{symbol} {fmtMoney(bag.balance)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Detalle MN + nota salario admin */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs text-slate-500">
                <span>Ventas efectivo: <span className="font-mono text-slate-300">${fmtMoney(mnDetalle?.ventas_cash)}</span></span>
                <span>Inyecciones: <span className="font-mono text-slate-300">${fmtMoney(mnDetalle?.inyecciones)}</span></span>
                <span>Gastos efectivo: <span className="font-mono text-slate-300">${fmtMoney(mnDetalle?.gastos_cash)}</span></span>
                <span>Devoluciones: <span className="font-mono text-slate-300">${fmtMoney(mnDetalle?.devoluciones_cash)}</span></span>
                <span>Compra divisas: <span className="font-mono text-slate-300">${fmtMoney(mnDetalle?.compras_divisas_mn)}</span></span>
            </div>
            <p className="text-[11px] text-amber-400/80">
                <PiggyBank className="w-3.5 h-3.5 inline-block mr-1" />
                El <b>Salario Admin del mes anterior</b> ya viene descontado dentro de los egresos de la bolsa MN (−$ {fmtMoney(salaryAmount)}, redondeado a centenas).
            </p>

            {/* Fila de efectivo real vs diff */}
            <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 space-y-3">
                <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-violet-300 flex items-center gap-2">
                        <Receipt className="w-3.5 h-3.5" /> Efectivo Real (contado físico) vs Diff
                    </h4>
                    {allCounted && (
                        balanced ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold">
                                <BadgeCheck className="w-4 h-4" /> Cuadrado
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold">
                                <AlertTriangle className="w-4 h-4" /> Descuadre
                            </span>
                        )
                    )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {BAG_META.map(({ key, label }) => {
                        const diff = diffFor(key);
                        return (
                            <div key={key}>
                                <label className="text-xs text-slate-400 block mb-1">{label}</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    disabled={!isAdmin}
                                    placeholder={isAdmin ? 'Contado físico' : 'Solo admin'}
                                    value={counts[key]}
                                    onChange={e => setCounts(prev => ({ ...prev, [key]: e.target.value }))}
                                    className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm font-mono disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                                {diff !== null && (
                                    <p className={`text-xs font-mono mt-1 ${Math.abs(diff) < 0.01 ? 'text-emerald-400' : diff > 0 ? 'text-cyan-400' : 'text-rose-400'}`}>
                                        diff: {diff > 0 ? '+' : ''}{fmtMoney(diff)}
                                    </p>
                                )}
                            </div>
                        );
                    })}
                </div>
                {isAdmin && (
                    <div className="flex items-center gap-3">
                        <button
                            onClick={saveCount}
                            disabled={saving}
                            className="px-4 py-2 rounded-lg bg-violet-600/80 hover:bg-violet-600 text-white text-sm font-semibold transition-all flex items-center gap-2 disabled:opacity-50"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scale className="w-4 h-4" />}
                            Registrar Conteo
                        </button>
                        {countMsg && (
                            <span className={`text-xs ${countMsg.ok ? 'text-emerald-400' : 'text-rose-400'}`}>{countMsg.text}</span>
                        )}
                    </div>
                )}
            </div>

            {/* Conteos registrados en el período */}
            {data && data.physical_counts && data.physical_counts.length > 0 && (
                <div className="rounded-lg bg-secondary/30 border border-border p-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-2">
                        <BadgeCheck className="w-3.5 h-3.5" /> Conteos registrados ({data.physical_counts.length})
                    </h4>
                    <div className="space-y-1.5 text-xs font-mono text-slate-300">
                        {data.physical_counts.map((pc, i) => (
                            <div key={i} className="flex justify-between gap-3">
                                <span className="text-slate-400">{pc.date || pc.created_at || `#${i + 1}`}</span>
                                <span>
                                    MN ${fmtMoney(pc.counted_mn ?? pc.mn ?? 0)} · USD {fmtMoney(pc.counted_usd ?? pc.usd ?? 0)} · EUR {fmtMoney(pc.counted_eur ?? pc.eur ?? 0)} · Transf ${fmtMoney(pc.counted_transfer ?? pc.transfer ?? pc.transfers ?? 0)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// --- ENTREGAS DE EFECTIVO (KIOSCO → CAJA) ---
function DeliveriesCard({ _scope, singleBusiness, delivery, setDelivery, deliverySaving, deliveryMsg, onSave, deliveries }) {
    const list = Array.isArray(deliveries) ? deliveries : [];
    return (
        <div className="glass-card p-5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-2">
                <Banknote className="w-4 h-4" /> Entregas de Efectivo <span className="text-slate-500 normal-case">(Kiosco → Caja)</span>
            </h3>

            {singleBusiness ? (
                <div className="space-y-3 mt-3">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs text-slate-400 block mb-1">Divisa</label>
                            <select
                                value={delivery.currency}
                                onChange={e => setDelivery(p => ({ ...p, currency: e.target.value }))}
                                className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm">
                                <option value="MN">MN ($)</option>
                                <option value="USD">USD</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs text-slate-400 block mb-1">Monto</label>
                            <input
                                type="number" step="0.01" min="0"
                                value={delivery.amount}
                                onChange={e => setDelivery(p => ({ ...p, amount: e.target.value }))}
                                className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm font-mono" />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs text-slate-400 block mb-1">Nota</label>
                        <input
                            type="text"
                            value={delivery.note}
                            placeholder="Ej: entrega diaria de kiosco"
                            onChange={e => setDelivery(p => ({ ...p, note: e.target.value }))}
                            className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onSave}
                            disabled={deliverySaving}
                            className="px-4 py-2 rounded-lg bg-cyan-600/80 hover:bg-cyan-600 text-white text-sm font-semibold transition-all flex items-center gap-2 disabled:opacity-50"
                        >
                            {deliverySaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            Registrar Entrega
                        </button>
                        {deliveryMsg && (
                            <span className={`text-xs ${deliveryMsg.ok ? 'text-emerald-400' : 'text-rose-400'}`}>{deliveryMsg.text}</span>
                        )}
                    </div>
                </div>
            ) : (
                <p className="text-xs text-slate-500 mt-3">
                    Seleccioná la pestaña <b>MCH</b> o <b>M&R</b> para registrar una entrega (el negocio se toma de la pestaña activa).
                </p>
            )}

            <div className="mt-4 border-t border-border/50 pt-3">
                {list.length === 0 ? (
                    <p className="text-xs text-slate-500">Sin entregas en el período.</p>
                ) : (
                    <div className="space-y-1.5">
                        {list.map((d, i) => {
                            const isManual = String(d.source || '').toLowerCase().includes('manual');
                            return (
                                <div key={i} className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-secondary/40 border border-border/50">
                                    <div className="min-w-0">
                                        <span className="text-sm font-semibold font-mono text-cyan-300">{currencyFmt(d.currency, d.amount)}</span>
                                        <span className="text-xs text-slate-500 ml-2">
                                            {d.date ? new Date(d.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : ''}
                                            {(d.note ? ` · ${d.note}` : '')}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isManual ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                                            {isManual ? 'manual' : 'auto'}
                                        </span>
                                        {d.session_id ? (
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-secondary/60 text-slate-400">sesión #{d.session_id}</span>
                                        ) : (
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-secondary/60 text-slate-400">—</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

// --- EFECTIVO ENTREGADO EN USA (ingreso externo) ---
function ExternalIncomeCard({ _scope, singleBusiness, external, setExternal, externalSaving, externalMsg, onSave, items }) {
    const list = Array.isArray(items) ? items : [];
    return (
        <div className="glass-card p-5 border-emerald-500/30">
            <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                <Upload className="w-4 h-4" /> Efectivo Entregado en USA
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 text-[10px] font-bold normal-case">ingreso externo</span>
            </h3>

            {singleBusiness ? (
                <div className="space-y-3 mt-3">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs text-slate-400 block mb-1">Divisa</label>
                            <select
                                value={external.currency}
                                onChange={e => setExternal(p => ({ ...p, currency: e.target.value }))}
                                className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm">
                                <option value="USD">USD</option>
                                <option value="MN">MN ($)</option>
                                <option value="EUR">EUR</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs text-slate-400 block mb-1">Monto</label>
                            <input
                                type="number" step="0.01" min="0"
                                value={external.amount}
                                onChange={e => setExternal(p => ({ ...p, amount: e.target.value }))}
                                className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm font-mono" />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs text-slate-400 block mb-1">Descripción</label>
                        <input
                            type="text"
                            value={external.description}
                            placeholder="Ej: remesa desde USA"
                            onChange={e => setExternal(p => ({ ...p, description: e.target.value }))}
                            className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onSave}
                            disabled={externalSaving}
                            className="px-4 py-2 rounded-lg bg-emerald-600/80 hover:bg-emerald-600 text-white text-sm font-semibold transition-all flex items-center gap-2 disabled:opacity-50"
                        >
                            {externalSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
                            Registrar Ingreso
                        </button>
                        {externalMsg && (
                            <span className={`text-xs ${externalMsg.ok ? 'text-emerald-400' : 'text-rose-400'}`}>{externalMsg.text}</span>
                        )}
                    </div>
                </div>
            ) : (
                <p className="text-xs text-slate-500 mt-3">
                    Seleccioná la pestaña <b>MCH</b> o <b>M&R</b> para registrar un ingreso externo.
                </p>
            )}

            <div className="mt-4 border-t border-border/50 pt-3">
                {list.length === 0 ? (
                    <p className="text-xs text-slate-500">Sin ingresos externos en el período.</p>
                ) : (
                    <div className="space-y-1.5">
                        {list.map((d, i) => (
                            <div key={i} className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                                <div className="min-w-0">
                                    <span className="text-sm font-semibold font-mono text-emerald-300">+{currencyFmt(d.currency, d.amount)}</span>
                                    <span className="text-xs text-slate-500 ml-2">
                                        {d.date ? new Date(d.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : ''}
                                        {(d.description ? ` · ${d.description}` : '')}
                                    </span>
                                </div>
                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 text-[10px] font-bold">ingreso</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// --- SALARIO ADMIN MES ANTERIOR ---
function AdminSalaryCard({ scopeTitle, isAdmin, value, setValue, salaryMsg, onSave, salaryAmount }) {
    return (
        <div className="glass-card p-5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                <Users className="w-4 h-4" /> Salario Admin · Mes Anterior
            </h3>
            <p className="text-xs text-slate-500 mt-1">
                {scopeTitle} — se descuenta como egreso en la bolsa MN del bloque. El servidor lo redondea a centenas.
            </p>
            <div className="flex flex-wrap items-center gap-3 mt-3">
                <div>
                    <label className="text-xs text-slate-400 block mb-1">Monto (MN)</label>
                    <input
                        type="number" step="100" min="0"
                        value={value}
                        disabled={!isAdmin}
                        onChange={e => setValue(e.target.value)}
                        style={{ backgroundColor: '#FFFFCC' }}
                        className="w-40 bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm font-mono disabled:opacity-50 disabled:cursor-not-allowed"
                        placeholder={salaryAmount ? String(salaryAmount) : '0'}
                    />
                </div>
                {isAdmin && (
                    <button
                        onClick={onSave}
                        className="px-4 py-2 rounded-lg bg-amber-600/80 hover:bg-amber-600 text-white text-sm font-semibold transition-all flex items-center gap-2"
                    >
                        <PiggyBank className="w-4 h-4" /> Guardar
                    </button>
                )}
            </div>
            <p className="text-[11px] text-slate-400 mt-2">
                Actual: <span className="font-mono text-amber-300">$ {fmtMoney(salaryAmount)}</span>
                {Number(salaryAmount) > 0 && Number(salaryAmount) % 100 !== 0 ? ' · redondeado a centenas' : ''}
            </p>
            {salaryMsg && (
                <p className={`text-xs mt-2 ${salaryMsg.ok ? 'text-emerald-400' : 'text-rose-400'}`}>{salaryMsg.text}</p>
            )}
        </div>
    );
}

// --- AUDITORÍA DE SALARIOS (wages/diff) ---
function WagesAuditCard({ wages, period, wagesUnavailable }) {
    const rows = Array.isArray(wages) ? wages : [];
    return (
        <div className="glass-card p-5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-violet-400 flex items-center gap-2">
                <BadgeCheck className="w-4 h-4" /> Auditoría Salarios · {period}
            </h3>

            {wagesUnavailable ? (
                <p className="text-xs text-slate-500 mt-3">
                    Endpoint <span className="font-mono text-slate-400">/api/wages/diff</span> aún no disponible (404). Mostrando vacío hasta que el backend lo habilite.
                </p>
            ) : rows.length === 0 ? (
                <p className="text-xs text-slate-500 mt-3">Sin datos de salarios en el período.</p>
            ) : (
                <div className="overflow-x-auto mt-3">
                    <table className="w-full text-xs min-w-[520px]">
                        <thead>
                            <tr className="text-left text-[10px] uppercase tracking-wider text-slate-400 border-b border-border">
                                <th className="py-1.5 px-2">Trabajador</th>
                                <th className="py-1.5 px-2">Negocio</th>
                                <th className="py-1.5 px-2 text-right">Corte</th>
                                <th className="py-1.5 px-2 text-right">Fórmula</th>
                                <th className="py-1.5 px-2 text-right">Pagado Efectivo</th>
                                <th className="py-1.5 px-2 text-right">Diff</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((w, i) => {
                                const diff = num(w.diff ?? (num(w.paid_cash) - num(w.formula)));
                                const flat = Math.abs(diff) < 0.01;
                                return (
                                    <tr key={i} className="border-b border-border/50">
                                        <td className="py-2 px-2 text-slate-300 font-medium">{w.worker || w.name || '—'}</td>
                                        <td className="py-2 px-2 text-slate-400">
                                            {w.business ? (
                                                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${w.business === 'MCH' ? 'bg-rose-500/15 text-rose-300' : 'bg-sky-500/15 text-sky-300'}`}>
                                                    {BUSINESS_LABELS[w.business] || w.business}
                                                </span>
                                            ) : '—'}
                                        </td>
                                        <td className="py-2 px-2 text-right font-mono text-slate-300">{fmtMoney(w.sales_corte)}</td>
                                        <td className="py-2 px-2 text-right font-mono text-slate-300">{fmtMoney(w.formula)}</td>
                                        <td className="py-2 px-2 text-right font-mono text-slate-300">{fmtMoney(w.paid_cash)}</td>
                                        <td className={`py-2 px-2 text-right font-mono font-bold ${flat ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            {flat ? '✓' : '▲'} {diff > 0 ? '+' : ''}{fmtMoney(diff)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    <p className="text-[10px] text-slate-500 mt-2">Diff = pagado − fórmula · verde ≈ 0 · rojo ≠ 0</p>
                </div>
            )}
        </div>
    );
}