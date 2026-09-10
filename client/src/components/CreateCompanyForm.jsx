/**
 * CreateCompanyForm — mini-form para crear una empresa desde el selector
 * "Empresa" del Sidebar (docs/FASE_EMPRESAS_SELECTOR.md §2).
 * Campos: nombre (requerido) + logo opcional con preview (base64).
 * POST /api/companies → al crear, el Sidebar la selecciona como activa.
 * Defensivo: 404 → "Backend sin soporte aún", sin crash.
 * Regla Yoe: NO existe botón de eliminar empresa en ninguna parte.
 * TODO multi-empresa-nexus: la empresa creada será un nodo raíz del árbol Nexus.
 */
import { useState, useEffect } from 'react';
import { X, RefreshCw, Building2, AlertTriangle, ImagePlus } from 'lucide-react';

import { apiCreateCompany } from '../lib/companies';

const MAX_LOGO_BYTES = 300 * 1024; // 300KB, suficiente para un logo chico

export default function CreateCompanyForm({ open, onClose, onCreated }) {
    const [name, setName] = useState('');
    const [logo, setLogo] = useState(null); // dataURL base64
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (open) { setName(''); setLogo(null); setError(null); }
    }, [open]);

    if (!open) return null;

    const handleLogo = (e) => {
        const file = e.target?.files?.[0];
        if (!file) return;
        if (file.size > MAX_LOGO_BYTES) {
            setError('El logo es muy grande (máx 300KB).');
            return;
        }
        const reader = new FileReader();
        reader.onload = () => setLogo(String(reader.result || ''));
        reader.onerror = () => setError('No se pudo leer la imagen.');
        reader.readAsDataURL(file);
    };

    const submit = async (e) => {
        e?.preventDefault?.();
        if (!name.trim() || busy) return;
        setBusy(true);
        setError(null);
        try {
            const created = await apiCreateCompany(name, logo || undefined);
            onCreated(created, name.trim());
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
            data-testid="create-company-dialog"
            onClick={(ev) => { if (ev.target === ev.currentTarget) onClose(); }}
        >
            <form
                onSubmit={submit}
                className="bg-slate-900 border border-slate-700 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4 text-slate-200"
            >
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <h3 className="font-bold text-base text-white">Nueva Empresa</h3>
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
                        placeholder="Ej: Miss Chulerías, M&R…"
                        autoFocus
                        className="w-full bg-[#FFFFCC] border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                </div>

                <div className="space-y-1.5">
                    <label className="text-xs uppercase font-semibold text-slate-400 tracking-wider">Logo (opcional)</label>
                    <div className="flex items-center gap-3">
                        {logo ? (
                            <img
                                src={logo}
                                alt="Preview del logo"
                                className="w-12 h-12 rounded-xl object-contain bg-slate-800 border border-slate-600"
                                data-testid="company-logo-preview"
                            />
                        ) : (
                            <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-600 flex items-center justify-center text-slate-500">
                                <Building2 className="w-6 h-6" />
                            </div>
                        )}
                        <label className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 border border-slate-600 text-sm cursor-pointer hover:border-slate-500 transition-colors">
                            <ImagePlus className="w-4 h-4" />
                            Elegir imagen
                            <input type="file" accept="image/*" className="hidden" onChange={handleLogo} />
                        </label>
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
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white text-sm font-semibold shadow-lg shadow-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                    >
                        {busy && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                        Crear
                    </button>
                </div>
            </form>
        </div>
    );
}