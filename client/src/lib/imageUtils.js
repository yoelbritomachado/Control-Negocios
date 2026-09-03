/**
 * Utility to get optimized image URLs based on connection quality / device state
 */
export function getAdaptiveImageUrl(url, qualityOverride = null) {
  if (!url || typeof url !== 'string') return '';
  if (url.startsWith('blob:') || url.startsWith('data:')) return url;

  // Si viene como ruta relativa /uploads/..., mantenerla relativa para que funcione tanto en HTTPS, Tailscale o local
  const baseUrl = url.startsWith('http') ? url : (url.startsWith('/') ? url : `/${url}`);

  let quality = qualityOverride;
  if (!quality) {
    try {
      const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (conn) {
        if (conn.saveData || conn.effectiveType === '2g' || conn.effectiveType === 'slow-2g') {
          quality = 'low';
        } else if (conn.effectiveType === '3g') {
          quality = 'medium';
        }
      }
    } catch (e) {
      // Ignore
    }
  }

  if (!quality) return baseUrl;

  try {
    const urlObj = new URL(baseUrl, window.location.origin);
    urlObj.searchParams.set('quality', quality);
    return baseUrl.startsWith('http') ? urlObj.toString() : (urlObj.pathname + urlObj.search);
  } catch (e) {
    const sep = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${sep}quality=${quality}`;
  }
}
