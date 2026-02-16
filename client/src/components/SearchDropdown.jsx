import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { Package2, Plus, X } from 'lucide-react';

// Componente de Dropdown usando Portal para evitar problemas de z-index
export function SearchDropdown({ 
    isOpen, 
    onClose, 
    searchResults, 
    currentInventory, 
    onSelectProduct,
    inputRef 
}) {
    const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
    const dropdownRef = useRef(null);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            const rect = inputRef.current.getBoundingClientRect();
            setPosition({
                top: rect.bottom + window.scrollY + 8,
                left: rect.left + window.scrollX,
                width: rect.width
            });
        }
    }, [isOpen, inputRef]);

    // Cerrar al hacer click fuera
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target) && 
                inputRef.current && !inputRef.current.contains(e.target)) {
                onClose();
            }
        };
        
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, onClose, inputRef]);

    if (!isOpen || searchResults.length === 0) return null;

    return createPortal(
        <motion.div
            ref={dropdownRef}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="fixed bg-[#0B1120] border border-cyan-500/30 rounded-xl shadow-2xl max-h-80 overflow-y-auto"
            style={{
                top: position.top,
                left: position.left,
                width: position.width,
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.9), 0 0 0 1px rgba(6,182,212,0.3)',
                zIndex: 99999
            }}
        >
            <div className="p-3 space-y-2">
                <div className="flex items-center justify-between px-2 pb-2 border-b border-slate-700/50">
                    <span className="text-xs text-slate-400">{searchResults.length} producto(s) encontrado(s)</span>
                    <button 
                        onClick={onClose}
                        className="p-1 hover:bg-slate-700 rounded transition-colors"
                    >
                        <X className="w-4 h-4 text-slate-400" />
                    </button>
                </div>
                
                {searchResults.map((product, index) => {
                    const stock = product.inventory?.[currentInventory] || 0;
                    return (
                        <motion.button
                            key={product.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.03 }}
                            onClick={() => {
                                onSelectProduct(product);
                                onClose();
                            }}
                            className="w-full flex items-center gap-3 p-3 rounded-lg bg-slate-800/80 hover:bg-cyan-950/50 border border-slate-700 hover:border-cyan-500/40 transition-all text-left group"
                        >
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center border border-cyan-500/30 shrink-0">
                                <Package2 className="w-5 h-5 text-cyan-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="font-semibold text-foreground truncate group-hover:text-cyan-300 transition-colors">
                                    {product.name}
                                </div>
                                <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                                    <span className="font-mono bg-slate-900 px-1.5 py-0.5 rounded text-slate-400">
                                        {product.code || 'SIN CÓDIGO'}
                                    </span>
                                    <span className="w-1 h-1 rounded-full bg-slate-600"></span>
                                    <span className={stock < 5 ? "text-rose-400 font-medium" : "text-emerald-400 font-medium"}>
                                        Stock: {stock}
                                    </span>
                                </div>
                            </div>
                            <div className="text-right shrink-0">
                                <div className="font-bold text-emerald-400 font-mono text-lg">
                                    ${product.sale_price_manual}
                                </div>
                                <div className="text-xs text-slate-500">${product.cost_mx} costo</div>
                            </div>
                            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all border border-cyan-500/40 shrink-0">
                                <Plus className="w-5 h-5 text-cyan-400" />
                            </div>
                        </motion.button>
                    );
                })}
            </div>
        </motion.div>,
        document.body
    );
}

export default SearchDropdown;
