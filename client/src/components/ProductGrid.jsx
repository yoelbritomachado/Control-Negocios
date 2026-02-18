import React, { useEffect, useState } from 'react';
import { fetchProducts } from '../api';
import { useCart } from './CartProvider';
import { FaBoxOpen, FaSearch, FaExclamationCircle } from 'react-icons/fa';
import { SafeImage } from './SafeImage';

export default function ProductGrid() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const { currentInventory, addToCart } = useCart(); // Assuming currentInventory is available
    const [search, setSearch] = useState('');

    useEffect(() => {
        loadProducts();
    }, [search]); // Reload on search

    const loadProducts = async () => {
        setLoading(true);
        try {
            const data = await fetchProducts(search);
            setProducts(data || []);
        } catch (e) {
            console.error("Failed to load products", e);
        } finally {
            setLoading(false);
        }
    };

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

    if (loading) return (
        <div className="flex flex-col items-center justify-center h-64 text-gray-500 animate-pulse">
            <FaBoxOpen className="text-4xl mb-2" />
            <span className="text-sm font-medium">Cargando catálogo...</span>
        </div>
    );

    return (
        <div className="h-full flex flex-col">
            {/* Search Bar - Floating */}
            <div className="sticky top-0 z-20 pb-6 bg-[#131517]/95 backdrop-blur-sm">
                <div className="relative group">
                    <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-pink-500 transition-colors" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre o código..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-12 pr-4 py-4 bg-[#1A1D21] border border-gray-800 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500 transition-all shadow-lg"
                        autoFocus
                    />
                </div>
            </div>

            {/* Grid */}
            {products.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-600">
                    <FaExclamationCircle className="text-4xl mb-4 opacity-50" />
                    <p>No se encontraron productos</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 pb-20">
                    {products.map((p, index) => {
                        const invId = localStorage.getItem('currentInventory') || 'mch1';
                        const stock = p.inventory && p.inventory[invId] !== undefined ? p.inventory[invId] : (p.quantity || 0);
                        const hasStock = stock > 0;
                        const uniqueKey = p?.id || p?.code || `prod-grid-${index}`;

                        const imageUrl = p.image
                            ? (p.image.startsWith('http') ? p.image : `${API_URL}${p.image}`)
                            : null;

                        return (
                            <div
                                key={uniqueKey}
                                onClick={() => hasStock && addToCart(p)}
                                className={`
                                    bg-[#1A1D21] border border-gray-800 rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 group relative
                                    ${hasStock ? 'hover:-translate-y-1 hover:shadow-xl hover:shadow-pink-900/10 hover:border-gray-700' : 'opacity-50 grayscale cursor-not-allowed'}
                                `}
                            >
                                {/* Active Selection Border Effect */}
                                <div className="absolute inset-0 border-2 border-transparent group-active:border-pink-500 rounded-2xl transition-colors pointer-events-none z-10"></div>

                                {/* Image Aspect Ratio Frame */}
                                <div className="aspect-[4/3] bg-gray-800 relative overflow-hidden">
                                    {imageUrl ? (
                                        <SafeImage
                                            src={imageUrl}
                                            alt={p.name}
                                            containerClassName="w-full h-full"
                                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                            placeholder={
                                                <div className="w-full h-full flex flex-col items-center justify-center text-gray-600 bg-gray-800/50">
                                                    <FaBoxOpen className="text-2xl mb-1 opacity-50" />
                                                    <span className="text-[10px] font-medium uppercase tracking-wider">Sin Imagen</span>
                                                </div>
                                            }
                                        />
                                    ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-600 bg-gray-800/50">
                                            <FaBoxOpen className="text-2xl mb-1 opacity-50" />
                                            <span className="text-[10px] font-medium uppercase tracking-wider">Sin Imagen</span>
                                        </div>
                                    )}

                                    {/* Badges */}
                                    <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
                                        <span className={`px-2 py-1 rounded-md text-[10px] font-bold backdrop-blur-md shadow-sm ${hasStock ? 'bg-black/60 text-white' : 'bg-red-500/90 text-white'}`}>
                                            {hasStock ? `${stock} u.` : 'AGOTADO'}
                                        </span>
                                    </div>
                                </div>

                                <div className="p-4">
                                    <h3 className="text-sm font-bold text-gray-200 line-clamp-2 leading-tight min-h-[2.5em] mb-2" title={p.name}>
                                        {p.name}
                                    </h3>

                                    <div className="flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Precio</span>
                                            <span className="text-lg font-bold text-pink-500">${p.sale_price_manual?.toFixed(2)}</span>
                                        </div>
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${hasStock ? 'bg-gray-800 text-pink-500 group-hover:bg-pink-500 group-hover:text-white' : 'bg-transparent'}`}>
                                            <span className="text-xl font-bold">+</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
