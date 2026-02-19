import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Package2, Loader2 } from 'lucide-react';

// ProductThumbnail Component - Memoized for performance
const ProductThumbnail = React.memo(({ product, onClick }) => {
  const [index, setIndex] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Memoize images array to prevent unnecessary recalculations
  const images = useMemo(() => 
    product.images && product.images.length > 0 
      ? product.images 
      : (product.image ? [product.image] : []),
    [product.images, product.image]
  );

  // Image rotation effect - only run when necessary
  useEffect(() => {
    if (images.length <= 1) return;
    const interval = setInterval(() => {
      setIndex(prev => (prev + 1) % images.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [images.length]);

  // Memoize valid images filter
  const validImages = useMemo(() => {
    const isValidImageUrl = (url) => {
      if (!url) return false;
      return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/');
    };
    return images.filter(isValidImageUrl);
  }, [images]);
  
  // Memoized click handler
  const handleClick = useCallback((e) => {
    e.stopPropagation();
    if (!hasError && onClick) onClick(validImages, index);
  }, [hasError, onClick, validImages, index]);

  const handleImageError = useCallback(() => {
    setHasError(true);
    setIsLoading(false);
  }, []);

  const handleImageLoad = useCallback(() => {
    setIsLoading(false);
  }, []);

  // Si no hay imágenes válidas o hubo error, mostrar icono genérico
  if (validImages.length === 0 || hasError) {
    return (
      <div className="w-12 h-12 bg-gradient-to-br from-slate-800 to-slate-700 rounded-lg flex items-center justify-center border border-slate-600">
        <Package2 className="w-6 h-6 text-slate-400" />
      </div>
    );
  }

  const currentImage = validImages[index];

  return (
    <div
      onClick={handleClick}
      className="w-12 h-12 cursor-pointer relative overflow-hidden rounded-lg bg-slate-800 border border-slate-600 hover:border-cyan-500/50 transition-colors"
    >
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
          <Loader2 className="w-4 h-4 text-slate-500 animate-spin" />
        </div>
      )}
      <img
        src={currentImage}
        alt={product.name}
        onError={handleImageError}
        onLoad={handleImageLoad}
        className={`w-full h-full object-cover transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
      />
      
      {validImages.length > 1 && (
        <div className="absolute bottom-0 right-0 z-10 bg-black/70 text-white text-[7px] px-1 rounded-tl">
          {validImages.length}
        </div>
      )}
    </div>
  );
});

ProductThumbnail.displayName = 'ProductThumbnail';

export default ProductThumbnail;
