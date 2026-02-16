import React, { useState } from 'react';
import { Database, Upload, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import api from '../api';

export default function MigrationTool() {
    const [status, setStatus] = useState('idle'); // idle, uploading, processing, success, error
    const [message, setMessage] = useState('');
    const [output, setOutput] = useState('');

    const handleMigrate = async () => {
        if (!confirm('¿Estás seguro de ejecutar la migración? Esto importará los productos del sistema legacy.')) {
            return;
        }
        
        setStatus('processing');
        setMessage('Ejecutando migración...');
        
        try {
            const res = await api.post('/admin/migrate-legacy');
            setStatus('success');
            setMessage('Migración completada exitosamente');
            setOutput(res.data.output || '');
        } catch (e) {
            setStatus('error');
            setMessage(e.response?.data?.error || 'Error en la migración');
            setOutput(e.response?.data?.details || '');
        }
    };

    return (
        <div className="p-6 max-w-2xl mx-auto">
            <div className="bg-card/50 rounded-2xl border border-border/50 p-6 space-y-6">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                        <Database className="w-6 h-6 text-cyan-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold">Migración de Datos Legacy</h2>
                        <p className="text-sm text-muted-foreground">
                            Importa productos desde el sistema .mnx anterior
                        </p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-700">
                        <h3 className="font-semibold mb-2 flex items-center gap-2">
                            <Upload className="w-4 h-4" />
                            Requisitos
                        </h3>
                        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                            <li>Archivo <code>backup_legacy.db</code> en /uploads</li>
                            <li>Imágenes extraídas en <code>/uploads/temp_mnx/</code></li>
                            <li>Permisos de administrador</li>
                        </ul>
                    </div>

                    {status === 'success' && (
                        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3">
                            <CheckCircle className="w-5 h-5 text-emerald-400 mt-0.5" />
                            <div>
                                <p className="text-emerald-400 font-medium">{message}</p>
                                {output && (
                                    <pre className="mt-2 text-xs text-emerald-300/70 bg-emerald-950/30 p-3 rounded-lg overflow-auto max-h-60">
                                        {output}
                                    </pre>
                                )}
                            </div>
                        </div>
                    )}

                    {status === 'error' && (
                        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-rose-400 mt-0.5" />
                            <div>
                                <p className="text-rose-400 font-medium">{message}</p>
                                {output && (
                                    <pre className="mt-2 text-xs text-rose-300/70 bg-rose-950/30 p-3 rounded-lg overflow-auto max-h-60">
                                        {output}
                                    </pre>
                                )}
                            </div>
                        </div>
                    )}

                    <button
                        onClick={handleMigrate}
                        disabled={status === 'processing'}
                        className="w-full py-3 px-4 bg-cyan-500 hover:bg-cyan-600 disabled:bg-cyan-500/50 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                    >
                        {status === 'processing' ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Procesando...
                            </>
                        ) : (
                            <>
                                <Database className="w-5 h-5" />
                                Ejecutar Migración
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
