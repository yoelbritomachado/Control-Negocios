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

export async function apiCreateInventory(name, type) {
    let res;
    try {
        res = await fetch(`${API_URL}/inventories`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ name: String(name || '').trim(), type })
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