import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { FaTimes, FaUpload, FaClipboard, FaCalculator, FaCheckCircle, FaExclamationCircle, FaImage, FaCrop, FaPaste, FaCamera, FaTrash, FaTag } from 'react-icons/fa';
import Cropper from 'react-easy-crop';
import { getAdaptiveImageUrl } from './lib/imageUtils';

const createImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = url;
  });

async function getCroppedImg(imageSrc, pixelCrop) {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return null;
  }

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob);
    }, 'image/jpeg');
  });
}

const ProductForm = ({ isOpen, onClose, onSubmit, initialData, settings }) => {
  const [formData, setFormData] = useState({
    name: '',
    quantity: 0,
    cost_mx: 0,
    sale_price_manual: 0,
    description: '',
    label_color: 'none',
  });

  // Image State Management
  const [imagePreviews, setImagePreviews] = useState([]);
  const [deletedImages, setDeletedImages] = useState([]);

  // Image Selection Logic (Mobile/Desktop)
  const [selectedIds, setSelectedIds] = useState([]);
  const longPressTimer = useRef(null);
  const galleryRef = useRef(null);
  const isLongPressTriggered = useRef(false); // New Ref to track if long press happened

  // === REFS ===
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // === CROP STATE ===
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [isCropping, setIsCropping] = useState(false);
  const [tempImage, setTempImage] = useState(null);
  const [showMobilePasteInput, setShowMobilePasteInput] = useState(false);

  // === CURRENCY STATE ===
  const [selectedCurrency, setSelectedCurrency] = useState(settings?.PRIMARY_CURRENCY || 'MXN');
  const [isCostFocused, setIsCostFocused] = useState(false);

  // Update default currency if settings change and user hasn't interacted
  useEffect(() => {
    if (settings?.PRIMARY_CURRENCY && !initialData) {
      setSelectedCurrency(settings.PRIMARY_CURRENCY);
    }
  }, [settings?.PRIMARY_CURRENCY, initialData]);

  // === REMOVE IMAGE HELPER (Defined early) ===
  const removeImage = (id) => {
    setImagePreviews(prev => {
      const imgToRemove = prev.find(img => img.id === id);
      if (imgToRemove && !imgToRemove.isFile) {
        try {
          // Fix for relative URLs
          const baseUrl = window.location.origin;
          const urlStr = imgToRemove.url.startsWith('/')
            ? baseUrl + imgToRemove.url
            : imgToRemove.url;

          const urlObj = new URL(urlStr);
          setDeletedImages(d => [...d, urlObj.pathname]);
        } catch (e) {
          // Fallback: just store what we have if it looks like a path
          setDeletedImages(d => [...d, imgToRemove.url]);
        }
      }
      return prev.filter(img => img.id !== id);
    });
  };

  // Helper to get rate to MN
  const getRateToMN = (currency) => {
    const r_usd_mn = settings?.RATE_USD_MN || 530;
    const r_mxn_usd = settings?.RATE_MXN_USD || 19;
    
    switch (currency) {
      case 'USD': return r_usd_mn;
      case 'EUR': return settings.RATE_EUR_MN || 590;
      case 'MXN': 
        // Fórmula Cruzada: (1 MXN / Tasa_MXN_USD) * Tasa_USD_MN
        return r_usd_mn / r_mxn_usd;
      case 'MN': return 1;
      default: return 1;
    }
  };

  // Local state for cost input to allow smooth typing (handling commas, dots, etc.)
  const [localCostInput, setLocalCostInput] = useState('');

  // Sync local input when currency changes or form data loads
  useEffect(() => {
    // Only update if we are not currently typing (simple heuristic or just force it on currency/data change)
    if (isCostFocused) return;

    // Actually, calculate what the value SHOULD be based on stored MXN
    const costInMXN = formData.cost_mx || 0;
    const costInMN = costInMXN * getRateToMN('MXN');
    const val = costInMN / getRateToMN(selectedCurrency);
    // If it's effectively zero, show empty string for cleaner UI, unless it's explicitly 0
    if (val === 0 && localCostInput === '') return;

    // Check if we need to update local state (avoid overwriting user typing if values match loosely)
    // For now, let's just update perfectly on currency switch logic
    const formatted = parseFloat(val.toFixed(2)).toString();
    // Only override if the difference is significant (calculated vs user input) or if we just switched currencies
    // Simplest: just set it. The user will see it jump if they switch currency, which is expected.
    setLocalCostInput(val === 0 ? '' : formatted);
  }, [formData.cost_mx, selectedCurrency, settings]); // This might cause loop if not careful.

  // Better approach: Calculate display value ONLY when not editing? 
  // Easier: Helper to sanitize input
  const sanitizeNumberInput = (value) => {
    // Replace comma with dot
    let val = value.replace(/,/g, '.');
    // Remove non-numeric chars except dot
    val = val.replace(/[^0-9.]/g, '');
    // Prevent multiple dots
    const parts = val.split('.');
    if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');

    // Handle leading zeros: 05 -> 5, but 0.5 stays 0.5
    if (val.length > 1 && val.startsWith('0') && val[1] !== '.') {
      val = val.substring(1);
    }
    return val;
  };

  const handleCurrencyChange = (e) => {
    const newCurrency = e.target.value;
    setSelectedCurrency(newCurrency);
  };

  const handleCostChange = (e) => {
    const rawVal = e.target.value;
    const cleanVal = sanitizeNumberInput(rawVal);
    setLocalCostInput(cleanVal); // Update UI immediately so user sees their typing

    const val = parseFloat(cleanVal) || 0;

    // Convert Input (Selected) -> MN
    const costInMN = val * getRateToMN(selectedCurrency);

    // Convert MN -> MXN (Storage)
    // Usar la misma tasa cruzada inversa para consistencia
    const r_usd_mn = settings?.RATE_USD_MN || 530;
    const r_mxn_usd = settings?.RATE_MXN_USD || 19;
    const rate_mxn_mn = r_usd_mn / r_mxn_usd;
    
    const costInMXN = costInMN / rate_mxn_mn;

    setFormData(prev => ({ ...prev, cost_mx: costInMXN }));
  };

  // Draft Persistence Logic
  const draftKey = initialData ? `draft_edit_${initialData.id}` : 'draft_new';

  useEffect(() => {
    // 1. Initialize from props (Standard behavior)
    let baseData = {
      name: '',
      quantity: 0,
      cost_mx: 0,
      sale_price_manual: 0,
      description: '',
      label_color: 'none',
    };

    if (initialData) {
      baseData = {
        name: initialData.name || '',
        quantity: initialData.quantity || 0,
        cost_mx: initialData.cost_mx || 0,
        sale_price_manual: initialData.sale_price_manual || 0,
        description: initialData.description || '',
        label_color: initialData.label_color || 'none',
      };

      // Image handling logic
      const initialImages = [];

      // Simplificación: Usar rutas relativas siempre que sea posible para aprovechar el proxy/express static
      // Si la imagen viene como '/uploads/foo.jpg', la usamos tal cual.
      // Si viene como 'http...', la usamos tal cual.

      if (initialData.images && Array.isArray(initialData.images)) {
        initialData.images.forEach((img, idx) => {
          // Si la URL es relativa y no empieza con /, asegurarse de ponerle /
          // Pero la DB guarda /uploads/... así que debería estar bien.
          // Solo si es una URL absoluta antigua (http://localhost...) podría haber problemas mixtos, pero el navegador suele manejarlos si es localhost.
          // Si es ngrok, las absolutas antiguas fallarán. Las nuevas relativas funcionarán.
          let imageUrl = img;
          if (!img.startsWith('http') && !img.startsWith('/')) {
            imageUrl = `/${img}`;
          }
          initialImages.push({ id: `existing-${idx}`, url: imageUrl, isFile: false });
        });
      } else if (initialData.image) {
        // Legacy single image
        let imageUrl = initialData.image;
        if (!imageUrl.startsWith('http') && !imageUrl.startsWith('/')) {
          imageUrl = `/${imageUrl}`;
        }
        initialImages.push({ id: 'legacy-1', url: imageUrl, isFile: false });
      }
      setImagePreviews(initialImages);
      setDeletedImages([]);
    } else {
      // Reset logic for new product handled partly here, but mostly ensures clean slate
      setImagePreviews([]);
      setDeletedImages([]);
    }

    // 2. Check for saved draft to override
    const savedDraft = localStorage.getItem(draftKey);
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        // Verify compatibility or timestamp if needed, for now just merge
        // Prioritize draft values over initialData
        setFormData({ ...baseData, ...parsed });
      } catch (e) {
        console.error("Error parsing draft", e);
        setFormData(baseData);
      }
    } else {
      setFormData(baseData);
    }

  }, [initialData, isOpen, draftKey]); // Depend on draftKey to switch contexts

  // Save Draft on Change
  useEffect(() => {
    if (isOpen) {
      localStorage.setItem(draftKey, JSON.stringify(formData));
    }
  }, [formData, isOpen, draftKey]);

  // Clear draft on unmount/close specific cleanup handled in handlers
  const clearDraft = () => localStorage.removeItem(draftKey);

  const processPaste = useCallback((e) => {
    // 1. Try standard 'files' list first (often more reliable for direct file pastes)
    if (e.clipboardData.files && e.clipboardData.files.length > 0) {
      const file = e.clipboardData.files[0];
      if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file);
        setTempImage(url);
        setIsCropping(true);
        setShowMobilePasteInput(false);
        e.preventDefault();
        return true;
      }
    }

    // 2. Fallback to 'items' inspection
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        const url = URL.createObjectURL(blob);
        setTempImage(url);
        setIsCropping(true);
        setShowMobilePasteInput(false);
        e.preventDefault();
        return true;
      }
    }
    
    // ... rest of error handling
    if (showMobilePasteInput) {
       // ...
    }
    return false;
  }, [showMobilePasteInput]);

  // Global Paste Handler
  useEffect(() => {
    if (!isOpen) return;
    const handleWindowPaste = (e) => processPaste(e);
    window.addEventListener('paste', handleWindowPaste);
    return () => window.removeEventListener('paste', handleWindowPaste);
  }, [isOpen, processPaste]);

  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleCropSave = async () => {
    try {
      if (imagePreviews.length >= 5) {
        alert("Máximo 5 imágenes permitidas.");
        setIsCropping(false);
        setTempImage(null);
        return;
      }
      const croppedBlob = await getCroppedImg(tempImage, croppedAreaPixels);
      const file = new File([croppedBlob], `cropped_${Date.now()}.jpg`, { type: "image/jpeg" });

      const newImage = {
        id: `new-${Date.now()}`,
        url: URL.createObjectURL(file),
        isFile: true,
        file: file
      };

      setImagePreviews(prev => [...prev, newImage]);
      setIsCropping(false);
      setTempImage(null);
    } catch (e) {
      console.error(e);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      quantity: 0,
      cost_mx: 0,
      sale_price_manual: 0,
      description: '',
      label_color: 'none',
    });
    setImagePreviews([]);
    setDeletedImages([]);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'quantity' || name === 'sale_price_manual') {
      const cleanVal = sanitizeNumberInput(value);

      // If empty, set to '' (or 0 if preferred, but empty string lets user feel cleared field)
      if (cleanVal === '') {
        setFormData(prev => ({ ...prev, [name]: name === 'quantity' ? 0 : 0 }));
        return;
      }

      setFormData(prev => ({ ...prev, [name]: cleanVal })); // Store strictly as string? Or number?
      // Wait, standard formData expects logic. If we store "5." as string, calculations might break if they expect number.
      // But typically JS handles "5." * 5 fine.
      // Safer: Store as number but we need to control the input value from a formatted source?
      // Issue: If we store number 5, input value=5, user types "." -> input value "5". Dot lost.
      // For these fields, we might need simple text storage in formData or local logic essentially.
      // Since 'quantity' and 'sale_price' are simple, let's just store them as is (string/number hybrid) and cast when saving.
      // Actually, let's keep it simple: 
      // If the field is 'quantity' (integer-ish), maybe force parse?
      // User asked for "input numbers after comma", so quantity could be 1.5 kg.

      // Let's rely on the input's "value" prop being fed directly from formData.
      // So simple update:
      setFormData(prev => ({ ...prev, [name]: cleanVal }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleFileChange = (e) => {
    // console.log('File Change triggered');
    const file = e.target.files[0];
    if (file) {
      if (imagePreviews.length >= 5) {
        alert("Máximo 5 imágenes permitidas.");
        e.target.value = '';
        return;
      }

      // Check file type
      if (!file.type.startsWith('image/')) {
        alert('Por favor, selecciona un archivo de imagen válido (JPEG, PNG, GIF, etc.).');
        e.target.value = ''; // Reset input
        return;
      }
      // Check file size (e.g., 5MB limit)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        alert('El tamaño de la imagen excede el límite de 5MB. Por favor, selecciona una imagen más pequeña.');
        e.target.value = ''; // Reset input
        return;
      }
      // Create URL from blob
      const url = URL.createObjectURL(file);
      setTempImage(url);
      setIsCropping(true); // Trigger cropping modal
      e.target.value = ''; // Reset input to allow selecting same file again
    }
  };

  const handleManualPaste = async () => {
    if (imagePreviews.length >= 5) {
      alert("Máximo 5 imágenes permitidas.");
      return;
    }
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        if (item.types.includes('image/png') || item.types.includes('image/jpeg')) {
          const blob = await item.getType('image/png') || await item.getType('image/jpeg');
          setTempImage(URL.createObjectURL(blob));
          setIsCropping(true);
          return;
        }
      }
      alert('No se encontró imagen en el portapapeles');
    } catch (err) {
      // Fallback for mobile/non-secure context
      setShowMobilePasteInput(true);
    }
  };

  // Click Outside Listener (To Deselect) - Enhanced for Drag vs Click
  useEffect(() => {
    let isDragging = false;
    let startX = 0;
    let startY = 0;

    const handleMouseDown = (e) => {
      startX = e.clientX;
      startY = e.clientY;
      isDragging = false;
    };

    const handleMouseMove = (e) => {
      if (Math.abs(e.clientX - startX) > 5 || Math.abs(e.clientY - startY) > 5) {
        isDragging = true;
      }
    };

    const handleMouseUp = (event) => {
      if (isDragging) return; // Ignore drag end

      if (galleryRef.current && !galleryRef.current.contains(event.target) && selectedIds.length > 0) {
        // If clicking on specific UI elements like modals, ignore? 
        // For now, strict outside gallery deselects.
        setSelectedIds([]);
      }
    };

    // Mobile Touch Logic
    const handleTouchStartGlobal = (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      isDragging = false;
    };

    const handleTouchMoveGlobal = (e) => {
      if (Math.abs(e.touches[0].clientX - startX) > 10 || Math.abs(e.touches[0].clientY - startY) > 10) {
        isDragging = true;
      }
    };

    const handleTouchEndGlobal = (event) => {
      if (isDragging) return;
      if (galleryRef.current && !galleryRef.current.contains(event.target) && selectedIds.length > 0) {
        setSelectedIds([]);
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    document.addEventListener('touchstart', handleTouchStartGlobal);
    document.addEventListener('touchmove', handleTouchMoveGlobal);
    document.addEventListener('touchend', handleTouchEndGlobal);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);

      document.removeEventListener('touchstart', handleTouchStartGlobal);
      document.removeEventListener('touchmove', handleTouchMoveGlobal);
      document.removeEventListener('touchend', handleTouchEndGlobal);
    };
  }, [selectedIds]);

  const handleMouseDown = (id) => {
    console.log('MouseDown/TouchStart on:', id);
    isLongPressTriggered.current = false; // Reset flag
    longPressTimer.current = setTimeout(() => {
      // Long press detected
      console.log('Long press triggered for:', id);
      isLongPressTriggered.current = true; // Mark as long press

      setSelectedIds(prev => {
        if (!prev.includes(id)) {
          // Vibrate only on first selection
          try { if (navigator.vibrate) navigator.vibrate(50); } catch (e) { }
          return [...prev, id];
        }
        return prev;
      });
    }, 600);
  };

  const handleMouseUpImage = () => {
    console.log('MouseUp/TouchEnd');
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  const handleImageClick = (id) => {
    console.log('Click on:', id, 'LongPress was:', isLongPressTriggered.current);

    // If this click was actually the end of a long press, DO NOT toggle immediately
    if (isLongPressTriggered.current) {
      console.log('Ignoring click due to long press');
      isLongPressTriggered.current = false;
      return;
    }

    // Normal toggle logic
    if (selectedIds.length > 0) {
      if (selectedIds.includes(id)) {
        console.log('Deselecting:', id);
        setSelectedIds(prev => prev.filter(i => i !== id));
      } else {
        console.log('Selecting:', id);
        setSelectedIds(prev => [...prev, id]);
      }
    } else {
      console.log('Normal click (Preview/View)');
      // Here you could add logic to open the image in full screen
    }
  };

  const handleDeleteSelected = () => {
    // Si no hay seleccionados, no hacer nada
    if (selectedIds.length === 0) return;

    // Confirmación nativa
    if (window.confirm(`¿Estás seguro de eliminar las ${selectedIds.length} imágenes seleccionadas?`)) {
      // Ejecutar eliminación
      // Usar un bucle síncrono sobre los IDs copiados
      const idsToDelete = [...selectedIds];

      idsToDelete.forEach(id => {
        // Logic duplicated from removeImage to avoid state batching issues in loop
        // or just call removeImage carefully. 
        // In React 18, batching is automatic.
        // Better: update state ONCE.
        removeImage(id);
      });

      // Limpiar selección
      setSelectedIds([]);
    }
  };

  // Safe Image URL Helper
  const getImageUrl = (url) => {
    if (!url) return '';
    // If it's a blob (locally uploaded), return as is
    if (url.startsWith('blob:')) return url;

    let normalized = url;
    // Aggressive fix for stored absolute paths or bad formats
    // If it contains "uploads", extract everything after "uploads"
    if (url.includes('uploads')) {
      const parts = url.split('uploads');
      // Take the last part, ensure it starts with /uploads
      normalized = '/uploads' + parts[parts.length - 1];
      // Clean double slashes just in case
      normalized = normalized.replace('//', '/').replace(/\\/g, '/');
    } else if (!url.startsWith('http')) {
      normalized = url.startsWith('/') ? url : `/${url}`;
    }
    return getAdaptiveImageUrl(normalized);
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const data = new FormData();
      Object.keys(formData).forEach(key => data.append(key, formData[key]));

      // Append new files
      imagePreviews.forEach(img => {
        if (img.isFile && img.file) {
          data.append('images', img.file);
        }
      });

      // Append deleted images list
      if (deletedImages.length > 0) {
        console.log('Sending deleted images to server:', deletedImages);
        data.append('deletedImages', JSON.stringify(deletedImages));
      }

      await onSubmit(data);
      clearDraft(); // Clear draft on success
      onClose();
    } catch (error) {
      console.error("Error submitting form:", error);
      alert("Error al guardar el producto. Inténtalo de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculations for Display
  
  // Base Calculations (Internal)
  const rate_usd_mn = settings?.RATE_USD_MN || 530;
  const rate_mxn_usd = settings?.RATE_MXN_USD || 19;
  const rate_eur_mn = settings?.RATE_EUR_MN || 590;
  const margin_multiplier = settings?.MARGIN_MULTIPLIER || 3.5; 

  const cost_mx_val = parseFloat(formData.cost_mx) || 0;
  
  // Pivot: Calculate MN first using Cross Rate
  // Formula: (MXN / Rate_MXN_USD) * Rate_USD_MN
  const cost_mn = (cost_mx_val / rate_mxn_usd) * rate_usd_mn;
  
  // Calculate others from MN
  const cost_usd = cost_mn / rate_usd_mn;
  const cost_eur = cost_mn / rate_eur_mn;
  
  // Suggested Sale (MN)
  const sale_unit_mn_suggested = cost_mn * margin_multiplier;

  /* Safe Parsing of Manual Price */
  const manualPriceVal = parseFloat(formData.sale_price_manual) || 0;
  const actual_price = manualPriceVal > 0 ? manualPriceVal : sale_unit_mn_suggested;
  const isUsingManual = formData.sale_price_manual > 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4 transition-all duration-300">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-5xl max-h-[95vh] overflow-y-auto transition-all border border-gray-200 dark:border-gray-700 shadow-2xl relative flex flex-col">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 sticky top-0 z-20">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {initialData ? 'Editar Producto' : 'Nuevo Producto'}
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
            <FaTimes size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
            
            {/* TOP SECTION: Inputs & Analysis */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* LEFT: Inputs */}
              <div className="space-y-5">
                  {/* Name */}
                <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Nombre del Producto *</label>
                    
                    {/* Color Label Selector */}
                    <div className="flex gap-1.5 items-center bg-white dark:bg-gray-800 p-1 rounded-full border border-gray-200 dark:border-gray-700 shadow-sm">
                       <FaTag className="text-gray-400 text-xs ml-1" />
                       {[
                         { id: 'none', bg: 'bg-gray-200 dark:bg-gray-700', border: 'border-transparent' },
                         { id: 'red', bg: 'bg-red-500', border: 'border-red-600' },
                         { id: 'blue', bg: 'bg-blue-500', border: 'border-blue-600' },
                         { id: 'green', bg: 'bg-emerald-500', border: 'border-emerald-600' },
                         { id: 'yellow', bg: 'bg-amber-400', border: 'border-amber-500' },
                         { id: 'purple', bg: 'bg-purple-500', border: 'border-purple-600' },
                       ].map(color => (
                         <button
                           key={color.id}
                           type="button"
                           onClick={() => setFormData(prev => ({ ...prev, label_color: color.id }))}
                           className={`w-4 h-4 rounded-full transition-transform hover:scale-110 ${color.bg} ${formData.label_color === color.id ? 'ring-2 ring-offset-1 ring-gray-400 dark:ring-gray-500 scale-110' : ''}`}
                           title={`Etiqueta ${color.id}`}
                         />
                       ))}
                    </div>
                  </div>
                  <input
                    type="text"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Ej. iPhone 15 Pro Max"
                    className="w-full p-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-base font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                {/* Numeric Grid */}
                <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700 grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Stock */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Stock</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      name="quantity"
                      value={formData.quantity}
                      onChange={handleChange}
                      className="w-full p-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-base font-mono font-bold text-center text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>

                  {/* Cost */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="block text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Costo</label>
                      <select
                        value={selectedCurrency}
                        onChange={handleCurrencyChange}
                        className="text-[9px] font-bold uppercase bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded px-1 cursor-pointer outline-none"
                      >
                        <option value="MXN">MXN</option>
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                        <option value="MN">MN</option>
                      </select>
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={localCostInput}
                        onChange={handleCostChange}
                        onFocus={() => setIsCostFocused(true)}
                        onBlur={() => setIsCostFocused(false)}
                        className="w-full p-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-base font-mono font-bold text-indigo-600 dark:text-indigo-400 focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                  </div>

                  {/* Sale Price */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="block text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Venta</label>
                      {isUsingManual && (
                        <span className="text-[8px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-1.5 rounded-full font-bold">MANUAL</span>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="decimal"
                        name="sale_price_manual"
                        value={formData.sale_price_manual === 0 ? '' : formData.sale_price_manual}
                        onChange={handleChange}
                        placeholder={Math.round(sale_unit_mn_suggested).toString()}
                        className={`w-full p-2 bg-white dark:bg-gray-800 border rounded-lg text-base font-mono font-bold focus:ring-2 focus:ring-emerald-500 outline-none transition-all ${isUsingManual 
                          ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/10' 
                          : 'border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white'}`}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT: Analysis */}
              <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700 h-full">
                <h3 className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest flex items-center gap-2 border-b border-gray-200 dark:border-gray-700 pb-2 mb-3">
                  <FaCalculator className="text-indigo-500" /> Rentabilidad
                </h3>
                
                <div className="space-y-3">
                  {/* Suggested & Final */}
                  <div className="grid grid-cols-2 gap-3">
                      <div className="bg-indigo-50 dark:bg-indigo-900/20 p-2.5 rounded-lg border border-indigo-100 dark:border-indigo-900/30 text-center">
                      <p className="text-indigo-600 dark:text-indigo-400 text-[9px] uppercase font-bold">Sugerido</p>
                      <p className="text-sm font-mono font-bold text-indigo-700 dark:text-indigo-300">${sale_unit_mn_suggested.toFixed(2)}</p>
                    </div>
                    <div className={`p-2.5 rounded-lg border shadow-sm text-center transition-all ${actual_price < cost_mn
                      ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-900/30'
                      : 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-900/30'
                      }`}>
                      <p className={`text-[9px] uppercase font-bold ${actual_price < cost_mn ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {actual_price < cost_mn ? 'Pérdida' : 'Final'}
                      </p>
                      <p className={`text-lg font-black tracking-tight ${actual_price < cost_mn ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
                        ${actual_price.toFixed(2)}
                      </p>
                    </div>
                  </div>

                  {/* Detailed Costs Grid */}
                  <div className="grid grid-cols-4 gap-2">
                    <div className="bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700 flex flex-col items-center">
                      <span className="text-[8px] font-bold text-gray-400 uppercase">MXN</span>
                      <span className="text-xs font-mono font-bold text-gray-700 dark:text-gray-300">${cost_mx_val.toFixed(2)}</span>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700 flex flex-col items-center">
                      <span className="text-[8px] font-bold text-gray-400 uppercase">USD</span>
                      <span className="text-xs font-mono font-bold text-gray-700 dark:text-gray-300">${cost_usd.toFixed(2)}</span>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700 flex flex-col items-center">
                      <span className="text-[8px] font-bold text-gray-400 uppercase">EUR</span>
                      <span className="text-xs font-mono font-bold text-gray-700 dark:text-gray-300">€{cost_eur.toFixed(2)}</span>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700 flex flex-col items-center border-l-2 border-l-indigo-200 dark:border-l-indigo-800">
                      <span className="text-[8px] font-bold text-indigo-500 uppercase">MN</span>
                      <span className="text-xs font-mono font-bold text-indigo-700 dark:text-indigo-300">${cost_mn.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* BOTTOM SECTION: Gallery (Full Width) */}
            <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700 flex-1 flex flex-col min-h-[250px]" ref={galleryRef}>
              <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">
                <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Galería <span className="text-indigo-500">({imagePreviews.length}/5)</span>
                </label>
                {selectedIds.length > 0 && (
                  <button
                    type="button"
                    onClick={handleDeleteSelected}
                    className="text-[9px] bg-red-600 text-white px-3 py-1 rounded-full font-bold uppercase shadow-sm flex items-center gap-1 hover:bg-red-700 transition-colors"
                  >
                    <FaTrash size={10} /> Borrar Selección ({selectedIds.length})
                  </button>
                )}
              </div>

              <div className="flex-1 grid grid-cols-5 gap-4">
                {/* Images */}
                {imagePreviews.map((img) => {
                  const isSelected = selectedIds.includes(img.id);
                  const safeUrl = getImageUrl(img.url);
                  return (
                    <div
                      key={img.id}
                      className={`relative group aspect-square rounded-xl overflow-hidden cursor-pointer transition-all shadow-sm 
                        ${isSelected ? 'ring-4 ring-red-500 scale-95' : 'border border-gray-200 dark:border-gray-700 hover:border-indigo-400 hover:shadow-md'}`}
                      onMouseDown={() => handleMouseDown(img.id)}
                      onMouseUp={handleMouseUpImage}
                      onMouseLeave={handleMouseUpImage}
                      onTouchStart={() => handleMouseDown(img.id)}
                      onTouchEnd={handleMouseUpImage}
                      onContextMenu={(e) => e.preventDefault()}
                      onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleImageClick(img.id); }}
                    >
                      <img src={safeUrl} alt="" className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 ${isSelected ? 'opacity-50 grayscale' : ''}`} />
                      
                      {/* Hover Overlay */}
                      <div className={`absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 ${isSelected ? '!opacity-100 !bg-red-500/20' : ''}`}>
                         {isSelected && <FaTrash className="text-white drop-shadow-md animate-bounce" size={20}/>}
                      </div>
                    </div>
                  );
                })}
                
                {/* Add Button */}
                {imagePreviews.length < 5 && (
                  <div
                    className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl aspect-square flex flex-col items-center justify-center cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:border-indigo-400 transition-all group"
                    onClick={() => fileInputRef.current.click()}
                  >
                    <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center group-hover:scale-110 transition-transform">
                       <FaUpload className="text-gray-400 group-hover:text-indigo-500" size={16} />
                    </div>
                    <span className="text-[10px] font-bold text-gray-400 group-hover:text-indigo-500 uppercase mt-2">Subir Foto</span>
                  </div>
                )}
              </div>

              {/* Action Buttons (Below Grid) */}
              <div className="flex gap-4 mt-4">
                 {imagePreviews.length < 5 && (
                    <>
                      <button type="button" onClick={(e) => { e.stopPropagation(); cameraInputRef.current.click(); }} className="flex-1 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-xl text-xs font-bold uppercase hover:bg-gray-50 dark:hover:bg-gray-700 transition flex items-center justify-center gap-2 shadow-sm">
                        <FaCamera /> Usar Cámara
                      </button>
                      <button type="button" onClick={(e) => { e.stopPropagation(); handleManualPaste(); }} className="flex-1 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-xl text-xs font-bold uppercase hover:bg-gray-50 dark:hover:bg-gray-700 transition flex items-center justify-center gap-2 shadow-sm">
                        <FaPaste /> Pegar Imagen
                      </button>
                    </>
                 )}
              </div>

              {/* Hidden inputs... */}
              {showMobilePasteInput && (
                <div className="absolute inset-0 bg-gray-900/90 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center p-4 z-50">
                    <textarea autoFocus className="w-full h-32 bg-gray-800 text-white rounded-xl p-4 text-sm border border-indigo-500" onPaste={processPaste} onBlur={() => setTimeout(() => setShowMobilePasteInput(false), 300)} placeholder="Mantén presionado aquí para pegar..." />
                    <button type="button" onClick={() => setShowMobilePasteInput(false)} className="mt-4 text-xs text-red-400 font-bold uppercase bg-white/10 px-4 py-2 rounded-lg">Cancelar</button>
                </div>
              )}
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
              <input type="file" ref={cameraInputRef} className="hidden" accept="image/*" capture="environment" onChange={handleFileChange} />
            </div>

          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={() => { clearDraft(); onClose(); }}
              className="px-6 py-3 rounded-xl font-bold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors uppercase text-xs tracking-wider"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/30 transition transform active:scale-95 uppercase text-xs tracking-wider flex items-center gap-2 ${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {isSubmitting ? 'Guardando...' : (initialData ? 'Actualizar' : 'Guardar Producto')}
            </button>
          </div>
        </form>
      </div>

      {/* Crop Modal */}
      {/* Crop Modal - Portalled to body to ensure visibility */}
      {isCropping && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black flex flex-col animate-fade-in">
          <div className="relative flex-1 bg-black">
            <Cropper
              image={tempImage}
              crop={crop}
              zoom={zoom}
              aspect={1}
              onCropChange={setCrop}
              onCropComplete={onCropComplete}
              onZoomChange={setZoom}
            />
          </div>
          <div className="bg-gray-900 p-6 flex flex-col gap-4 border-t border-gray-800">
            <div className="flex items-center gap-4">
              <span className="text-white text-xs font-bold uppercase">Zoom</span>
              <input
                type="range"
                value={zoom}
                min={1}
                max={3}
                step={0.1}
                onChange={(e) => setZoom(e.target.value)}
                className="w-full accent-indigo-500 cursor-pointer"
              />
            </div>
            <div className="flex justify-between gap-4">
              <button
                type="button"
                onClick={() => { setIsCropping(false); setTempImage(null); }}
                className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-bold uppercase text-sm transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCropSave}
                className="flex-1 py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold uppercase text-sm shadow-lg transition flex justify-center items-center gap-2"
              >
                <FaCrop /> Recortar y Usar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default ProductForm;
