/**
 * UI-01: Indicador circular compacto de señal WiFi para el header en móviles.
 * Verde = online, gris = offline. Con texto de estado opcional.
 */
import React from 'react';
import { cn } from '../lib/utils';

const ICON_PATH_ONLINE = 'M12 18.5c.9 0 1.6.7 1.6 1.6S12.9 21.7 12 21.7s-1.6-.7-1.6-1.6.7-1.6 1.6-1.6zm0-4.4c1.6 0 3 .6 4.1 1.7l-1.5 1.5a3.7 3.7 0 0 0-5.2 0L7.9 15.8a5.8 5.8 0 0 1 4.1-1.7zm0-4.5c2.8 0 5.4 1.1 7.3 3l-1.5 1.5a8.2 8.2 0 0 0-11.6 0L4.7 12.6a10.3 10.3 0 0 1 7.3-3zm0-4.5c4 0 7.7 1.6 10.4 4.3l-1.5 1.5A12.6 12.6 0 0 0 12 7.4 12.6 12.6 0 0 0 3.1 10.9L1.6 9.4A14.7 14.7 0 0 1 12 5.1z';

export function ConnectionIndicator({ isOnline, showLabel = false, className }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 flex-shrink-0',
        className
      )}
      title={isOnline ? 'Conectado' : 'Sin conexión'}
      aria-label={isOnline ? 'Conectado' : 'Sin conexión'}
      role="status"
    >
      <span
        className={cn(
          'relative inline-flex items-center justify-center w-6 h-6 rounded-full flex-shrink-0',
          isOnline
            ? 'bg-emerald-500/20 ring-1 ring-emerald-500/40'
            : 'bg-slate-600/30 ring-1 ring-slate-500/40'
        )}
      >
        <svg
          viewBox="0 0 24 24"
          className={cn('w-3.5 h-3.5 transition-colors', isOnline ? 'text-emerald-400' : 'text-slate-400')}
          fill="currentColor"
          aria-hidden="true"
        >
          <path d={ICON_PATH_ONLINE} />
        </svg>
        {!isOnline && (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="block w-4 h-[2px] bg-rose-400 rotate-45 rounded-full" />
          </span>
        )}
      </span>
      {showLabel && (
        <span className={cn('text-[10px] font-semibold uppercase tracking-wide', isOnline ? 'text-emerald-400' : 'text-slate-400')}>
          {isOnline ? 'Online' : 'Offline'}
        </span>
      )}
    </span>
  );
}

export default ConnectionIndicator;
