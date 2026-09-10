/**
 * API de empresas (Fase Empresas — docs/FASE_EMPRESAS_SELECTOR.md).
 * Defensivo: 404 → "Backend sin soporte aún", sin crash.
 * Contrato: GET /api/companies → [{id,name,logo,is_default,inventories_count}]
 *           POST /api/companies {name, logo?}
 *           PUT  /api/companies/:id {name?, logo?}  (logo base64)
 * Regla de negocio (Yoe): NO existe eliminar empresa desde este selector.
 */
const API_URL = import.meta.env.VITE_API_URL || '/api';

const getAuthHeaders = () => {
    const token = localStorage.getItem('session_token') || localStorage.getItem('token');
    const h = { 'Content-Type': 'application/json' };
    return token ? { ...h, 'Authorization': `Bearer ${token}` } : h;
};

export async function apiGetCompanies() {
    let res;
    try {
        res = await fetch(`${API_URL}/companies`, { headers: getAuthHeaders() });
    } catch (_) {
        throw new Error('No se pudo contactar al backend (¿sin conexión?).');
    }
    if (res.status === 404) {
        throw new Error('Backend sin soporte aún');
    }
    if (!res.ok) {
        throw new Error(`Error al cargar empresas (HTTP ${res.status})`);
    }
    const data = await res.json();
    return Array.isArray(data) ? data : (Array.isArray(data?.companies) ? data.companies : []);
}

export async function apiCreateCompany(name, logo) {
    let res;
    try {
        const body = { name: String(name || '').trim() };
        if (logo) body.logo = logo; // dataURL base64 (opcional)
        res = await fetch(`${API_URL}/companies`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(body)
        });
    } catch (_) {
        throw new Error('No se pudo contactar al backend (¿sin conexión?).');
    }
    if (res.status === 404) {
        throw new Error('Backend sin soporte aún');
    }
    if (!res.ok) {
        let msg = `Error al crear la empresa (HTTP ${res.status})`;
        try {
            const err = await res.json();
            if (err?.error) msg = err.error;
        } catch (_) { /* cuerpo no JSON */ }
        throw new Error(msg);
    }
    return res.json();
}

// TODO multi-empresa-nexus: edición de nombre/logo para "Limpieza / Reset selectivo"
// futuro en Configuración (espec §3). Por ahora no se usa desde el selector.
export async function apiUpdateCompany(id, { name, logo } = {}) {
    let res;
    try {
        res = await fetch(`${API_URL}/companies/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ ...(name !== undefined ? { name } : {}), ...(logo !== undefined ? { logo } : {}) })
        });
    } catch (_) {
        throw new Error('No se pudo contactar al backend (¿sin conexión?).');
    }
    if (res.status === 404) {
        throw new Error('Backend sin soporte aún');
    }
    if (!res.ok) {
        throw new Error(`Error al actualizar la empresa (HTTP ${res.status})`);
    }
    return res.json();
}