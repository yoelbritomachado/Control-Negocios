import { motion } from 'framer-motion';
import {
  Plus,
  Bell,
  Search,
  User,
  ChevronDown
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useNavigate } from 'react-router-dom';

export function Header({ businessName, userName, userRole }) {
  const navigate = useNavigate();

  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
      className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8"
    >
      {/* Left Side - Title */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"
          />
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Monitoreo activo de flujos de caja
          </p>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">
          Dashboard:{' '}
          <span className="gradient-text-cyan">{businessName}</span>
        </h1>
      </div>

      {/* Right Side - Actions */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative hidden sm:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar..."
            className={cn(
              'pl-10 pr-4 py-2.5 rounded-xl text-sm',
              'bg-secondary/50 border border-border/50',
              'focus:outline-none focus:ring-2 focus:ring-cyan-500/30',
              'transition-all duration-300',
              'w-48 focus:w-64'
            )}
          />
        </div>

        {/* Notifications */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="relative p-2.5 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors"
        >
          <Bell className="w-5 h-5 text-muted-foreground" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
        </motion.button>

        {/* User Profile */}
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="flex items-center gap-3 p-2 pl-3 pr-4 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors cursor-pointer"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <User className="w-4 h-4 text-white" />
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium">{userName}</p>
            <p className="text-xs text-muted-foreground">{userRole}</p>
          </div>
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </motion.div>

        {/* New Sale Button */}
        <motion.button
          onClick={() => navigate('/pos')}
          whileHover={{ scale: 1.02, y: -1 }}
          whileTap={{ scale: 0.98 }}
          className={cn(
            'flex items-center gap-2 px-5 py-2.5 rounded-xl',
            'bg-gradient-to-r from-cyan-500 to-blue-600',
            'text-white font-medium text-sm',
            'shadow-lg shadow-cyan-500/30',
            'hover:shadow-cyan-500/50',
            'transition-all duration-300'
          )}
        >
          <Plus className="w-4 h-4" />
          <span>Nueva Venta</span>
        </motion.button>
      </div>
    </motion.header>
  );
}
