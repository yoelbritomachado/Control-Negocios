import React, { useState, useRef, useEffect } from 'react';
import { 
    Database, Upload, CheckCircle, AlertCircle, Loader2, FileArchive, 
    FolderOpen, RefreshCw, Layers, Store, ArrowRight, ShieldAlert,
    Check, X, ChevronRight, FileSpreadsheet, Package, ShoppingCart, 
    ArrowLeftRight, Trash2, Sliders, Info
} from 'lucide-react';
import api from '../api';

const TARGET_INVENTORIES = [
    { id: 'alm', name: 'Almacén MCH', isWarehouse: true, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30' },
    { id: 'mch1', name: 'MCH 1 (Kiosco 1)', isWarehouse: false, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
    { id: 'mch2', name: 'MCH 2 (Kiosco 2)', isWarehouse: false, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' }
];

const buildDefaultNewInventoryName = (source) => {
    const name = (source?.name || source?.dbFile || 'Inventario importado').replace(/\.db$/i, '').trim();
    return name || 'Inventario importado';
};

export default function MigrationTool() {
    // MNX Inspector State
    const [mnxData, setMnxData] = useState(null);
    const [loadingMnx, setLoadingMnx] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const fileInputRef = useRef(null);

    // Modular Configurations State: Map of dbFile -> { enabled, targetInventoryId, importInventory, importSales, importPurchases, importLosses }
    const [modularConfigs, setModularConfigs] = useState({});
    
    // Execution State
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState(null);
    const [importError, setImportError] = useState(null);

    // Initial check
    useEffect(() => {
        fetchMnxStatus();
    }, []);

    const fetchMnxStatus = async () => {
        setLoadingMnx(true);
        setImportError(null);
        try {
            const res = await api.get('/admin/check-mnx');
            if (res.data.exists) {
                setMnxData(res.data);
                initDefaultConfigs(res.data.sources || []);
            } else {
                setMnxData(null);
            }
        } catch (e) {
            console.error("Error al obtener estado MNX:", e);
            setImportError(e.response?.data?.error || e.message);
        } finally {
            setLoadingMnx(false);
        }
    };

    const initDefaultConfigs = (sources) => {
        const initial = {};
        sources.forEach(src => {
            const isMCH = src.company === 'Miss Chulerías';
            const isWarehouse = src.isWarehouse;

            initial[src.dbFile] = {
                enabled: true, // Activar todos por defecto para que el usuario elija
                dbFile: src.dbFile,
                sourceName: src.name,
                sourceCompany: src.company,
                isWarehouse: isWarehouse,
                importMode: 'replace',
                createInventoryName: buildDefaultNewInventoryName(src),
                targetInventoryId: src.suggestedTarget, // 'alm', 'mch1', 'mch2'
                importInventory: true,
                importSales: !isWarehouse && src.stats.sales > 0,
                importPurchases: src.stats.purchases > 0,
                importLosses: src.stats.losses > 0
            };
        });
        setModularConfigs(initial);
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.name.endsWith('.mnx')) {
            alert('El archivo debe tener extensión .mnx');
            return;
        }

        setSelectedFile(file);
        setLoadingMnx(true);
        setImportError(null);
        setImportResult(null);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await api.post('/admin/mnx/upload-inspect', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            if (res.data.sources) {
                setMnxData(res.data);
                initDefaultConfigs(res.data.sources);
            }
        } catch (err) {
            setImportError(err.response?.data?.error || err.message || 'Error al procesar el archivo MNX');
        } finally {
            setLoadingMnx(false);
        }
    };

    const toggleSourceEnabled = (dbFile) => {
        setModularConfigs(prev => ({
            ...prev,
            [dbFile]: {
                ...prev[dbFile],
                enabled: !prev[dbFile]?.enabled
            }
        }));
    };

    const updateTargetInventory = (dbFile, targetId) => {
        const isWarehouse = targetId === 'alm';
        setModularConfigs(prev => ({
            ...prev,
            [dbFile]: {
                ...prev[dbFile],
                targetInventoryId: targetId,
                // Si el destino es Almacén, deshabilitar forzosamente las ventas
                importSales: isWarehouse ? false : prev[dbFile]?.importSales
            }
        }));
    };

    const updateImportMode = (dbFile, importMode) => {
        setModularConfigs(prev => {
            const current = prev[dbFile] || {};
            const isCreateWarehouse = importMode === 'create' && current.isWarehouse;
            return {
                ...prev,
                [dbFile]: {
                    ...current,
                    importMode,
                    importSales: isCreateWarehouse ? false : current.importSales,
                    createInventoryName: current.createInventoryName || current.sourceName || 'Inventario importado'
                }
            };
        });
    };

    const updateCreateInventoryName = (dbFile, name) => {
        setModularConfigs(prev => ({
            ...prev,
            [dbFile]: {
                ...prev[dbFile],
                createInventoryName: name
            }
        }));
    };

    const toggleModule = (dbFile, moduleKey) => {
        setModularConfigs(prev => {
            const current = prev[dbFile];
            // Prohibir activar ventas si el destino es Almacén
            if (moduleKey === 'importSales' && current.targetInventoryId === 'alm') {
                return prev;
            }
            return {
                ...prev,
                [dbFile]: {
                    ...current,
                    [moduleKey]: !current[moduleKey]
                }
            };
        });
    };

    const handleExecuteModularImport = async () => {
        const activeConfigs = Object.values(modularConfigs).filter(c => c.enabled);

        if (activeConfigs.length === 0) {
            alert('Selecciona al menos una sucursal/base de datos para importar.');
            return;
        }

        // Resumen de lo que se va a sobreescribir
        const lines = activeConfigs.map(c => {
            const targetName = c.importMode === 'create'
                ? `Nuevo inventario: ${c.createInventoryName || c.sourceName}`
                : (TARGET_INVENTORIES.find(t => t.id === c.targetInventoryId)?.name || c.targetInventoryId);
            const modules = [];
            if (c.importInventory) modules.push('Inventario');
            if (c.importSales) modules.push('Ventas');
            if (c.importPurchases) modules.push('Compras');
            if (c.importLosses) modules.push('Mermas');
            return `• "${c.sourceName}" ➡️ ${c.importMode === 'create' ? 'Crea' : 'Sobreescribe'} [${targetName}] (${modules.join(', ') || 'Ninguno'})`;
        }).join('\n');

        const confirmed = window.confirm(
            `⚠️ ATENCIÓN: IMPORTACIÓN MODULAR MNX\n\n` +
            `Se realizarán las siguientes operaciones:\n${lines}\n\n` +
            `Se creará automáticamente un respaldo de seguridad antes de comenzar.\n¿Deseas continuar?`
        );

        if (!confirmed) return;

        setImporting(true);
        setImportError(null);
        setImportResult(null);

        try {
            const res = await api.post('/admin/mnx/import-modular', {
                mnxPath: mnxData?.path,
                configs: activeConfigs
            });

            setImportResult(res.data);
            alert(`✅ ${res.data.message}\n\n• Respaldo de seguridad creado: ${res.data.summary?.safetyBackup}\n• Ventas desglosadas importadas: ${res.data.summary?.totalSalesImported} (${res.data.summary?.totalSalesItemsImported} productos)\n• Compras desglosadas importadas: ${res.data.summary?.totalPurchasesImported}\n• Mermas importadas: ${res.data.summary?.totalLossesImported}`);
        } catch (err) {
            setImportError(err.response?.data?.error || err.message || 'Error durante la importación');
        } finally {
            setImporting(false);
        }
    };

    // Agrupar fuentes
    const sourcesList = mnxData?.sources || [];

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-purple-950 to-slate-900 border border-purple-500/20 p-6 rounded-2xl shadow-xl">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                        <Database className="w-7 h-7 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                            Centro de Importación y Migración MNX
                        </h1>
                        <p className="text-sm text-slate-300">
                            Carga respaldos .mnx y decidí si cada origen sobreescribe un inventario MCH o crea uno nuevo con su historial
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchMnxStatus}
                        disabled={loadingMnx || importing}
                        className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium border border-slate-700 transition-colors flex items-center gap-2"
                        title="Recargar archivo detectado"
                    >
                        <RefreshCw className={`w-4 h-4 ${loadingMnx ? 'animate-spin text-cyan-400' : ''}`} />
                        <span>Actualizar</span>
                    </button>

                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={loadingMnx || importing}
                        className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white text-sm font-semibold shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-2"
                    >
                        <Upload className="w-4 h-4" />
                        <span>Cargar otro .mnx</span>
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        accept=".mnx"
                        className="hidden"
                    />
                </div>
            </div>

            {/* Error Message */}
            {importError && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-400" />
                    <div>
                        <div className="font-semibold">Error en la operación</div>
                        <div className="text-sm mt-0.5">{importError}</div>
                    </div>
                </div>
            )}

            {/* Success Result Summary */}
            {importResult && (
                <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 space-y-3">
                    <div className="flex items-center gap-2 text-base font-bold text-emerald-400">
                        <CheckCircle className="w-5 h-5" />
                        <span>{importResult.message}</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs">
                        <div className="p-3 bg-slate-900/80 rounded-xl border border-emerald-500/20">
                            <span className="text-slate-400 block">Respaldo de seguridad:</span>
                            <span className="font-semibold text-white">{importResult.summary?.safetyBackup}</span>
                        </div>
                        <div className="p-3 bg-slate-900/80 rounded-xl border border-emerald-500/20">
                            <span className="text-slate-400 block">Ventas Desglosadas:</span>
                            <span className="font-semibold text-emerald-400 text-sm">
                                {importResult.summary?.totalSalesImported} ventas ({importResult.summary?.totalSalesItemsImported} items)
                            </span>
                        </div>
                        <div className="p-3 bg-slate-900/80 rounded-xl border border-emerald-500/20">
                            <span className="text-slate-400 block">Compras / Entradas:</span>
                            <span className="font-semibold text-cyan-400 text-sm">
                                {importResult.summary?.totalPurchasesImported} ({importResult.summary?.totalPurchasesItemsImported} items)
                            </span>
                        </div>
                        <div className="p-3 bg-slate-900/80 rounded-xl border border-emerald-500/20">
                            <span className="text-slate-400 block">Mermas:</span>
                            <span className="font-semibold text-amber-400 text-sm">
                                {importResult.summary?.totalLossesImported} bajas
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* File Info Bar */}
            {mnxData ? (
                <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-xs">
                    <div className="flex items-center gap-2 text-slate-300">
                        <FileArchive className="w-4 h-4 text-cyan-400" />
                        <span>Archivo cargado: <strong className="text-white">{mnxData.filename}</strong> ({mnxData.size})</span>
                        <span className="text-slate-500">|</span>
                        <span>{mnxData.totalDbFiles} bases de datos internas</span>
                        <span className="text-slate-500">|</span>
                        <span>{mnxData.totalImages} imágenes de productos</span>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                        Listo para seleccionar y sobreescribir
                    </span>
                </div>
            ) : (
                <div className="p-8 text-center rounded-2xl border-2 border-dashed border-slate-800 bg-slate-900/40 space-y-3">
                    <FileArchive className="w-12 h-12 text-slate-600 mx-auto" />
                    <h3 className="text-base font-semibold text-slate-300">No se ha cargado ningún archivo MNX</h3>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                        Haz clic en "Cargar otro .mnx" para seleccionar el respaldo desde tu equipo y configurar la migración.
                    </p>
                </div>
            )}

            {/* Panel de Configuración Modular por Sucursal */}
            {mnxData && (
                <div className="space-y-6">
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-cyan-400"></div>
                                <h2 className="text-lg font-bold text-white uppercase tracking-wider">
                                    📦 Fuentes detectadas en el respaldo ({sourcesList.length} bases de datos)
                                </h2>
                            </div>
                            <span className="text-xs text-slate-400">
                                Asigná cada origen al inventario MCH que quieras sobreescribir, o crealo como inventario nuevo
                            </span>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            {sourcesList.map((source) => {
                                const cfg = modularConfigs[source.dbFile] || {};
                                const isEnabled = cfg.enabled;
                                const isWarehouse = cfg.importMode === 'create' ? cfg.isWarehouse : cfg.targetInventoryId === 'alm';

                                return (
                                    <div
                                        key={source.dbFile}
                                        className={`rounded-2xl border transition-all duration-300 overflow-hidden ${
                                            isEnabled
                                                ? 'bg-slate-900/90 border-cyan-500/40 shadow-lg shadow-cyan-950/20'
                                                : 'bg-slate-900/30 border-slate-800 opacity-60'
                                        }`}
                                    >
                                        <div className="p-5 space-y-4">
                                            {/* Header de la sucursal origen */}
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                                                <div className="flex items-start sm:items-center gap-3">
                                                    <input
                                                        type="checkbox"
                                                        checked={isEnabled}
                                                        onChange={() => toggleSourceEnabled(source.dbFile)}
                                                        className="w-5 h-5 mt-0.5 sm:mt-0 rounded text-cyan-500 focus:ring-cyan-500 bg-slate-800 border-slate-700 cursor-pointer"
                                                    />
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold text-base text-white">
                                                                {source.name}
                                                            </span>
                                                            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                                                                {source.dbFile}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-slate-400">
                                                            Detectado: {source.stats.products} productos | {source.stats.sales} ventas ({source.stats.salesItems} renglones) | {source.stats.purchases} compras | {source.stats.losses} mermas
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Selector de modo y destino */}
                                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-slate-950/80 p-2 rounded-xl border border-slate-800">
                                                    <span className="text-xs font-semibold text-slate-400 whitespace-nowrap flex items-center gap-1">
                                                        <ArrowRight className="w-3.5 h-3.5 text-cyan-400" />
                                                        Acción:
                                                    </span>
                                                    <select
                                                        value={cfg.importMode || 'replace'}
                                                        onChange={(e) => updateImportMode(source.dbFile, e.target.value)}
                                                        disabled={!isEnabled}
                                                        className="bg-slate-900 text-white text-xs font-medium rounded-lg px-3 py-1.5 border border-slate-700 focus:outline-none focus:border-cyan-500 cursor-pointer"
                                                    >
                                                        <option value="replace">Sobreescribir existente</option>
                                                        <option value="create">Crear inventario nuevo</option>
                                                    </select>
                                                    {(cfg.importMode || 'replace') === 'create' ? (
                                                        <input
                                                            type="text"
                                                            value={cfg.createInventoryName || ''}
                                                            onChange={(e) => updateCreateInventoryName(source.dbFile, e.target.value)}
                                                            disabled={!isEnabled}
                                                            placeholder="Nombre del inventario nuevo"
                                                            className="bg-slate-900 text-white text-xs font-medium rounded-lg px-3 py-1.5 border border-slate-700 focus:outline-none focus:border-cyan-500 min-w-[180px]"
                                                        />
                                                    ) : (
                                                        <select
                                                            value={cfg.targetInventoryId || 'mch1'}
                                                            onChange={(e) => updateTargetInventory(source.dbFile, e.target.value)}
                                                            disabled={!isEnabled}
                                                            className="bg-slate-900 text-white text-xs font-medium rounded-lg px-3 py-1.5 border border-slate-700 focus:outline-none focus:border-cyan-500 cursor-pointer"
                                                        >
                                                            {TARGET_INVENTORIES.map(t => (
                                                                <option key={t.id} value={t.id}>
                                                                    {t.name}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Opciones Modulares de Sobreescritura */}
                                            {isEnabled && (
                                                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-1">
                                                    {/* Módulo 1: Inventario */}
                                                    <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                                                        cfg.importInventory
                                                            ? 'bg-blue-500/10 border-blue-500/30 text-blue-200'
                                                            : 'bg-slate-950/40 border-slate-800/80 text-slate-400'
                                                    }`}>
                                                        <input
                                                            type="checkbox"
                                                            checked={cfg.importInventory}
                                                            onChange={() => toggleModule(source.dbFile, 'importInventory')}
                                                            className="w-4 h-4 mt-0.5 rounded text-blue-500 focus:ring-blue-500 bg-slate-800 border-slate-700"
                                                        />
                                                        <div className="text-xs space-y-0.5">
                                                            <div className="font-semibold flex items-center gap-1.5">
                                                                <Package className="w-3.5 h-3.5 text-blue-400" />
                                                                <span>Catálogo y Stock</span>
                                                            </div>
                                                            <div className="text-[11px] opacity-75">
                                                                {source.stats.products} productos
                                                            </div>
                                                        </div>
                                                    </label>

                                                    {/* Módulo 2: Ventas */}
                                                    <label className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${
                                                        isWarehouse 
                                                            ? 'opacity-40 bg-slate-950/20 border-slate-800 cursor-not-allowed'
                                                            : cfg.importSales
                                                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200 cursor-pointer'
                                                                : 'bg-slate-950/40 border-slate-800/80 text-slate-400 cursor-pointer'
                                                    }`}>
                                                        <input
                                                            type="checkbox"
                                                            checked={cfg.importSales}
                                                            disabled={isWarehouse}
                                                            onChange={() => toggleModule(source.dbFile, 'importSales')}
                                                            className="w-4 h-4 mt-0.5 rounded text-emerald-500 focus:ring-emerald-500 bg-slate-800 border-slate-700"
                                                        />
                                                        <div className="text-xs space-y-0.5">
                                                            <div className="font-semibold flex items-center gap-1.5">
                                                                <ShoppingCart className="w-3.5 h-3.5 text-emerald-400" />
                                                                <span>Ventas Desglosadas</span>
                                                            </div>
                                                            <div className="text-[11px] opacity-75">
                                                                {isWarehouse ? 'No aplica (Almacén)' : `${source.stats.sales} ventas (${source.stats.salesItems} items)`}
                                                            </div>
                                                        </div>
                                                    </label>

                                                    {/* Módulo 3: Compras */}
                                                    <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                                                        cfg.importPurchases
                                                            ? 'bg-purple-500/10 border-purple-500/30 text-purple-200'
                                                            : 'bg-slate-950/40 border-slate-800/80 text-slate-400'
                                                    }`}>
                                                        <input
                                                            type="checkbox"
                                                            checked={cfg.importPurchases}
                                                            onChange={() => toggleModule(source.dbFile, 'importPurchases')}
                                                            className="w-4 h-4 mt-0.5 rounded text-purple-500 focus:ring-purple-500 bg-slate-800 border-slate-700"
                                                        />
                                                        <div className="text-xs space-y-0.5">
                                                            <div className="font-semibold flex items-center gap-1.5">
                                                                <ArrowLeftRight className="w-3.5 h-3.5 text-purple-400" />
                                                                <span>Compras / Entradas</span>
                                                            </div>
                                                            <div className="text-[11px] opacity-75">
                                                                {source.stats.purchases} entradas ({source.stats.purchasesItems} items)
                                                            </div>
                                                        </div>
                                                    </label>

                                                    {/* Módulo 4: Mermas */}
                                                    <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                                                        cfg.importLosses
                                                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                                                            : 'bg-slate-950/40 border-slate-800/80 text-slate-400'
                                                    }`}>
                                                        <input
                                                            type="checkbox"
                                                            checked={cfg.importLosses}
                                                            onChange={() => toggleModule(source.dbFile, 'importLosses')}
                                                            className="w-4 h-4 mt-0.5 rounded text-amber-500 focus:ring-amber-500 bg-slate-800 border-slate-700"
                                                        />
                                                        <div className="text-xs space-y-0.5">
                                                            <div className="font-semibold flex items-center gap-1.5">
                                                                <Trash2 className="w-3.5 h-3.5 text-amber-400" />
                                                                <span>Mermas / Pérdidas</span>
                                                            </div>
                                                            <div className="text-[11px] opacity-75">
                                                                {source.stats.losses} registros
                                                            </div>
                                                        </div>
                                                    </label>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Botón de Ejecución */}
                    <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="text-xs text-slate-400 flex items-center gap-2">
                            <ShieldAlert className="w-5 h-5 text-cyan-400 flex-shrink-0" />
                            <span>
                                La importación creará un <strong>respaldo de seguridad automático</strong> previo. Podés sobreescribir inventarios MCH existentes o crear inventarios nuevos con su historial.
                            </span>
                        </div>

                        <button
                            onClick={handleExecuteModularImport}
                            disabled={importing}
                            className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-600 hover:to-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold shadow-xl shadow-cyan-500/25 transition-all flex items-center justify-center gap-3 text-sm whitespace-nowrap"
                        >
                            {importing ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    <span>Importando...</span>
                                </>
                            ) : (
                                <>
                                    <Check className="w-5 h-5" />
                                    <span>Ejecutar Importación Seleccionada</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
