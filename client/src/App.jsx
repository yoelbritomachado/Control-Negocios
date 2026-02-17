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
import './index.css';

function App() {
  return (
    <BrowserRouter>
      <CartProvider>
        <Routes>
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
          </Route>
        </Routes>
      </CartProvider>
    </BrowserRouter>
  );
}

export default App;
