import React from 'react';
import { Link } from 'react-router-dom';
import { FaArrowUp, FaArrowDown, FaWallet, FaExchangeAlt, FaExclamationTriangle, FaPlus, FaChartPie } from 'react-icons/fa';
import InventorySelector from './InventorySelector';

// Dashboard Component v2 - Fixed imports

const Widget = ({ title, value, subtext, icon: Icon, colorClass, trend }) => (
  <div className="bg-[#1A1D21] p-5 rounded-2xl border border-gray-800 relative overflow-hidden group hover:border-gray-700 transition-all">
    <div className={`absolute top-4 right-4 p-2 rounded-lg opacity-20 ${colorClass}`}>
      <Icon className="text-xl text-white" />
    </div>

    <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">{title}</h3>
    <div className="flex items-baseline gap-2 mb-2">
      <span className={`text-2xl font-bold text-white`}>${value}</span>
      {subtext && <span className="text-[10px] font-medium text-gray-400">{subtext}</span>}
    </div>

    {trend && (
      <div className="flex items-center gap-1 text-[10px] font-bold">
        {trend > 0 ? <FaArrowUp className="text-emerald-500" /> : <FaArrowDown className="text-rose-500" />}
        <span className={trend > 0 ? "text-emerald-500" : "text-rose-500"}>{Math.abs(trend)}% vs Ayer</span>
      </div>
    )}
  </div>
);

const Dashboard = ({ totals, currentInventory, settings }) => {
  // Helpers
  const formatMoney = (amount) => amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="p-8 h-full overflow-y-auto bg-[#131517] text-white">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            Dashboard: <span className="text-pink-500"><InventorySelector minimal={true} /></span>
          </h1>
          <p className="text-xs text-gray-500 font-medium tracking-wide mt-1">
            MONITOREO ACTIVO DE FLUJOS DE CAJA
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:block text-right">
            <p className="text-xs font-bold text-white">Administrador</p>
            <p className="text-[9px] text-gray-500 uppercase tracking-wider">Sesión Maestra</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-gray-700 to-gray-600 border border-gray-500"></div>

          <Link to="/pos" className="bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide shadow-lg shadow-pink-900/40 flex items-center gap-2 transition-transform active:scale-95">
            <FaPlus /> Nueva Venta
          </Link>
        </div>
      </div>

      {/* Widgets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Widget
          title="VENTAS TOTALES (ESTIMADAS)"
          value={formatMoney(totals?.sales || 0)}
          icon={FaArrowUp}
          colorClass="bg-emerald-500"
          trend={12.5}
        />
        <Widget
          title="MERMAS (COSTO)"
          value="0.00"
          icon={FaExclamationTriangle}
          colorClass="bg-red-500"
        />
        <Widget
          title="FONDO CUP (CAJA)"
          value="100,000.00"
          icon={FaWallet}
          colorClass="bg-blue-500"
          subtext="Efectivo Físico"
        />
        <Widget
          title="FONDO CUP (TRANSF)"
          value="0.00"
          icon={FaExchangeAlt}
          colorClass="bg-gray-500"
          subtext="Saldos Bancos"
        />
      </div>

      {/* Main Chart Area (Mockup for Visuals) */}
      <div className="bg-[#1A1D21] rounded-3xl p-6 border border-gray-800 mb-8 relative overflow-hidden">
        <div className="flex justify-between items-center mb-6">
          <div>
            <div className="w-8 h-8 bg-pink-500/10 rounded-lg flex items-center justify-center mb-2">
              <FaChartPie className="text-pink-500" />
            </div>
            <h2 className="font-bold text-lg">Evolución de Ventas</h2>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest">VENTAS DIARIAS - SEPTIEMBRE</p>
          </div>
          <div className="flex gap-2">
            <button className="px-3 py-1 rounded-lg bg-pink-500/10 text-pink-500 text-[10px] font-bold border border-pink-500/20">MES ACTUAL</button>
            <button className="px-3 py-1 rounded-lg bg-gray-800 text-gray-500 text-[10px] font-bold border border-gray-700 hover:bg-gray-700">HISTÓRICO</button>
          </div>
        </div>

        {/* Fake Bar Chart */}
        <div className="h-48 flex items-end justify-between gap-1 opacity-80">
          {[...Array(30)].map((_, i) => {
            const height = Math.floor(Math.random() * 80) + 20;
            const isToday = i === 28;
            return (
              <div k={i} className="flex-1 flex flex-col items-center gap-2 group">
                <div
                  className={`w-full rounded-t-sm transition-all duration-500 ${isToday ? 'bg-pink-500 shadow-[0_0_15px_rgba(236,72,153,0.5)]' : 'bg-gray-700 group-hover:bg-gray-600'}`}
                  style={{ height: `${height}%` }}
                ></div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Footer Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Total Estimado */}
        <div className="bg-[#1A1D21] p-5 rounded-2xl border border-gray-800 flex items-center justify-between">
          <div>
            <h3 className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Total Estimado General</h3>
            <div className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
              ${formatMoney(100000)}
            </div>
          </div>
          <button className="bg-white text-black px-4 py-2 rounded-lg text-xs font-bold uppercase hover:bg-gray-200">
            Ver Reporte
          </button>
        </div>

        {/* Health Bar */}
        <div className="bg-[#1A1D21] p-5 rounded-2xl border border-gray-800 flex flex-col justify-center">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Salud del Inventario</span>
            <span className="text-xs font-bold text-emerald-500">85% OPTIMIZADO</span>
          </div>
          <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-pink-500 to-rose-500 w-[85%] rounded-full shadow-[0_0_10px_rgba(244,63,94,0.5)]"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
