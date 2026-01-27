// CASH CONTROL MODULE (Admin View)
// Manages the "Safe Box" (Caja Fuerte) and Transfers

window.renderCashControl = function (container) {
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'owner')) {
        container.innerHTML = `<div style="padding:2rem; text-align:center;">⛔ No tienes permiso para ver esta sección.</div>`;
        return;
    }

    const balances = db.adminCashControl?.balances || {
        mn: { start: 0, current: 0, real: 0 },
        usd: { start: 0, current: 0, real: 0 },
        eur: { start: 0, current: 0, real: 0 },
        transfer: { start: 0, current: 0, real: 0 }
    };

    const transactions = db.adminCashControl?.transactions || [];

    // Calculate Incomes/Outcomes dynamically for the period (Month)
    // For simplicity, we just sum everything in the array. Ideally, filter by month.
    const stats = {
        mn: { income: 0, outcome: 0 },
        usd: { income: 0, outcome: 0 },
        eur: { income: 0, outcome: 0 },
        transfer: { income: 0, outcome: 0 }
    };

    transactions.forEach(t => {
        const key = t.currency.toLowerCase();
        if (stats[key]) {
            if (t.type.startsWith('INCOME')) stats[key].income += t.amount;
            if (t.type.startsWith('OUTCOME')) stats[key].outcome += t.amount;
        }
    });

    // Update theoretical current based on Start + Inc - Out
    ['mn', 'usd', 'eur', 'transfer'].forEach(k => {
        // balances[k].current = (balances[k].start || 0) + stats[k].income - stats[k].outcome;
        // Actually, let's trust the stored 'current' but verify? 
        // Better recalculate to ensure consistency.
        const theo = (balances[k].start || 0) + stats[k].income - stats[k].outcome;
        balances[k].current = theo; 
    });

    container.innerHTML = `
        <div class="fade-in" style="padding: 1rem;">
            
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2rem;">
                <div>
                    <h2 style="margin:0;">Control de Efectivo Admin</h2>
                    <p style="color:var(--text-muted);">Gestión de Caja Fuerte y Cuentas Digitales</p>
                </div>
                <div style="display:flex; gap:1rem;">
                    <button class="btn-secondary" onclick="setStartingBalance()"><i class="ph ph-pencil"></i> Ajustar Saldos Iniciales</button>
                    <button class="btn-primary" onclick="showTransferOutcomeModal()"><i class="ph ph-minus-circle"></i> Registrar Salida</button>
                </div>
            </div>

            <!-- MAIN TABLE (Excel Replica) -->
            <div class="card" style="margin-bottom: 2rem; overflow-x:auto;">
                <h3 style="margin-bottom:1rem; border-bottom:1px solid var(--border); padding-bottom:0.5rem;">Resumen de Saldos</h3>
                <table style="width:100%; border-collapse:collapse;">
                    <thead>
                        <tr style="background:var(--bg-dark); color:var(--text-muted); text-align:right;">
                            <th style="text-align:left; padding:1rem;">Moneda</th>
                            <th style="padding:1rem;">Saldo Anterior</th>
                            <th style="padding:1rem; color:var(--success);">Ingresos</th>
                            <th style="padding:1rem; color:var(--danger);">Egresos</th>
                            <th style="padding:1rem; font-weight:900; color:var(--text-main);">Saldo Teórico</th>
                            <th style="padding:1rem;">Efectivo Real</th>
                            <th style="padding:1rem;">Diferencia</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${['mn', 'usd', 'eur', 'transfer'].map(curr => {
                            const b = balances[curr];
                            const s = stats[curr];
                            const diff = (b.real || 0) - b.current;
                            const diffColor = diff < 0 ? 'var(--danger)' : (diff > 0 ? 'var(--success)' : 'var(--text-muted)');
                            return `
                                <tr style="border-bottom:1px solid var(--border);">
                                    <td style="padding:1rem; font-weight:bold; text-transform:uppercase;">${curr}</td>
                                    <td style="padding:1rem; text-align:right;">$${(b.start||0).toLocaleString()}</td>
                                    <td style="padding:1rem; text-align:right; color:var(--success);">+$${s.income.toLocaleString()}</td>
                                    <td style="padding:1rem; text-align:right; color:var(--danger);">-$${s.outcome.toLocaleString()}</td>
                                    <td style="padding:1rem; text-align:right; font-weight:900; font-size:1.1rem;">$${b.current.toLocaleString()}</td>
                                    <td style="padding:1rem; text-align:right;">
                                        <input type="number" value="${b.real || 0}" 
                                               onchange="updateRealBalance('${curr}', this.value)"
                                               style="background:var(--bg-dark); border:1px solid var(--border); padding:0.4rem; border-radius:4px; width:100px; text-align:right; color:white;">
                                    </td>
                                    <td style="padding:1rem; text-align:right; font-weight:bold; color:${diffColor};">$${diff.toLocaleString()}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>

            <!-- TRANSFER OUTCOMES LOG (Registro Salidas) -->
            <div class="card">
                <h3 style="margin-bottom:1rem; display:flex; justify-content:space-between;">
                    <span>Registro de Movimientos</span>
                    <span style="font-size:0.9rem; color:var(--text-muted); font-weight:normal;">Últimos 20</span>
                </h3>
                <div style="overflow-x:auto;">
                    <table style="width:100%; border-collapse:collapse; font-size:0.9rem;">
                        <thead>
                            <tr style="text-align:left; color:var(--text-muted); border-bottom:1px solid var(--border);">
                                <th style="padding:0.8rem;">Fecha</th>
                                <th style="padding:0.8rem;">Tipo</th>
                                <th style="padding:0.8rem;">Descripción</th>
                                <th style="padding:0.8rem;">Moneda</th>
                                <th style="padding:0.8rem; text-align:right;">Monto</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${transactions.slice(0, 20).map(t => `
                                <tr style="border-bottom:1px solid var(--border);">
                                    <td style="padding:0.8rem;">${new Date(t.date).toLocaleString()}</td>
                                    <td style="padding:0.8rem;">
                                        <span style="padding:2px 6px; border-radius:4px; background:${t.type.includes('INCOME') ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'}; color:${t.type.includes('INCOME') ? 'var(--success)' : 'var(--danger)'}; font-size:0.8rem;">
                                            ${t.type === 'INCOME_CLOSURE' ? 'CIERRE CAJA' : (t.type === 'OUTCOME_TRANSFER' ? 'SALIDA TRANSF' : t.type)}
                                        </span>
                                    </td>
                                    <td style="padding:0.8rem;">${t.desc}</td>
                                    <td style="padding:0.8rem; text-transform:uppercase;">${t.currency}</td>
                                    <td style="padding:0.8rem; text-align:right; font-weight:bold;">$${t.amount.toLocaleString()}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    `;
};

// ACTIONS

window.updateRealBalance = function(currency, value) {
    if (!db.adminCashControl) return;
    db.adminCashControl.balances[currency].real = parseFloat(value) || 0;
    window.saveData();
    renderCashControl(document.getElementById('content-area')); // Refresh to recalc diff
};

window.setStartingBalance = function() {
    Swal.fire({
        title: 'Ajustar Saldos Iniciales',
        html: `
            <input id="start-mn" type="number" placeholder="MN" class="swal2-input">
            <input id="start-transfer" type="number" placeholder="Transferencia" class="swal2-input">
            <input id="start-usd" type="number" placeholder="USD" class="swal2-input">
            <input id="start-eur" type="number" placeholder="EUR" class="swal2-input">
        `,
        preConfirm: () => {
            return {
                mn: document.getElementById('start-mn').value,
                transfer: document.getElementById('start-transfer').value,
                usd: document.getElementById('start-usd').value,
                eur: document.getElementById('start-eur').value
            };
        }
    }).then((res) => {
        if (res.isConfirmed) {
            const vals = res.value;
            ['mn', 'transfer', 'usd', 'eur'].forEach(k => {
                if (vals[k]) db.adminCashControl.balances[k].start = parseFloat(vals[k]);
            });
            window.saveData();
            renderCashControl(document.getElementById('content-area'));
        }
    });
};

window.showTransferOutcomeModal = function() {
    Swal.fire({
        title: 'Registrar Salida',
        html: `
            <select id="out-currency" class="swal2-select">
                <option value="transfer">Transferencia</option>
                <option value="mn">Efectivo MN</option>
                <option value="usd">USD</option>
                <option value="eur">EUR</option>
            </select>
            <input id="out-desc" type="text" placeholder="Descripción (Ej: Extracción cajero)" class="swal2-input">
            <input id="out-amount" type="number" placeholder="Monto" class="swal2-input">
        `,
        showCancelButton: true,
        confirmButtonText: 'Registrar',
        confirmButtonColor: 'var(--danger)',
        preConfirm: () => {
            const currency = document.getElementById('out-currency').value;
            const desc = document.getElementById('out-desc').value;
            const amount = parseFloat(document.getElementById('out-amount').value);
            if (!amount || !desc) {
                Swal.showValidationMessage('Datos incompletos');
                return false;
            }
            return { currency, desc, amount };
        }
    }).then((res) => {
        if (res.isConfirmed) {
            const { currency, desc, amount } = res.value;
            db.adminCashControl.transactions.unshift({
                date: new Date().toISOString(),
                type: 'OUTCOME_MANUAL',
                currency,
                amount,
                desc
            });
            window.saveData();
            renderCashControl(document.getElementById('content-area'));
            showToast('Salida registrada', 'success');
        }
    });
};
