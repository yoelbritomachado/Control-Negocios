import React, { useState, useEffect } from 'react';
import { FaEdit, FaTrash, FaTag } from 'react-icons/fa';
import { Package2, Loader2 } from 'lucide-react';

// ProductThumbnail Component
const ProductThumbnail = ({ product, onClick }) => {
  const [index, setIndex] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const images = product.images && product.images.length > 0 
    ? product.images 
    : (product.image ? [product.image] : []);

  useEffect(() => {
    if (images.length <= 1) return;
    const interval = setInterval(() => {
      setIndex(prev => (prev + 1) % images.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [images.length]);

  // Verificar si la URL de la imagen es válida
  const isValidImageUrl = (url) => {
    if (!url) return false;
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/')) {
      return true;
    }
    return false;
  };

  const validImages = images.filter(isValidImageUrl);

  const handleImageError = () => {
    setHasError(true);
    setIsLoading(false);
  };

  const handleImageLoad = () => {
    setIsLoading(false);
  };

  // Si no hay imágenes válidas o hubo error
  if (validImages.length === 0 || hasError) {
    return (
      <div className="w-12 h-12 bg-slate-800 rounded-lg flex items-center justify-center border border-slate-700">
        <Package2 className="w-5 h-5 text-slate-500" />
      </div>
    );
  }

  const currentImage = validImages[index];

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        if (!hasError) onClick(validImages, index);
      }}
      className="w-12 h-12 cursor-pointer relative overflow-hidden rounded-lg bg-slate-800 border border-slate-700"
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
};

export default ProductThumbnail;
