import { useEffect, useMemo, useState } from 'react';
import { motion as Motion } from 'framer-motion';
import { X, DollarSign, Wallet, Loader2 } from 'lucide-react';

import api from '../api';

// Tasas de referencia (default) por divisa — se reemplazan con GET /api/settings
const CURRENCIES = [
    { code: 'USD', label: 'USD', rateKey: 'RATE_USD_MN', default: 550 },
    { code: 'EUR', label: 'EUR', rateKey: 'RATE_EUR_MN', default: 590 },
    { code: 'MXN', label: 'MXN', rateKey: 'RATE_MXN_MN', default: 17.30 },
];

const fmtMN = (value) => `$${Number(value || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MN`;

export default function CurrencyPurchaseModal({ open, onClose, onSaved }) {
    const [currency, setCurrency] = useState('USD');
    const [amount, setAmount] = useState('');
    const [costPerDivisa, setCostPerDivisa] = useState('');
    const [available, setAvailable] = useState(null);
    const [rates, setRates] = useState({});
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    // Al abrir: reset del formulario + carga de disponible y tasas
    useEffect(() => {
        if (!open) return;
        let cancelled = false;

        setCurrency('USD');
        setAmount('');
        setSaving(false);
        setError(null);
        setLoading(true);

        (async () => {
            try {
                const [cashRes, settingsRes] = await Promise.all([
                    api.get('/sessions/available-cash'),
                    api.get('/settings'),
                ]);
                if (cancelled) return;

                const availableValue = cashRes.data?.success ? (cashRes.data.available ?? 0) : (cashRes.data?.available ?? 0);
                setAvailable(availableValue);

                const settings = settingsRes.data || {};
                const nextRates = {};
                CURRENCIES.forEach(c => {
                    const parsed = parseFloat(settings[c.rateKey]);
                    nextRates[c.code] = Number.isFinite(parsed) ? parsed : c.default;
                });
                setRates(nextRates);
                setCostPerDivisa(String(nextRates.USD ?? CURRENCIES[0].default));
            } catch (err) {
                if (!cancelled) {
                    const status = err.response?.status;
                    if (status === 404 || /sesi/i.test(err.response?.data?.error || '')) {
                        setError('Abrí una sesión de ventas primero para registrar la compra de divisas.');
                    } else {
                        setError(err.response?.data?.error || err.message || 'No se pudo cargar el efectivo disponible.');
                    }
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, [open]);

    const numAmount = parseFloat(amount);
    const numCost = parseFloat(costPerDivisa);
    const total = useMemo(() => {
        if (!Number.isFinite(numAmount) || !Number.isFinite(numCost) || numAmount <= 0 || numCost <= 0) return 0;
        return Math.round(numAmount * numCost * 100) / 100;
    }, [numAmount, numCost]);

    const exceedsAvailable = Number.isFinite(total) && available !== null && total > available;
    const valid =
        !loading && !saving && Number.isFinite(numAmount) && numAmount > 0 &&
        Number.isFinite(numCost) && numCost > 0 && !exceedsAvailable && available !== null;

    const handleCurrencyChange = (code) => {
        setCurrency(code);
        // Costo editable con default de settings según divisa
        setCostPerDivisa(String(rates[code] ?? CURRENCIES.find(c => c.code === code)?.default ?? ''));
    };

    const handleSave = async () => {
        if (!valid) return;
        setSaving(true);
        setError(null);
        try {
            const res = await api.post('/currency-purchase', {
                amount_divisas: numAmount,
                cost_per_divisa: numCost,
                currency,
                payment_method: 'cash',
            });
            if (res.data?.success) {
                onSaved?.(res.data);
                onClose?.();
            } else {
                setError(res.data?.error || 'No se pudo registrar la compra de divisas.');
                setSaving(false);
            }
        } catch (err) {
            setError(err.response?.data?.error || err.message || 'No se pudo registrar la compra de divisas.');
            setSaving(false);
        }
    };

    if (!open) return null;

    return (
        <Motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <Motion.div
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

                <div className="p-6 space-y-5">
                    {/* Header */}
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                            <DollarSign className="w-7 h-7" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white">Compra de Divisas</h3>
                            <p className="text-sm text-muted-foreground">
                                Se descuenta del efectivo del turno
                            </p>
                        </div>
                    </div>

                    {/* Disponible */}
                    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                        <span className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Wallet className="w-4 h-4 text-cyan-400" />
                            Efectivo disponible
                        </span>
                        <span className="font-bold text-cyan-400">
                            {loading ? '...' : fmtMN(available)}
                        </span>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Cargando...
                        </div>
                    ) : (
                        <>
                            {/* Divisa */}
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-muted-foreground">Divisa</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {CURRENCIES.map(c => (
                                        <button
                                            key={c.code}
                                            type="button"
                                            onClick={() => handleCurrencyChange(c.code)}
                                            className={`py-2.5 rounded-xl text-sm font-semibold transition-all border ${
                                                currency === c.code
                                                    ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white border-transparent shadow-lg'
                                                    : 'bg-white/5 text-muted-foreground hover:text-white hover:bg-white/10 border-white/10'
                                            }`}
                                        >
                                            {c.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Cantidad */}
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-muted-foreground">
                                    Cantidad <span className="text-cyan-400">({currency})</span>
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    step="any"
                                    inputMode="decimal"
                                    value={amount}
                                    onChange={e => setAmount(e.target.value)}
                                    placeholder="0.00"
                                    className="w-full bg-slate-900/60 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30 transition-all"
                                />
                            </div>

                            {/* Costo por divisa */}
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-muted-foreground">
                                    Costo por divisa (MN)
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    inputMode="decimal"
                                    value={costPerDivisa}
                                    onChange={e => setCostPerDivisa(e.target.value)}
                                    placeholder="0.00"
                                    className="w-full bg-slate-900/60 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30 transition-all"
                                />
                            </div>

                            {/* Total calculado */}
                            <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 px-4 py-3">
                                <span className="text-sm font-medium text-muted-foreground">Total</span>
                                <span className="text-2xl font-bold text-white">{fmtMN(total)}</span>
                            </div>

                            {exceedsAvailable && (
                                <p className="text-sm text-rose-400">
                                    El total supera el efectivo disponible del turno.
                                </p>
                            )}

                            {error && (
                                <p className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-2.5">
                                    {error}
                                </p>
                            )}

                            {/* Acciones */}
                            <div className="flex gap-3 pt-1">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="flex-1 px-4 py-3 rounded-xl text-muted-foreground hover:text-white hover:bg-white/5 font-medium transition-all border border-white/10"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSave}
                                    disabled={!valid}
                                    className={`flex-1 px-4 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl font-semibold transition-all ${
                                        valid ? 'hover:shadow-lg hover:brightness-110' : 'opacity-50 cursor-not-allowed'
                                    }`}
                                >
                                    {saving ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <Loader2 className="w-4 h-4 animate-spin" /> Guardando...
                                        </span>
                                    ) : (
                                        'Guardar compra'
                                    )}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </Motion.div>
        </Motion.div>
    );
}