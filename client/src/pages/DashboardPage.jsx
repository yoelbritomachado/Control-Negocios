import { motion } from 'framer-motion';
import {
    DollarSign,
    TrendingDown,
    Wallet,
    Building2
} from 'lucide-react';
import { StatCard } from '../components/StatCard';
import { SalesChart } from '../components/SalesChart';
import { FundsDistribution } from '../components/FundsDistribution';
import { InventoryHealth } from '../components/InventoryHealth';
import { useCart } from '../components/CartProvider';

// Dashboard Data
const dashboardData = {
    stats: {
        totalSales: 4227.00,
        losses: 0.00,
        cashFund: 100000.00,
        transferFund: 0.00,
    }
};

const inventoryLabels = {
    mch1: 'MCH 1',
    mch2: 'MCH 2',
    alm: 'Almacén'
};

export default function DashboardPage() {
    const { currentInventory } = useCart();
    
    const inventoryLabel = inventoryLabels[currentInventory] || currentInventory.toUpperCase();
    
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="space-y-6"
        >
            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="Ventas Totales (CUP)"
                    value={dashboardData.stats.totalSales}
                    prefix="$"
                    decimals={2}
                    trend={12.5}
                    trendLabel="Actualizado ahora"
                    icon={DollarSign}
                    variant="success"
                    delay={0.1}
                    isCurrency
                />
                <StatCard
                    title="Mermas (Costo)"
                    value={dashboardData.stats.losses}
                    prefix="$"
                    decimals={2}
                    trend={0}
                    trendLabel="Sin pérdidas"
                    icon={TrendingDown}
                    variant="danger"
                    delay={0.2}
                    isCurrency
                />
                <StatCard
                    title="Fondo CUP (Caja)"
                    value={dashboardData.stats.cashFund}
                    prefix="$"
                    decimals={2}
                    trendLabel="Efectivo físico"
                    icon={Wallet}
                    variant="info"
                    delay={0.3}
                    isCurrency
                />
                <StatCard
                    title="Fondo CUP (Transf)"
                    value={dashboardData.stats.transferFund}
                    prefix="$"
                    decimals={2}
                    trendLabel="Saldos bancos"
                    icon={Building2}
                    variant="purple"
                    delay={0.4}
                    isCurrency
                />
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Sales Chart - Takes 2 columns */}
                <div className="xl:col-span-2">
                    <SalesChart />
                </div>

                {/* Right Column */}
                <div className="space-y-6">
                    <FundsDistribution />
                    <InventoryHealth />
                </div>
            </div>
        </motion.div>
    );
}
