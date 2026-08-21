import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    RotateCcw,
    AlertTriangle,
    CheckCircle2,
    X,
    Package,
    ArrowRight,
    Loader2,
    ShieldAlert
} from 'lucide-react';
import api from '../api';

const INVENTORY_LABELS = {
    mch1: 'MCH 1',
    mch2: 'MCH 2',
    alm: 'Almacén MCH'
};

export default function TransferReversalModal({ transferId, onClose, onSuccess }) {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [reversalMode, setReversalMode] = useState('available_only'); // 'available_only' | 'force_total'
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!transferId) return;
        fetchCheckData();
    }, [transferId]);

    const fetchCheckData = async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await api.get(`/transfers/${transferId}/reversal-check`);
            setData(res.data);
            if (res.data.canFullReverse) {
                setReversalMode('available_only');
            }
        } catch (err) {
            console.error('Error fetching reversal check:', err);
            setError(err.response?.data?.error || err.message || 'Error al verificar traslado');
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmRevert = async () => {
        try {
            setSubmitting(true);
            const mode = data?.canFullReverse ? 'standard' : reversalMode;
            const res = await api.post(`/transfers/${transferId}/revert`, {
                mode,
                reason
            });

            if (res.data.success) {
                alert('Traslado revertido exitosamente.');
                if (onSuccess) onSuccess(res.data);
                onClose();
            }
        } catch (err) {
            alert('Error al revertir traslado: ' + (err.response?.data?.error || err.message));
        } finally {
            setSubmitting(false);
        }
    };

    if (!transferId) return null;

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="glass rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-border/50 shadow-2xl relative"
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-border/50 pb-4 mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-xl bg-purple-500/20 text-purple-400">
                            <RotateCcw className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">Revertir / Cancelar Traslado #{transferId}</h2>
                            <p className="text-xs text-muted-foreground">
                                Verificación de existencias y devolución de mercancía
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
                        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
                        <p className="text-sm">Verificando stock actual en destino...</p>
                    </div>
                ) : error ? (
                    <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-center py-6">
                        <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-80" />
                        <p className="font-semibold">{error}</p>
                    </div>
                ) : data ? (
                    <div className="space-y-5">
                        {/* Summary Pill */}
                        <div className="p-4 rounded-xl bg-secondary/30 flex items-center justify-between text-sm">
                            <div>
                                <span className="text-muted-foreground">Origen → Destino: </span>
                                <span className="font-semibold text-foreground">
                                    {INVENTORY_LABELS[data.source_inventory] || data.source_inventory}
                                    {' → '}
                                    {INVENTORY_LABELS[data.target_inventory] || data.target_inventory}
                                </span>
                            </div>
                            <div>
                                <span className="text-muted-foreground">Estado actual: </span>
                                <span className={`font-semibold px-2 py-0.5 rounded-full text-xs ${
                                    data.status === 'received' 
                                        ? 'bg-green-500/20 text-green-400' 
                                        : 'bg-amber-500/20 text-amber-400'
                                }`}>
                                    {data.status === 'received' ? 'Recibido' : 'Pendiente'}
                                </span>
                            </div>
                        </div>

                        {/* Items Breakdown Table */}
                        <div>
                            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                                <Package className="w-4 h-4 text-purple-400" />
                                Productos del Traslado y Existencias
                            </h3>
                            <div className="rounded-xl border border-border/50 overflow-hidden text-xs">
                                <table className="w-full text-left">
                                    <thead className="bg-secondary/40 border-b border-border/50">
                                        <tr>
                                            <th className="p-2.5 font-medium">Producto</th>
                                            <th className="p-2.5 font-medium text-center">Trasladado</th>
                                            <th className="p-2.5 font-medium text-center">Disp. en Destino</th>
                                            <th className="p-2.5 font-medium text-center">Vendido / Faltante</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/30">
                                        {data.items.map((item) => (
                                            <tr key={item.id} className="hover:bg-secondary/20">
                                                <td className="p-2.5 font-medium">
                                                    {item.product_name}
                                                    {item.product_code && <span className="text-muted-foreground ml-1">({item.product_code})</span>}
                                                </td>
                                                <td className="p-2.5 text-center font-bold text-foreground">
                                                    {item.transfer_quantity}
                                                </td>
                                                <td className="p-2.5 text-center font-bold text-green-400">
                                                    {item.available_to_return}
                                                </td>
                                                <td className={`p-2.5 text-center font-bold ${item.sold_or_missing > 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
                                                    {item.sold_or_missing}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Warnings & Mode Selector */}
                        {data.anyShortage ? (
                            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-3">
                                <div className="flex items-start gap-3">
                                    <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-semibold text-amber-300">
                                            Aviso de unidades vendidas en destino
                                        </p>
                                        <p className="text-xs text-amber-200/80 mt-1">
                                            Algunos productos ya se vendieron o tienen menos stock disponible en el destino del que fue trasladado originalmente. Selección de modo de devolución:
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-2 pt-2 text-xs">
                                    <label className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                                        reversalMode === 'available_only' 
                                            ? 'bg-purple-500/10 border-purple-500/50 text-foreground' 
                                            : 'bg-secondary/20 border-border/40 hover:bg-secondary/40 text-muted-foreground'
                                    }`}>
                                        <input
                                            type="radio"
                                            name="reversal_mode"
                                            value="available_only"
                                            checked={reversalMode === 'available_only'}
                                            onChange={() => setReversalMode('available_only')}
                                            className="mt-0.5 accent-purple-500"
                                        />
                                        <div>
                                            <p className="font-semibold text-foreground">Devolver solo lo disponible (Recomendado)</p>
                                            <p className="text-muted-foreground mt-0.5">
                                                Se devolverán las unidades disponibles al origen sin generar números negativos en el destino. Las unidades ya vendidas quedarán asentadas.
                                            </p>
                                        </div>
                                    </label>

                                    <label className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                                        reversalMode === 'force_total' 
                                            ? 'bg-red-500/10 border-red-500/50 text-foreground' 
                                            : 'bg-secondary/20 border-border/40 hover:bg-secondary/40 text-muted-foreground'
                                    }`}>
                                        <input
                                            type="radio"
                                            name="reversal_mode"
                                            value="force_total"
                                            checked={reversalMode === 'force_total'}
                                            onChange={() => setReversalMode('force_total')}
                                            className="mt-0.5 accent-red-500"
                                        />
                                        <div>
                                            <p className="font-semibold text-foreground">Forzar devolución total (Permite stock negativo)</p>
                                            <p className="text-muted-foreground mt-0.5">
                                                Devuelve todas las unidades originales al origen. Si en el destino no hay suficiente stock, quedará en negativo para posterior ajuste de inventario.
                                            </p>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        ) : (
                            <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/30 flex items-center gap-3 text-xs text-green-300">
                                <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
                                <span>
                                    Todas las unidades del traslado están disponibles en el destino y serán restituidas al inventario de origen.
                                </span>
                            </div>
                        )}

                        {/* Reason / Notes */}
                        <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1">
                                Motivo o nota de la reversión (opcional):
                            </label>
                            <input
                                type="text"
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder="Ej: Error al ingresar traslado / Corrección de inventario..."
                                className="w-full px-3 py-2 text-xs rounded-xl bg-secondary/40 border border-border/50 focus:outline-none focus:border-purple-500"
                            />
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/50">
                            <button
                                onClick={onClose}
                                disabled={submitting}
                                className="px-4 py-2 rounded-xl text-xs font-medium bg-secondary hover:bg-secondary/80 text-foreground transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleConfirmRevert}
                                disabled={submitting}
                                className="px-4 py-2 rounded-xl text-xs font-medium bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-500/20 transition-all flex items-center gap-2"
                            >
                                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                Confirmar Reversión
                            </button>
                        </div>
                    </div>
                ) : null}
            </motion.div>
        </div>
    );
}
