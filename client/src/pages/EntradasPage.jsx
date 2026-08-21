import React, { useState, useEffect, useMemo, useCallback } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  fetchProducts, 
  fetchSettings, 
  createProduct,
  updateProduct, 
  deleteProduct,
  unifyProducts 
} from '../api';
import { useCart } from '../components/CartProvider';
import ProductTable from '../components/ProductTable';
import ProductForm from '../components/ProductForm';
import Gallery from '../components/Gallery';

import { 
  Plus, 
  Search, 
  X, 
  List, 
  LayoutGrid, 
  Layers, 
  FileSpreadsheet, 
  FileText, 
  AlertCircle,
  Sparkles,
  TrendingUp,
  DollarSign,
  PackageCheck
} from 'lucide-react';

export default function EntradasPage() {
  const { currentInventory } = useCart();

  // Estados de datos
  const [products, setProducts] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);

  // Filtros y ordenamiento persistidos
  const [searchTerm, setSearchTerm] = useState('');
  const [sortMode, setSortMode] = useState(() => localStorage.getItem('mch_sort_mode') || 'original');
  const [labelFilter, setLabelFilter] = useState(() => localStorage.getItem('mch_label_filter') || 'all');
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('mch_view_mode') || 'list');

  // Modales y formularios
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [viewGallery, setViewGallery] = useState(null);

  // Unificación de productos
  const [isUnifyMode, setIsUnifyMode] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [unifyDraft, setUnifyDraft] = useState(null);

  // Guardar configuración de filtros en localStorage
  useEffect(() => {
    localStorage.setItem('mch_sort_mode', sortMode);
  }, [sortMode]);

  useEffect(() => {
    localStorage.setItem('mch_label_filter', labelFilter);
  }, [labelFilter]);

  useEffect(() => {
    localStorage.setItem('mch_view_mode', viewMode);
  }, [viewMode]);

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
      console.error('Error al cargar datos del inventario:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleProductUpdated = () => {
    setRefresh(prev => prev + 1);
  };

  // Selección de productos para unificar
  const toggleProductSelection = useCallback((id) => {
    if (!isUnifyMode) return;
    setSelectedProductIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  }, [isUnifyMode]);

  const openUnifyPreview = () => {
    const selected = products.filter(p => selectedProductIds.includes(p.id));
    if (selected.length < 2) {
      return alert('Seleccioná al menos dos productos para unificar.');
    }

    const totalQuantity = selected.reduce((sum, p) => {
      const qty = (p.inventory && p.inventory[currentInventory] !== undefined) 
        ? p.inventory[currentInventory] 
        : (p.quantity ?? p.total_quantity ?? 0);
      return sum + (Number(qty) || 0);
    }, 0);

    const averageCost = selected.reduce((sum, p) => sum + (Number(p.cost_mx) || 0), 0) / selected.length;
    const images = selected.flatMap(p => (Array.isArray(p.images) && p.images.length > 0) ? p.images : (p.image ? [p.image] : []));

    setUnifyDraft({
      name: `Unificado - ${selected.map(p => p.name).join(' + ')}`,
      quantity: totalQuantity,
      cost_mx: Number(averageCost.toFixed(2)),
      sale_price_manual: selected[0]?.sale_price_manual || 0,
      description: selected.map(p => p.description).filter(Boolean).join('\n'),
      label_color: 'none',
      images: [...new Set(images)],
      selected
    });
  };

  const handleUnify = async (formData) => {
    if (!unifyDraft) return;
    try {
      const data = {
        name: formData.get('name') || 'Producto unificado',
        quantity: formData.get('quantity'),
        cost_mx: formData.get('cost_mx'),
        sale_price_manual: formData.get('sale_price_manual') || 0,
        description: formData.get('description') || '',
        label_color: formData.get('label_color') || 'none',
        code: formData.get('code') || null
      };

      await unifyProducts(unifyDraft.selected.map(p => p.id), data);
      setUnifyDraft(null);
      setSelectedProductIds([]);
      setIsUnifyMode(false);
      handleProductUpdated();
    } catch (error) {
      console.error('Error al unificar productos:', error);
      alert(error.response?.data?.error || 'No se pudieron unificar los productos.');
    }
  };

  // Creación / Edición estándar
  const handleCreateOrUpdate = async (formData) => {
    try {
      if (editingProduct) {
        await updateProduct(editingProduct.id, formData);
      } else {
        await createProduct(formData);
      }
      setIsModalOpen(false);
      setEditingProduct(null);
      handleProductUpdated();
    } catch (e) {
      console.error('Error al guardar producto:', e);
      alert('Error al guardar el producto');
    }
  };

  const handleDeleteProduct = async (id) => {
    try {
      await deleteProduct(id);
      handleProductUpdated();
    } catch (e) {
      console.error('Error al eliminar producto:', e);
      alert('Error al eliminar producto');
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

  // Filtrado y Ordenamiento
  const filteredProducts = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    const visible = products.filter(p => {
      const nameMatch = (p.name || '').toLowerCase().includes(normalizedSearch);
      const codeMatch = (p.code || '').toLowerCase().includes(normalizedSearch);
      const matchesSearch = !normalizedSearch || nameMatch || codeMatch;

      const productLabel = p.label_color || 'none';
      const matchesLabel = labelFilter === 'all' || productLabel === labelFilter;

      return matchesSearch && matchesLabel;
    });

    const sorted = [...visible];
    if (sortMode === 'name_asc' || sortMode === 'name_desc') {
      sorted.sort((a, b) => {
        const comp = (a.name || '').localeCompare(b.name || '', 'es', { sensitivity: 'base', numeric: true });
        return sortMode === 'name_asc' ? comp : -comp;
      });
    }

    return sorted;
  }, [products, searchTerm, labelFilter, sortMode]);

  // Cálculo de totales financieros para el Dashboard superior
  const totals = useMemo(() => {
    const t = filteredProducts.reduce((acc, p) => {
      const qty = (p.inventory && p.inventory[currentInventory] !== undefined) 
        ? parseFloat(p.inventory[currentInventory]) || 0 
        : parseFloat(p.quantity ?? p.total_quantity) || 0;
      const costMN = parseFloat(p.cost_mn) || 0;
      const saleMN = parseFloat(p.actual_sale_price ?? p.sale_price_manual) || 0;
      acc.cost += costMN * qty;
      acc.sales += saleMN * qty;
      return acc;
    }, { cost: 0, sales: 0 });

    t.profit = t.sales - t.cost;
    t.rentability = t.cost > 0 ? (t.profit / t.cost) * 100 : 0;
    return t;
  }, [filteredProducts, currentInventory]);

  // Exportación a Excel con fórmulas de conversión y margen
  const exportToExcel = () => {
    const exportData = filteredProducts.map(p => {
      const qty = (p.inventory && p.inventory[currentInventory] !== undefined) 
        ? (p.inventory[currentInventory] || 0) 
        : (p.quantity ?? p.total_quantity ?? 0);

      return {
        'cantidad': qty,
        'Producto': p.name,
        'precio de venta redondeado': parseFloat(p.actual_sale_price ?? p.sale_price_manual) || 0,
        'venta x unidad': '',
        'costo x unidad MX': p.cost_mx || 0,
        'costo x cant MX': '',
        'costo x unidad MN': '',
        'costo x cantidad MN': '',
        'costo x unidad USD': '',
        'costo total MN': '',
        'costo total USD': '',
        'venta total': '',
        'venta total redondeada': '',
        'MB%': ''
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData, {
      header: [
        'cantidad', 'Producto', 'precio de venta redondeado', 'venta x unidad',
        'costo x unidad MX', 'costo x cant MX', 'costo x unidad MN',
        'costo x cantidad MN', 'costo x unidad USD', 'costo total MN',
        'costo total USD', 'venta total', 'venta total redondeada', 'MB%'
      ]
    });

    const rates = {
      R_MXN_USD: settings.RATE_MXN_USD || 19,
      R_USD_MN: settings.RATE_USD_MN || 550,
      MARGIN: settings.MARGIN_MULTIPLIER || 3.5
    };

    filteredProducts.forEach((_, i) => {
      const r = i + 2;
      ws[`D${r}`] = { f: `G${r}*${rates.MARGIN}` };
      ws[`F${r}`] = { f: `E${r}*A${r}` };
      ws[`G${r}`] = { f: `E${r}/${rates.R_MXN_USD}*${rates.R_USD_MN}` };
      ws[`H${r}`] = { f: `G${r}*A${r}` };
      ws[`I${r}`] = { f: `E${r}/${rates.R_MXN_USD}` };
      ws[`J${r}`] = { f: `A${r}*G${r}` };
      ws[`K${r}`] = { f: `A${r}*E${r}/${rates.R_MXN_USD}` };
      ws[`L${r}`] = { f: `(G${r}*A${r})*${rates.MARGIN}` };
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Entradas_${currentInventory.toUpperCase()}`);
    XLSX.writeFile(wb, `Entradas_${currentInventory.toUpperCase()}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Exportación a PDF con Grilla fluida y fotos cuadradas sin deformación
  const exportToPDF = async () => {
    const doc = new jsPDF();
    doc.text(`Miss Chulerías - Entradas (${currentInventory.toUpperCase()})`, 14, 15);
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

      const hasMultiplePhotos = p.imageData.length >= 2;
      const qty = (p.inventory && p.inventory[currentInventory] !== undefined) 
        ? p.inventory[currentInventory] 
        : (p.quantity ?? p.total_quantity ?? 0);
      const qtyText = String(qty);
      const priceText = `$${(parseFloat(p.actual_sale_price ?? p.sale_price_manual) || 0).toFixed(2)}`;

      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
      if (hasMultiplePhotos) {
        doc.setFont('helvetica', 'bold');
        doc.text(`${qtyText}   ${p.name}   ${priceText}`, cardX + cardWidth / 2, cardY + 6.5, {
          align: 'center',
          maxWidth: cardWidth - 2
        });
      } else {
        doc.text(p.name, cardX + cardWidth / 2, cardY + 5, {
          align: 'center',
          maxWidth: cardWidth - 2
        });
      }

      if (p.imageData.length > 0) {
        p.imageData.forEach((image, index) => {
          const col = index % columnsPerRow;
          const row = Math.floor(index / columnsPerRow);
          const rowStart = row * columnsPerRow;
          const photosInThisRow = Math.min(columnsPerRow, p.imageData.length - rowStart);
          const rowWidth = photosInThisRow * photoSize + (photosInThisRow - 1) * innerGap;
          const rowOffsetX = (cardWidth - rowWidth) / 2;
          const imageX = cardX + rowOffsetX + col * (photoSize + innerGap);
          const imageY = contentY + innerMargin + row * (photoSize + innerGap);
          doc.addImage(image, 'JPEG', imageX, imageY, photoSize, photoSize);
          doc.setDrawColor(...borderColor);
          doc.setLineWidth(0.45);
          doc.rect(imageX, imageY, photoSize, photoSize);
        });
      } else {
        doc.setFontSize(7);
        doc.setTextColor(150);
        doc.text('Sin IMG', cardX + cardWidth / 2, contentY + photoSize / 2, { align: 'center' });
      }

      if (!hasMultiplePhotos) {
        const lastImageX = cardX + innerMargin;
        const lastImageY = contentY + innerMargin;
        doc.setFontSize(14);
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
      }
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

    doc.save(`Entradas_${currentInventory.toUpperCase()}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const lowStockCount = filteredProducts.filter(p => {
    const stock = (p.inventory && p.inventory[currentInventory] !== undefined)
      ? p.inventory[currentInventory]
      : (p.quantity ?? p.total_quantity ?? 0);
    return stock < 5;
  }).length;

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando Entradas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 space-y-6">
      
      {/* 1. DASHBOARD FINANCIERO SUPERIOR */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Costo Total MN */}
        <div className="bg-card/50 p-5 rounded-2xl border border-border/60 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Costo Total MN</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-foreground">
              ${totals.cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-xs font-medium text-muted-foreground">MN</span>
          </div>
        </div>

        {/* Venta Estimada */}
        <div className="bg-card/50 p-5 rounded-2xl border border-border/60 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-2">Venta Estimada</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-cyan-400">
              ${totals.sales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-xs font-medium text-muted-foreground">MN</span>
          </div>
        </div>

        {/* Ganancia Bruta */}
        <div className="bg-card/50 p-5 rounded-2xl border border-border/60 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2">Ganancia Bruta</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-400">
              ${totals.profit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-xs font-medium text-muted-foreground">MN</span>
          </div>
        </div>

        {/* Rentabilidad */}
        <div className="bg-gradient-to-br from-indigo-600 to-purple-600 p-5 rounded-2xl shadow-lg text-white flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -right-4 -top-4 bg-white/10 w-24 h-24 rounded-full blur-xl"></div>
          <span className="text-xs font-bold text-indigo-100 uppercase tracking-wider mb-2 z-10">Rentabilidad</span>
          <div className="flex items-baseline gap-2 z-10">
            <span className="text-3xl font-black">{totals.rentability.toFixed(1)}%</span>
            <span className="text-xs font-medium text-indigo-200">Markup</span>
          </div>
        </div>
      </div>

      {/* 2. BARRA DE HERRAMIENTAS: BÚSQUEDA, ORDEN, ETIQUETA, VISTAS, EXPORTAR Y ACCIONES */}
      <div className="flex flex-col xl:flex-row gap-3 items-stretch xl:items-center justify-between bg-card/30 p-3 rounded-2xl border border-border/50">
        
        {/* Buscador */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nombre o código de producto..."
            className="w-full pl-9 pr-9 py-2 bg-slate-800/60 border border-slate-700 rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:border-cyan-500 text-sm"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filtros: Orden A-Z y Etiquetas */}
        <div className="flex flex-wrap sm:flex-nowrap gap-2 items-center">
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 text-foreground text-xs font-bold shadow-sm outline-none focus:border-cyan-500"
            title="Ordenar productos"
          >
            <option value="original">Orden original</option>
            <option value="name_asc">Nombre A-Z</option>
            <option value="name_desc">Nombre Z-A</option>
          </select>

          <select
            value={labelFilter}
            onChange={(e) => setLabelFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 text-foreground text-xs font-bold shadow-sm outline-none focus:border-cyan-500"
            title="Filtrar por color de etiqueta"
          >
            {labelOptions.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>

          {/* Switch Modo Lista / Cuadrícula */}
          <div className="flex items-center bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`p-2 text-xs font-bold transition-colors ${
                viewMode === 'list' ? 'bg-cyan-500 text-white' : 'text-slate-400 hover:bg-slate-700'
              }`}
              title="Vista Lista"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-2 text-xs font-bold transition-colors ${
                viewMode === 'grid' ? 'bg-cyan-500 text-white' : 'text-slate-400 hover:bg-slate-700'
              }`}
              title="Vista Cuadrícula"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>

          {/* Exportar Excel & PDF */}
          <button
            onClick={exportToExcel}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600/80 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
            title="Descargar Excel"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Excel</span>
          </button>

          <button
            onClick={exportToPDF}
            className="flex items-center gap-1.5 px-3 py-2 bg-rose-600/80 hover:bg-rose-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
            title="Descargar Catálogo PDF"
          >
            <FileText className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">PDF</span>
          </button>

          {/* Botón Unificar */}
          <button
            onClick={() => {
              setIsUnifyMode(prev => !prev);
              setSelectedProductIds([]);
              setUnifyDraft(null);
            }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${
              isUnifyMode 
                ? 'bg-amber-500 hover:bg-amber-600 text-white' 
                : 'bg-purple-600 hover:bg-purple-700 text-white'
            }`}
            title="Seleccionar productos para unificar"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{isUnifyMode ? 'Cancelar' : 'Unificar'}</span>
          </button>

          {/* Botón Nuevo Producto */}
          <button
            onClick={() => {
              setEditingProduct(null);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo</span>
          </button>
        </div>
      </div>

      {/* 3. BARRA FLOTANTE DE SELECCIÓN PARA UNIFICAR */}
      {isUnifyMode && (
        <div className="p-3 bg-purple-900/30 border border-purple-500/40 rounded-xl flex items-center justify-between text-purple-200">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span>{selectedProductIds.length} producto(s) seleccionado(s) para unificar</span>
          </div>
          <button
            onClick={openUnifyPreview}
            disabled={selectedProductIds.length < 2}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold rounded-lg transition-colors shadow-sm"
          >
            Continuar a Unificación
          </button>
        </div>
      )}

      {/* 4. AVISO DE STOCK BAJO */}
      {lowStockCount > 0 && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
          <span className="text-rose-400 text-sm">
            Hay {lowStockCount} productos con stock bajo en la sede <strong>{currentInventory.toUpperCase()}</strong>.
          </span>
        </div>
      )}

      {/* 5. TABLA O CUADRÍCULA DE PRODUCTOS */}
      <div onClick={() => { if (!isUnifyMode) setSelectedProductIds([]); }}>
        <ProductTable
          products={filteredProducts}
          currentInventory={currentInventory}
          onProductUpdated={handleProductUpdated}
          onEdit={(product) => {
            setEditingProduct(product);
            setIsModalOpen(true);
          }}
          onDelete={handleDeleteProduct}
          setViewGallery={setViewGallery}
          settings={settings}
          selectedProductIds={selectedProductIds}
          onSelectProduct={toggleProductSelection}
          viewMode={viewMode}
        />
      </div>

      {/* 6. MODAL DE PRODUCTO (REUTILIZADO PARA CREAR, EDITAR Y UNIFICAR) */}
      <ProductForm
        isOpen={isModalOpen || Boolean(unifyDraft)}
        onClose={() => {
          setIsModalOpen(false);
          setEditingProduct(null);
          setUnifyDraft(null);
        }}
        onSubmit={unifyDraft ? handleUnify : handleCreateOrUpdate}
        initialData={unifyDraft ? { ...unifyDraft, id: 'unify-preview', images: unifyDraft.images } : editingProduct}
        settings={settings}
        isUnifying={Boolean(unifyDraft)}
      />

      {/* 7. VISOR DE GALERÍA FLUIDA A PANTALLA COMPLETA */}
      <Gallery
        viewGallery={viewGallery}
        setViewGallery={setViewGallery}
      />
    </div>
  );
}
