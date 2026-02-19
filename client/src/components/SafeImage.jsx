import React, { useState, useCallback } from 'react';
import { Package2, Loader2, ImageOff } from 'lucide-react';
import { cn } from '../lib/utils';

/**
 * SafeImage Component
 * 
 * A wrapper around img that handles loading states and errors gracefully.
 * Shows a placeholder when the image fails to load or doesn't exist.
 * 
 * @param {string} src - Image URL
 * @param {string} alt - Alt text
 * @param {string} className - Classes for the image element
 * @param {string} containerClassName - Classes for the container
 * @param {ReactNode} placeholder - Custom placeholder component
 * @param {boolean} showLoader - Whether to show loading spinner
 * @param {function} onError - Callback when image fails to load
 * @param {function} onLoad - Callback when image loads successfully
 */
export const SafeImage = React.memo(({
  src,
  alt = '',
  className = '',
  containerClassName = '',
  placeholder = null,
  showLoader = true,
  onError,
  onLoad,
  ...imgProps
}) => {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const handleError = useCallback((e) => {
    setHasError(true);
    setIsLoading(false);
    onError?.(e);
  }, [onError]);

  const handleLoad = useCallback((e) => {
    setIsLoading(false);
    onLoad?.(e);
  }, [onLoad]);

  // If no src or error occurred, show placeholder
  if (!src || hasError) {
    return (
      <div className={cn(
        "flex items-center justify-center bg-slate-800/50",
        containerClassName
      )}>
        {placeholder || (
          <div className="flex flex-col items-center justify-center text-slate-500">
            <ImageOff className="w-8 h-8 opacity-50" />
            <span className="text-[10px] mt-1 opacity-50">No disponible</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden", containerClassName)}>
      {showLoader && isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-800/30">
          <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
        </div>
      )}
      <img
        src={src}
        alt={alt}
        onError={handleError}
        onLoad={handleLoad}
        className={cn(
          "transition-opacity duration-300",
          isLoading ? "opacity-0" : "opacity-100",
          className
        )}
        {...imgProps}
      />
    </div>
  );
});

SafeImage.displayName = 'SafeImage';

/**
 * ProductImage Component
 * 
 * Specialized version for product thumbnails/cards with consistent styling
 */
export const ProductImage = React.memo(({
  src,
  alt = '',
  className = '',
  size = 'md',
  ...props
}) => {
  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-20 h-20',
    full: 'w-full h-full',
  };

  return (
    <SafeImage
      src={src}
      alt={alt}
      containerClassName={cn(
        sizeClasses[size] || sizeClasses.md,
        "rounded-lg bg-slate-800 border border-slate-700",
        className
      )}
      className="w-full h-full object-cover"
      placeholder={
        <div className="flex items-center justify-center w-full h-full">
          <Package2 className="w-5 h-5 text-slate-500 opacity-50" />
        </div>
      }
      {...props}
    />
  );
});

ProductImage.displayName = 'ProductImage';

export default SafeImage;
