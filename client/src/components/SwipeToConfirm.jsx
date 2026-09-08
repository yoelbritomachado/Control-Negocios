import React, { useState, useRef, useEffect } from 'react';
import { motion, useMotionValue, animate } from 'framer-motion';
import BurstFeedback from './BurstFeedback';

/**
 * SwipeToConfirm — botón modular de confirmación por deslizamiento.
 * Mismo código para toda acción; cambia solo el skin (color/labels) y la acción.
 * Al soltar el knob pasando el umbral (~75% del recorrido):
 *   1) ¡ting! — estallido de partículas (BurstFeedback) visible ~600ms
 *   2) luego se ejecuta la acción (onConfirm) y el contenedor se cierra
 *
 * El burst se renderiza FUERA del track (que tiene overflow-hidden) para que
 * las partículas no queden recortadas.
 *
 * Props:
 * - onConfirm: función a ejecutar (la acción definida: aprobar, eliminar, etc.)
 * - label / confirmLabel: textos
 * - color: 'rose' (danger) | 'emerald' (success) | 'amber'
 * - disabled: bool
 */
const SKINS = {
    rose: {
        track: 'bg-rose-500/15 border-rose-500/40',
        fill: 'bg-gradient-to-r from-rose-600 to-rose-500',
        text: 'text-rose-300',
        knob: 'bg-rose-500 shadow-lg shadow-rose-500/40',
        burst: 'danger'
    },
    emerald: {
        track: 'bg-emerald-500/15 border-emerald-500/40',
        fill: 'bg-gradient-to-r from-emerald-600 to-emerald-500',
        text: 'text-emerald-300',
        knob: 'bg-emerald-500 shadow-lg shadow-emerald-500/40',
        burst: 'success'
    },
    amber: {
        track: 'bg-amber-500/15 border-amber-500/40',
        fill: 'bg-gradient-to-r from-amber-600 to-amber-500',
        text: 'text-amber-300',
        knob: 'bg-amber-500 shadow-lg shadow-amber-500/40',
        burst: 'success'
    }
};

const KNOB = 44;
const PADDING = 4;
const BURST_DELAY_MS = 600; // tiempo visible del estallido antes de ejecutar la acción

export default function SwipeToConfirm({
    onConfirm,
    label = 'Desliza para confirmar',
    confirmLabel = 'Confirmado',
    color = 'rose',
    disabled = false
}) {
    const trackRef = useRef(null);
    const [maxX, setMaxX] = useState(0);
    const [fired, setFired] = useState(false); // acción disparada: bloquea re-drag y muestra burst
    const [busy, setBusy] = useState(false);
    const x = useMotionValue(0);
    const skin = SKINS[color] || SKINS.rose;

    // Medir ancho real del track (y en resize)
    useEffect(() => {
        const measure = () => {
            if (trackRef.current) {
                setMaxX(Math.max(0, trackRef.current.offsetWidth - KNOB - PADDING * 2));
            }
        };
        measure();
        window.addEventListener('resize', measure);
        return () => window.removeEventListener('resize', measure);
    }, []);

    const handleDragEnd = async () => {
        if (disabled || fired || busy) return;
        const threshold = maxX * 0.75;
        if (maxX > 0 && x.get() >= threshold) {
            // Umbral superado → snap al final + burst visible + acción diferida
            animate(x, maxX, { duration: 0.12 });
            setFired(true);
            setBusy(true);
            // Dejar que el estallido se vea antes de ejecutar la acción
            setTimeout(async () => {
                try {
                    await onConfirm?.();
                } catch (err) {
                    console.warn('SwipeToConfirm onConfirm error:', err);
                } finally {
                    // Resetear tras ejecutar (margen para que el cierre del modal no corte el burst a mitad)
                    setTimeout(() => {
                        animate(x, 0, { duration: 0.25 });
                        setFired(false);
                        setBusy(false);
                    }, 300);
                }
            }, BURST_DELAY_MS);
        } else {
            // No llegó → volver suave
            animate(x, 0, { type: 'spring', stiffness: 400, damping: 30 });
        }
    };

    return (
        <div className="relative">
            {/* Track con overflow-hidden (clip del fill redondeado) */}
            <div
                ref={trackRef}
                className={`relative w-full rounded-xl border overflow-hidden touch-none select-none ${skin.track} ${disabled ? 'opacity-50' : ''}`}
                style={{ height: 56 }}
            >
                {/* Fill de progreso bajo el knob */}
                <motion.div
                    className={`absolute top-0 h-full ${skin.fill}`}
                    style={{ left: PADDING, width: x }}
                />

                {/* Texto centrado (se desvanece al arrastrar) */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <motion.span
                        className={`text-sm font-semibold ${fired ? 'text-white' : skin.text}`}
                        style={{ opacity: fired ? 1 : undefined }}
                    >
                        {fired ? confirmLabel : label}
                    </motion.span>
                </div>

                {/* Knob arrastrable — constraints numéricos, sin ref reactivo */}
                <motion.div
                    drag={disabled || fired ? false : 'x'}
                    dragConstraints={{ left: 0, right: maxX }}
                    dragElastic={0.01}
                    dragMomentum={false}
                    style={{ x, width: KNOB, height: KNOB, top: PADDING, left: PADDING }}
                    onDragEnd={handleDragEnd}
                    className={`absolute rounded-full flex items-center justify-center ${
                        fired ? 'bg-transparent' : skin.knob
                    } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'}`}
                >
                    {!fired && (
                        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 5l7 7-7 7" />
                        </svg>
                    )}
                </motion.div>
            </div>

            {/* KANB-H: Overlay del burst — FUERA del track para no ser recortado por overflow-hidden.
                Posicionado exactamente donde queda el knob al final del recorrido. */}
            {fired && (
                <div
                    className="absolute pointer-events-none flex items-center justify-center"
                    style={{
                        top: PADDING,
                        left: PADDING + maxX,
                        width: KNOB,
                        height: KNOB,
                        zIndex: 60
                    }}
                >
                    <BurstFeedback variant={skin.burst} />
                </div>
            )}
        </div>
    );
}
