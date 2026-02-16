import React, { useState, useEffect } from 'react';
import { History, ShoppingCart, Package, AlertTriangle, Calendar, Search, DollarSign, TrendingUp } from 'lucide-react';
import { fetchLegacyHistory } from '../api';

export default function LegacyHistoryPage() {
    const [activeTab, setActiveTab] = useState('sales'); // sales, purchases, losses
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [dateFilter, setDateFilter] = useState('');

    useEffect(() => {
        loadData();
    }, [activeTab]);

    const loadData = async () => {
        setLoading(true);
        try {
            const result = await fetchLegacyHistory(activeTab);
            setData(result || []);
        } catch (e) {
            console.error('Error loading legacy history:', e);
        } finally {
            setLoading(false);
        }
    };

    const filteredData = data.filter(item => {
        const matchesSearch = searchTerm === '' || 
            JSON.stringify(item).toLowerCase().includes(searchTerm.toLowerCase());
        const matchesDate = dateFilter === '' || 
            (item.fecha && item.fecha.includes(dateFilter));
        return matchesSearch && matchesDate;
    });

    const getTotalAmount = () => {
        return filteredData.reduce((sum, item) => sum + (item.total || 0), 0);
    };

    const getTotalCount = () => filteredData.length;

    const tabs = [
        { id: 'sales', label: 'Ventas', icon: ShoppingCart, color: 'emerald' },
        { id: 'purchases', label: 'Compras', icon: Package, color: 'blue' },
        { id: 'losses', label: 'Mermas', icon: AlertTriangle, color: 'rose' },
    ];

    const activeTabData = tabs.find(t => t.id === activeTab);

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="mb-8">
                <div className="flex items-center gap-4 mb-2">
                    <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                        <History className="w-6 h-6 text-amber-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold">Historial Legacy</h1>
                        <p className="text-sm text-muted-foreground">
                            Datos migrados del sistema anterior
                        </p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                            activeTab === tab.id
                                ? `bg-${tab.color}-500/20 text-${tab.color}-400 border border-${tab.color}-500/30`
                                : 'bg-card/50 text-muted-foreground hover:bg-card border border-border/50'
                        }`}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className={`p-4 rounded-xl bg-${activeTabData.color}-500/10 border border-${activeTabData.color}-500/20`}>
                    <div className="flex items-center gap-3">
                        <activeTabData.icon className={`w-5 h-5 text-${activeTabData.color}-400`} />
                        <div>
                            <p className="text-sm text-muted-foreground">Total {activeTabData.label}</p>
                            <p className={`text-2xl font-bold text-${activeTabData.color}-400`}>{getTotalCount()}</p>
                        </div>
                    </div>
                </div>

                <div className="p-4 rounded-xl bg-card/50 border border-border/50">
                    <div className="flex items-center gap-3">
                        <DollarSign className="w-5 h-5 text-cyan-400" />
                        <div>
                            <p className="text-sm text-muted-foreground">Monto Total</p>
                            <p className="text-2xl font-bold text-cyan-400">${getTotalAmount().toFixed(2)}</p>
                        </div>
                    </div>
                </div>

                <div className="p-4 rounded-xl bg-card/50 border border-border/50">
                    <div className="flex items-center gap-3">
                        <TrendingUp className="w-5 h-5 text-purple-400" />
                        <div>
                            <p className="text-sm text-muted-foreground">Promedio</p>
                            <p className="text-2xl font-bold text-purple-400">
                                ${getTotalCount() > 0 ? (getTotalAmount() / getTotalCount()).toFixed(2) : '0.00'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-4 mb-6">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Buscar..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-card/50 border border-border/50 rounded-lg focus:outline-none focus:border-cyan-500/50"
                    />
                </div>
                <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="date"
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value)}
                        className="pl-10 pr-4 py-2 bg-card/50 border border-border/50 rounded-lg focus:outline-none focus:border-cyan-500/50"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="bg-card/30 rounded-2xl border border-border/50 overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center">
                        <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-muted-foreground">Cargando historial...</p>
                    </div>
                ) : filteredData.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                        No se encontraron registros
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-card/50 border-b border-border/50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Fecha</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Tipo</th>
                                    {activeTab === 'sales' && (
                                        <>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Items</th>
                                            <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Total</th>
                                        </>
                                    )}
                                    {activeTab === 'purchases' && (
                                        <>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Proveedor</th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Producto</th>
                                            <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">Cantidad</th>
                                            <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Total</th>
                                        </>
                                    )}
                                    {activeTab === 'losses' && (
                                        <>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Producto</th>
                                            <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">Cantidad</th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Motivo</th>
                                        </>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/30">
                                {filteredData.map((item, index) => (
                                    <tr key={index} className="hover:bg-card/50 transition-colors"
003e
                                        <td className="px-4 py-3 text-sm">
                                            {item.fecha ? new Date(item.fecha).toLocaleDateString() : 'N/A'}
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                                activeTab === 'sales' ? 'bg-emerald-500/20 text-emerald-400' :
                                                activeTab === 'purchases' ? 'bg-blue-500/20 text-blue-400' :
                                                'bg-rose-500/20 text-rose-400'
                                            }`}>
                                                {item.tipo || 'N/A'}
                                            </span>
                                        </td>
                                        {activeTab === 'sales' && (
                                            <>
                                                <td className="px-4 py-3 text-sm">{item.items_count || 0}</td>
                                                <td className="px-4 py-3 text-sm text-right font-mono">
                                                    ${(item.total || 0).toFixed(2)}
                                                </td>
                                            </>
                                        )}
                                        {activeTab === 'purchases' && (
                                            <>
                                                <td className="px-4 py-3 text-sm">{item.proveedor || 'N/A'}</td>
                                                <td className="px-4 py-3 text-sm">{item.producto || 'N/A'}</td>
                                                <td className="px-4 py-3 text-sm text-center">{item.cantidad || 0}</td>
                                                <td className="px-4 py-3 text-sm text-right font-mono">
                                                    ${(item.total || 0).toFixed(2)}
                                                </td>
                                            </>
                                        )}
                                        {activeTab === 'losses' && (
                                            <>
                                                <td className="px-4 py-3 text-sm">{item.producto || 'N/A'}</td>
                                                <td className="px-4 py-3 text-sm text-center">{item.cantidad || 0}</td>
                                                <td className="px-4 py-3 text-sm text-muted-foreground">
                                                    {item.motivo || 'Sin motivo'}
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
