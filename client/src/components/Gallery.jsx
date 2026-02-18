import React, { useState, useEffect, useCallback } from 'react';
import { ImageOff } from 'lucide-react';

const Gallery = ({ viewGallery, setViewGallery }) => {
    const [touchDelta, setTouchDelta] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [failedImages, setFailedImages] = useState(new Set());

    // Gallery Keyboard Navigation
    useEffect(() => {
        if (!viewGallery) return;

        const handleKeyDown = (e) => {
            if (e.key === 'ArrowRight') {
                setViewGallery(prev => ({ ...prev, index: (prev.index + 1) % prev.images.length }));
            } else if (e.key === 'ArrowLeft') {
                setViewGallery(prev => ({ ...prev, index: (prev.index - 1 + prev.images.length) % prev.images.length }));
            } else if (e.key === 'Escape') {
                setViewGallery(null);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [viewGallery, setViewGallery]);

    if (!viewGallery) return null;

    const handleImageError = useCallback((imgIndex) => {
        setFailedImages(prev => new Set(prev).add(imgIndex));
    }, []);

    const validImages = viewGallery.images.map((img, i) => ({
        src: img,
        failed: failedImages.has(i)
    }));

    return (
        <div
            className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center p-0 animate-fade-in touch-none"
            onClick={() => setViewGallery(null)}
            onTouchStart={(e) => {
                const touch = e.touches[0];
                // Store in local variable to avoid unnecessary state access during move
                e.currentTarget.dataset.startX = touch.clientX;
                setIsDragging(true);
            }}
            onTouchMove={(e) => {
                const startX = parseFloat(e.currentTarget.dataset.startX);
                const currentX = e.touches[0].clientX;
                setTouchDelta(currentX - startX);
            }}
            onTouchEnd={() => {
                setIsDragging(false);
                const threshold = window.innerWidth * 0.2; // 20%

                if (Math.abs(touchDelta) > threshold) {
                    const total = viewGallery.images.length;
                    if (touchDelta < 0) {
                        setViewGallery(prev => ({ ...prev, index: (prev.index + 1) % total }));
                    } else {
                        setViewGallery(prev => ({ ...prev, index: (prev.index - 1 + total) % total }));
                    }
                }
                setTouchDelta(0);
            }}
        >
            <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden" onClick={(e) => e.stopPropagation()}>

                {/* Sliding Container */}
                <div
                    className={`flex w-full h-full ${!isDragging ? 'transition-transform duration-300 ease-out' : ''} will-change-transform`}
                    style={{
                        transform: `translate3d(calc(-${viewGallery.index * 100}% + ${touchDelta}px), 0, 0)`
                    }}
                >
                    {validImages.map((img, i) => (
                        <div key={i} className="min-w-full h-full flex items-center justify-center p-4">
                            {img.failed ? (
                                <div className="flex flex-col items-center justify-center text-white/50">
                                    <ImageOff className="w-16 h-16 mb-4 opacity-50" />
                                    <span className="text-sm">Imagen no disponible</span>
                                </div>
                            ) : (
                                <img
                                    src={img.src}
                                    className="max-w-full max-h-full object-contain shadow-2xl pointer-events-none"
                                    alt={`Gallery ${i}`}
                                    onError={() => handleImageError(i)}
                                />
                            )}
                        </div>
                    ))}
                </div>

                {/* Close Button */}
                <button
                    onClick={() => setViewGallery(null)}
                    className="absolute top-6 right-6 z-[110] text-white/50 hover:text-white bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full w-12 h-12 flex items-center justify-center transition-all shadow-lg active:scale-95"
                >
                    <span className="text-3xl leading-none">&times;</span>
                </button>

                {/* Navigation Arrows (Desktop) */}
                {viewGallery.images.length > 1 && (
                    <>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setViewGallery(prev => ({ ...prev, index: (prev.index - 1 + prev.images.length) % prev.images.length }));
                            }}
                            className="absolute left-6 top-1/2 -translate-y-1/2 z-50 text-white/40 hover:text-white bg-white/5 hover:bg-white/10 backdrop-blur-sm p-5 rounded-full transition-all hidden md:flex items-center justify-center active:scale-90"
                        >
                            <span className="text-5xl leading-none" style={{ marginTop: '-4px' }}>&#8249;</span>
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setViewGallery(prev => ({ ...prev, index: (prev.index + 1) % prev.images.length }));
                            }}
                            className="absolute right-6 top-1/2 -translate-y-1/2 z-50 text-white/40 hover:text-white bg-white/5 hover:bg-white/10 backdrop-blur-sm p-5 rounded-full transition-all hidden md:flex items-center justify-center active:scale-90"
                        >
                            <span className="text-5xl leading-none" style={{ marginTop: '-4px' }}>&#8250;</span>
                        </button>
                    </>
                )}

                {/* Image Counter */}
                {viewGallery.images.length > 1 && (
                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-md px-6 py-2 rounded-full text-white/90 text-sm font-bold shadow-xl border border-white/10 whitespace-nowrap">
                        {viewGallery.index + 1} <span className="text-white/30 mx-1">/</span> {viewGallery.images.length}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Gallery;
