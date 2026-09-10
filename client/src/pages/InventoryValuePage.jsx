import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import {
    Package, RefreshCw, Loader2, Info, Boxes, Coins, Scale, BadgeCheck,
    AlertTriangle, TrendingDown, TrendingUp, ClipboardCheck, Save,
} from 'lucide-react';

const BUSINESS_LABELS = { MCH: 'MCH', 'M&R': 'M&R' };

// --- Helpers de formato ---
const num = (v) => {
    const n = Number(v);
    return Number.isNaN(n) ? 0 : n;
};

const fmtInt = (v) => {
    const n = num(v);
    return n.toLocaleString('es-CU'); // separador de miles: 12.345
};

const fmtMoney = (v) => {
    const n = num(v);
    return n.toLocaleString('es-CU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const currentMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const fmtDate = (d) => {
    if (!d) return '—';
    const date = new Date(d);
    if (Number.isNaN(date.getTime())) return String(d);
    return date.toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

// Location id → label legible (mismo mapeo que usa el CRM)
const LOCATION_LABELS = { alm: 'Almacén Central', mch1: 'MCH 1', mch2: 'MCH 2' };
const locationLabel = (id, name) => {
    if (name && String(name).trim()) return String(name).trim();
    const key = String(id || '').toLowerCase();
    return LOCATION_LABELS[key] || id || 'Sede';
};

// --- Normalización defensiva del contrato ---
// GET /api/inventory-value?business=...
// → {business, locations:[{location_id, name, items, total_units, sales_possible,
//    products:[{id, sku, name, stock, sale_price, value}]}], totals:{sales_possible}}
const normalizeLoc = (l, li) => ({
    location_id: l?.location_id ?? l?.id ?? `loc-${li}`,
    name: l?.name ?? '',
    items: num(l?.items),
    total_units: num(l?.total_units),
    sales_possible: num(l?.sales_possible),
    products: Array.isArray(l?.products) ? l.products : [],
});

const normalizeInv = (raw, business) => {
    let locations = [];
    let rawBusiness = raw?.business;
    if (Array.isArray(raw?.locations)) {
        // Contrato directo con business en el query
        locations = raw.locations.map(normalizeLoc);
    } else if (raw?.businesses && typeof raw.businesses === 'object' && !Array.isArray(raw.businesses)) {
        // Variante 'Todo': {businesses:{MCH:{locations:[...]}, 'M&R':{locations:[...]}}}
        Object.entries(raw.businesses).forEach(([biz, block]) => {
            (Array.isArray(block?.locations) ? block.locations : []).forEach((l, li) => {
                const loc = normalizeLoc(l, locations.length + li);
                locations.push({ ...loc, name: `${biz} · ${loc.name || locationLabel(loc.location_id)}` });
            });
        });
        rawBusiness = business || 'Todo';
    }
    // Totales: del backend si vienen; si no, sumar por sede (defensivo)
    const sum = locations.reduce((acc, l) => acc + l.sales_possible, 0);
    const totals = { sales_possible: num(raw?.totals?.sales_possible) || sum };
    return { business: rawBusiness ?? business, locations, totals, empty: locations.length === 0 };
};

// GET /api/price-changes?period=YYYY-MM&business=...
// → {changes:[{date, business, location_id, sku, name, old_price, new_price, diff, change_type, user}],
//    totals:{rebajas, aumentos, monto_rebajas, monto_aumentos, by_business} del período}
// Defensivo: totals puede venir plano (acumulando ambos negocios) o anidado por negocio
// (by_business / claves MCH y M&R). Normalizo a un mapa {MCH, 'M&R'}.
const pickTotals = (t) => ({
    rebajas: num(t?.rebajas),
    aumentos: num(t?.aumentos),
    monto_rebajas: num(t?.monto_rebajas),
    monto_aumentos: num(t?.monto_aumentos),
});

const normalizePriceChanges = (raw, business) => {
    const changes = Array.isArray(raw?.changes) ? raw.changes : [];
    const totals = {};
    const src = raw?.totals || {};

    if (src.by_business && typeof src.by_business === 'object' && !Array.isArray(src.by_business)) {
        // Forma nueva: totals.by_business = {MCH:{...}, 'M&R':{...}}
        Object.entries(src.by_business).forEach(([biz, t]) => { totals[biz] = pickTotals(t); });
    } else if ('MCH' in src || 'M&R' in src) {
        // Forma por negocio: totals = {MCH:{...}, 'M&R':{...}}
        if ('MCH' in src) totals['MCH'] = pickTotals(src['MCH']);
        if ('M&R' in src) totals['M&R'] = pickTotals(src['M&R']);
    } else if (changes.length) {
        // Fallback: derivar totales desde la lista de changes (confiable, siempre disponible)
        ['MCH', 'M&R'].forEach((biz) => {
            const rows = changes.filter(c => (c.business || '') === biz);
            if (rows.length || business === biz) {
                totals[biz] = {
                    rebajas: rows.filter(c => c.change_type === 'rebaja').length,
                    aumentos: rows.filter(c => c.change_type === 'aumento').length,
                    monto_rebajas: rows.filter(c => c.change_type === 'rebaja').reduce((a, c) => a + num(c.diff), 0),
                    monto_aumentos: rows.filter(c => c.change_type === 'aumento').reduce((a, c) => a + num(c.diff), 0),
                };
            }
        });
    }
    return { changes, totals };
};

// GET /api/inventory-counts?business=... → lista con diff (más reciente primero)
const normalizeCounts = (raw) => {
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw?.counts)) return raw.counts;
    if (Array.isArray(raw?.items)) return raw.items;
    return [];
};

