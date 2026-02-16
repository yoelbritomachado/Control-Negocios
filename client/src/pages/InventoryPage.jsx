import React, { useState, useEffect } from 'react';
import ProductTable from '../components/ProductTable';
import Dashboard from '../components/Dashboard'; // Stats
import { useCart } from '../components/CartProvider';
import { fetchProducts, fetchSettings, fetchInventories } from '../api';

export default function InventoryPage() {
    const { currentInventory } = useCart();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [settings, setSettings] = useState({});

    // Refresh Trigger
    const [refresh, setRefresh] = useState(0);

    useEffect(() => {
        loadData();
    }, [currentInventory, refresh]);

    const loadData = async () => {
        setLoading(true);
        try {
            // Fetch products filtered by current inventory (or all if we handle logic there)
            // The ported ProductTable expects products array.
            // My updated api.js fetchProducts(search, inventoryId) supports this.

            // Note: fetchProducts signature in client/src/api.js is (search='', inventoryId=null)
            // We pass '' for search, and currentInventory for ID.
            const prods = await fetchProducts('', currentInventory);
            const sets = await fetchSettings();

            // Ensure products is array
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

    if (loading) return <div className="p-10 text-center">Cargando Inventario...</div>;

    return (
        <div className="flex flex-col h-full overflow-y-auto p-4 space-y-6">
            <div className="grid gap-6">
                {/* Dashboard Stats */}
                <Dashboard
                    products={products}
                    currentInventory={currentInventory}
                    settings={settings} // Dashboard needs settings for rates
                />

                {/* Product Management Table */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                    <h2 className="text-lg font-bold mb-4">Gestión de Productos</h2>
                    {/* ProductTable props need to match what the component expects */}
                    <ProductTable
                        products={products}
                        currentInventory={currentInventory}
                        onProductUpdated={handleProductUpdated}
                        settings={settings}
                    />
                </div>
            </div>
        </div>
    );
}
