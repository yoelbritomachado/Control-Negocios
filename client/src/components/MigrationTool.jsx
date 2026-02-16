import React, { useState, useRef, useEffect } from 'react';
import { Database, Upload, CheckCircle, AlertCircle, Loader2, FileArchive, FolderOpen } from 'lucide-react';
import api from '../api';

export default function MigrationTool() {
    const [status, setStatus] = useState('idle'); // idle, checking, uploading, processing, success, error
    const [message, setMessage] = useState('');
    const [output, setOutput] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const [localFileExists, setLocalFileExists] = useState(false);
    const fileInputRef = useRef(null);

    // Check if local file exists on mount
    useEffect(() => {
        checkLocalFile();
    }, []);

    const checkLocalFile = async () => {
        setStatus('checking');
        try {
            const res = await api.get('/admin/check-mnx');
            if (res.data.exists) {
                setLocalFileExists(true);
                setMessage(`Archivo local encontrado: ${res.data.filename} (${res.data.size})`);
            }
        } catch (e) {
            // Silently fail - user can upload manually
        }
        setStatus('idle');
    };

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (!file.name.endsWith('.mnx')) {
                setStatus('error');
                setMessage('El archivo debe tener extensión .mnx');
                return;
            }
            setSelectedFile(file);
            setStatus('idle');
            setMessage('');
        }
    };

    const handleMigrateLocal = async () => {
        if (!confirm('¿Ejecutar migración con el archivo local backup.mnx?')) {
            return;
        }

        setStatus('processing');
        setMessage('Extrayendo y migrando datos...');

        try {
            // 1. Extract local file
            const extractRes = await api.post('/admin/extract-local-mnx');
            if (!extractRes.data.success) {
                throw new Error(extractRes.data.error || 'Error al extraer archivo');
            }

            // 2. Execute migration
            const migrateRes = await api.post('/admin/migrate-legacy');
            
            setStatus('success');
            setMessage('Migración completada exitosamente');
            setOutput(migrateRes.data.output || '');

        } catch (e) {
            setStatus('error');
            setMessage(e.response?.data?.error || e.message || 'Error en la migración');
            setOutput(e.response?.data?.details || '');
        }
    };

    const handleUploadAndMigrate = async () => {
        if (!selectedFile) {
            setStatus('error');
            setMessage('Selecciona un archivo .mnx primero');
            return;
        }

        if (!confirm('¿Estás seguro de ejecutar la migración? Esto importará los productos del sistema legacy.')) {
            return;
        }

        setStatus('uploading');
        setMessage('Subiendo archivo...');

        try {
            // 1. Upload file
            const formData = new FormData();
            formData.append('file', selectedFile);

            const uploadRes = await api.post('/admin/upload-mnx', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (!uploadRes.data.success) {
                throw new Error(uploadRes.data.error || 'Error al subir archivo');
            }

            setStatus('processing');
            setMessage('Extrayendo y migrando datos...');

            // 2. Execute migration
            const migrateRes = await api.post('/admin/migrate-legacy');
            
            setStatus('success');
            setMessage('Migración completada exitosamente');
            setOutput(migrateRes.data.output || '');
            setSelectedFile(null);

        } catch (e) {
            setStatus('error');
            setMessage(e.response?.data?.error || e.message || 'Error en la migración');
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
                            Importa productos desde el archivo .mnx del sistema anterior
                        </p>
                    </div>
                </div>

                <div className="space-y-4">
                    {/* Local File Option */}
                    {localFileExists && (
                        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                            <div className="flex items-center gap-3 mb-3">
                                <FolderOpen className="w-5 h-5 text-emerald-400" />
                                <span className="text-emerald-400 font-medium">Archivo local detectado</span>
                            </div>
                            <p className="text-sm text-emerald-300/70 mb-3">{message}</p>
                            <button
                                onClick={handleMigrateLocal}
                                disabled={status === 'processing'}
                                className="w-full py-2 px-4 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                            >
                                {status === 'processing' ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Migrando...
                                    </>
                                ) : (
                                    <>
                                        <Database className="w-4 h-4" />
                                        Usar Archivo Local
                                    </>
                                )}
                            </button>
                        </div>
                    )}

                    {/* Divider */}
                    {localFileExists && (
                        <div className="flex items-center gap-4">
                            <div className="flex-1 h-px bg-border/50"></div>
                            <span className="text-xs text-muted-foreground">O sube un archivo diferente</span>
                            <div className="flex-1 h-px bg-border/50"></div>
                        </div>
                    )}

                    {/* File Upload Area */}
                    <div 
                        className={`
                            border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
                            ${status === 'uploading' ? 'border-cyan-500 bg-cyan-500/5' : 'border-slate-700 hover:border-slate-500'}
                        `}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileSelect}
                            accept=".mnx"
                            className="hidden"
                        />
                        
                        {selectedFile ? (
                            <div className="flex flex-col items-center gap-2">
                                <FileArchive className="w-12 h-12 text-cyan-400" />
                                <p className="font-medium">{selectedFile.name}</p>
                                <p className="text-sm text-muted-foreground">
                                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                                </p>
                                <button 
                                    className="text-sm text-cyan-400 hover:underline mt-2"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedFile(null);
                                    }}
                                >
                                    Cambiar archivo
                                </button>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-2">
                                <Upload className="w-12 h-12 text-slate-500" />
                                <p className="font-medium">Click para seleccionar archivo .mnx</p>
                                <p className="text-sm text-muted-foreground">
                                    o arrastra y suelta aquí
                                </p>
                            </div>
                        )}
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
                        onClick={handleUploadAndMigrate}
                        disabled={!selectedFile || status === 'uploading' || status === 'processing'}
                        className="w-full py-3 px-4 bg-cyan-500 hover:bg-cyan-600 disabled:bg-cyan-500/50 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                    >
                        {status === 'uploading' ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Subiendo...
                            </>
                        ) : status === 'processing' ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Migrando...
                            </>
                        ) : (
                            <>
                                <Database className="w-5 h-5" />
                                Subir y Ejecutar Migración
                            </>
                        )}
                    </button>
                </div>
            </div>        </div>
    );
}
