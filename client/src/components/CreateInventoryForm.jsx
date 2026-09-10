/**
 * CreateInventoryForm — formulario para crear un inventario nuevo desde el
 * selector "Inventario Activo" (espec docs/FASE_RESET_MULTIEMPRESA.md §2).
 *
 * POST /api/inventories { name, type: 'kiosk' | 'warehouse' }
 * Defensivo: 404 → mensaje "Backend sin soporte aún", sin crash.
 * TODO multi-empresa: el inventario se crea dentro de la empresa por defecto
 *   (Miss Chulerías). Cuando exista la entidad EMPRESA, habrá que pasar
 *   business/company_id explícito y ofrecer el selector de empresa.
 */
import { useState } from 'react';
import { X, RefreshCw, Store, Warehouse, AlertTriangle } from 'lucide-react';

import { apiCreateInventory } from '../lib/inventories';

const TYPES = [
    { value: 'kiosk', label: 'Punto de Venta', _Icon: Store, hint: 'Vende y se nutre del almacén' },
    { value: 'warehouse', label: 'Almacén', _Icon: Warehouse, hint: 'No vende: abastece los POS' }
];

export default function CreateInventoryForm({ open, onClose, onCreated, companyId }) {
    const [name, setName] = useState('');
    const [type, setType] = useState('kiosk');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    if (!open) return null;

    const submit = async (e) => {
        e?.preventDefault?.();
        if (!name.trim() || busy) return;
        setBusy(true);
        setError(null);
        try {
            const created = await apiCreateInventory(name, type, companyId);
            onCreated(created);
            setName('');
            setType('kiosk');
            onClose();
        } catch (err) {
            setError(err?.message || 'Error inesperado.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            data-testid="create-inventory-dialog"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <form
                onSubmit={submit}
                className="bg-slate-900 border border-slate-700 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4 text-slate-200"
            >
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <h3 className="font-bold text-base text-white">Nuevo Inventario</h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
                        aria-label="Cerrar"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="space-y-1.5">
                    <label className="text-xs uppercase font-semibold text-slate-400 tracking-wider">Nombre</label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ej: MCH 3, Depósito Norte…"
                        autoFocus
                        className="w-full bg-[#FFFFCC] border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                </div>

                <div className="space-y-1.5">
                    <label className="text-xs uppercase font-semibold text-slate-400 tracking-wider">Tipo</label>
                    <div className="grid grid-cols-2 gap-2">
                        {TYPES.map(({ value, label, _Icon, hint }) => (
                            <button
                                key={value}
                                type="button"
                                onClick={() => setType(value)}
                                className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-all ${
                                    type === value
                                        ? 'bg-violet-500/20 border-violet-500/50 text-white'
                                        : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:border-slate-600'
                                }`}
                            >
                                <_Icon className="w-5 h-5" />
                                <span className="text-xs font-semibold">{label}</span>
                                <span className="text-[9px] leading-tight text-center opacity-70">{hint}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {error && (
                    <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                        <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-red-200">{error}</p>
                    </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-medium transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={!name.trim() || busy}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white text-sm font-semibold shadow-lg shadow-violet-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                    >
                        {busy && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                        Crear
                    </button>
                </div>
            </form>
        </div>
    );
}