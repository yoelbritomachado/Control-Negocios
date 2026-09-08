/**
 * Aviso de medianoche (kanb-j): la sesión abierta del vendedor se auto-cierra
 * a las 00:00 y va a revisión. Este hook expone el estado temporal:
 *  - 'none':   aún no aplica (antes de las 23:00)
 *  - 'soon':   entre 23:00 y 00:00 -> advertir que se envía a revisión a las 00:00
 *  - 'crossed': después de medianoche (00:00 a 01:00) -> la sesión ya cruzó
 */
import { useState, useEffect } from 'react';

function computePhase(now = new Date()) {
  const h = now.getHours();
  if (h >= 23) return 'soon';
  if (h < 1) return 'crossed';
  return 'none';
}

export function useMidnightWarning() {
  const [phase, setPhase] = useState(() => computePhase());

  useEffect(() => {
    const tick = () => setPhase(computePhase());
    tick();
    // Revisar cada 30 segundos para no perder el cambio de fase
    const iv = setInterval(tick, 30000);
    return () => clearInterval(iv);
  }, []);

  return {
    phase, // 'none' | 'soon' | 'crossed'
    showWarning: phase !== 'none',
    minutesToMidnight: phase === 'soon' ? 60 - new Date().getMinutes() : null
  };
}

export default useMidnightWarning;
