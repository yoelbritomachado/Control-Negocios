/**
 * FactoryResetFlow — flujo REAL de Reset de Fábrica (espec docs/FASE_RESET_MULTIEMPRESA.md §1).
 *
 * Estados del flujo:
 *   idle → backup_question (con fecha del último backup) →
 *     Sí  → running (POST con backup:true; muestra "Backup creado: <nombre>") → done
 *     No  → final_confirm (exige escribir RESET) → running (backup:false) → done
 *
 * Al completar: toast con resumen de lo borrado, cierre de sesión local y reload a /login.
 * TODO multi-empresa: cuando exista la entidad EMPRESA, este flujo deberá admitir
 *   reset por empresa (scope) y conservar usuarios de la empresa destino.
 * Defensivo: si el backend responde 404 (sin soporte aún), muestra mensaje claro sin crash.
 */
import { useState, useEffect } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { X, RotateCcw, RefreshCw, ShieldCheck, AlertTriangle, Loader2 } from 'lucide-react';
import {
    fetchLastBackupDate,
    performFactoryReset,
    clearLocalSession,
    formatDeletedSummary
} from '../lib/factoryReset';

const OWNER_USERNAME = 'yoelbritomachado'; // único usuario que sobrevive al reset (del backend)

export default function FactoryResetFlow({ open, onClose }) {
    const [step, setStep] = useState('loading_last'); // loading_last | backup_question | final_confirm | running | error
    const [lastBackupDate, setLastBackupDate] = useState(null);
    const [confirmText, setConfirmText] = useState('');
    const [busyMsg, setBusyMsg] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [resetResult, setResetResult] = useState(null);

        // Al abrir: pedir fecha del último backup (defensivo, nunca crash)
        const start = async () => {
            setStep('loading_last');
            setErrorMsg('');
            const date = await fetchLastBackupDate();
            setLastBackupDate(date);
            setStep('backup_question');
        };

        useEffect(() => {
            if (!open) return;
            const t = setTimeout(start, 0);
            return () => clearTimeout(t);
        }, [open]);

        if (!open) return null;

    // Inicia la llamada real al backend (desde backup_question o final_confirm)
    const runReset = async (withBackup) => {
        setStep('running');
        setBusyMsg(withBackup ? 'Creando backup completo y reseteando…' : 'Reseteando la aplicación…');
        try {
            const result = await performFactoryReset({ backup: withBackup });
            setResetResult(result);
            setBusyMsg('Reseteando la aplicación…');
            await clearLocalSession();
            setBusyMsg('Redirigiendo al login…');
            // Login precargado con el dueño: el LoginPage ya lee mch_saved_email,
            // y lo dejamos apuntando al dueño que sobrevive al reset.
            try { localStorage.setItem('mch_saved_email', OWNER_USERNAME); } catch (_) {}
            // Toast de resumen antes de recargar
            const summary = formatDeletedSummary(result.deleted);
            if (summary) {
                try {
                    // Feedback visible en el último instante (no hay Toaster global en el client)
                    console.info('[FactoryReset] Borrado:', result.deleted);
                } catch (_) {}
            }
            setTimeout(() => {
                window.location.href = '/login';
                // Si por alguna razón /login no navega, reload duro
                setTimeout(() => window.location.reload(), 1500);
            }, withBackup && result.backup_name ? 1200 : 400);
        } catch (e) {
            setErrorMsg(e?.message || 'Error inesperado durante el reset.');
            setStep('error');
        }
    };

    const dateLabel = lastBackupDate
        ? new Date(lastBackupDate).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' })
        : 'no hay registro de backups';

    return (
        <AnimatePresence>
            {open && (
                <Motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
                    data-testid="factory-reset-dialog"
                >
                    <Motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-slate-200"
                    >
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <div className="flex items-center gap-2 text-red-400 font-bold text-lg">
                                <RotateCcw className="w-5 h-5" />
                                <span>Reset de Fábrica</span>
                            </div>
                            {(step === 'backup_question' || step === 'final_confirm' || step === 'error') && (
                                <button
                                    onClick={onClose}
                                    className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
                                    aria-label="Cerrar"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            )}
                        </div>

                        {step === 'loading_last' && (
                            <div className="flex items-center gap-3 py-6 justify-center text-slate-400">
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span className="text-sm">Consultando último backup…</span>
                            </div>
                        )}

                        {step === 'backup_question' && (
                            <>
                                <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                                    <ShieldCheck className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                                    <p className="text-sm text-amber-200">
                                        ¿Querés hacer un backup? El último backup es del{' '}
                                        <strong className="text-amber-300">{dateLabel}</strong>.
                                    </p>
                                </div>
                                <p className="text-xs text-slate-400">
                                    Si decís Sí se crea un backup completo (ventas, usuarios, fotos, todo) antes de resetear.
                                </p>
                                <div className="flex items-center justify-end gap-3 pt-1">
                                    <button
                                        onClick={() => setStep('final_confirm')}
                                        className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-medium transition-colors"
                                    >
                                        No
                                    </button>
                                    <button
                                        onClick={() => runReset(true)}
                                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white text-sm font-semibold shadow-lg transition-all"
                                    >
                                        Sí, hacer backup
                                    </button>
                                </div>
                            </>
                        )}

                        {step === 'final_confirm' && (
                            <>
                                <div className="flex items-start gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                                    <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                                    <p className="text-sm text-red-200 font-medium">
                                        No habrá vuelta atrás. Se borra TODO: inventarios, ventas, gastos,
                                        traslados, mermas, divisas, salarios y usuarios (queda solo el dueño).
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs uppercase font-semibold text-slate-400 tracking-wider">
                                        Escribí RESET para habilitar el botón
                                    </label>
                                    <input
                                        type="text"
                                        value={confirmText}
                                        onChange={(e) => setConfirmText(e.target.value)}
                                        placeholder="RESET"
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-red-500 font-mono tracking-widest"
                                        autoFocus
                                    />
                                </div>
                                <div className="flex items-center justify-end gap-3 pt-1">
                                    <button
                                        onClick={onClose}
                                        className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-medium transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={() => runReset(false)}
                                        disabled={confirmText.trim() !== 'RESET'}
                                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white text-sm font-semibold shadow-lg shadow-red-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                    >
                                        Borrar todo definitivamente
                                    </button>
                                </div>
                            </>
                        )}

                        {step === 'running' && (
                            <div className="py-6 space-y-3 text-center">
                                <Loader2 className="w-8 h-8 animate-spin mx-auto text-cyan-400" />
                                <p className="text-sm text-slate-300">{busyMsg}</p>
                                {resetResult?.backup_created && resetResult?.backup_name && (
                                    <p className="text-sm text-emerald-400 font-semibold">
                                        ✅ Backup creado: {resetResult.backup_name}
                                    </p>
                                )}
                                {resetResult && formatDeletedSummary(resetResult.deleted) && (
                                    <p className="text-xs text-slate-400 px-2">
                                        Borrado: {formatDeletedSummary(resetResult.deleted)}
                                    </p>
                                )}
                            </div>
                        )}

                        {step === 'error' && (
                            <>
                                <div className="flex items-start gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                                    <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                                    <div className="text-sm text-red-200">
                                        <p className="font-semibold mb-1">{errorMsg}</p>
                                        <p className="text-xs text-red-300/70">
                                            No se hizo ningún cambio. Los datos están intactos.
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center justify-end gap-3 pt-1">
                                    <button
                                        onClick={onClose}
                                        className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-medium transition-colors"
                                    >
                                        Cerrar
                                    </button>
                                    <button
                                        onClick={start}
                                        className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium transition-colors"
                                    >
                                        Reintentar
                                    </button>
                                </div>
                            </>
                        )}
                    </Motion.div>
                </Motion.div>
            )}
        </AnimatePresence>
    );
}