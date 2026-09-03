/**
 * Utilidades de QR Offline para Miss Chulerías CRM
 * Soporta empaquetado ultra compacto, compresión gzip (pako),
 * chunking multi-QR (para 100-300+ productos) y verificación de integridad/idempotencia.
 */
import * as pako from 'pako';

// Tamaño máximo recomendado de caracteres por frame QR para lectura rápida en cámaras modestas
const MAX_CHUNK_SIZE = 500;

/**
 * Convierte un payload JS en un string base64 comprimido
 */
export function compressPayload(data) {
  try {
    const jsonStr = JSON.stringify(data);
    const utf8Bytes = new TextEncoder().encode(jsonStr);
    const compressed = pako.deflate(utf8Bytes, { level: 9 });
    
    // Convertir Uint8Array a binario string de manera segura por chunks
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < compressed.length; i += chunkSize) {
      const sub = compressed.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, sub);
    }
    return btoa(binary);
  } catch (err) {
    console.error('Error comprimiendo payload QR:', err);
    // Fallback a base64 simple UTF-8
    return btoa(encodeURIComponent(JSON.stringify(data)));
  }
}

/**
 * Descomprime un string base64 a su objeto JS original
 */
export function decompressPayload(base64Str) {
  try {
    const binary = atob(base64Str);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const inflated = pako.inflate(bytes);
    const jsonStr = new TextDecoder().decode(inflated);
    return JSON.parse(jsonStr);
  } catch (err) {
    try {
      // Intento con fallback sin pako (JSON directo codificado en base64)
      return JSON.parse(decodeURIComponent(atob(base64Str)));
    } catch (e2) {
      try {
        return JSON.parse(decodeURIComponent(escape(atob(base64Str))));
      } catch (e3) {
        throw new Error('Formato de código QR inválido o dañado');
      }
    }
  }
}

/**
 * Empaqueta un objeto de datos (traslado, venta, cierre) en uno o varios frames QR
 * @param {string} type - Tipo de paquete ('TRF' para traslado, 'SALE' para venta, 'SHIFT' para cierre)
 * @param {object} payload - Datos del objeto
 * @returns {Array<string>} - Array de strings listos para ser renderizados como QR
 */
export function encodeMultiQR(type, payload) {
  const compressed = compressPayload(payload);
  const totalLength = compressed.length;

  // Si cabe en un solo frame
  if (totalLength <= MAX_CHUNK_SIZE) {
    // Formato: MCH|TYPE|1/1|PAYLOAD
    return [`MCH|${type}|1/1|${compressed}`];
  }

  // Dividir en fragmentos
  const totalChunks = Math.ceil(totalLength / MAX_CHUNK_SIZE);
  const frames = [];
  const sessionId = Math.random().toString(36).substring(2, 7).toUpperCase();

  for (let i = 0; i < totalChunks; i++) {
    const start = i * MAX_CHUNK_SIZE;
    const end = Math.min(start + MAX_CHUNK_SIZE, totalLength);
    const chunk = compressed.substring(start, end);
    // Formato: MCH|TYPE|CHUNK_IDX/TOTAL|SESSION_ID|CHUNK
    frames.push(`MCH|${type}|${i + 1}/${totalChunks}|${sessionId}|${chunk}`);
  }

  return frames;
}

/**
 * Acumulador de chunks para el escáner
 */
export class MultiQRReceiver {
  constructor() {
    this.reset();
  }

  reset() {
    this.type = null;
    this.total = 0;
    this.sessionId = null;
    this.chunks = {};
    this.completed = false;
  }

  /**
   * Procesa un string escaneado por la cámara
   * @param {string} rawString
   * @returns {object} { progress, isComplete, data, error, isDuplicateChunk }
   */
  feed(rawString) {
    if (!rawString || typeof rawString !== 'string' || !rawString.startsWith('MCH|')) {
      return { error: 'No es un código QR válido de Miss Chulerías' };
    }

    const parts = rawString.split('|');
    if (parts.length < 4) {
      return { error: 'Estructura de QR incompleta' };
    }

    const type = parts[1];
    const chunkInfo = parts[2]; // '1/1' o '1/4'
    const [currentIdxStr, totalStr] = chunkInfo.split('/');
    const currentIdx = parseInt(currentIdxStr, 10);
    const total = parseInt(totalStr, 10);

    // Caso frame único
    if (total === 1) {
      const payloadBase64 = parts[3];
      try {
        const decoded = decompressPayload(payloadBase64);
        return {
          progress: 100,
          current: 1,
          total: 1,
          isComplete: true,
          type,
          data: decoded
        };
      } catch (err) {
        return { error: 'Error al descomprimir datos del QR: ' + err.message };
      }
    }

    // Caso multi-chunk
    if (parts.length < 5) {
      return { error: 'Fragmento multi-QR inválido' };
    }

    const sessionId = parts[3];
    const chunkData = parts[4];

    // Si cambió de sesión (ej. empezaron a escanear otro paquete nuevo), reiniciamos
    if (this.sessionId && this.sessionId !== sessionId) {
      this.reset();
    }

    this.type = type;
    this.total = total;
    this.sessionId = sessionId;

    const alreadyHad = !!this.chunks[currentIdx];
    this.chunks[currentIdx] = chunkData;

    const receivedCount = Object.keys(this.chunks).length;
    const progress = Math.round((receivedCount / total) * 100);

    if (receivedCount === total) {
      // Reensamblar
      let fullBase64 = '';
      for (let i = 1; i <= total; i++) {
        if (!this.chunks[i]) {
          return { error: `Falta el fragmento ${i} de ${total}` };
        }
        fullBase64 += this.chunks[i];
      }

      try {
        const decoded = decompressPayload(fullBase64);
        this.completed = true;
        return {
          progress: 100,
          current: receivedCount,
          total,
          isComplete: true,
          type: this.type,
          data: decoded
        };
      } catch (err) {
        return { error: 'Error al reensamblar paquete multi-QR: ' + err.message };
      }
    }

    return {
      progress,
      current: receivedCount,
      total,
      isComplete: false,
      isDuplicateChunk: alreadyHad,
      type: this.type
    };
  }
}

