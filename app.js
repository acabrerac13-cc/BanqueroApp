/**
 * BanqueroApp Web — Application Controller
 * Connects UI to the BankerAlgorithm engine.
 */
(function () {
    'use strict';

    // ===== State =====
    let currentScreen = 'home';
    let screenHistory = ['home'];

    // Custom exercise state
    let nProc = 3;
    let nRes = 2;
    let total = [5, 3];
    let allocation = [[1, 0], [1, 1], [1, 0]];
    let max = [[3, 2], [2, 1], [3, 2]];

    // Simulation state
    let simWork = [];
    let simFinish = [];
    let simSequence = [];
    let simHistory = []; // for undo
    let simSelectedProc = null;
    let simSourceState = null; // the state being simulated

    // Request state
    let reqSelectedProc = 0;
    let currentState = null; // active BankerState for custom exercise

    // ===== Learn example data =====
    const LEARN_EXAMPLE = {
        nProc: 3, nRes: 2,
        total: [5, 3],
        allocation: [[1, 0], [1, 1], [1, 0]],
        max: [[3, 2], [2, 1], [3, 2]]
    };

    const FIVE_PROC_EXAMPLE = {
        nProc: 5, nRes: 3,
        total: [10, 5, 7],
        allocation: [[0, 1, 0], [2, 0, 0], [3, 0, 2], [2, 1, 1], [0, 0, 2]],
        max: [[7, 5, 3], [3, 2, 2], [9, 0, 2], [2, 2, 2], [4, 3, 3]]
    };

    // ===== Navigation =====
    function showScreen(name) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const el = document.getElementById('screen-' + name);
        if (el) el.classList.add('active');
        currentScreen = name;

        // Back button
        const backBtn = document.getElementById('btn-back');
        backBtn.style.display = (name === 'home') ? 'none' : 'flex';

        // Title
        const titles = {
            home: 'BanqueroApp',
            learn: 'Aprender con un ejemplo',
            simulation: 'Simulación interactiva',
            config: 'Configurar ejercicio',
            review: 'Cálculos automáticos',
            safety: 'Comprobar seguridad',
            request: 'Solicitud de recursos',
            glossary: 'Glosario',
            help: '¿Cómo funciona?'
        };
        document.getElementById('topbar-title').textContent = titles[name] || 'BanqueroApp';
    }

    function navigateTo(name) {
        screenHistory.push(name);
        showScreen(name);
    }

    function navigateBack() {
        if (screenHistory.length > 1) {
            screenHistory.pop();
            showScreen(screenHistory[screenHistory.length - 1]);
        }
    }

    // ===== Helpers =====
    function resName(j) { return String.fromCharCode(65 + j); }

    function vec(arr) { return '(' + arr.join(', ') + ')'; }

    function cloneState(st) {
        return {
            nProc: st.nProc, nRes: st.nRes,
            total: [...st.total],
            allocation: st.allocation.map(r => [...r]),
            max: st.max.map(r => [...r])
        };
    }

    function sanitizeInt(val) {
        const digits = String(val).replace(/[^0-9]/g, '');
        if (!digits) return 0;
        return Math.min(parseInt(digits, 10), 999);
    }

    function getResColors(j) {
        const colors = [
            { bg: 'var(--blue-100)', border: 'var(--blue-200)', text: 'var(--blue-800)', cls: 'res-a' },
            { bg: 'var(--green-100)', border: 'var(--green-200)', text: 'var(--green-800)', cls: 'res-b' },
            { bg: '#fef3c7', border: '#fde68a', text: '#92400e', cls: 'res-generic' },
            { bg: '#fce7f3', border: '#fbcfe8', text: '#9d174d', cls: 'res-generic' },
            { bg: '#e0e7ff', border: '#c7d2fe', text: '#3730a3', cls: 'res-generic' }
        ];
        return colors[j % colors.length];
    }

    // ===== Render resource blocks =====
    function renderResBlocks(container, values, labels) {
        container.innerHTML = '';
        values.forEach((v, j) => {
            const c = getResColors(j);
            const div = document.createElement('div');
            div.className = 'res-block';
            div.style.background = c.bg;
            div.style.borderColor = c.border;
            div.style.color = c.text;
            div.style.border = '1px solid ' + c.border;
            div.innerHTML = `<span class="res-label">${labels ? labels[j] : resName(j)}</span><span class="res-val">${v}</span>`;
            container.appendChild(div);
        });
    }

    // ===== CONFIG SCREEN =====
    function buildConfigUI() {
        document.getElementById('proc-count').textContent = nProc;
        document.getElementById('res-count').textContent = nRes;

        // Total inputs
        const totalDiv = document.getElementById('total-inputs');
        totalDiv.innerHTML = '';
        for (let j = 0; j < nRes; j++) {
            const grp = document.createElement('div');
            grp.className = 'input-group';
            grp.innerHTML = `<label>${resName(j)}</label><input class="cell-input" type="text" inputmode="numeric" data-type="total" data-j="${j}" value="${total[j] || 0}">`;
            totalDiv.appendChild(grp);
        }

        // Allocation table
        buildInputTable('alloc-table', allocation, 'alloc');

        // Max table
        buildInputTable('max-table', max, 'max');

        validateAndShowErrors();
    }

    function buildInputTable(tableId, matrix, dataType) {
        const table = document.getElementById(tableId);
        let html = '<thead><tr><th>Proc.</th>';
        for (let j = 0; j < nRes; j++) html += `<th>${resName(j)}</th>`;
        html += '</tr></thead><tbody>';
        for (let i = 0; i < nProc; i++) {
            html += `<tr><td>P${i}</td>`;
            for (let j = 0; j < nRes; j++) {
                const val = matrix[i]?.[j] || 0;
                html += `<td><input class="cell-input" type="text" inputmode="numeric" data-type="${dataType}" data-i="${i}" data-j="${j}" value="${val}"></td>`;
            }
            html += '</tr>';
        }
        html += '</tbody>';
        table.innerHTML = html;
    }

    function handleCellInput(e) {
        const input = e.target;
        if (!input.classList.contains('cell-input')) return;
        const type = input.dataset.type;
        const j = parseInt(input.dataset.j);
        const val = sanitizeInt(input.value);
        input.value = val;

        if (type === 'total') {
            total[j] = val;
        } else if (type === 'alloc') {
            const i = parseInt(input.dataset.i);
            if (!allocation[i]) allocation[i] = new Array(nRes).fill(0);
            allocation[i][j] = val;
        } else if (type === 'max') {
            const i = parseInt(input.dataset.i);
            if (!max[i]) max[i] = new Array(nRes).fill(0);
            max[i][j] = val;
        } else if (type === 'request') {
            // handled in request section
        }

        validateAndShowErrors();
    }

    function validateAndShowErrors() {
        const state = { nProc, nRes, total, allocation, max };
        const result = BankerAlgorithm.validate(state);
        const area = document.getElementById('config-validation');
        area.innerHTML = '';

        // Mark error cells
        document.querySelectorAll('.cell-input.error').forEach(el => el.classList.remove('error'));

        if (result.valid) {
            area.innerHTML = '<div class="val-msg success"><span class="val-icon">✅</span> Todos los datos son válidos.</div>';
        } else {
            result.issues.forEach(issue => {
                const div = document.createElement('div');
                div.className = 'val-msg ' + (issue.type === 'max_exceeds_total' ? 'warning' : 'error');
                div.innerHTML = `<span class="val-icon">${issue.type === 'max_exceeds_total' ? '⚠️' : '❌'}</span> ${issue.msg}`;
                area.appendChild(div);

                // Highlight error cells
                if (issue.proc !== undefined && issue.res !== undefined) {
                    const type = issue.type === 'alloc_exceeds_max' ? 'alloc' : 'max';
                    const sel = `.cell-input[data-type="${type}"][data-i="${issue.proc}"][data-j="${issue.res}"]`;
                    const cell = document.querySelector(sel);
                    if (cell) cell.classList.add('error');
                }
            });
        }

        const nextBtn = document.getElementById('btn-config-next');
        nextBtn.disabled = !result.valid;

        currentState = state;
        return result.valid;
    }

    function loadExample(ex) {
        nProc = ex.nProc;
        nRes = ex.nRes;
        total = [...ex.total];
        allocation = ex.allocation.map(r => [...r]);
        max = ex.max.map(r => [...r]);
        buildConfigUI();
    }

    function resizeDimensions() {
        // Preserve data
        const newAlloc = [];
        const newMax = [];
        for (let i = 0; i < nProc; i++) {
            newAlloc[i] = [];
            newMax[i] = [];
            for (let j = 0; j < nRes; j++) {
                newAlloc[i][j] = allocation[i]?.[j] || 0;
                newMax[i][j] = max[i]?.[j] || 0;
            }
        }
        allocation = newAlloc;
        max = newMax;

        const newTotal = [];
        for (let j = 0; j < nRes; j++) {
            newTotal[j] = total[j] || 0;
        }
        total = newTotal;

        buildConfigUI();
    }

    // ===== REVIEW SCREEN =====
    function buildReviewUI() {
        const state = { nProc, nRes, total, allocation, max };
        const need = BankerAlgorithm.computeNeed(allocation, max, nProc, nRes);
        const available = BankerAlgorithm.computeAvailable(total, allocation, nProc, nRes);
        const allocSum = BankerAlgorithm.computeAllocSum(allocation, nProc, nRes);

        // Available with formula
        const avDiv = document.getElementById('review-available');
        let avHTML = '<div class="resource-blocks" style="margin-bottom:12px;">';
        for (let j = 0; j < nRes; j++) {
            const c = getResColors(j);
            avHTML += `<div class="res-block" style="background:${c.bg};border:1px solid ${c.border};color:${c.text};">
                <span class="res-label">${resName(j)}</span><span class="res-val">${available[j]}</span></div>`;
        }
        avHTML += '</div>';
        avHTML += '<div style="font-size:0.83rem;color:var(--text-secondary);">';
        for (let j = 0; j < nRes; j++) {
            avHTML += `${resName(j)}: ${total[j]} − ${allocSum[j]} = <strong>${available[j]}</strong>`;
            if (j < nRes - 1) avHTML += ' &nbsp;|&nbsp; ';
        }
        avHTML += '</div>';
        avDiv.innerHTML = avHTML;

        // Need table
        const needTable = document.getElementById('review-need-table');
        let nHTML = '<thead><tr><th></th>';
        for (let j = 0; j < nRes; j++) nHTML += `<th>${resName(j)}</th>`;
        nHTML += '</tr></thead><tbody>';
        for (let i = 0; i < nProc; i++) {
            nHTML += `<tr><td>P${i}</td>`;
            for (let j = 0; j < nRes; j++) {
                nHTML += `<td>${max[i][j]} − ${allocation[i][j]} = <strong>${need[i][j]}</strong></td>`;
            }
            nHTML += '</tr>';
        }
        nHTML += '</tbody>';
        needTable.innerHTML = nHTML;

        // Full comparison table
        buildFullTable('review-full-table', state, need);
    }

    function buildFullTable(tableId, state, need) {
        const table = document.getElementById(tableId);
        let html = '<thead><tr><th></th>';
        for (let j = 0; j < state.nRes; j++) html += `<th>Asig. ${resName(j)}</th>`;
        for (let j = 0; j < state.nRes; j++) html += `<th>Máx. ${resName(j)}</th>`;
        for (let j = 0; j < state.nRes; j++) html += `<th>Nec. ${resName(j)}</th>`;
        html += '</tr></thead><tbody>';
        for (let i = 0; i < state.nProc; i++) {
            html += `<tr><td>P${i}</td>`;
            for (let j = 0; j < state.nRes; j++) html += `<td>${state.allocation[i][j]}</td>`;
            for (let j = 0; j < state.nRes; j++) html += `<td>${state.max[i][j]}</td>`;
            for (let j = 0; j < state.nRes; j++) html += `<td style="font-weight:700;color:var(--green-600)">${need[i][j]}</td>`;
            html += '</tr>';
        }
        html += '</tbody>';
        table.innerHTML = html;
    }

    // ===== SAFETY SCREEN =====
    function buildSafetyUI() {
        const state = { nProc, nRes, total, allocation, max };
        const need = BankerAlgorithm.computeNeed(allocation, max, nProc, nRes);
        const safety = BankerAlgorithm.checkSafety(state);

        // Result card
        const card = document.getElementById('safety-result-card');
        if (safety.isSafe) {
            card.className = 'safety-card safe';
            card.innerHTML = `
                <div class="safety-icon">✅</div>
                <h3>ESTADO SEGURO</h3>
                <p>El sistema puede asignar recursos de forma que todos los procesos terminen sin caer en interbloqueo.</p>
                <p class="seq-text">Secuencia segura encontrada: ${safety.sequence.map(i => 'P' + i).join(' → ')}</p>
                <p style="margin-top:8px;font-size:0.84rem;opacity:0.8;">Esta secuencia demuestra que es posible; pueden existir otras secuencias válidas.</p>`;
        } else {
            card.className = 'safety-card unsafe';
            let pendingInfo = '';
            safety.pending.forEach(p => {
                const m = safety.missing[p] || [];
                if (m.length > 0) {
                    pendingInfo += `<br>P${p} necesita: ${m.map(x => `${x.resName}(faltan ${x.deficit})`).join(', ')}`;
                }
            });
            card.innerHTML = `
                <div class="safety-icon">🚨</div>
                <h3>ESTADO INSEGURO</h3>
                <p>No fue posible encontrar una secuencia que permita terminar a todos los procesos.</p>
                <p>Procesos pendientes: ${safety.pending.map(i => 'P' + i).join(', ')}${pendingInfo}</p>
                <p style="margin-top:8px;font-size:0.84rem;"><strong>Nota:</strong> Un estado inseguro no significa que ya exista un interbloqueo, sino que no se puede garantizar evitarlo si los procesos demandan su máximo declarado.</p>`;
        }

        // Available
        const avDiv = document.getElementById('safety-available');
        renderResBlocks(avDiv, safety.available);

        // Full table
        buildFullTable('safety-full-table', state, need);
    }

    // ===== SIMULATION =====
    function initSimulation(state) {
        simSourceState = cloneState(state);
        const available = BankerAlgorithm.computeAvailable(state.total, state.allocation, state.nProc, state.nRes);
        simWork = [...available];
        simFinish = new Array(state.nProc).fill(false);
        simSequence = [];
        simHistory = [];
        simSelectedProc = null;

        document.getElementById('sim-final').style.display = 'none';
        document.getElementById('sim-comparison').style.display = 'none';
        document.getElementById('sim-explanation').style.display = 'none';

        renderSimUI();
    }

    function renderSimUI() {
        const st = simSourceState;
        const need = BankerAlgorithm.computeNeed(st.allocation, st.max, st.nProc, st.nRes);

        // Work blocks
        renderResBlocks(document.getElementById('sim-work'), simWork);

        // Process buttons
        const btnGroup = document.getElementById('sim-process-btns');
        btnGroup.innerHTML = '';
        for (let i = 0; i < st.nProc; i++) {
            const btn = document.createElement('button');
            btn.className = 'process-btn';
            btn.textContent = 'P' + i;
            if (simFinish[i]) {
                btn.classList.add('done');
                btn.disabled = true;
            }
            if (simSelectedProc === i) btn.classList.add('selected');
            btn.addEventListener('click', () => selectSimProcess(i));
            btnGroup.appendChild(btn);
        }

        // Sequence display
        const seqDiv = document.getElementById('sim-sequence');
        if (simSequence.length === 0) {
            seqDiv.innerHTML = '<span class="seq-empty">Aún no se ha ejecutado ningún proceso.</span>';
        } else {
            seqDiv.innerHTML = simSequence.map((p, idx) => {
                let html = `<span class="seq-item slide-in">P${p}</span>`;
                if (idx < simSequence.length - 1) html += '<span class="seq-arrow">→</span>';
                return html;
            }).join('');
        }

        // Status table
        renderStatusTable(st, need);

        // Undo button
        document.getElementById('btn-sim-undo').disabled = simHistory.length === 0;

        // Check if simulation is complete
        checkSimComplete(st, need);
    }

    function renderStatusTable(st, need) {
        const div = document.getElementById('sim-status-table');
        let html = '<table class="status-table"><thead><tr><th>Proc.</th>';
        for (let j = 0; j < st.nRes; j++) html += `<th>Nec. ${resName(j)}</th>`;
        for (let j = 0; j < st.nRes; j++) html += `<th>Asig. ${resName(j)}</th>`;
        html += '<th>Estado</th></tr></thead><tbody>';

        for (let i = 0; i < st.nProc; i++) {
            html += `<tr class="${simFinish[i] ? 'done-row' : ''}"><td><strong>P${i}</strong></td>`;
            for (let j = 0; j < st.nRes; j++) html += `<td>${need[i][j]}</td>`;
            for (let j = 0; j < st.nRes; j++) html += `<td>${st.allocation[i][j]}</td>`;
            html += `<td>${simFinish[i] ? '✓ Terminado' : 'Pendiente'}</td></tr>`;
        }
        html += '</tbody></table>';
        div.innerHTML = html;
    }

    function selectSimProcess(i) {
        if (simFinish[i]) return;
        simSelectedProc = i;

        const st = simSourceState;
        const need = BankerAlgorithm.computeNeed(st.allocation, st.max, st.nProc, st.nRes);

        // Update button highlight
        document.querySelectorAll('#sim-process-btns .process-btn').forEach((btn, idx) => {
            btn.classList.toggle('selected', idx === i);
        });

        // Show comparison
        const compDiv = document.getElementById('sim-comparison');
        compDiv.style.display = 'block';
        document.getElementById('sim-comp-title').textContent = `Comparación para P${i}`;

        const body = document.getElementById('sim-comp-body');
        body.innerHTML = '';

        let canFinish = true;
        const failedRes = [];

        for (let j = 0; j < st.nRes; j++) {
            const n = need[i][j];
            const w = simWork[j];
            const ok = n <= w;
            if (!ok) {
                canFinish = false;
                failedRes.push({ j, need: n, work: w, deficit: n - w });
            }

            const row = document.createElement('div');
            row.className = 'comp-row ' + (ok ? 'satisfied' : 'unsatisfied');
            row.innerHTML = `<span class="comp-icon">${ok ? '✅' : '❌'}</span>
                <span>Necesidad(${resName(j)}) = ${n} ${ok ? '≤' : '>'} Trabajo(${resName(j)}) = ${w}</span>`;
            body.appendChild(row);
        }

        const resultDiv = document.getElementById('sim-comp-result');
        const actionsDiv = document.getElementById('sim-comp-actions');

        if (canFinish) {
            resultDiv.className = 'sim-result can-finish';
            resultDiv.innerHTML = `<strong>P${i} puede terminar.</strong> Su Necesidad ${vec(need[i])} es menor o igual que Trabajo ${vec(simWork)} en todos los recursos.`;

            actionsDiv.innerHTML = '';
            const btn = document.createElement('button');
            btn.className = 'btn btn-success';
            btn.innerHTML = '▶ Simular que P' + i + ' termina';
            btn.addEventListener('click', () => executeSimProcess(i));
            actionsDiv.appendChild(btn);
        } else {
            resultDiv.className = 'sim-result cannot-finish';
            const details = failedRes.map(f =>
                `${resName(f.j)}: necesita ${f.need}, Trabajo tiene ${f.work} (faltan ${f.deficit})`
            ).join('; ');
            resultDiv.innerHTML = `<strong>P${i} no puede terminar ahora.</strong> Faltan recursos: ${details}. Elige otro proceso.`;
            actionsDiv.innerHTML = '';
        }
    }

    function executeSimProcess(i) {
        const st = simSourceState;

        // Save undo state
        simHistory.push({
            work: [...simWork],
            finish: [...simFinish],
            sequence: [...simSequence]
        });

        const need = BankerAlgorithm.computeNeed(st.allocation, st.max, st.nProc, st.nRes);

        // Show explanation
        const workBefore = [...simWork];
        for (let j = 0; j < st.nRes; j++) {
            simWork[j] += st.allocation[i][j];
        }
        simFinish[i] = true;
        simSequence.push(i);
        simSelectedProc = null;

        const expDiv = document.getElementById('sim-explanation');
        expDiv.style.display = 'block';
        expDiv.className = 'explanation-box slide-in';
        expDiv.innerHTML = `<strong>P${i}</strong> todavía podría necesitar ${vec(need[i])}. En la simulación tenemos ${vec(workBefore)}, así que puede terminar. Libera los recursos que tenía asignados: ${vec(st.allocation[i])}. <strong>Trabajo pasa a ser ${vec(simWork)}.</strong>`;

        // Hide comparison
        document.getElementById('sim-comparison').style.display = 'none';

        // Animate work blocks
        setTimeout(() => {
            document.querySelectorAll('#sim-work .res-block').forEach(b => b.classList.add('pulse-anim'));
        }, 50);

        renderSimUI();
    }

    function undoSimStep() {
        if (simHistory.length === 0) return;
        const prev = simHistory.pop();
        simWork = prev.work;
        simFinish = prev.finish;
        simSequence = prev.sequence;
        simSelectedProc = null;

        document.getElementById('sim-final').style.display = 'none';
        document.getElementById('sim-comparison').style.display = 'none';
        document.getElementById('sim-explanation').style.display = 'none';

        renderSimUI();
    }

    function resetSimulation() {
        initSimulation(simSourceState);
    }

    function showHint() {
        const st = simSourceState;
        const need = BankerAlgorithm.computeNeed(st.allocation, st.max, st.nProc, st.nRes);

        // Find first process that can finish
        for (let i = 0; i < st.nProc; i++) {
            if (simFinish[i]) continue;
            let canFinish = true;
            for (let j = 0; j < st.nRes; j++) {
                if (need[i][j] > simWork[j]) { canFinish = false; break; }
            }
            if (canFinish) {
                selectSimProcess(i);
                return;
            }
        }

        // No process can finish — show message
        const expDiv = document.getElementById('sim-explanation');
        expDiv.style.display = 'block';
        expDiv.className = 'explanation-box';
        expDiv.innerHTML = '<strong>Ningún proceso pendiente puede terminar</strong> con el Trabajo actual ' + vec(simWork) + '. No es posible encontrar una secuencia segura desde este punto.';
    }

    function checkSimComplete(st, need) {
        const allDone = simFinish.every(f => f);
        const finalDiv = document.getElementById('sim-final');

        if (allDone) {
            finalDiv.style.display = 'block';
            finalDiv.className = 'sim-final-card safe slide-in';
            finalDiv.innerHTML = `
                <h3>✅ ¡Todos los procesos terminaron!</h3>
                <p>Secuencia construida: <strong>${simSequence.map(i => 'P' + i).join(' → ')}</strong></p>
                <p>Esto demuestra que el estado inicial era <strong>seguro</strong>: existe al menos un orden en el que todos los procesos pueden terminar recibiendo los recursos que necesitan.</p>
                <p style="font-size:0.84rem;margin-top:6px;opacity:0.8;">Recuerda: la secuencia segura es una posibilidad que demuestra la seguridad, no un orden obligatorio de ejecución real. Pueden existir otras secuencias válidas.</p>`;
            return;
        }

        // Check if stuck
        let anyCanFinish = false;
        for (let i = 0; i < st.nProc; i++) {
            if (simFinish[i]) continue;
            let canFinish = true;
            for (let j = 0; j < st.nRes; j++) {
                if (need[i][j] > simWork[j]) { canFinish = false; break; }
            }
            if (canFinish) { anyCanFinish = true; break; }
        }

        if (!anyCanFinish && simSequence.length > 0) {
            const pending = [];
            for (let i = 0; i < st.nProc; i++) {
                if (!simFinish[i]) pending.push(i);
            }
            finalDiv.style.display = 'block';
            finalDiv.className = 'sim-final-card unsafe slide-in';
            finalDiv.innerHTML = `
                <h3>🚨 No se encontró secuencia segura</h3>
                <p>Ningún proceso pendiente (${pending.map(i => 'P' + i).join(', ')}) puede terminar con Trabajo = ${vec(simWork)}.</p>
                <p>Esto indica un <strong>estado inseguro</strong>: el sistema no puede garantizar que todos terminen si demandan su máximo declarado.</p>
                <p style="font-size:0.84rem;margin-top:6px;opacity:0.8;"><strong>Importante:</strong> Un estado inseguro no significa que ya exista un interbloqueo, solo que no hay garantía de evitarlo.</p>`;
        }
    }

    // ===== REQUEST SCREEN =====
    function buildRequestUI() {
        const state = { nProc, nRes, total, allocation, max };
        const need = BankerAlgorithm.computeNeed(allocation, max, nProc, nRes);
        const available = BankerAlgorithm.computeAvailable(total, allocation, nProc, nRes);

        // Process buttons
        const btnGroup = document.getElementById('req-process-btns');
        btnGroup.innerHTML = '';
        for (let i = 0; i < nProc; i++) {
            const btn = document.createElement('button');
            btn.className = 'process-btn' + (i === reqSelectedProc ? ' selected' : '');
            btn.textContent = 'P' + i;
            btn.addEventListener('click', () => {
                reqSelectedProc = i;
                buildRequestUI();
            });
            btnGroup.appendChild(btn);
        }

        // Request inputs
        const inputDiv = document.getElementById('req-inputs');
        inputDiv.innerHTML = '';
        for (let j = 0; j < nRes; j++) {
            const grp = document.createElement('div');
            grp.className = 'input-group';
            const existingInput = inputDiv.querySelector(`[data-type="request"][data-j="${j}"]`);
            const val = existingInput ? existingInput.value : '0';
            grp.innerHTML = `<label>${resName(j)}</label><input class="cell-input" type="text" inputmode="numeric" data-type="request" data-j="${j}" value="${val}">`;
            inputDiv.appendChild(grp);
        }

        // Context info
        const ctx = document.getElementById('req-context');
        ctx.innerHTML = `<strong>P${reqSelectedProc}:</strong> Necesidad = ${vec(need[reqSelectedProc])} | Asignado = ${vec(allocation[reqSelectedProc])} | Disponible = ${vec(available)}`;

        // Hide previous result
        document.getElementById('req-result').style.display = 'none';
    }

    function evaluateRequest() {
        const state = { nProc, nRes, total, allocation, max };

        // Read request values
        const request = [];
        for (let j = 0; j < nRes; j++) {
            const input = document.querySelector(`[data-type="request"][data-j="${j}"]`);
            request.push(sanitizeInt(input ? input.value : '0'));
        }

        const result = BankerAlgorithm.processRequest(state, reqSelectedProc, request);

        const card = document.getElementById('req-result');
        card.style.display = 'block';
        card.className = 'req-result-card slide-in ';

        let cssClass, actionsHTML = '';

        if (result.status === 'APPROVED') {
            cssClass = 'approved';
            actionsHTML = `<div class="req-actions">
                <button class="btn btn-success" onclick="window._applyRequest()">Aplicar asignación</button>
                <button class="btn btn-outline" onclick="document.getElementById('req-result').style.display='none'">Descartar</button>
            </div>`;
            window._pendingUpdate = result.updatedState;
        } else if (result.status === 'REJECTED_EXCEEDS_NEED') {
            cssClass = 'rejected';
        } else if (result.status === 'DEFERRED_NO_RESOURCES') {
            cssClass = 'deferred';
        } else if (result.status === 'DEFERRED_UNSAFE') {
            cssClass = 'deferred';
        }

        card.classList.add(cssClass);
        card.innerHTML = `
            <h3>${result.icon} ${result.title}</h3>
            <p>${result.message}</p>
            <p style="font-size:0.83rem;color:var(--text-secondary);">${result.detail}</p>
            ${actionsHTML}`;
    }

    window._applyRequest = function () {
        if (!window._pendingUpdate) return;
        const u = window._pendingUpdate;
        allocation = u.allocation.map(r => [...r]);
        // total and max stay the same
        window._pendingUpdate = null;
        document.getElementById('req-result').style.display = 'none';
        buildRequestUI();
    };

    // ===== TABLE SCROLL CHECK =====
    function checkTableScroll() {
        document.querySelectorAll('.table-scroll-wrapper').forEach(wrapper => {
            const canScroll = wrapper.scrollWidth > wrapper.clientWidth;
            wrapper.classList.toggle('can-scroll', canScroll);
        });
    }

    // ===== INIT & EVENT BINDING =====
    function init() {
        // Navigation
        document.getElementById('btn-back').addEventListener('click', navigateBack);
        document.getElementById('btn-glossary').addEventListener('click', () => navigateTo('glossary'));
        document.getElementById('btn-help').addEventListener('click', () => navigateTo('help'));
        document.getElementById('btn-home-glossary').addEventListener('click', () => navigateTo('glossary'));
        document.getElementById('btn-home-help').addEventListener('click', () => navigateTo('help'));

        // Home
        document.getElementById('btn-learn').addEventListener('click', () => {
            navigateTo('learn');
        });

        document.getElementById('btn-custom').addEventListener('click', () => {
            navigateTo('config');
            buildConfigUI();
        });

        // Learn screen
        document.getElementById('btn-start-sim').addEventListener('click', () => {
            navigateTo('simulation');
            document.getElementById('sim-mode-badge').textContent = 'Modo aprendizaje';
            initSimulation(LEARN_EXAMPLE);
        });

        // Config screen
        document.getElementById('btn-load-5proc').addEventListener('click', () => loadExample(FIVE_PROC_EXAMPLE));
        document.getElementById('btn-load-3proc').addEventListener('click', () => loadExample(LEARN_EXAMPLE));
        document.getElementById('btn-clear-data').addEventListener('click', () => {
            total = new Array(nRes).fill(0);
            allocation = Array.from({ length: nProc }, () => new Array(nRes).fill(0));
            max = Array.from({ length: nProc }, () => new Array(nRes).fill(0));
            buildConfigUI();
        });

        document.getElementById('btn-proc-minus').addEventListener('click', () => {
            if (nProc > 1) { nProc--; resizeDimensions(); }
        });
        document.getElementById('btn-proc-plus').addEventListener('click', () => {
            if (nProc < 10) { nProc++; resizeDimensions(); }
        });
        document.getElementById('btn-res-minus').addEventListener('click', () => {
            if (nRes > 1) { nRes--; resizeDimensions(); }
        });
        document.getElementById('btn-res-plus').addEventListener('click', () => {
            if (nRes < 5) { nRes++; resizeDimensions(); }
        });

        // Input events (delegated)
        document.addEventListener('input', handleCellInput);

        // Config nav
        document.getElementById('btn-config-back').addEventListener('click', navigateBack);
        document.getElementById('btn-config-next').addEventListener('click', () => {
            if (validateAndShowErrors()) {
                navigateTo('review');
                buildReviewUI();
            }
        });

        // Review nav
        document.getElementById('btn-review-back').addEventListener('click', navigateBack);
        document.getElementById('btn-review-next').addEventListener('click', () => {
            navigateTo('safety');
            buildSafetyUI();
        });

        // Safety nav
        document.getElementById('btn-safety-back').addEventListener('click', navigateBack);
        document.getElementById('btn-safety-sim').addEventListener('click', () => {
            navigateTo('simulation');
            document.getElementById('sim-mode-badge').textContent = 'Paso 4 de 5 — Simulación paso a paso';
            initSimulation({ nProc, nRes, total, allocation, max });
        });
        document.getElementById('btn-safety-req').addEventListener('click', () => {
            reqSelectedProc = 0;
            navigateTo('request');
            buildRequestUI();
        });

        // Simulation controls
        document.getElementById('btn-sim-undo').addEventListener('click', undoSimStep);
        document.getElementById('btn-sim-reset').addEventListener('click', resetSimulation);
        document.getElementById('btn-sim-hint').addEventListener('click', showHint);

        // Request
        document.getElementById('btn-evaluate-req').addEventListener('click', evaluateRequest);
        document.getElementById('btn-req-back').addEventListener('click', navigateBack);
        document.getElementById('btn-req-home').addEventListener('click', () => {
            screenHistory = ['home'];
            showScreen('home');
        });

        // Glossary / Help back
        document.getElementById('btn-glossary-back').addEventListener('click', navigateBack);
        document.getElementById('btn-help-back').addEventListener('click', navigateBack);

        // Scroll check on resize
        window.addEventListener('resize', checkTableScroll);
        new MutationObserver(checkTableScroll).observe(document.getElementById('app'), { childList: true, subtree: true });

        // Initial scroll check
        setTimeout(checkTableScroll, 100);
    }

    // Start
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
