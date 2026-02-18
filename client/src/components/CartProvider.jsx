import React, { createContext, useContext, useState, useEffect } from 'react';

const CartContext = createContext();

export const useCart = () => useContext(CartContext);

export const CartProvider = ({ children }) => {
    const [cart, setCart] = useState(() => {
        try {
            const saved = localStorage.getItem('mch_cart');
            return saved ? JSON.parse(saved) : [];
        } catch (e) { return []; }
    });

    const [savedSales, setSavedSales] = useState(() => {
        try {
            const saved = localStorage.getItem('mch_saved_sales');
            return saved ? JSON.parse(saved) : [];
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

    useEffect(() => {
        localStorage.setItem('mch_saved_sales', JSON.stringify(savedSales));
    }, [savedSales]);

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
