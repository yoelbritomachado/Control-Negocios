import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { CartProvider } from './components/CartProvider';
import MainLayout from './components/MainLayout';
import POSPage from './pages/POSPage';
import InventoryPage from './pages/InventoryPage';
import PurchaseSection from './components/PurchaseSection';
import DashboardPage from './pages/DashboardPage';
import MigrationTool from './components/MigrationTool';
import LegacyHistoryPage from './pages/LegacyHistoryPage';
import HistoryPage from './pages/HistoryPage';
import SettingsPage from './pages/SettingsPage';
import MermasPage from './pages/MermasPage';
import { NexusManager } from './nexus';
import HistorySalesPage from './pages/HistorySalesPage';
import HistoryPurchasesPage from './pages/HistoryPurchasesPage';
import HistoryMermasPage from './pages/HistoryMermasPage';
import './index.css';

function App() {
  return (
    <BrowserRouter>
      <CartProvider>
        <Routes>
          {/* Ruta Nexus - Fuera del MainLayout para pantalla completa */}
          <Route path="/nexus" element={<NexusManager />} />
          
          {/* Rutas con Layout Principal (Sidebar y Header Global) */}
          <Route path="/" element={<MainLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="pos" element={<POSPage />} />
            <Route path="entradas" element={<InventoryPage />} />
            <Route path="compras" element={<PurchaseSection />} />
            <Route path="usuarios" element={<div className="p-10">Módulo de Usuarios (En Construcción)</div>} />
            <Route path="admin/migracion" element={<MigrationTool />} />
            {/* Historial Legacy deshabilitado temporalmente
              <Route path="admin/historial-legacy" element={<LegacyHistoryPage />} />
              */}
            <Route path="historial" element={<HistoryPage />} />
            <Route path="historial/ventas" element={<HistorySalesPage />} />
            <Route path="historial/compras" element={<HistoryPurchasesPage />} />
            <Route path="historial/mermas" element={<HistoryMermasPage />} />
            <Route path="mermas" element={<MermasPage />} />
            <Route path="configuracion" element={<SettingsPage />} />
          </Route>
        </Routes>
      </CartProvider>
    </BrowserRouter>
  );
}

export default App;