/**
 * Empaqueta un traslado en formato ultra ligero (omitiendo fotos)
 */
export function prepareTransferQRPayload(transfer, items = null) {
  if (!transfer) return null;
  const rawItems = items || transfer.items || [];
  return {
    id: transfer.id || transfer.transfer_id || transfer.local_id || `TRF-${Date.now()}`,
    src: transfer.source_inventory || transfer.source_location || 'alm',
    tgt: transfer.target_inventory || transfer.target_location || 'mch1',
    date: transfer.date || transfer.created_at || new Date().toISOString(),
    notes: transfer.notes || '',
    user: transfer.created_by || transfer.user_name || 'Admin',
    total_cost: Number(transfer.total_cost || 0),
    total_sale: Number(transfer.total_sale || 0),
    items: rawItems.map(item => ({
      pid: item.product_id || item.id,
      sku: item.sku || '',
      name: item.name || item.product_name || '',
      qty: Number(item.quantity || item.qty || 0),
      cost: Number(item.cost_price || item.cost || item.cost_mn || 0),
      price: Number(item.sale_price || item.price || item.sale_price_manual || 0)
    }))
  };
}

/**
 * Empaqueta una venta en formato ultra ligero
 */
export function prepareSaleQRPayload(sale, items = null) {
  if (!sale) return null;
  const rawItems = items || sale.items || [];
  return {
    id: sale.id || sale.sale_id || sale.local_id || `VTA-${Date.now()}`,
    code: sale.ticket_code || sale.code || `VTA-${sale.id || sale.local_id || Date.now()}`,
    inv: sale.inventory_id || sale.location_id || 'mch1',
    date: sale.created_at || sale.date || new Date().toISOString(),
    seller: sale.seller_name || sale.user_name || 'Vendedor',
    total: Number(sale.total_amount || sale.total || 0),
    method: sale.payment_method || sale.method || 'cash',
    cash_paid: Number(sale.cash_received || sale.cash_paid || sale.cash_amount || sale.total || 0),
    trans_paid: Number(sale.transfer_received || sale.trans_paid || sale.transfer_amount || 0),
    notes: sale.notes || '',
    items: rawItems.map(item => ({
      pid: item.product_id || item.id,
      sku: item.sku || '',
      name: item.product_name || item.name || '',
      qty: Number(item.quantity || item.qty || 0),
      price: Number(item.unit_price || item.sale_price_manual || item.price || 0),
      total: Number(item.total_price || (Number(item.quantity || 1) * Number(item.sale_price_manual || item.price || 0)))
    }))
  };
}

/**
 * Empaqueta un corte de caja / cierre de turno diario
 */
export function prepareShiftQRPayload(shiftSummary, salesList) {
  return {
    shift_id: shiftSummary.id || `SFT-${Date.now()}`,
    inv: shiftSummary.inventory_id,
    date: shiftSummary.date || new Date().toISOString(),
    seller: shiftSummary.seller_name,
    start_time: shiftSummary.start_time,
    end_time: shiftSummary.end_time || new Date().toISOString(),
    initial_cash: Number(shiftSummary.initial_cash || 0),
    total_cash: Number(shiftSummary.total_cash || 0),
    total_transfer: Number(shiftSummary.total_transfer || 0),
    total_sales_count: Number(shiftSummary.sales_count || salesList?.length || 0),
    grand_total: Number(shiftSummary.grand_total || 0),
    notes: shiftSummary.notes || '',
    sales: (salesList || []).map(s => ({
      id: s.id,
      code: s.code || s.ticket_code,
      tot: Number(s.total_amount || s.total || 0),
      m: s.payment_method,
      t: s.created_at
    }))
  };
}
