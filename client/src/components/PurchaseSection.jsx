import React, { useState, useEffect } from 'react';
import api from '../api';
import { FaBoxOpen, FaClipboardList, FaPlus, FaSearch, FaHistory, FaBarcode } from 'react-icons/fa';

export default function PurchaseSection() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);

    // Fetch Products
    useEffect(() => {
        loadProducts();
    }, []);

    const loadProducts = async () => {
        setLoading(true);
        try {
            const data = await api.fetchProducts();
            setProducts(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const filteredAndSorted = products
        .filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || (p.code && p.code.includes(search)))
        .sort((a, b) => b.quantity - a.quantity); // Sort by stock high to low

    return (
        <div className="flex flex-col h-full bg-[#08090A] text-white p-6 animate-fade-in overflow-hidden">
            {/* Header */}
            <div className="flex justify-between items-center mb-8 shrink-0">
                <div>
                    <h1 className="text-3xl font-bold font-outfit tracking-tight flex items-center gap-3">
                        <FaClipboardList className="text-pink-500" />
                        Gestión de Compras
                    </h1>
                    <p className="text-gray-400 text-sm mt-1">Control de inventario y entradas de mercancía</p>
                </div>
                <div className="flex gap-3">
                    <button className="btn-primary flex items-center gap-2">
                        <FaHistory /> Historial Entradas
                    </button>
                    <button onClick={() => setShowAddModal(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-6 rounded-xl shadow-lg shadow-emerald-900/40 transition-all hover:-translate-y-1 flex items-center gap-2">
                        <FaPlus /> Nueva Entrada
                    </button>
                </div>
            </div>

            {/* Metrics Cards (Optional, based on legacy) */}
            <div className="grid grid-cols-4 gap-6 mb-8 shrink-0">
                <div className="card-glass p-6 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-pink-500/10 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                    <div className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">Total Productos</div>
                    <div className="text-4xl font-black">{products.length}</div>
                </div>
                <div className="card-glass p-6 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/10 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                    <div className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">Valor Inventario</div>
                    <div className="text-4xl font-black text-blue-400">$ {(products.reduce((acc, p) => acc + (p.cost_usd || 0) * (p.quantity || 0), 0)).toFixed(2)}</div>
                    <div className="text-xs text-gray-500">USD Estimado</div>
                </div>
                <div className="card-glass p-6 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/10 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                    <div className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">Stock Total</div>
                    <div className="text-4xl font-black text-emerald-400">{products.reduce((acc, p) => acc + (p.quantity || 0), 0)}</div>
                    <div className="text-xs text-gray-500">Unidades Físicas</div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col card-glass overflow-hidden">
                {/* Search Toolbar */}
                <div className="p-4 border-b border-white/5 flex gap-4 bg-white/5 backdrop-blur-md">
                    <div className="relative flex-1">
                        <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input
                            type="text"
                            placeholder="Buscar por nombre, código..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="input-premium pl-12"
                        />
                    </div>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-black/20 text-gray-400 text-xs uppercase sticky top-0 backdrop-blur-sm z-10">
                            <tr>
                                <th className="p-4 font-bold tracking-wider">Producto</th>
                                <th className="p-4 font-bold tracking-wider text-center">Código</th>
                                <th className="p-4 font-bold tracking-wider text-right">Costo (USD)</th>
                                <th className="p-4 font-bold tracking-wider text-right">Precio (MN)</th>
                                <th className="p-4 font-bold tracking-wider text-center">Stock</th>
                                <th className="p-4 font-bold tracking-wider text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-sm">
                            {loading ? (
                                <tr><td colSpan="6" className="p-10 text-center text-gray-500"><FaBoxOpen className="mx-auto text-4xl mb-2 opacity-50" /> Cargando inventario...</td></tr>
                            ) : filteredAndSorted.length === 0 ? (
                                <tr><td colSpan="6" className="p-10 text-center text-gray-500">No se encontraron productos.</td></tr>
                            ) : (
                                filteredAndSorted.map(p => (
                                    <tr key={p.id} className="hover:bg-white/5 transition-colors group">
                                        <td className="p-4 font-medium text-white flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-gray-800 border border-gray-700 overflow-hidden shrink-0">
                                                {p.image_url ? <img src={p.image_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-600"><FaBoxOpen /></div>}
                                            </div>
                                            {p.name}
                                        </td>
                                        <td className="p-4 text-center font-mono text-gray-400">{p.code || '-'}</td>
                                        <td className="p-4 text-right font-mono text-blue-300 font-bold">${p.cost_usd}</td>
                                        <td className="p-4 text-right font-mono text-emerald-300 font-bold">${p.sale_price_manual}</td>
                                        <td className="p-4 text-center">
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${p.quantity > 5 ? 'bg-emerald-500/20 text-emerald-500' : 'bg-red-500/20 text-red-500'}`}>
                                                {p.quantity} un.
                                            </span>
                                        </td>
                                        <td className="p-4 text-center">
                                            <button className="text-gray-500 hover:text-white transition-colors px-3 py-1 hover:bg-white/10 rounded">Editar</button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add Modal Placeholder (To be implemented fully if requested) */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setShowAddModal(false)}>
                    <div className="bg-[#1A1D21] p-8 rounded-2xl w-full max-w-md border border-gray-700 text-center animate-scale-in" onClick={e => e.stopPropagation()}>
                        <h2 className="text-2xl font-bold mb-4">Nueva Entrada</h2>
                        <p className="text-gray-400 mb-6">Esta funcionalidad abrirá el formulario completo de registro de productos (similar a Entradas legacy).</p>
                        <button onClick={() => setShowAddModal(false)} className="btn-primary w-full">Entendido</button>
                    </div>
                </div>
            )}
        </div>
    );
}
