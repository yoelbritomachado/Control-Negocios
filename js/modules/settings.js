// SETTINGS MODULE
// Manages App Configuration, Currency Rates, Expense Categories, and Data

window.renderSettingsV2 = function (container) {
    // Permission Check
    if (!currentUser || (currentUser.role !== 'owner' && currentUser.role !== 'admin')) {
        container.innerHTML = `<div style="padding:2rem; text-align:center;">⛔ Acceso Denegado</div>`;
        return;
    }

    const rates = db.settings.currencyRates || { usd_buy: 320, eur_buy: 340 };
    const theme = db.settings.theme || 'dark';
    const categories = db.expenseCategories || [];

    container.innerHTML = `
        <div class="fade-in" style="max-width: 900px; margin: 0 auto; padding: 1rem;">
            
            <h2 style="margin-bottom: 2rem; display: flex; align-items: center; gap: 0.5rem;">
                <i class="ph ph-gear"></i> Configuración del Sistema
            </h2>

            <!-- 1. FINANCIAL SETTINGS (Currency Rates) -->
            <div class="card" style="margin-bottom: 2rem; border-left: 4px solid var(--warning);">
                <h3 style="margin-bottom: 1rem; color: var(--warning); display: flex; align-items: center; gap: 0.5rem;">
                    <i class="ph ph-currency-circle-dollar"></i> Tasas de Cambio (Compra de Divisas)
                </h3>
                <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 1.5rem;">
                    Define el precio en MN al que el negocio compra divisas (USD/EUR) a través del POS.
                </p>

                <div class="grid-2" style="gap: 2rem;">
                    <div>
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Precio Compra USD</label>
                        <div style="position: relative;">
                            <span style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: var(--text-muted);">$</span>
                            <input type="number" id="conf-usd-rate" value="${rates.usd_buy}" class="input-field" style="padding-left: 2rem; width: 100%; font-size:1.1rem; font-weight:bold;">
                        </div>
                    </div>
                    <div>
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Precio Compra EUR</label>
                        <div style="position: relative;">
                            <span style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: var(--text-muted);">$</span>
                            <input type="number" id="conf-eur-rate" value="${rates.eur_buy}" class="input-field" style="padding-left: 2rem; width: 100%; font-size:1.1rem; font-weight:bold;">
                        </div>
                    </div>
                </div>
            </div>

            <!-- 2. EXPENSE CATEGORIES -->
            <div class="card" style="margin-bottom: 2rem;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                    <h3 style="margin:0; color: var(--text-main); display: flex; align-items: center; gap: 0.5rem;">
                        <i class="ph ph-list-dashes"></i> Categorías de Gastos
                    </h3>
                    <button class="btn-sm btn-primary" onclick="addExpenseCategory()">+ Nueva</button>
                </div>
                
                <div style="background:var(--bg-dark); border-radius:8px; overflow:hidden;">
                    ${categories.map((cat, idx) => `
                        <div style="padding:0.8rem 1rem; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
                            <div>
                                <span style="font-weight:600;">${cat.name || cat.label}</span>
                                <span style="font-size:0.75rem; color:var(--text-muted); margin-left:0.5rem; background:rgba(255,255,255,0.1); padding:2px 6px; border-radius:4px;">
                                    ${cat.allowedRoles === 'all' ? 'Público' : 'Solo Admin'}
                                </span>
                            </div>
                            <button class="btn-icon" onclick="removeExpenseCategory(${idx})" style="color:var(--danger);"><i class="ph ph-trash"></i></button>
                        </div>
                    `).join('')}
                    ${categories.length === 0 ? '<div style="padding:1rem; text-align:center; color:var(--text-muted);">No hay categorías definidas</div>' : ''}
                </div>
            </div>

            <!-- 3. APP PREFERENCES -->
            <div class="card" style="margin-bottom: 2rem;">
                <h3 style="margin-bottom: 1rem; color: var(--text-main); display: flex; align-items: center; gap: 0.5rem;">
                    <i class="ph ph-paint-brush"></i> Apariencia
                </h3>
                <div style="display: flex; gap: 1rem; align-items: center;">
                    <label class="switch">
                        <input type="checkbox" id="conf-theme-toggle" ${theme === 'light' ? 'checked' : ''} onchange="toggleThemeFromSettings(this)">
                        <span class="slider round"></span>
                    </label>
                    <span>Modo Claro</span>
                </div>
            </div>

            <!-- 4. DATA MANAGEMENT -->
            <div class="card" style="border: 1px solid var(--danger); background: rgba(239, 68, 68, 0.05);">
                <h3 style="margin-bottom: 1rem; color: var(--danger); display: flex; align-items: center; gap: 0.5rem;">
                    <i class="ph ph-database"></i> Gestión de Datos
                </h3>
                <div style="display: flex; gap: 1rem;">
                    <button class="btn-secondary" onclick="exportData()" style="border-color: var(--border);">
                        <i class="ph ph-download"></i> Exportar Copia
                    </button>
                    ${currentUser.role === 'owner' ? `
                    <button class="btn-ghost" onclick="resetDatabase()" style="color: var(--danger);">
                        <i class="ph ph-trash"></i> Resetear Fábrica
                    </button>
                    ` : ''}
                </div>
            </div>

            <!-- SAVE ACTION -->
            <div style="position: sticky; bottom: 1rem; background: var(--bg-main); padding: 1rem; border-top: 1px solid var(--border); display: flex; justify-content: flex-end; margin-top: 2rem; border-radius:12px; box-shadow: 0 -5px 20px rgba(0,0,0,0.2);">
                <button class="btn-primary" onclick="saveSettings()" style="padding: 0.8rem 3rem; font-size: 1.1rem; box-shadow: 0 4px 15px rgba(59, 130, 246, 0.4);">
                    <i class="ph ph-floppy-disk"></i> GUARDAR CAMBIOS
                </button>
            </div>

        </div>
    `;
};

