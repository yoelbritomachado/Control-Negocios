/**
 * API de inventarios (creación desde el selector '+' — espec §2).
 * Defensivo: 404 → mensaje "Backend sin soporte aún", sin crash.
 * TODO multi-empresa: el inventario se crea dentro de la empresa por defecto
 *   (Miss Chulerías); cuando exista la entidad EMPRESA habrá que pasar
 *   business/company_id explícito.
 */
const API_URL = import.meta.env.VITE_API_URL || '/api';

const getAuthHeaders = () => {
    const token = localStorage.getItem('session_token') || localStorage.getItem('token');
    const h = { 'Content-Type': 'application/json' };
    return token ? { ...h, 'Authorization': `Bearer ${token}` } : h;
};

export async function apiGetInventories(companyId) {
    let res;
    try {
        const qs = companyId ? `?company_id=${encodeURIComponent(companyId)}` : '';
        res = await fetch(`${API_URL}/inventories${qs}`, { headers: getAuthHeaders() });
    } catch (_) {
        throw new Error('No se pudo contactar al backend (¿sin conexión?).');
    }
    if (res.status === 404) {
        throw new Error('Backend sin soporte aún');
    }
    if (!res.ok) {
        throw new Error(`Error al cargar inventarios (HTTP ${res.status})`);
    }
    return res.json();
}

export async function apiCreateInventory(name, type, companyId) {
    let res;
    try {
        res = await fetch(`${API_URL}/inventories`, {
            method: 'POST',
            headers: getAuthHeaders(),
            // TODO multi-empresa-nexus: el inventario se crea linkeado a la EMPRESA ACTIVA.
            // Si el backend aún no soporta company_id, lo ignora (defensivo).
            body: JSON.stringify({
                name: String(name || '').trim(),
                type,
                ...(companyId !== undefined && companyId !== null ? { company_id: companyId } : {})
            })
        });
    } catch (_) {
        throw new Error('No se pudo contactar al backend (¿sin conexión?).');
    }
    if (res.status === 404) {
        throw new Error('Backend sin soporte aún');
    }
    if (!res.ok) {
        let msg = `Error al crear el inventario (HTTP ${res.status})`;
        try {
            const err = await res.json();
            if (err?.error) msg = err.error;
        } catch (_) { /* cuerpo no JSON */ }
        throw new Error(msg);
    }
    return res.json();
}