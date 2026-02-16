import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  DollarSign, 
  TrendingDown, 
  Wallet, 
  Building2,
  Sparkles
} from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { StatCard } from './components/StatCard';
import { SalesChart } from './components/SalesChart';
import { FundsDistribution } from './components/FundsDistribution';
import { InventoryHealth } from './components/InventoryHealth';
import { cn } from './lib/utils';

// Dashboard Data
const dashboardData = {
  businessName: 'MCH 1',
  userName: 'Administrador',
  userRole: 'Acceso Maestro',
  stats: {
    totalSales: 4227.00,
    losses: 0.00,
    cashFund: 100000.00,
    transferFund: 0.00,
  }
};

// Background Animation Component
function AnimatedBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      {/* Gradient Orbs */}
      <motion.div
        animate={{
          x: [0, 100, 0],
          y: [0, -50, 0],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: 'linear',
        }}
        className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-cyan-500/10 blur-3xl"
      />
      <motion.div
        animate={{
          x: [0, -100, 0],
          y: [0, 50, 0],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: 'linear',
        }}
        className="absolute top-1/2 -right-40 w-96 h-96 rounded-full bg-violet-500/10 blur-3xl"
      />
      <motion.div
        animate={{
          x: [0, 50, 0],
          y: [0, 100, 0],
        }}
        transition={{
          duration: 30,
          repeat: Infinity,
          ease: 'linear',
        }}
        className="absolute -bottom-40 left-1/3 w-96 h-96 rounded-full bg-emerald-500/10 blur-3xl"
      />
      
      {/* Grid Pattern */}
      <div 
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
        }}
      />
    </div>
  );
}

// Welcome Animation
function WelcomeAnimation({ onComplete }: { onComplete: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 2500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{
        background: 'linear-gradient(135deg, hsl(222 47% 6%) 0%, hsl(222 47% 8%) 100%)',
      }}
    >
      <div className="text-center">
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
          className="relative inline-block mb-6"
        >
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-2xl shadow-cyan-500/50">
            <Sparkles className="w-12 h-12 text-white" />
          </div>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-0 rounded-2xl border-2 border-dashed border-cyan-400/30"
            style={{ transform: 'scale(1.2)' }}
          />
        </motion.div>
        
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="text-4xl font-bold mb-2"
        >
          <span className="gradient-text">BizControl</span>
        </motion.h1>
        
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.6 }}
          className="text-muted-foreground text-lg"
        >
          Sistema Premium de Gestión Económica
        </motion.p>
        
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: '100%' }}
          transition={{ delay: 0.8, duration: 1.5, ease: [0.23, 1, 0.32, 1] }}
          className="h-1 bg-gradient-to-r from-cyan-500 via-violet-500 to-emerald-500 rounded-full mt-8 max-w-xs mx-auto"
        />
      </div>
    </motion.div>
  );
}

// Main Dashboard Content
function DashboardContent() {
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

function App() {
  const [isDark, setIsDark] = useState(true);
  const [activeSection, setActiveSection] = useState('dashboard');
  const [showWelcome, setShowWelcome] = useState(true);

  // Toggle theme
  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle('dark');
  };

  // Initialize dark mode
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  return (
    <div className={cn(
      'min-h-screen transition-colors duration-500',
      isDark ? 'dark' : ''
    )}>
      {/* Welcome Animation */}
      <AnimatePresence>
        {showWelcome && (
          <WelcomeAnimation onComplete={() => setShowWelcome(false)} />
        )}
      </AnimatePresence>

      {/* Background */}
      <AnimatedBackground />

      {/* Sidebar */}
      <Sidebar
        isDark={isDark}
        toggleTheme={toggleTheme}
        activeSection={activeSection}
        setActiveSection={setActiveSection}
      />

      {/* Main Content */}
      <main className={cn(
        'transition-all duration-500 min-h-screen',
        'lg:ml-72'
      )}>
        <div className="p-6 lg:p-8">
          <Header
            businessName={dashboardData.businessName}
            userName={dashboardData.userName}
            userRole={dashboardData.userRole}
          />
          
          <DashboardContent />
        </div>
      </main>
    </div>
  );
}

export default App;
