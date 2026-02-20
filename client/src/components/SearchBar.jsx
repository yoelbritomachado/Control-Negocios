import React, { useState, useEffect, useRef, forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Loader2, Package2 } from 'lucide-react';
import { cn } from '../lib/utils';

/**
 * SearchBar - Componente de búsqueda modular y reutilizable
 * 
 * Características:
 * - Busca desde la primera letra
 * - Si escribes números, busca por precio
 * - Debounce configurable
 * - Múltiples variantes de diseño
 * - Soporte para resultados con dropdown o callback
 * 
 * @param {Object} props
 * @param {Function} props.onSearch - Callback cuando cambia la búsqueda (query, isNumber)
 * @param {Function} props.onSelect - Callback al seleccionar un resultado
 * @param {Array} props.results - Resultados a mostrar (opcional, para control externo)
 * @param {boolean} props.loading - Estado de carga
 * @param {string} props.placeholder - Texto placeholder
 * @param {string} props.variant - 'default' | 'compact' | 'large' | 'minimal'
 * @param {boolean} props.showDropdown - Mostrar dropdown de resultados
 * @param {Function} props.renderResult - Función para renderizar cada resultado
 * @param {number} props.debounceMs - Tiempo de debounce en ms (default: 200)
 * @param {boolean} props.autoFocus - Auto focus al montar
 * @param {string} props.className - Clases adicionales
 * @param {React.Ref} ref - Ref para acceder al input
 */