export default function InventoryValuePage() {
    // Tabs de negocio: MCH (default) | M&R | Todo ('')
    const [business, setBusiness] = useState('MCH');
    const [period, setPeriod] = useState(currentMonth());

    const [inv, setInv] = useState(null);
    const [invUnavailable, setInvUnavailable] = useState(false);
    const [loading, setLoading] = useState(true);

    const [counts, setCounts] = useState([]);
    const [countsUnavailable, setCountsUnavailable] = useState(false);

    const [priceChanges, setPriceChanges] = useState(null);
    const [pcUnavailable, setPcUnavailable] = useState(false);

    const [error, setError] = useState(null);

    // --- Carga de inventario valorizado (defensiva: 404 → vista vacía sin crash) ---
    const loadInventory = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (business) params.set('business', business);
            const res = await api.get(`/inventory-value?${params.toString()}`, { timeout: 8000 });
            setInv(normalizeInv(res.data, business));
            setInvUnavailable(false);
        } catch (e) {
            if (e.response?.status === 404 || e.response?.status === 501) {
                // Endpoint nuevo aún no desplegado (backend en paralelo): UI con vacíos
                setInv(normalizeInv(null, business));
                setInvUnavailable(true);
            } else {
                setError(e.response?.data?.error || e.message);
                setInv(normalizeInv(null, business));
                setInvUnavailable(true);
            }
        } finally {
            setLoading(false);
        }
    }, [business]);

    // --- Carga de conteos físicos históricos ---
    const loadCounts = useCallback(async () => {
        try {
            const params = new URLSearchParams();
            if (business) params.set('business', business);
            const res = await api.get(`/inventory-counts?${params.toString()}`, { timeout: 8000 });
            const list = normalizeCounts(res.data);
            // Contrato: más reciente primero — ordenar defensivamente por fecha descendente
            list.sort((a, b) => new Date(b?.date || 0) - new Date(a?.date || 0));
            setCounts(list);
            setCountsUnavailable(false);
        } catch (e) {
            if (e.response?.status === 404 || e.response?.status === 501) {
                setCounts([]);
                setCountsUnavailable(true);
            } else {
                setCounts([]);
                setCountsUnavailable(true);
            }
        }
    }, [business]);

    // --- Carga de rebajas y aumentos del período ---
    const loadPriceChanges = useCallback(async () => {
        try {
            const params = new URLSearchParams({ period });
            if (business) params.set('business', business);
            const res = await api.get(`/price-changes?${params.toString()}`, { timeout: 8000 });
            setPriceChanges(normalizePriceChanges(res.data, business));
            setPcUnavailable(false);
        } catch (e) {
            if (e.response?.status === 404 || e.response?.status === 501) {
                setPriceChanges(normalizePriceChanges(null, business));
                setPcUnavailable(true);
            } else {
                setPriceChanges(normalizePriceChanges(null, business));
                setPcUnavailable(true);
            }
        }
    }, [period, business]);

    // Refrescar todo al cambiar tab o período
    useEffect(() => {
        loadInventory();
        loadCounts();
        loadPriceChanges();
    }, [loadInventory, loadCounts, loadPriceChanges]);

    const refreshAll = () => { loadInventory(true); loadCounts(); loadPriceChanges(); };

    const bizTitle = business ? BUSINESS_LABELS[business] : 'Todo · todas las sedes';

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Package className="w-6 h-6 text-cyan-400" /> Inventario Valorizado
                    </h1>
                    <p className="text-sm text-slate-400 mt-1">
                        {bizTitle} · período {period}
                        {invUnavailable ? ' · backend aún no disponible (vista con vacíos)' : ''}
                    </p>
                </div>
                <button
                    onClick={refreshAll}
                    className="btn-secondary flex items-center gap-2 self-start"
                    title="Actualizar"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar
                </button>
            </div>

            {/* Pestañas de negocio: mismo estilo que CashControlPage */}
            <div className="glass-card p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold mr-1">Negocio</span>
                    {['MCH', 'M&R', ''].map((b) => (
                        <button
                            key={b || 'todo'}
                            onClick={() => setBusiness(b)}
                            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${business === b
                                ? (b ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'bg-violet-500/20 text-violet-300 border border-violet-500/40')
                                : 'bg-secondary/40 text-slate-400 border border-transparent hover:bg-secondary/70'
                            }`}
                        >
                            {b ? BUSINESS_LABELS[b] : 'Todo'}
                        </button>
                    ))}
                    <div className="ml-auto">
                        <label className="text-xs text-slate-400 block mb-1">Período rebajas (mes)</label>
                        <input
                            type="month"
                            value={period}
                            onChange={e => setPeriod(e.target.value)}
                            className="bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm" />
                    </div>
                </div>
                {(invUnavailable || pcUnavailable) && (
                    <p className="text-xs text-amber-400/90">
                        ⚠ Algunos endpoints ({invUnavailable ? '/api/inventory-value ' : ''}{pcUnavailable ? '/api/price-changes' : ''}) no responden aún (404).
                        Esta vista muestra vacíos; refrescá cuando el backend termine.
                    </p>
                )}
                {error && (
                    <div className="text-xs text-rose-400 flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5" /> {error}
                    </div>
                )}
            </div>

            {loading && !inv ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
                </div>
            ) : (
                <>
                    {/* C) INVENTARIO VALORIZADO */}
                    <InventoryValueCard inv={inv} unavailable={invUnavailable} />

                    {/* D) CONTEO FÍSICO POR SEDE */}
                    <PhysicalCountCard
                        business={business}
                        inv={inv}
                        counts={counts}
                        countsUnavailable={countsUnavailable}
                        onSaved={() => { loadInventory(true); loadCounts(); }}
                    />

                    {/* E+F) REBAJAS Y AUMENTOS */}
                    <PriceChangesCard
                        business={business}
                        period={period}
                        data={priceChanges}
                        unavailable={pcUnavailable}
                    />
                </>
            )}
        </div>
    );
}

// ============================================================
// C) CARD: VENTAS POSIBLES (INVENTARIO VALORIZADO)
// ============================================================
function InventoryValueCard({ inv, unavailable }) {
    if (!inv) return null;
    return (
        <div className="glass-card p-5 space-y-4">
            <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-2">
                    <Boxes className="w-4 h-4" /> Ventas Posibles (Inventario Valorizado)
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                    Valor total del stock a precio de venta ({inv.business === 'Todo' ? 'todas las sedes' : (BUSINESS_LABELS[inv.business] || inv.business || 'todas las sedes')})
                </p>
            </div>

            {unavailable ? (
                <p className="text-xs text-slate-500">
                    Endpoint <span className="font-mono text-slate-400">/api/inventory-value</span> aún no disponible (404). Mostrando vacío hasta que el backend lo habilite.
                </p>
            ) : inv.empty ? (
                <p className="text-xs text-slate-500">Sin datos de inventario para este negocio.</p>
            ) : (
                <>
                    {/* Total destacado en grande */}
                    <div className="rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-600/5 border border-cyan-500/20 p-4 flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Ventas Posibles · Total</p>
                            <div className="text-4xl font-black font-mono text-cyan-300 mt-1">
                                $ {fmtMoney(inv.totals.sales_possible)}
                            </div>
                        </div>
                        <Coins className="w-10 h-10 text-cyan-500/40" />
                    </div>

                    {/* Desglose por sede */}
                    <div className="space-y-4">
                        {inv.locations.map((loc) => (
                            <div key={loc.location_id} className="rounded-xl border border-border bg-secondary/20 overflow-hidden">
                                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-secondary/40 border-b border-border">
                                    <div className="flex items-center gap-2">
                                        <Package className="w-4 h-4 text-violet-300" />
                                        <span className="text-sm font-bold text-slate-200">{locationLabel(loc.location_id, loc.name)}</span>
                                    </div>
                                    <div className="flex items-center gap-4 font-mono text-sm">
                                        <span className="text-slate-400">{fmtInt(loc.items)} ítems · {fmtInt(loc.total_units)} unidades</span>
                                        <span className="font-black text-lg text-cyan-300">$ {fmtMoney(loc.sales_possible)}</span>
                                    </div>
                                </div>
                                {loc.products.length > 0 && (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs min-w-[560px]">
                                            <thead>
                                                <tr className="text-left text-[10px] uppercase tracking-wider text-slate-400 border-b border-border">
                                                    <th className="py-1.5 px-3">SKU</th>
                                                    <th className="py-1.5 px-3">Producto</th>
                                                    <th className="py-1.5 px-3 text-right">Stock</th>
                                                    <th className="py-1.5 px-3 text-right">Precio</th>
                                                    <th className="py-1.5 px-3 text-right">Valor</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {loc.products.map((p, i) => (
                                                    <tr key={p.id ?? i} className="border-b border-border/40 hover:bg-white/[0.02]">
                                                        <td className="py-1.5 px-3 font-mono text-slate-400">{p.sku ?? '—'}</td>
                                                        <td className="py-1.5 px-3 text-slate-200">{p.name ?? '—'}</td>
                                                        <td className="py-1.5 px-3 text-right font-mono text-slate-300">{fmtInt(p.stock)}</td>
                                                        <td className="py-1.5 px-3 text-right font-mono text-slate-300">$ {fmtMoney(p.sale_price)}</td>
                                                        <td className="py-1.5 px-3 text-right font-mono font-semibold text-cyan-200">$ {fmtMoney(p.value)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

// ============================================================
// D) CARD: CONTEO FÍSICO POR SEDE
// ============================================================
function PhysicalCountCard({ business, inv, counts, countsUnavailable, onSaved }) {
    // Un input amarillo por sede (única celda editable estilo planilla)
    const [inputs, setInputs] = useState({}); // { [location_id]: { value, note } }
    const [saving, setSaving] = useState(null); // location_id en curso
    const [msg, setMsg] = useState(null); // { ok, text }

    // Sede activa si hay tab de negocio específico; en 'Todo' se cuentan todas las sedes
    const locations = Array.isArray(inv?.locations) ? inv.locations : [];

    // Resetear inputs cuando cambia el negocio/sedes
    const locationsKey = locations.map(l => l.location_id).join('|');
    useEffect(() => {
        setInputs({});
        setMsg(null);
    }, [locationsKey]);

    const setInput = (locId, field, v) => {
        setInputs(prev => ({
            ...prev,
            [locId]: { value: prev[locId]?.value ?? '', note: prev[locId]?.note ?? '', [field]: v },
        }));
    };

    const saveCount = async (loc) => {
        const state = inputs[loc.location_id] || {};
        const counted = num(state.value);
        if (!state.value || state.value === '' || counted < 0) {
            setMsg({ ok: false, text: `Ingresá un valor contado para ${locationLabel(loc.location_id, loc.name)}` });
            return;
        }
        setSaving(loc.location_id);
        setMsg(null);
        try {
            const res = await api.post('/inventory-counts', {
                business: business || null,
                location_id: loc.location_id,
                counted_value: counted,
                note: String(state.note || '').trim(),
            });
            const diff = res.data?.diff;
            const diffTxt = (diff === null || diff === undefined) ? '' : ` · Diff: ${num(diff) > 0 ? '+' : ''}${fmtMoney(diff)}`;
            setMsg({ ok: true, text: `Conteo guardado (${locationLabel(loc.location_id, loc.name)})${diffTxt}` });
            setInputs(prev => ({ ...prev, [loc.location_id]: { value: '', note: '' } }));
            if (onSaved) onSaved();
        } catch (e) {
            setMsg({ ok: false, text: e.response?.data?.error || 'Error al guardar el conteo físico' });
        } finally {
            setSaving(null);
        }
    };

    return (
        <div className="glass-card p-5 space-y-4">
            <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                    <ClipboardCheck className="w-4 h-4" /> Conteo Físico por Sede
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                    Valor contado vs valor esperado (inventario valorizado). Las celdas editables van en amarillo claro.
                </p>
            </div>

            {business === '' && (
                <p className="text-xs text-slate-500">
                    Estás en <b>Todo</b>: podés guardar el conteo de cada sede individualmente.
                </p>
            )}

            {locations.length === 0 && !countsUnavailable ? (
                <p className="text-xs text-slate-500">Sin sedes cargadas para este negocio.</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[720px]">
                        <thead>
                            <tr className="text-left text-xs uppercase tracking-wider text-slate-400 border-b border-border">
                                <th className="py-2 px-2">Sede</th>
                                <th className="py-2 px-2 text-right">Valor Esperado</th>
                                <th className="py-2 px-2">Valor Contado</th>
                                <th className="py-2 px-2">Nota (opcional)</th>
                                <th className="py-2 px-2 text-right">Diff</th>
                                <th className="py-2 px-2"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {locations.map((loc) => {
                                const st = inputs[loc.location_id] || { value: '', note: '' };
                                const expected = loc.sales_possible;
                                const typed = st.value !== '' && st.value !== null && st.value !== undefined;
                                const diff = typed ? Math.round((num(st.value) - expected) * 100) / 100 : null;
                                const diffOk = diff !== null && Math.abs(diff) < 0.01;
                                return (
                                    <tr key={loc.location_id} className="border-b border-border/50 hover:bg-white/[0.02]">
                                        <td className="py-2.5 px-2 font-semibold text-slate-200">
                                            {locationLabel(loc.location_id, loc.name)}
                                            <span className="block text-[10px] text-slate-500 font-normal">{fmtInt(loc.items)} ítems</span>
                                        </td>
                                        <td className="py-2.5 px-2 text-right font-mono text-slate-300">$ {fmtMoney(expected)}</td>
                                        <td className="py-2.5 px-2">
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={st.value}
                                                onChange={e => setInput(loc.location_id, 'value', e.target.value)}
                                                placeholder="Contado físico"
                                                style={{ backgroundColor: '#FFFFCC' }}
                                                className="w-36 bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm font-mono text-slate-900"
                                            />
                                        </td>
                                        <td className="py-2.5 px-2">
                                            <input
                                                type="text"
                                                value={st.note}
                                                onChange={e => setInput(loc.location_id, 'note', e.target.value)}
                                                placeholder="Ej: faltante estante 3"
                                                className="w-44 bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm"
                                            />
                                        </td>
                                        <td className={`py-2.5 px-2 text-right font-mono ${diff === null ? 'text-slate-500' : diffOk ? 'text-emerald-400' : 'text-rose-400 font-bold'}`}>
                                            {diff === null ? '—' : `${diff > 0 ? '+' : ''}${fmtMoney(diff)}`}
                                        </td>
                                        <td className="py-2.5 px-2 text-right">
                                            <button
                                                onClick={() => saveCount(loc)}
                                                disabled={saving === loc.location_id}
                                                className="px-3 py-1.5 rounded-lg bg-amber-600/80 hover:bg-amber-600 text-white text-xs font-semibold transition-all flex items-center gap-1.5 disabled:opacity-50"
                                            >
                                                {saving === loc.location_id
                                                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    : <Save className="w-3.5 h-3.5" />}
                                                Guardar
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
            {msg && (
                <p className={`text-xs ${msg.ok ? 'text-emerald-400' : 'text-rose-400'}`}>{msg.text}</p>
            )}

            {/* Histórico de conteos */}
            <div className="border-t border-border/50 pt-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                    <BadgeCheck className="w-3.5 h-3.5" /> Conteos registrados {counts.length ? `(${counts.length})` : ''}
                </h4>
                {countsUnavailable ? (
                    <p className="text-xs text-slate-500">
                        Endpoint <span className="font-mono text-slate-400">/api/inventory-counts</span> aún no disponible (404).
                    </p>
                ) : counts.length === 0 ? (
                    <p className="text-xs text-slate-500">Sin conteos registrados para este negocio.</p>
                ) : (
                    <div className="space-y-1.5 text-xs font-mono text-slate-300 max-h-56 overflow-y-auto pr-1">
                        {counts.map((c, i) => {
                            const d = num(c.diff);
                            const diffOk = Math.abs(d) < 0.01;
                            return (
                                <div key={c.id ?? i} className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-lg bg-secondary/40 border border-border/50">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="text-slate-400">{fmtDate(c.date)}</span>
                                        <span className="font-semibold text-slate-200">{locationLabel(c.location_id, c.location_name)}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span>esperado $ {fmtMoney(c.expected_value)}</span>
                                        <span>contado $ {fmtMoney(c.counted_value)}</span>
                                        <span className={`px-2 py-0.5 rounded-full font-bold ${diffOk ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                                            {d > 0 ? '+' : ''}{fmtMoney(d)}
                                        </span>
                                        {c.note && <span className="text-slate-500 truncate max-w-[180px]">{c.note}</span>}
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

// ============================================================
// E+F) CARD: REBAJAS Y AUMENTOS
// ============================================================
function PriceChangesCard({ business, period, data, unavailable }) {
    const changes = Array.isArray(data?.changes) ? data.changes : [];
    const totals = data?.totals || {};
    // El backend devuelve totals por negocio; cuando la tab es 'Todo' mostrar ambos negocios apilados
    const totalRows = Object.keys(totals).filter(k => k !== '_all');

    return (
        <div className="glass-card p-5 space-y-4">
            <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-violet-400 flex items-center gap-2">
                    <Scale className="w-4 h-4" /> Rebajas y Aumentos · {period}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                    Cambios de precio del período {business ? `(${BUSINESS_LABELS[business]})` : '(todos los negocios)'}
                </p>
            </div>

            {unavailable ? (
                <p className="text-xs text-slate-500">
                    Endpoint <span className="font-mono text-slate-400">/api/price-changes</span> aún no disponible (404). Mostrando vacío hasta que el backend lo habilite.
                </p>
            ) : (
                <>
                    <div className="overflow-x-auto">
                        {changes.length === 0 ? (
                            <p className="text-xs text-slate-500">Sin cambios de precio en el período.</p>
                        ) : (
                            <table className="w-full text-xs min-w-[680px]">
                                <thead>
                                    <tr className="text-left text-[10px] uppercase tracking-wider text-slate-400 border-b border-border">
                                        <th className="py-1.5 px-2">Fecha</th>
                                        <th className="py-1.5 px-2">Producto</th>
                                        <th className="py-1.5 px-2">Sede</th>
                                        <th className="py-1.5 px-2 text-right">Precio</th>
                                        <th className="py-1.5 px-2 text-right">Diff</th>
                                        <th className="py-1.5 px-2">Tipo</th>
                                        <th className="py-1.5 px-2">Usuario</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {changes.map((c, i) => {
                                        const isRebaja = String(c.change_type || '').toLowerCase() === 'rebaja' || num(c.diff) < 0;
                                        const isAumento = String(c.change_type || '').toLowerCase() === 'aumento' || num(c.diff) > 0;
                                        return (
                                            <tr key={i} className="border-b border-border/40 hover:bg-white/[0.02]">
                                                <td className="py-1.5 px-2 font-mono text-slate-400">{fmtDate(c.date)}</td>
                                                <td className="py-1.5 px-2">
                                                    <span className="font-mono text-slate-500">{c.sku ?? '—'}</span>
                                                    <span className="text-slate-200 ml-1.5">{c.name ?? ''}</span>
                                                </td>
                                                <td className="py-1.5 px-2 text-slate-300">{locationLabel(c.location_id, c.location_name)}</td>
                                                <td className="py-1.5 px-2 text-right font-mono text-slate-300">
                                                    $ {fmtMoney(c.old_price)} → $ {fmtMoney(c.new_price)}
                                                </td>
                                                <td className={`py-1.5 px-2 text-right font-mono font-semibold ${num(c.diff) < 0 ? 'text-rose-400' : num(c.diff) > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                                                    {num(c.diff) > 0 ? '+' : ''}{fmtMoney(c.diff)}
                </td>
                                                <td className="py-1.5 px-2">
                                                    {isRebaja ? (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-bold">
                                                            <TrendingDown className="w-3 h-3" /> REBAJA
                                                        </span>
                                                    ) : isAumento ? (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                                                            <TrendingUp className="w-3 h-3" /> AUMENTO
                                                        </span>
                                                    ) : (
                                                        <span className="px-2 py-0.5 rounded-full bg-secondary/60 text-slate-400 text-[10px] font-bold">—</span>
                                                    )}
                                                </td>
                                                <td className="py-1.5 px-2 text-slate-400">{c.user ?? '—'}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* Totales por negocio al pie */}
                    {totalRows.length > 0 && (
                        <div className="border-t border-border/50 pt-3">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5" /> Totales por negocio
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {totalRows.map((biz) => {
                                    const t = totals[biz] || {};
                                    return (
                                        <div key={biz} className="rounded-xl border border-border bg-secondary/20 p-3">
                                            <p className="text-xs font-bold text-slate-200 mb-1.5">{BUSINESS_LABELS[biz] || biz}</p>
                                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-mono">
                                                <span className="text-rose-400">Rebajas: {fmtInt(t.rebajas)}</span>
                                                <span className="text-emerald-400">Aumentos: {fmtInt(t.aumentos)}</span>
                                                <span className="text-rose-300">Monto: $ {fmtMoney(t.monto_rebajas)}</span>
                                                <span className="text-emerald-300">Monto: $ {fmtMoney(t.monto_aumentos)}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
