const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');

const CHROME_PATH = "C:\\Users\\Yoe_Laptop\\AppData\\Local\\ms-playwright\\chromium-1228\\chrome-win64\\chrome.exe";
const PORT = 9222;

function get(url) {
    return new Promise((resolve, reject) => {
        http.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve(data);
                }
            });
        }).on('error', reject);
    });
}

function sendCDP(wsUrl, method, params = {}) {
    return new Promise((resolve, reject) => {
        const WebSocket = require('ws'); // or built-in if available
    });
}

async function run() {
    console.log("=== INICIANDO INSTANCIA DE TEST HEADLESS CDP ===");
    const chrome = spawn(CHROME_PATH, [
        `--remote-debugging-port=${PORT}`,
        '--headless=new',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--user-data-dir=C:\\Users\\Yoe_Laptop\\AppData\\Local\\Temp\\crm_audit_profile'
    ]);

    await new Promise(r => setTimeout(r, 2000));

    try {
        const version = await get(`http://127.0.0.1:${PORT}/json/version`);
        console.log("CDP Conectado:", version.Browser);

        const list = await get(`http://127.0.0.1:${PORT}/json/list`);
        console.log("Tabs activas:", list.length);
    } catch (e) {
        console.error("Error al conectar con CDP:", e.message);
    } finally {
        chrome.kill();
    }
}

run();
