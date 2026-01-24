/**
 * MCH Control - Debug Overlay
 * Injected to catch and display errors explicitly for the user.
 */

window.onerror = function (msg, url, lineNo, columnNo, error) {
    showCriticalError(`FATAL ERROR: ${msg}\nLine: ${lineNo}\nFile: ${url}`);
    return false;
};

window.addEventListener('unhandledrejection', function (event) {
    showCriticalError(`UNHANDLED PROMISE: ${event.reason}`);
});

console.error = (function (originalError) {
    return function (...args) {
        // Filter out harmless logs if needed, but for now show everything
        try {
            const errorMsg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
            if (!errorMsg.includes("404") && !errorMsg.includes("favicon")) {
                showCriticalError(`CONSOLE ERROR: ${errorMsg}`);
            }
        } catch (e) { }
        originalError.apply(console, args);
    };
})(console.error);

function showCriticalError(message) {
    // Prevent duplicate overlays
    if (document.getElementById('debug-overlay-' + message.substring(0, 20))) return;

    const overlay = document.createElement('div');
    overlay.id = 'debug-overlay-' + message.substring(0, 20);
    overlay.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        max-width: 400px;
        background: rgba(40, 0, 0, 0.95);
        border: 2px solid #ff4444;
        color: white;
        padding: 15px;
        z-index: 99999;
        font-family: monospace;
        font-size: 12px;
        border-radius: 8px;
        box-shadow: 0 5px 20px rgba(0,0,0,0.5);
    `;

    overlay.innerHTML = `
        <h3 style="margin: 0 0 10px; color: #ff4444; border-bottom: 1px solid #ff4444; padding-bottom: 5px;">🔥 ERROR DETECTADO</h3>
        <pre style="white-space: pre-wrap; margin: 0; color: #ffcccc;">${message}</pre>
        <button onclick="this.parentElement.remove()" style="margin-top: 10px; background: #444; color: white; border: none; padding: 5px 10px; cursor: pointer; width: 100%;">Cerrar</button>
    `;

    document.body.appendChild(overlay);
}

console.log("🛡️ Debug Overlay Active");