export const SearchBar = forwardRef(({
    value,
    onChange,
    onSearch,
    onSelect,
    results = [],
    loading = false,
    placeholder = 'Buscar producto...',
    variant = 'default',
    showDropdown = true,
    renderResult,
    debounceMs = 200,
    autoFocus = false,
    className,
    icon: CustomIcon,
    rightElement,
    inputClassName,
    dropdownClassName,
}, ref) => {
    // Estado interno (modo no controlado) o externo (modo controlado)
    const isControlled = value !== undefined;
    const [internalQuery, setInternalQuery] = useState('');
    const query = isControlled ? value : internalQuery;
    const setQuery = isControlled ? onChange : setInternalQuery;

    const [isOpen, setIsOpen] = useState(false);
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const inputRef = useRef(null);
    const containerRef = useRef(null);

    // Exponer el ref del input
    React.useImperativeHandle(ref, () => ({
        focus: () => inputRef.current?.focus(),
        clear: () => {
            setQuery('');
            setDebouncedQuery('');
            onChange?.('');
        },
        getValue: () => query,
        setValue: (val) => {
            setQuery(val);
            onChange?.(val);
        },
    }));

    // Debounce
    useEffect(() => {
        const timeout = setTimeout(() => {
            setDebouncedQuery(query);
        }, debounceMs);
        return () => clearTimeout(timeout);
    }, [query, debounceMs]);

    // Trigger search cuando cambia el debounced query
    useEffect(() => {
        if (debouncedQuery.length >= 1) {
            const isNumber = /^\d+$/.test(debouncedQuery);
            onSearch?.(debouncedQuery, isNumber);
        } else {
            onSearch?.('', false);
            setIsOpen(false);
        }
    }, [debouncedQuery, onSearch]);

    // Controlar visibilidad del dropdown basado en results
    useEffect(() => {
        if (showDropdown && results.length > 0 && debouncedQuery.length >= 1) {
            setIsOpen(true);
        } else if (results.length === 0) {
            setIsOpen(false);
        }
    }, [results.length, showDropdown, debouncedQuery.length]);

    // Cerrar dropdown al hacer click fuera
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Auto focus
    useEffect(() => {
        if (autoFocus) {
            inputRef.current?.focus();
        }
    }, [autoFocus]);

    const handleClear = () => {
        setQuery('');
        setDebouncedQuery('');
        setIsOpen(false);
        onSearch?.('', false);
        inputRef.current?.focus();
    };

    const handleSelect = (item) => {
        onSelect?.(item);
        setQuery('');
        setDebouncedQuery('');
        setIsOpen(false);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            setIsOpen(false);
        }
        if (e.key === 'Enter' && results.length > 0) {
            handleSelect(results[0]);
        }
    };

    // Variantes de diseño
    const variants = {
        default: {
            container: 'h-12',
            input: 'text-base pl-12 pr-10',
            icon: 'w-5 h-5 left-4',
            clear: 'right-3',
        },
        compact: {
            container: 'h-9',
            input: 'text-sm pl-9 pr-8',
            icon: 'w-4 h-4 left-3',
            clear: 'right-2',
        },
        large: {
            container: 'h-14',
            input: 'text-lg pl-14 pr-12',
            icon: 'w-6 h-6 left-4',
            clear: 'right-4',
        },
        minimal: {
            container: 'h-10',
            input: 'text-sm pl-9 pr-8 bg-transparent border-0 border-b border-white/20 rounded-none focus:border-cyan-500 focus:ring-0',
            icon: 'w-4 h-4 left-0',
            clear: 'right-0',
        },
    };

    const v = variants[variant] || variants.default;
    const SearchIcon = CustomIcon || Search;

    return (
        <div ref={containerRef} className={cn('relative', className)}>
            {/* Input Container */}
            <div className={cn('relative flex items-center', v.container)}>
                {/* Icono de búsqueda */}
                <SearchIcon className={cn('absolute text-muted-foreground pointer-events-none', v.icon)} />

                {/* Input */}
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => query.length >= 1 && results.length > 0 && setIsOpen(true)}
                    placeholder={placeholder}
                    className={cn(
                        'w-full bg-white/5 border border-white/10 rounded-xl text-foreground',
                        'placeholder:text-muted-foreground/50',
                        'focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50',
                        'transition-all',
                        v.input,
                        inputClassName
                    )}
                    autoComplete="off"
                />

                {/* Botón de limpiar o Loading */}
                <AnimatePresence mode="wait">
                    {loading ? (
                        <motion.div
                            key="loading"
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            className={cn('absolute', v.clear)}
                        >
                            <Loader2 className="w-4 h-4 text-cyan-500 animate-spin" />
                        </motion.div>
                    ) : query && (
                        <motion.button
                            key="clear"
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            onClick={handleClear}
                            className={cn('absolute p-1 rounded-full hover:bg-white/10 text-muted-foreground hover:text-white transition-colors', v.clear)}
                        >
                            <X className="w-4 h-4" />
                        </motion.button>
                    )}
                </AnimatePresence>

                {/* Elemento derecho opcional */}
                {rightElement && (
                    <div className="absolute right-10">{rightElement}</div>
                )}
            </div>

            {/* Dropdown de resultados */}
            <AnimatePresence>
                {showDropdown && isOpen && results.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        style={{ backgroundColor: '#0f172a' }}
                        className={cn(
                            'absolute top-full left-0 right-0 mt-2 z-40',
                            'border border-cyan-500/30 rounded-xl shadow-2xl',
                            'max-h-80 overflow-y-auto',
                            dropdownClassName
                        )}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700/50">
                            <span className="text-xs text-slate-400">
                                {results.length} resultado{results.length !== 1 ? 's' : ''}
                            </span>
                            {/^\d+$/.test(query) && (
                                <span className="text-xs text-cyan-400">
                                    Búsqueda por precio
                                </span>
                            )}
                        </div>

                        {/* Lista de resultados */}
                        <div className="p-2 space-y-1">
                            {results.map((item, index) => {
                                const safeKey = `search-item-${item.id || 'no-id'}-${index}`;
                                return renderResult ? (
                                    <div key={safeKey} onClick={() => handleSelect(item)}>
                                        {renderResult(item, index)}
                                    </div>
                                ) : (
                                    <DefaultResultItem
                                        key={safeKey}
                                        item={item}
                                        index={index}
                                        onClick={() => handleSelect(item)}
                                    />
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
});

// Item por defecto para el dropdown
function DefaultResultItem({ item, index, onClick }) {
    return (
        <motion.button
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.03 }}
            onClick={onClick}
            style={{ backgroundColor: '#1e293b' }}
            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-600 border border-slate-500 hover:border-cyan-500/40 transition-all text-left group"
        >
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center border border-cyan-500/30 shrink-0">
                <Package2 className="w-5 h-5 text-cyan-400" />
            </div>
            <div className="flex-1 min-w-0">
                <div className="font-semibold text-foreground truncate group-hover:text-cyan-300 transition-colors">
                    {item.name}
                </div>
                <div className="text-xs text-muted-foreground">
                    {item.inventory ? `Stock: ${Object.values(item.inventory)[0] || 0}` : ''}
                </div>
            </div>
            <div className="text-right shrink-0">
                <div className="font-bold text-emerald-400 font-mono">
                    ${item.sale_price_manual}
                </div>
            </div>
        </motion.button>
    );
}

SearchBar.displayName = 'SearchBar';

export default SearchBar;
