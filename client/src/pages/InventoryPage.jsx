import React, { useState, useEffect } from 'react';
import ProductTable from '../components/ProductTable';
import ProductForm from '../components/ProductForm';
import { useCart } from '../components/CartProvider';
import { fetchProducts, fetchSettings, updateProduct } from '../api';
import { Package, AlertCircle, Plus, Search } from 'lucide-react';

export default function InventoryPage() {
    const { currentInventory } = useCart();
    const [products, setProducts] = useState([]);
    const [filteredProducts, setFilteredProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [settings, setSettings] = useState({});
    const [refresh, setRefresh] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    
    // Estado para el formulario de edición
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);

    useEffect(() => {
        loadData();
    }, [currentInventory, refresh]);

    // Filtrar productos cuando cambia la búsqueda
    useEffect(() => {
        if (searchQuery.trim() === '') {
            setFilteredProducts(products);
        } else {
            const filtered = products.filter(p => 
                p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (p.code && p.code.toLowerCase().includes(searchQuery.toLowerCase()))
            );
            setFilteredProducts(filtered);
        }
    }, [searchQuery, products]);

    const loadData = async () => {
        setLoading(true);
        try {
            const prods = await fetchProducts('', currentInventory);
            const sets = await fetchSettings();
            setProducts(Array.isArray(prods) ? prods : []);
            setFilteredProducts(Array.isArray(prods) ? prods : []);
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

    const handleEdit = (product) => {
        setEditingProduct(product);
        setIsFormOpen(true);
    };

    const handleCloseForm = () => {
        setIsFormOpen(false);
        setEditingProduct(null);
    };

    const handleSubmit = async (formData) => {
        try {
            if (editingProduct) {
                // Actualizar producto existente
                await updateProduct(editingProduct.id, formData);
            }
            handleProductUpdated();
            handleCloseForm();
        } catch (e) {
            console.error("Error saving product:", e);
            alert("Error al guardar el producto");
        }
    };

    const totalProducts = products.length;
    const lowStockProducts = products.filter(p => {
        const stock = p.inventory?.[currentInventory] || 0;
        return stock < 5;
    }).length;

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Cargando Inventario...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto p-6 space-y-6">
            {/* Barra de búsqueda y Botón Nuevo Producto */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
                <div className="relative flex-1 max-w-md w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Buscar producto por nombre o código..."
                        className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                    />
                </div>
                <button
                    onClick={() => {
                        setEditingProduct(null);
                        setIsFormOpen(true);
                    }}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl font-medium transition-colors whitespace-nowrap"
                >
                    <Plus className="w-5 h-5" />
                    Nuevo Producto
                </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-card/50 border border-border/50">
                    <div className="text-sm text-muted-foreground">Total Productos</div>
                    <div className="text-2xl font-bold">{totalProducts}</div>
                </div>
                <div className="p-4 rounded-xl bg-card/50 border border-border/50">
                    <div className="text-sm text-muted-foreground">Stock Bajo</div>
                    <div className={lowStockProducts > 0 ? 'text-2xl font-bold text-rose-400' : 'text-2xl font-bold'}>
                        {lowStockProducts}
                    </div>
                </div>
                <div className="p-4 rounded-xl bg-card/50 border border-border/50">
                    <div className="text-sm text-muted-foreground">Sede Activa</div>
                    <div className="text-2xl font-bold text-cyan-400">{currentInventory.toUpperCase()}</div>
                </div>
            </div>

            {lowStockProducts > 0 && (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-rose-400" />
                    <span className="text-rose-400">
                        Hay {lowStockProducts} productos con stock bajo
                    </span>
                </div>
            )}

            <div className="bg-card/30 rounded-2xl border border-border/50 overflow-hidden">
                <div className="p-4 border-b border-border/50 flex items-center justify-between">
                    <h2 className="font-semibold">Gestion de Productos</h2>
                    {searchQuery && (
                        <span className="text-sm text-slate-400">
                            {filteredProducts.length} resultado(s)
                        </span>
                    )}
                </div>
                <ProductTable
                    products={filteredProducts}
                    currentInventory={currentInventory}
                    onProductUpdated={handleProductUpdated}
                    onEdit={handleEdit}
                    settings={settings}
                />
            </div>

            {/* Modal de Edicion/Creacion */}
            <ProductForm
                isOpen={isFormOpen}
                onClose={handleCloseForm}
                onSubmit={handleSubmit}
                initialData={editingProduct}
                settings={settings}
            />
        </div>
    );
}
