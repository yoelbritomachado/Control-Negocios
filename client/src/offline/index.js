/**
 * Miss Chulerías - Módulo Offline-First
 * Exporta todo lo necesario para trabajar offline
 */

// Core
export { getOfflineDatabase } from './database';
export { getSyncManager } from './sync';

// Provider y Context
export { OfflineProvider, OfflineContext } from './provider';

// Hooks principales
export {
  useOffline,
  useProducts,
  useProduct,
  useBarcodeScan,
  useCategories,
  useCreateSale,
  useOfflineStats,
  useCreatePurchase,
  useCreateTransfer,
  useCreateMerma,
  usePendingSales
} from './hooks';

// Hooks adicionales
export { usePWAInstall } from './hooks/usePWAInstall';

// Hook de integración POS
export { usePOSOffline } from './usePOSOffline';

// Componentes UI
export { 
  OfflineStatusBar, 
  SyncButton, 
  PendingOperationsModal,
  PWAInstallPrompt 
} from './components';
