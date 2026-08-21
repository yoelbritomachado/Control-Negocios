import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { CartProvider } from './components/CartProvider';
import { useCart } from './components/CartProvider';
import MainLayout from './components/MainLayout';
import POSPage from './pages/POSPage';
import InventoryPage from './pages/InventoryPage';
import EntradasPage from './pages/EntradasPage';
import PurchasesPage from './pages/PurchasesPage';
import DashboardPage from './pages/DashboardPage';
import MigrationTool from './components/MigrationTool';
import LegacyHistoryPage from './pages/LegacyHistoryPage';
import HistoryPage from './pages/HistoryPage';
import SettingsPage from './pages/SettingsPage';
import MermasPage from './pages/MermasPage';
import UsersPage from './pages/UsersPage';
import { NexusManager } from './nexus';
import HistorySalesPage from './pages/HistorySalesPage';
import HistoryPurchasesPage from './pages/HistoryPurchasesPage';
import HistoryMermasPage from './pages/HistoryMermasPage';
import TrasladosPage from './pages/TrasladosPage';
import './index.css';
import { PWAInstallPrompt } from './offline';

// El almacén central recibe compras y despacha mercancía a los quioscos.
// El POS solo está disponible dentro de MCH1/MCH2.
function InventoryAwarePOS() {
  const { currentInventory } = useCart();
  return currentInventory === 'alm' ? <Navigate to="/entradas" replace /> : <POSPage />;
}

function App() {
  return (
    <BrowserRouter>
      <CartProvider>
        <Routes>
          {/* Rutas con Layout Principal (Sidebar y Header Global) */}
          <Route path="/" element={<MainLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="pos" element={<InventoryAwarePOS />} />
            <Route path="entradas" element={<EntradasPage />} />
            <Route path="inventario" element={<InventoryPage />} />
            <Route path="compras" element={<PurchasesPage />} />
            <Route path="usuarios" element={<UsersPage />} />
            <Route path="admin/migracion" element={<MigrationTool />} />
            {/* Historial Legacy deshabilitado temporalmente
              <Route path="admin/historial-legacy" element={<LegacyHistoryPage />} />
              */}
            <Route path="historial" element={<HistoryPage />} />
            <Route path="historial/ventas" element={<HistorySalesPage />} />
            <Route path="historial/traslados" element={<HistoryPurchasesPage />} />
            <Route path="historial/compras" element={<Navigate to="/historial/traslados" replace />} />
            <Route path="historial-compras" element={<Navigate to="/historial/traslados" replace />} />
            <Route path="historial-traslados" element={<Navigate to="/historial/traslados" replace />} />
            <Route path="historial/mermas" element={<HistoryMermasPage />} />
            <Route path="mermas" element={<MermasPage />} />
            <Route path="traslados" element={<TrasladosPage />} />
            <Route path="configuracion" element={<SettingsPage />} />
            <Route path="nexus" element={<NexusManager />} />
          </Route>
        </Routes>
      </CartProvider>
      <PWAInstallPrompt />
    </BrowserRouter>
  );
}

export default App;
