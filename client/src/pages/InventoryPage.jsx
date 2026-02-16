import React, { useState, useEffect } from 'react';
import ProductTable from '../components/ProductTable';
import { useCart } from '../components/CartProvider';
import { fetchProducts, fetchSettings } from '../api';
import { Package, AlertCircle } from 'lucide-react';

export default function InventoryPage() {
    const { currentInventory } = useCart();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [settings, setSettings] = useState({});
    const [refresh, setRefresh] = useState(0);

    useEffect(() => {
        loadData();
    }, [currentInventory, refresh]);

    const loadData = async () => {
        setLoading(true);
        try {
            const prods = await fetchProducts('', currentInventory);
            const sets = await fetchSettings();
            setProducts(Array.isArray(prods) ? prods : []);
            setSettings(sets);
        } catch (e) {
            console.error("Error loading inventory page:", e);
        } finally {
            setLoading(false);
        }
    };

    const handleProductUpdated = () => {
        setRefresh(prev => prev + 1);
    };

    // Calcular estadísticas
    const totalProducts = products.length;
    const lowStockProducts = products.filter(p => {
        const stock = p.inventory?.[currentInventory] || 0;
        return stock < 5;
    }).length;

    if (loading) return (
        <div className="h-full flex items-center justify-center">
            <div className="text-center">
                <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-muted-foreground">Cargando Inventario...</p>
            </div>
        </div>
    );

    return (
        <div className="h-full overflow-y-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-3">
                        <Package className="w-7 h-7 text-cyan-400" /
                        Inventario
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Gestión de productos y control de stock
                    </p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-card/50 border border-border/50">
                    <div className="text-sm text-muted-foreground">Total Productos</div>
                    <div className="text-2xl font-bold">{totalProducts}</div>
                </div>
                <div className="p-4 rounded-xl bg-card/50 border border-border/50">
                    <div className="text-sm text-muted-foreground">Stock Bajo</div>
                    <div className={`text-2xl font-bold ${lowStockProducts > 0 ? 'text-rose-400' : ''}`}>
                        {lowStockProducts}
                    </div>
                </div>
                <div className="p-4 rounded-xl bg-card/50 border border-border/50">
                    <div className="text-sm text-muted-foreground">Sede Activa</div>
                    <div className="text-2xl font-bold text-cyan-400">{currentInventory.toUpperCase()}</div>
                </div>
            </div>

            {/* Alerta de stock bajo */}
            {lowStockProducts > 0 && (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-rose-400" />
                    <span className="text-rose-400">
                        Hay {lowStockProducts} productos con stock bajo (< 5 unidades)
                    </span>
                </div>
            )}

            {/* Product Management Table */}
            <div className="bg-card/30 rounded-2xl border border-border/50 overflow-hidden">
                <div className="p-4 border-b border-border/50">
                    <h2 className="font-semibold">Gestión de Productos</h2>
                </div>
                <ProductTable
                    products={products}
                    currentInventory={currentInventory}
                    onProductUpdated={handleProductUpdated}
                    settings={settings}
                />
            </div>
        </div>
    );
}
