import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import ProductTable from '../components/ProductTable';
import ProductForm from '../components/ProductForm';
import ProductDetailModal from '../components/ProductDetailModal';
import Gallery from '../components/Gallery';
import { useCart } from '../components/CartProvider';
import { useRole } from '../hooks/useRole';
import { fetchProducts, fetchSettings, updateProduct, createProduct, deleteProduct, deleteProductsBulk } from '../api';
import { 
  Package, 
  AlertCircle, 
  Plus, 
  Search, 
  X, 
  List, 
  LayoutGrid, 
  FileSpreadsheet, 
  FileText,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  Square,
  Trash2,
  DollarSign,
  TrendingUp,
  Boxes,
  AlertTriangle,
  Ban
} from 'lucide-react';

export default function InventoryPage() {
  const { currentInventory } = useCart();
  const { isSeller, isAdmin, isOwner } = useRole();

  // Estados de datos
  const [products, setProducts] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);

  // Filtros y vistas persistidas en localStorage
  const [searchQuery, setSearchQuery] = useState('');
  const [stockFilter, setStockFilter] = useState(() => localStorage.getItem('mch_inv_stock_filter') || 'all'); // 'all' | 'low' | 'zero' | 'available'
  const [sortMode, setSortMode] = useState(() => localStorage.getItem('mch_inv_sort_mode') || 'original');
  const [labelFilter, setLabelFilter] = useState(() => localStorage.getItem('mch_inv_label_filter') || 'all');
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('mch_inv_view_mode') || 'list');
  const [statsExpanded, setStatsExpanded] = useState(() => localStorage.getItem('mch_inv_stats_expanded') === 'true');

  // Modo Selección y Selección masiva
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);

  // Modales
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [viewGallery, setViewGallery] = useState(null);
  const [detailProduct, setDetailProduct] = useState(null);

  // Guardar configuración de filtros
  useEffect(() => {
    localStorage.setItem('mch_inv_stock_filter', stockFilter);
  }, [stockFilter]);

  useEffect(() => {
    localStorage.setItem('mch_inv_sort_mode', sortMode);
  }, [sortMode]);

  useEffect(() => {
    localStorage.setItem('mch_inv_label_filter', labelFilter);
  }, [labelFilter]);

  useEffect(() => {
    localStorage.setItem('mch_inv_view_mode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    localStorage.setItem('mch_inv_stats_expanded', statsExpanded ? 'true' : 'false');
  }, [statsExpanded]);

  // Cargar productos y configuración
  useEffect(() => {
    loadData();
  }, [currentInventory, refresh]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [prods, sets] = await Promise.all([
        fetchProducts('', currentInventory),
        fetchSettings()
      ]);
      setProducts(Array.isArray(prods) ? prods : []);
      setSettings(sets || {});
    } catch (e) {
      console.error("Error al cargar inventario:", e);
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
        await updateProduct(editingProduct.id, formData);
      } else {
        await createProduct(formData);
      }
      handleProductUpdated();
      handleCloseForm();
    } catch (e) {
      console.error("Error al guardar producto:", e);
      alert("Error al guardar el producto");
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteProduct(id);
      setSelectedProductIds(prev => prev.filter(item => item !== id));
      handleProductUpdated();
    } catch (e) {
      console.error("Error al eliminar producto:", e);
      alert("Error al eliminar producto");
    }
  };

  // Manejo de Selección
  const toggleSelectMode = () => {
    if (isSelectMode) {
      setIsSelectMode(false);
      setSelectedProductIds([]);
    } else {
      setIsSelectMode(true);
    }
  };

  const handleSelectProduct = (productId) => {
    setSelectedProductIds(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId) 
        : [...prev, productId]
    );
  };

  const handleSelectAllVisible = () => {
    const visibleIds = filteredProducts.map(p => p.id);
    const allSelected = visibleIds.every(id => selectedProductIds.includes(id));
    if (allSelected) {
      setSelectedProductIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setSelectedProductIds(prev => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedProductIds.length === 0) return;
    
    const count = selectedProductIds.length;
    const msg = `¿Estás completamente seguro de eliminar ${count} producto(s) seleccionado(s)?\n\nEsta acción es irreversible y eliminará el stock, imágenes y datos de estos productos.`;
    if (!confirm(msg)) return;

    setIsDeletingBulk(true);
    try {
      await deleteProductsBulk(selectedProductIds);
      setSelectedProductIds([]);
      setIsSelectMode(false);
      handleProductUpdated();
    } catch (e) {
      console.error("Error al eliminar productos seleccionados:", e);
      alert("Ocurrió un error al eliminar los productos seleccionados.");
    } finally {
      setIsDeletingBulk(false);
    }
  };

  // Opciones de colores de etiqueta
  const labelOptions = [
    { value: 'all', label: 'Todas las etiquetas' },
    { value: 'none', label: 'Sin etiqueta' },
    { value: 'red', label: 'Roja' },
    { value: 'blue', label: 'Azul' },
    { value: 'green', label: 'Verde' },
    { value: 'yellow', label: 'Amarilla' },
    { value: 'purple', label: 'Morada' }
  ];

  // Helper para obtener el stock de una sede
  const getProductStock = (p) => {
    if (currentInventory && p.inventory && p.inventory[currentInventory] !== undefined) {
      return p.inventory[currentInventory];
    }
    return p.quantity ?? p.total_quantity ?? 0;
  };

  // Filtrado y Ordenamiento
  const filteredProducts = useMemo(() => {
    const cleanSearch = searchQuery.trim().toLowerCase();

    const visible = products.filter(p => {
      const nameMatch = (p.name || '').toLowerCase().includes(cleanSearch);
      const codeMatch = (p.code || '').toLowerCase().includes(cleanSearch);
      const matchesSearch = !cleanSearch || nameMatch || codeMatch;

      const productLabel = p.label_color || 'none';
      const matchesLabel = labelFilter === 'all' || productLabel === labelFilter;

      const stock = getProductStock(p);
      let matchesStock = true;
      if (stockFilter === 'zero') {
        matchesStock = stock === 0;
      } else if (stockFilter === 'low') {
        matchesStock = stock > 0 && stock <= 5;
      } else if (stockFilter === 'available') {
        matchesStock = stock > 0;
      }

      return matchesSearch && matchesLabel && matchesStock;
    });

    const sorted = [...visible];
    if (sortMode === 'name_asc' || sortMode === 'name_desc') {
      sorted.sort((a, b) => {
        const comp = (a.name || '').localeCompare(b.name || '', 'es', { sensitivity: 'base', numeric: true });
        return sortMode === 'name_asc' ? comp : -comp;
      });
    }

    return sorted;
  }, [products, searchQuery, labelFilter, stockFilter, sortMode, currentInventory]);

  // Totales y estadísticas completas
  const totalProducts = products.length;
  const zeroStockProducts = useMemo(() => {
    return products.filter(p => getProductStock(p) === 0).length;
  }, [products, currentInventory]);

  const lowStockProducts = useMemo(() => {
    return products.filter(p => {
      const st = getProductStock(p);
      return st > 0 && st <= 5;
    }).length;
  }, [products, currentInventory]);

  const inStockProducts = useMemo(() => {
    return products.filter(p => getProductStock(p) > 0).length;
  }, [products, currentInventory]);

  const totalUnits = useMemo(() => {
    return products.reduce((acc, p) => acc + (getProductStock(p) || 0), 0);
  }, [products, currentInventory]);

  // Valor total de venta y costo estimado en la sede
  const totalSaleValue = useMemo(() => {
    return products.reduce((acc, p) => {
      const stock = getProductStock(p);
      const price = parseFloat(p.actual_sale_price ?? p.sale_price_manual ?? 0) || 0;
      return acc + (stock * price);
    }, 0);
  }, [products, currentInventory]);

  const totalCostMNValue = useMemo(() => {
    return products.reduce((acc, p) => {
      const stock = getProductStock(p);
      const cost = parseFloat(p.cost_mn ?? 0) || 0;
      return acc + (stock * cost);
    }, 0);
  }, [products, currentInventory]);

  // Exportar a Excel
  const exportToExcel = () => {
    const exportData = filteredProducts.map(p => {
      const qty = getProductStock(p);

      const row = {
        'Producto': p.name,
        'Código': p.code || '',
        'Cantidad': qty,
        'Precio de Venta MN': parseFloat(p.actual_sale_price ?? p.sale_price_manual) || 0,
      };

      if (!isSeller) {
        row['Costo MX'] = p.cost_mx || 0;
        row['Costo MN'] = parseFloat(p.cost_mn) || 0;
        row['Margen %'] = parseFloat(p.margin_percent) || 0;
      }

      return row;
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Inventario_${currentInventory.toUpperCase()}`);
    XLSX.writeFile(wb, `Inventario_${currentInventory.toUpperCase()}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Exportar a PDF
  const exportToPDF = async () => {
    const doc = new jsPDF();
    doc.text(`Miss Chulerías - Inventario (${currentInventory.toUpperCase()})`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 14, 22);

    const loadImage = (url) => {
      return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.src = url;
        img.onload = () => {
          const size = 500;
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');

          let sWidth = img.width;
          let sHeight = img.height;
          let sx = 0;
          let sy = 0;

          const aspect = sWidth / sHeight;
          if (aspect > 1) {
            const newWidth = sHeight;
            sx = (sWidth - newWidth) / 2;
            sWidth = newWidth;
          } else {
            const newHeight = sWidth;
            sy = (sHeight - newHeight) / 2;
            sHeight = newHeight;
          }

          ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, size, size);
          resolve(canvas.toDataURL('image/jpeg'));
        };
        img.onerror = () => resolve(null);
      });
    };

    const rowsWithImages = await Promise.all(filteredProducts.map(async (p) => {
      const productImages = (Array.isArray(p.images) && p.images.length > 0)
        ? p.images
        : (p.image ? [p.image] : []);
      const uniqueImages = [...new Set(productImages)].slice(0, 10);
      const imageData = (await Promise.all(uniqueImages.map(loadImage))).filter(Boolean);
      return { ...p, imageData };
    }));

    const margin = 7;
    const startX = margin;
    const startY = 25;
    const gapX = 2.5;
    const gapY = 3;
    const innerGap = 2.5;
    const innerMargin = 2.5;
    const columnsPerRow = 5;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const availableWidth = pageWidth - margin * 2;
    const slotWidth = (availableWidth - gapX * (columnsPerRow - 1)) / columnsPerRow;
    const photoSize = slotWidth - innerMargin * 2;
    const titleHeight = 10;
    const priceHeight = 10;

    let x = startX;
    let y = startY;
    let usedSlots = 0;
    let rowHeight = 0;

    const getProductLayout = (p) => {
      const imageCount = Math.max(1, p.imageData.length);
      const columns = Math.min(columnsPerRow, imageCount);
      const imageRows = Math.ceil(imageCount / columnsPerRow);
      const cardWidth = columns * slotWidth + (columns - 1) * gapX;
      const imagesHeight = imageRows * photoSize + (imageRows - 1) * innerGap;
      const bottomSectionHeight = p.imageData.length >= 2 ? innerMargin : priceHeight;
      return {
        imageCount,
        columns,
        imageRows,
        cardWidth,
        imagesHeight,
        cardHeight: titleHeight + innerMargin + imagesHeight + bottomSectionHeight
      };
    };

    const drawProductCard = (p, cardX, cardY, layout) => {
      const { cardWidth, imagesHeight } = layout;
      const contentY = cardY + titleHeight;

      const labelBorderColors = {
        red: [185, 28, 28],
        blue: [29, 78, 216],
        green: [21, 128, 61],
        yellow: [161, 98, 7],
        purple: [126, 34, 206],
        none: [75, 85, 99]
      };
      const borderColor = labelBorderColors[p.label_color] || labelBorderColors.none;
      doc.setDrawColor(...borderColor);
      doc.setLineWidth(0.9);
      doc.rect(cardX, cardY, cardWidth, layout.cardHeight);

      // Card Header
      doc.setFillColor(30, 41, 59);
      doc.rect(cardX, cardY, cardWidth, titleHeight, 'F');
      doc.setFontSize(7.5);
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      const titleLines = doc.splitTextToSize(p.name || 'Sin nombre', cardWidth - 4);
      doc.text(titleLines.slice(0, 2), cardX + 2, cardY + 4);

      // Photos
      const photosToDraw = p.imageData.slice(0, 10);
      photosToDraw.forEach((dataUrl, imgIndex) => {
        const colIndex = imgIndex % columnsPerRow;
        const rowIndex = Math.floor(imgIndex / columnsPerRow);
        const imageX = cardX + innerMargin + colIndex * (photoSize + innerGap);
        const imageY = contentY + innerMargin + rowIndex * (photoSize + innerGap);

        if (dataUrl) {
          doc.addImage(dataUrl, 'JPEG', imageX, imageY, photoSize, photoSize, undefined, 'FAST');
        }
      });

      const qty = getProductStock(p);
      const qtyText = `x${qty}`;
      const priceText = `$${Number(p.actual_sale_price ?? p.sale_price_manual ?? 0).toFixed(2)}`;

      const lastIndex = Math.max(0, photosToDraw.length - 1);
      const lastCol = lastIndex % columnsPerRow;
      const lastRow = Math.floor(lastIndex / columnsPerRow);
      const lastImageX = cardX + innerMargin + lastCol * (photoSize + innerGap);
      const lastImageY = contentY + innerMargin + lastRow * (photoSize + innerGap);

      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      const qtyWidth = doc.getTextWidth(qtyText) + 4;
      doc.setFillColor(0, 0, 0);
      doc.rect(lastImageX + photoSize - qtyWidth, lastImageY, qtyWidth, 7, 'F');
      doc.setTextColor(255, 255, 255);
      doc.text(qtyText, lastImageX + photoSize - qtyWidth / 2, lastImageY + 5, { align: 'center' });

      const priceY = contentY + innerMargin + imagesHeight;
      doc.setFillColor(245, 245, 245);
      doc.rect(cardX, priceY, cardWidth, priceHeight, 'F');
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.text(priceText, cardX + cardWidth / 2, priceY + 6.5, { align: 'center' });
    };

    rowsWithImages.forEach((p) => {
      const layout = getProductLayout(p);
      const neededSlots = layout.imageCount > columnsPerRow ? columnsPerRow : layout.columns;

      if (usedSlots > 0 && usedSlots + neededSlots > columnsPerRow) {
        x = startX;
        y += rowHeight + gapY;
        usedSlots = 0;
        rowHeight = 0;
      }

      if (y + layout.cardHeight > pageHeight - margin) {
        doc.addPage();
        x = startX;
        y = startY;
        usedSlots = 0;
        rowHeight = 0;
      }

      drawProductCard(p, x, y, layout);
      rowHeight = Math.max(rowHeight, layout.cardHeight);
      x += layout.cardWidth + gapX;
      usedSlots += neededSlots;

      if (usedSlots >= columnsPerRow) {
        x = startX;
        y += rowHeight + gapY;
        usedSlots = 0;
        rowHeight = 0;
      }
    });

    doc.save(`Inventario_${currentInventory.toUpperCase()}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

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

  const allVisibleSelected = filteredProducts.length > 0 && filteredProducts.every(p => selectedProductIds.includes(p.id));

  return (
    <div className="h-full overflow-y-auto p-3 sm:p-6 space-y-4">
      {/* 1. Panel Plegable de Estadísticas */}
      <div className="bg-card/40 dark:bg-slate-900/60 rounded-2xl border border-slate-700/60 shadow-sm overflow-hidden transition-all">
        {/* Cabecera compacta de estadísticas con botón expandir/plegar */}
        <div 
          onClick={() => setStatsExpanded(!statsExpanded)}
          className="p-3 sm:px-5 flex items-center justify-between cursor-pointer hover:bg-slate-800/40 select-none transition-colors"
        >
          <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-xs sm:text-sm">
            <div className="flex items-center gap-2">
              <Boxes className="w-4 h-4 text-cyan-400" />
              <span className="text-slate-400 font-medium">Catálogo:</span>
              <span className="font-bold font-mono text-white">{totalProducts}</span>
            </div>

            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-emerald-400" />
              <span className="text-slate-400 font-medium">En Stock:</span>
              <span className="font-bold font-mono text-emerald-400">{inStockProducts}</span>
            </div>

            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span className="text-slate-400 font-medium">Stock Bajo:</span>
              <span className="font-bold font-mono text-amber-400">{lowStockProducts}</span>
            </div>

            <div className="flex items-center gap-2">
              <Ban className="w-4 h-4 text-rose-400" />
              <span className="text-slate-400 font-medium">En Cero:</span>
              <span className="font-bold font-mono text-rose-400">{zeroStockProducts}</span>
            </div>
          </div>

          <button
            type="button"
            className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800/60 border border-slate-700/60 transition-colors"
            title={statsExpanded ? "Recoger estadísticas" : "Expandir estadísticas"}
          >
            <span className="hidden md:inline">{statsExpanded ? "Menos detalles" : "Más estadísticas"}</span>
            {statsExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* Contenido expandido de estadísticas */}
        {statsExpanded && (
          <div className="p-4 sm:p-5 pt-1 sm:pt-2 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
            <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700/40 min-w-0 overflow-hidden">
              <div className="text-[11px] text-slate-400 font-medium truncate">Total Unidades</div>
              <div className="text-base sm:text-xl font-bold font-mono text-white mt-1 truncate">
                {totalUnits.toLocaleString('es-ES')} <span className="text-xs text-slate-400 font-normal">u.</span>
              </div>
            </div>

            <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700/40 min-w-0 overflow-hidden">
              <div className="text-[11px] text-slate-400 font-medium truncate">Valor Total Venta</div>
              <div className="text-base sm:text-xl font-bold font-mono text-emerald-400 mt-1 truncate" title={`$${totalSaleValue.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MN`}>
                ${totalSaleValue.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} <span className="text-xs text-emerald-500/70 font-normal">MN</span>
              </div>
            </div>

            {!isSeller && (
              <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700/40 min-w-0 overflow-hidden">
                <div className="text-[11px] text-slate-400 font-medium truncate">Costo Total Estimado</div>
                <div className="text-base sm:text-xl font-bold font-mono text-indigo-400 mt-1 truncate" title={`$${totalCostMNValue.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MN`}>
                  ${totalCostMNValue.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} <span className="text-xs text-indigo-400/70 font-normal">MN</span>
                </div>
              </div>
            )}

            {!isSeller && (
              <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700/40 min-w-0 overflow-hidden">
                <div className="text-[11px] text-slate-400 font-medium truncate">Ganancia Potencial</div>
                <div className="text-base sm:text-xl font-bold font-mono text-amber-400 mt-1 truncate" title={`$${Math.max(0, totalSaleValue - totalCostMNValue).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MN`}>
                  ${Math.max(0, totalSaleValue - totalCostMNValue).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} <span className="text-xs text-amber-400/70 font-normal">MN</span>
                </div>
              </div>
            )}

            <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700/40 min-w-0 overflow-hidden col-span-2 sm:col-span-1">
              <div className="text-[11px] text-slate-400 font-medium truncate">% Disponibilidad</div>
              <div className="text-base sm:text-xl font-bold font-mono text-cyan-400 mt-1 truncate">
                {totalProducts > 0 ? ((inStockProducts / totalProducts) * 100).toFixed(1) : 0}%
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. Barra de Herramientas: Buscador, Filtros de Stock, A-Z, Etiquetas, Vistas y Acciones */}
      <div className="flex flex-wrap gap-2.5 items-center justify-between bg-card/30 p-2.5 sm:p-3 rounded-2xl border border-border/50">
        {/* Buscador */}
        <div className="relative flex-1 min-w-[200px] sm:min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre o código..."
            className="w-full pl-9 pr-9 py-2 bg-slate-800/60 border border-slate-700 rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:border-cyan-500 text-xs sm:text-sm h-9"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Grupo de Controles y Filtros */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Selector de Nivel de Stock */}
          <select
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value)}
            className="px-2.5 py-1.5 h-9 rounded-xl border border-slate-700 bg-slate-800 text-foreground text-xs font-bold shadow-sm outline-none focus:border-cyan-500 cursor-pointer"
            title="Filtrar por nivel de existencias"
          >
            <option value="all">📦 Todo el stock</option>
            <option value="low">⚠️ Stock Bajo (≤ 5)</option>
            <option value="zero">🚫 Stock en Cero (0)</option>
            <option value="available">✅ Con Stock (&gt; 0)</option>
          </select>

          {/* Orden A-Z */}
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value)}
            className="px-2.5 py-1.5 h-9 rounded-xl border border-slate-700 bg-slate-800 text-foreground text-xs font-bold shadow-sm outline-none focus:border-cyan-500 cursor-pointer"
            title="Ordenar productos"
          >
            <option value="original">Orden original</option>
            <option value="name_asc">Nombre A-Z</option>
            <option value="name_desc">Nombre Z-A</option>
          </select>

          {/* Etiquetas */}
          <select
            value={labelFilter}
            onChange={(e) => setLabelFilter(e.target.value)}
            className="px-2.5 py-1.5 h-9 rounded-xl border border-slate-700 bg-slate-800 text-foreground text-xs font-bold shadow-sm outline-none focus:border-cyan-500 cursor-pointer"
            title="Filtrar por color de etiqueta"
          >
            {labelOptions.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>

          {/* Switch Modo Lista / Cuadrícula */}
          <div className="flex items-center bg-slate-800 border border-slate-700 rounded-xl overflow-hidden h-9">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`px-2.5 h-full text-xs font-bold transition-colors flex items-center justify-center ${
                viewMode === 'list' ? 'bg-cyan-500 text-white' : 'text-slate-400 hover:bg-slate-700'
              }`}
              title="Vista Lista"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`px-2.5 h-full text-xs font-bold transition-colors flex items-center justify-center ${
                viewMode === 'grid' ? 'bg-cyan-500 text-white' : 'text-slate-400 hover:bg-slate-700'
              }`}
              title="Vista Cuadrícula"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>

          {/* Exportar Excel */}
          <button
            onClick={exportToExcel}
            className="flex items-center gap-1.5 px-3 h-9 bg-emerald-600/80 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm whitespace-nowrap"
            title="Descargar Excel"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Excel</span>
          </button>

          {/* Exportar PDF */}
          <button
            onClick={exportToPDF}
            className="flex items-center gap-1.5 px-3 h-9 bg-rose-600/80 hover:bg-rose-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm whitespace-nowrap"
            title="Descargar Catálogo PDF"
          >
            <FileText className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">PDF</span>
          </button>

          {/* Botón Modo Selección (Solo Admin / Dueño) */}
          {!isSeller && (isAdmin || isOwner) && (
            <button
              type="button"
              onClick={toggleSelectMode}
              className={`flex items-center gap-1.5 px-3 h-9 rounded-xl text-xs font-bold transition-all shadow-sm whitespace-nowrap border ${
                isSelectMode
                  ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-400 shadow-amber-500/20'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
              title={isSelectMode ? "Salir del modo selección" : "Activar selección múltiple de productos"}
            >
              <CheckSquare className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{isSelectMode ? "Cancelar" : "Seleccionar"}</span>
            </button>
          )}

          {/* Botón Nuevo Producto (Solo Admin / Dueño) */}
          {!isSeller && (isAdmin || isOwner) && (
            <button
              onClick={() => {
                setEditingProduct(null);
                setIsFormOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 h-9 bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm whitespace-nowrap"
            >
              <Plus className="w-4 h-4 flex-shrink-0" />
              <span>Nuevo</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. Barra flotante / destacada de acciones de Selección Múltiple */}
      {isSelectMode && (
        <div className="bg-rose-950/40 border border-rose-500/40 p-3 sm:px-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSelectAllVisible}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-200 hover:text-white px-2.5 py-1.5 bg-slate-800/80 hover:bg-slate-700 rounded-lg border border-slate-600/60 transition-colors"
            >
              {allVisibleSelected ? <CheckSquare className="w-4 h-4 text-rose-400" /> : <Square className="w-4 h-4" />}
              <span>{allVisibleSelected ? "Desmarcar todos" : "Seleccionar visibles"}</span>
            </button>

            <span className="text-xs font-bold text-rose-300">
              {selectedProductIds.length} producto(s) seleccionado(s)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={selectedProductIds.length === 0 || isDeletingBulk}
              onClick={handleBulkDelete}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{isDeletingBulk ? "Borrando..." : `Eliminar seleccionados (${selectedProductIds.length})`}</span>
            </button>
          </div>
        </div>
      )}

      {/* 4. Tabla / Cuadrícula de Productos */}
      <div>
        <div className="flex items-center justify-between pb-2">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-sm sm:text-base text-foreground">Listado de Inventario</h2>
            {stockFilter !== 'all' && (
              <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-slate-800 text-cyan-400 border border-slate-700">
                {stockFilter === 'zero' ? 'Filtro: En Cero' : stockFilter === 'low' ? 'Filtro: Stock Bajo' : 'Filtro: Con Stock'}
              </span>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            Mostrando {filteredProducts.length} de {totalProducts} producto(s)
          </span>
        </div>
        <ProductTable
          products={filteredProducts}
          currentInventory={currentInventory}
          onProductUpdated={handleProductUpdated}
          onEdit={handleEdit}
          onDelete={handleDelete}
          setViewGallery={setViewGallery}
          onProductClick={(prod) => setDetailProduct(prod)}
          settings={settings}
          viewMode={viewMode}
          isSelectMode={isSelectMode}
          selectedProductIds={selectedProductIds}
          onSelectProduct={handleSelectProduct}
        />
      </div>

      {/* 5. Modal de Creación / Edición */}
      <ProductForm
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        onSubmit={handleSubmit}
        initialData={editingProduct}
        settings={settings}
      />

      {/* 6. Modal de Detalles y Estadísticas (Para Vendedor / Consulta Rápida) */}
      <ProductDetailModal
        product={detailProduct}
        isOpen={Boolean(detailProduct)}
        onClose={() => setDetailProduct(null)}
        currentInventory={currentInventory}
        onViewGallery={setViewGallery}
        isSeller={isSeller}
      />

      {/* 7. Visor de Galería a Pantalla Completa */}
      <Gallery
        viewGallery={viewGallery}
        setViewGallery={setViewGallery}
      />
    </div>
  );
}