window.saveSettings = function () {
    const usdRate = parseFloat(document.getElementById('conf-usd-rate').value);
    const eurRate = parseFloat(document.getElementById('conf-eur-rate').value);

    if (!usdRate || !eurRate) {
        showToast("Ingresa tasas válidas", "warning");
        return;
    }

    // Save to DB
    if (!db.settings.currencyRates) db.settings.currencyRates = {};
    db.settings.currencyRates.usd_buy = usdRate;
    db.settings.currencyRates.eur_buy = eurRate;

    window.saveData();
    showToast("Configuración guardada correctamente ✅", "success");
};

// --- Helper Functions ---

window.toggleThemeFromSettings = function(el) {
    db.settings.theme = el.checked ? 'light' : 'dark';
    window.saveData();
    applyTheme(); // Defined in app.js
}

window.addExpenseCategory = async function() {
    const { value: formValues } = await Swal.fire({
        title: 'Nueva Categoría',
        html: `
            <input id="swal-input1" class="swal2-input" placeholder="Nombre (Ej: Limpieza)">
            <select id="swal-input2" class="swal2-select" style="margin-top:1rem; width:80%;">
                <option value="admin">Solo Admin</option>
                <option value="all">Todo el equipo</option>
            </select>
        `,
        focusConfirm: false,
        preConfirm: () => {
            return [
                document.getElementById('swal-input1').value,
                document.getElementById('swal-input2').value
            ]
        }
    });

    if (formValues && formValues[0]) {
        if (!db.expenseCategories) db.expenseCategories = [];
        // Generate new ID based on max existing ID + 1
        const maxId = db.expenseCategories.reduce((max, c) => Math.max(max, c.id || 0), 0);
        db.expenseCategories.push({
            id: maxId + 1,
            name: formValues[0],
            allowedRoles: formValues[1]
        });
        window.saveData();
        renderSettings(document.getElementById('content-area')); // Refresh
    }
}

window.removeExpenseCategory = function(index) {
    if(confirm("¿Eliminar esta categoría?")) {
        db.expenseCategories.splice(index, 1);
        window.saveData();
        renderSettings(document.getElementById('content-area'));
    }
}

window.exportData = function() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(window.db));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href",     dataStr);
    downloadAnchorNode.setAttribute("download", "mch_backup_" + new Date().toISOString().slice(0,10) + ".json");
    document.body.appendChild(downloadAnchorNode); 
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

window.resetDatabase = function() {
    Swal.fire({
        title: '¿Estás seguro?',
        text: "Se borrarán TODAS las ventas, productos y configuraciones. No se puede deshacer.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sí, borrar todo'
    }).then((result) => {
        if (result.isConfirmed) {
            localStorage.clear();
            location.reload();
        }
    })
}
