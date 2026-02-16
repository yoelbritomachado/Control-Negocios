import { useState, useRef, useEffect } from 'react';
import { useCart } from './CartProvider';
import { ChevronDown, Warehouse, Store, ShoppingBag, Check } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

const INVENTORIES = [
    { id: 'alm', name: 'Almacén MCH', color: 'text-blue-400', icon: Warehouse },
    { id: 'mch1', name: 'MCH 1', color: 'text-emerald-400', icon: Store },
    { id: 'mch2', name: 'MCH 2', color: 'text-amber-400', icon: ShoppingBag },
];

export default function InventorySelector({ minimal }) {
    const { currentInventory, setCurrentInventory } = useCart();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [dropdownRef]);

    const activeSdk = INVENTORIES.find(i => i.id === currentInventory) || INVENTORIES[0];

    return (
        <div className="relative z-50" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300",
                    "bg-white/5 border border-white/10 hover:border-white/20 hover:bg-white/10",
                    "min-w-[200px] justify-between group",
                    minimal && "min-w-[160px] px-3 py-2"
                )}
            >
                <div className="flex items-center gap-3">
                    <div className={cn("p-1.5 rounded-lg bg-white/5", activeSdk.color)}>
                        <activeSdk.icon className="w-4 h-4" />
                    </div>
                    {!minimal && (
                        <div className="text-left">
                            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Sede Activa</p>
                            <p className="text-sm font-semibold text-white">{activeSdk.name}</p>
                        </div>
                    )}
                    {minimal && (
                        <p className="text-sm font-semibold text-white">{activeSdk.name}</p>
                    )}
                </div>
                <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform duration-300", isOpen && "rotate-180")} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="absolute top-full right-0 mt-2 w-full min-w-[220px] p-1.5 rounded-xl bg-[#0F1115] border border-white/10 shadow-2xl overflow-hidden z-[60]"
                    >
                        {INVENTORIES.map((inv) => (
                            <button
                                key={inv.id}
                                onClick={() => {
                                    setCurrentInventory(inv.id);
                                    setIsOpen(false);
                                }}
                                className={cn(
                                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all relative overflow-hidden group",
                                    currentInventory === inv.id
                                        ? "bg-white/10 text-white"
                                        : "hover:bg-white/5 text-muted-foreground hover:text-white"
                                )}
                            >
                                <div className={cn("relative z-10 p-1.5 rounded-md bg-white/5 group-hover:bg-white/10 transition-colors", inv.color)}>
                                    <inv.icon className="w-4 h-4" />
                                </div>
                                <span className="relative z-10 font-medium flex-1 text-left">{inv.name}</span>
                                {currentInventory === inv.id && <Check className="w-4 h-4 text-emerald-500 relative z-10" />}
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
