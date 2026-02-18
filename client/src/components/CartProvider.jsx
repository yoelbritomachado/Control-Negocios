import React, { createContext, useContext, useState, useEffect } from 'react';

const CartContext = createContext();

export const useCart = () => useContext(CartContext);

// Helper para detectar IDs temporales
const isTempId = (id) => {
    if (!id) return true;
    const strId = String(id);
    return strId.startsWith('session_') || strId.startsWith('temp_');
};

// Función para limpiar ventas con IDs temporales
const cleanSavedSales = (sales) => {
    if (!Array.isArray(sales)) return [];
    const cleaned = sales.filter(sale => {
        const hasTempItems = sale.items?.some(item => 
            isTempId(item.id) && isTempId(item.product_id)
        );
        return !hasTempItems;
    });
    const removedCount = sales.length - cleaned.length;
    if (removedCount > 0) {
        console.log(`🧹 Se eliminaron ${removedCount} venta(s) guardada(s) con IDs temporales`);
    }
    return cleaned;
};

export const CartProvider = ({ children }) => {
    const [cart, setCart] = useState(() => {
        try {
            const saved = localStorage.getItem('mch_cart');
            const parsed = saved ? JSON.parse(saved) : [];
            // Limpiar carrito de items con IDs temporales
            const cleaned = parsed.filter(item => !isTempId(item.id));
            const removed = parsed.length - cleaned.length;
            if (removed > 0) {
                console.log(`🧹 Se eliminaron ${removed} producto(s) con IDs temporales del carrito`);
            }
            return cleaned;
        } catch (e) { return []; }
    });

    const [savedSales, setSavedSales] = useState(() => {
        try {
            const saved = localStorage.getItem('mch_saved_sales');
            const parsed = saved ? JSON.parse(saved) : [];
            return cleanSavedSales(parsed);
        } catch (e) { return []; }
    });

    const [editingSession, setEditingSession] = useState(() => {
        try {
            const saved = localStorage.getItem('editing_session');
            return saved ? JSON.parse(saved) : null;
        } catch (e) { return null; }
    });

    const [currentInventory, setCurrentInventory] = useState(
        localStorage.getItem('mch_inventory') || 'alm'
    );

    useEffect(() => {
        localStorage.setItem('mch_cart', JSON.stringify(cart));
    }, [cart]);

    // Limpiar carrito de items con IDs temporales al iniciar
    useEffect(() => {
        setCart(prev => prev.filter(item => !isTempId(item.id)));
    }, []);

    useEffect(() => {
        localStorage.setItem('mch_saved_sales', JSON.stringify(savedSales));
    }, [savedSales]);

    // Limpiar ventas con IDs temporales al iniciar
    useEffect(() => {
        setSavedSales(prev => cleanSavedSales(prev));
    }, []);

    useEffect(() => {
        if (editingSession) {
            localStorage.setItem('editing_session', JSON.stringify(editingSession));
        } else {
            localStorage.removeItem('editing_session');
        }
    }, [editingSession]);

    useEffect(() => {
        localStorage.setItem('mch_inventory', currentInventory);
    }, [currentInventory]);

    const addToCart = (product, quantity = 1) => {
        setCart(prev => {
            const existing = prev.find(item => item.id === product.id);
            if (existing) {
                return prev.map(item =>
                    item.id === product.id
                        ? { ...item, quantity: item.quantity + quantity }
                        : item
                );
            }
            return [...prev, { ...product, quantity }];
        });
    };

    const removeFromCart = (productId) => {
        setCart(prev => prev.filter(item => item.id !== productId));
    };

    const updateQuantity = (productId, quantity) => {
        if (quantity <= 0) {
            removeFromCart(productId);
            return;
        }
        setCart(prev => prev.map(item =>
            item.id === productId ? { ...item, quantity } : item
        ));
    };

    const clearCart = () => setCart([]);

    const total = cart.reduce((sum, item) => {
        const price = item.sale_price_manual || 0;
        return sum + (price * item.quantity);
    }, 0);

    return (
        <CartContext.Provider value={{
            cart,
            setCart,
            addToCart,
            removeFromCart,
            updateQuantity,
            clearCart,
            total,
            currentInventory,
            setCurrentInventory,
            savedSales,
            setSavedSales,
            editingSession,
            setEditingSession
        }}>
            {children}
        </CartContext.Provider>
    );
};
