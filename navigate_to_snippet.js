function navigateTo(viewId) {
    if (!viewId) viewId = 'dashboard';
    currentView = viewId;
    window.location.hash = viewId;

    // Save state
    saveData();

    // Update Sidebar
    renderSidebar(viewId);

    const container = document.getElementById('content-area');
    if (!container) return;
    container.innerHTML = ''; // Clear

    // Dispatch
    switch (viewId) {
        case 'login':
            renderLogin(container);
            break;
        case 'dashboard':
            if (typeof renderDashboard === 'function') renderDashboard(container);
            break;
        case 'pos':
            if (typeof renderPOS === 'function') renderPOS(container);
            break;
        case 'inventory':
            if (typeof renderInventory === 'function') renderInventory(container);
            break;
        case 'ventas':
            if (typeof renderVentas === 'function') renderVentas(container);
            break;
        case 'daily-records':
            if (typeof renderDailyRecords === 'function') renderDailyRecords(container);
            break;
        case 'cash-control':
            if (typeof renderCashControl === 'function') renderCashControl(container);
            break;
        case 'settings':
            if (typeof renderSettings === 'function') renderSettings(container);
            break;
        case 'transfer':
            if (typeof renderTransfer === 'function') renderTransfer(container);
            break;
        case 'mermas':
            if (typeof renderMermas === 'function') renderMermas(container);
            break;
        default:
            if (viewId !== 'login') {
                container.innerHTML = `<div style="padding:2rem; text-align:center;"><h2>Vista no encontrada: ${viewId}</h2></div>`;
            }
    }
}
