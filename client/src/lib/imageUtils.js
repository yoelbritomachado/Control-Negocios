/**
 * Utility to get optimized image URLs based on connection quality / device state
 */
export function getAdaptiveImageUrl(url, qualityOverride = null) {
  if (!url || typeof url !== 'string') return '';
  if (url.startsWith('blob:') || url.startsWith('data:')) return url;

  // Determine base url
  const baseUrl = url.startsWith('http') ? url : `http://localhost:3002${url.startsWith('/') ? '' : '/'}${url}`;

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
    const urlObj = new URL(baseUrl);
    urlObj.searchParams.set('quality', quality);
    return urlObj.toString();
  } catch (e) {
    const sep = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${sep}quality=${quality}`;
  }
}
