import React, { useMemo } from 'react';

/**
 * BurstFeedback — pequeña explosión de partículas al confirmar una acción.
 * variant 'success': circulito verde con check blanco → partículas esmeralda
 * variant 'danger':  circulito rojo con signo menos blanco → partículas rojas
 * Se monta ya animado (CSS keyframes) y se autolimpia el padre.
 */
export default function BurstFeedback({ variant = 'success' }) {
    const isGreen = variant === 'success';
    const color = isGreen ? '#10b981' : '#f43f5e';
    const glow = isGreen ? 'rgba(16,185,129,' : 'rgba(244,63,94,';

    // Partículas deterministas pero variadas (12 chispas)
    const particles = useMemo(() => {
        const arr = [];
        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2 + (i % 3) * 0.15;
            const dist = 26 + (i % 4) * 9;
            const size = 3 + (i % 3);
            const delay = (i % 5) * 0.02;
            arr.push({ angle, dist, size, delay });
        }
        return arr;
    }, []);

    return (
        <div className="relative flex items-center justify-center" style={{ width: 36, height: 36 }}>
            {/* Halo expandiéndose */}
            <span
                className="absolute inset-0 rounded-full animate-burst-ring"
                style={{ border: `2px solid ${color}`, boxShadow: `0 0 18px ${glow}0.6)` }}
            />
            {/* Círculo sólido con icono */}
            <span
                className="relative z-10 flex items-center justify-center rounded-full animate-burst-pop"
                style={{ width: 30, height: 30, background: color, boxShadow: `0 0 14px ${glow}0.7)` }}
            >
                {isGreen ? (
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 13l4 4L19 7" />
                    </svg>
                ) : (
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round">
                        <path d="M6 12h12" />
                    </svg>
                )}
            </span>
            {/* Chispas */}
            {particles.map((p, i) => (
                <span
                    key={i}
                    className="absolute rounded-full animate-burst-particle"
                    style={{
                        width: p.size,
                        height: p.size,
                        background: color,
                        animationDelay: `${p.delay}s`,
                        '--burst-x': `${Math.cos(p.angle) * p.dist}px`,
                        '--burst-y': `${Math.sin(p.angle) * p.dist}px`
                    }}
                />
            ))}
        </div>
    );
}
