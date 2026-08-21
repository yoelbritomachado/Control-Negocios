import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
    DollarSign,
    TrendingDown,
    TrendingUp,
    Wallet,
    Building2,
    Calendar,
    RefreshCw,
    Layers,
    Receipt,
    Percent,
    AlertCircle,
    Store
} from 'lucide-react';
import { StatCard } from '../components/StatCard';
import { SalesChart } from '../components/SalesChart';
import { FundsDistribution } from '../components/FundsDistribution';
import { InventoryHealth } from '../components/InventoryHealth';
import { TopProductsCard } from '../components/TopProductsCard';
import { useCart } from '../components/CartProvider';
import { fetchDashboardStats, fetchInventories } from '../api';

const PERIOD_OPTIONS = [
    { id: 'all', label: 'Todo el Histórico' },
    { id: 'month', label: 'Mes Actual' },
    { id: '30d', label: 'Últimos 30 días' },
    { id: '7d', label: 'Últimos 7 días' },
    { id: 'today', label: 'Hoy' },
    { id: 'custom', label: 'Personalizado' },
];

export default function DashboardPage() {
    const { currentInventory } = useCart();
    const [selectedInventory, setSelectedInventory] = useState(currentInventory || 'all');
    const [selectedPeriod, setSelectedPeriod] = useState('all');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    const [inventoriesList, setInventoriesList] = useState([]);
    
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [data, setData] = useState(null);

    // Sincronizar selector local si cambia el inventario global de la barra superior
    useEffect(() => {
        if (currentInventory) {
            setSelectedInventory(currentInventory);
        }
    }, [currentInventory]);

    // Cargar lista de inventarios disponibles para el filtro
    useEffect(() => {
        fetchInventories()
            .then(res => setInventoriesList(res || []))
            .catch(err => console.error("Error al cargar inventarios:", err));
    }, []);

    const loadDashboardData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = {
                inventory: selectedInventory,
                period: selectedPeriod,
            };
            if (selectedPeriod === 'custom') {
                if (customStartDate) params.startDate = customStartDate;
                if (customEndDate) params.endDate = customEndDate;
            }
            const res = await fetchDashboardStats(params);
            setData(res);
        } catch (err) {
            console.error("Error cargando dashboard:", err);
            setError(err.response?.data?.error || err.message || 'Error al obtener datos');
        } finally {
            setLoading(false);
        }
    }, [selectedInventory, selectedPeriod, customStartDate, customEndDate]);

    useEffect(() => {
        loadDashboardData();
    }, [loadDashboardData]);

    const stats = data?.stats || {};
    const topProducts = data?.topProducts || [];
    const salesTrend = data?.salesTrend || [];

    const getInventoryName = (id) => {
        if (id === 'all') return 'Negocio Completo (Global)';
        const found = inventoriesList.find(i => i.id === id);
        return found ? found.name : id.toUpperCase();
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="space-y-6 px-3 md:px-4 lg:px-0 max-w-7xl mx-auto pb-12"
        >
            {/* Header & Controls Bar */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl backdrop-blur-md">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                            En Vivo
                        </span>
                        <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
                            Panel de Control y Analíticas
                        </h1>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                        Estadísticas operativas para <strong className="text-cyan-400">{getInventoryName(selectedInventory)}</strong>
                    </p>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
                    {/* Selector de Inventario */}
                    <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
                        <Store className="w-4 h-4 text-slate-400 ml-1.5" />
                        <select
                            value={selectedInventory}
                            onChange={(e) => setSelectedInventory(e.target.value)}
                            className="bg-transparent text-white text-xs font-semibold focus:outline-none pr-2 cursor-pointer"
                        >
                            <option value="all" className="bg-slate-900">Todo el Negocio (Global)</option>
                            {inventoriesList.map(inv => (
                                <option key={inv.id} value={inv.id} className="bg-slate-900">
                                    {inv.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Selector de Periodo */}
                    <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
                        <Calendar className="w-4 h-4 text-slate-400 ml-1.5" />
                        <select
                            value={selectedPeriod}
                            onChange={(e) => setSelectedPeriod(e.target.value)}
                            className="bg-transparent text-white text-xs font-semibold focus:outline-none pr-2 cursor-pointer"
                        >
                            {PERIOD_OPTIONS.map(opt => (
                                <option key={opt.id} value={opt.id} className="bg-slate-900">
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Rango personalizado */}
                    {selectedPeriod === 'custom' && (
                        <div className="flex items-center gap-2">
                            <input
                                type="date"
                                value={customStartDate}
                                onChange={(e) => setCustomStartDate(e.target.value)}
                                className="bg-slate-950 text-white text-xs px-2.5 py-1.5 rounded-xl border border-slate-800 focus:outline-none focus:border-cyan-500"
                            />
                            <span className="text-slate-500 text-xs">a</span>
                            <input
                                type="date"
                                value={customEndDate}
                                onChange={(e) => setCustomEndDate(e.target.value)}
                                className="bg-slate-950 text-white text-xs px-2.5 py-1.5 rounded-xl border border-slate-800 focus:outline-none focus:border-cyan-500"
                            />
                        </div>
                    )}

                    {/* Botón Refrescar */}
                    <button
                        onClick={loadDashboardData}
                        disabled={loading}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                        title="Actualizar datos"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-400" />
                    <span className="text-sm font-medium">{error}</span>
                </div>
            )}

            {/* Key KPI Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                <StatCard
                    title="Ventas Totales"
                    value={stats.totalSales || 0}
                    prefix="$"
                    suffix=" CUP"
                    decimals={2}
                    trendLabel={`${stats.salesCount || 0} ventas registradas`}
                    icon={DollarSign}
                    variant="success"
                    delay={0.05}
                    isCurrency
                />
                <StatCard
                    title="Ganancia Estimada"
                    value={stats.estimatedProfit || 0}
                    prefix="$"
                    suffix=" CUP"
                    decimals={2}
                    trend={stats.profitMargin ? Number(stats.profitMargin.toFixed(1)) : undefined}
                    trendLabel={`Margen: ${stats.profitMargin ? stats.profitMargin.toFixed(1) : 0}% sobre ventas`}
                    icon={TrendingUp}
                    variant="info"
                    delay={0.1}
                    isCurrency
                />
                <StatCard
                    title="Mermas y Roturas"
                    value={stats.lossesCost || 0}
                    prefix="$"
                    suffix=" CUP"
                    decimals={2}
                    trendLabel={`${stats.lossesQty || 0} unidades perdidas`}
                    icon={TrendingDown}
                    variant="danger"
                    delay={0.15}
                    isCurrency
                />
                <StatCard
                    title="Ticket Promedio"
                    value={stats.averageTicket || 0}
                    prefix="$"
                    suffix=" CUP"
                    decimals={2}
                    trendLabel="Ingreso medio por venta"
                    icon={Receipt}
                    variant="purple"
                    delay={0.2}
                    isCurrency
                />
            </div>

            {/* Main Graphs & Detailed Stats */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Evolution Chart (2 Col) */}
                <div className="xl:col-span-2 space-y-6">
                    <SalesChart data={salesTrend} loading={loading} />
                    <TopProductsCard products={topProducts} />
                </div>

                {/* Right Column (1 Col) */}
                <div className="space-y-6">
                    <FundsDistribution
                        cash={stats.cashTotal || 0}
                        transfer={stats.transferTotal || 0}
                    />
                    <InventoryHealth
                        health={{
                            totalCatalog: stats.totalCatalog || 0,
                            totalUnits: stats.totalUnits || 0,
                            inventoryValuation: stats.inventoryValuation || 0,
                            outOfStock: stats.outOfStock || 0,
                            lowStock: stats.lowStock || 0,
                            optimalStock: stats.optimalStock || 0
                        }}
                    />
                </div>
            </div>
        </motion.div>
    );
}
