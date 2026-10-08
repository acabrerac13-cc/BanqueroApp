/**
 * BanqueroApp Web — Test suite
 * Run with: node web/tests.js
 * Uses the same BankerAlgorithm engine.
 */

const BankerAlgorithm = require('./banker.js');

let passed = 0;
let failed = 0;

function assert(condition, msg) {
    if (condition) {
        passed++;
        console.log(`  ✅ ${msg}`);
    } else {
        failed++;
        console.error(`  ❌ FAIL: ${msg}`);
    }
}

function arrEq(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    return a.every((v, i) => v === b[i]);
}

// ===== Test 1: Default 5-process example =====
console.log('\n📋 Test 1: Ejemplo de 5 procesos (Silberschatz)');
{
    const state = {
        nProc: 5, nRes: 3,
        total: [10, 5, 7],
        allocation: [[0,1,0],[2,0,0],[3,0,2],[2,1,1],[0,0,2]],
        max: [[7,5,3],[3,2,2],[9,0,2],[2,2,2],[4,3,3]]
    };

    const available = BankerAlgorithm.computeAvailable(state.total, state.allocation, 5, 3);
    assert(arrEq(available, [3, 3, 2]), `Disponible = [3,3,2] (got ${available})`);

    const need = BankerAlgorithm.computeNeed(state.allocation, state.max, 5, 3);
    assert(arrEq(need[0], [7,4,3]), `Necesidad P0 = [7,4,3]`);
    assert(arrEq(need[1], [1,2,2]), `Necesidad P1 = [1,2,2]`);
    assert(arrEq(need[2], [6,0,0]), `Necesidad P2 = [6,0,0]`);
    assert(arrEq(need[3], [0,1,1]), `Necesidad P3 = [0,1,1]`);
    assert(arrEq(need[4], [4,3,1]), `Necesidad P4 = [4,3,1]`);

    const val = BankerAlgorithm.validate(state);
    assert(val.valid, 'Validación: estado válido');

    const safety = BankerAlgorithm.checkSafety(state);
    assert(safety.isSafe, 'Estado seguro');
    assert(safety.sequence.length === 5, 'Secuencia incluye los 5 procesos');
    assert(safety.sequence[0] === 1 || safety.sequence[0] === 3, `Primer proceso ejecutable P1 o P3`);
    const seqSet = new Set(safety.sequence);
    assert(seqSet.size === 5, 'Sin repetidos en secuencia');
}

// ===== Test 2: Learn example (3 procs, 2 res) =====
console.log('\n📋 Test 2: Ejemplo de aprendizaje (3 procesos, 2 recursos)');
{
    const state = {
        nProc: 3, nRes: 2,
        total: [5, 3],
        allocation: [[1,0],[1,1],[1,0]],
        max: [[3,2],[2,1],[3,2]]
    };

    const available = BankerAlgorithm.computeAvailable(state.total, state.allocation, 3, 2);
    assert(arrEq(available, [2, 2]), `Disponible = [2,2] (got ${available})`);

    const need = BankerAlgorithm.computeNeed(state.allocation, state.max, 3, 2);
    assert(arrEq(need[0], [2,2]), `Necesidad P0 = [2,2]`);
    assert(arrEq(need[1], [1,0]), `Necesidad P1 = [1,0]`);
    assert(arrEq(need[2], [2,2]), `Necesidad P2 = [2,2]`);

    const safety = BankerAlgorithm.checkSafety(state);
    assert(safety.isSafe, 'Estado seguro');
    assert(safety.sequence.length === 3, 'Secuencia con 3 procesos');
}

// ===== Test 3: Unsafe state =====
console.log('\n📋 Test 3: Estado inseguro');
{
    const state = {
        nProc: 2, nRes: 2,
        total: [4, 4],
        allocation: [[2,2],[2,2]],
        max: [[4,4],[4,4]]
    };

    const available = BankerAlgorithm.computeAvailable(state.total, state.allocation, 2, 2);
    assert(arrEq(available, [0,0]), 'Disponible = [0,0]');

    const safety = BankerAlgorithm.checkSafety(state);
    assert(!safety.isSafe, 'Estado inseguro detectado');
    assert(safety.pending.length === 2, '2 procesos pendientes');
    assert(safety.pending.includes(0) && safety.pending.includes(1), 'P0 y P1 pendientes');
    assert(safety.missing[0] && safety.missing[0].length > 0, 'Faltantes para P0 detallados');
}

// ===== Test 4: Validation errors =====
console.log('\n📋 Test 4: Validaciones de entrada');
{
    // Alloc > Max
    const v1 = BankerAlgorithm.validate({
        nProc: 2, nRes: 2, total: [10,10],
        allocation: [[5,2],[1,1]], max: [[4,2],[2,2]]
    });
    assert(!v1.valid, 'Detecta Asignado > Máximo');
    assert(v1.issues.some(i => i.type === 'alloc_exceeds_max'), 'Tipo correcto: alloc_exceeds_max');

    // Max > Total
    const v2 = BankerAlgorithm.validate({
        nProc: 1, nRes: 1, total: [5],
        allocation: [[2]], max: [[7]]
    });
    assert(!v2.valid, 'Detecta Máximo > Total');
    assert(v2.issues.some(i => i.type === 'max_exceeds_total'), 'Tipo correcto: max_exceeds_total');

    // Sum > Total
    const v3 = BankerAlgorithm.validate({
        nProc: 2, nRes: 1, total: [5],
        allocation: [[3],[4]], max: [[5],[5]]
    });
    assert(!v3.valid, 'Detecta suma Asignado > Total');
    assert(v3.issues.some(i => i.type === 'sum_exceeds_total'), 'Tipo correcto: sum_exceeds_total');
}

// ===== Test 5: Request - Approved =====
console.log('\n📋 Test 5: Solicitud aprobada');
{
    const state = {
        nProc: 5, nRes: 3,
        total: [10, 5, 7],
        allocation: [[0,1,0],[2,0,0],[3,0,2],[2,1,1],[0,0,2]],
        max: [[7,5,3],[3,2,2],[9,0,2],[2,2,2],[4,3,3]]
    };

    const result = BankerAlgorithm.processRequest(state, 1, [1, 0, 2]);
    assert(result.status === 'APPROVED', 'Solicitud P1 [1,0,2] aprobada');
    assert(result.updatedState !== null, 'Estado actualizado disponible');

    const u = result.updatedState;
    assert(arrEq(u.allocation[1], [3, 0, 2]), 'Asignado P1 actualizado a [3,0,2]');
    const newAvail = BankerAlgorithm.computeAvailable(u.total, u.allocation, u.nProc, u.nRes);
    assert(arrEq(newAvail, [2, 3, 0]), 'Disponible actualizado a [2,3,0]');

    // Original not mutated
    assert(arrEq(state.allocation[1], [2, 0, 0]), 'Estado original no mutado');
}

// ===== Test 6: Request - Rejected (exceeds need) =====
console.log('\n📋 Test 6: Solicitud rechazada (excede necesidad)');
{
    const state = {
        nProc: 5, nRes: 3,
        total: [10, 5, 7],
        allocation: [[0,1,0],[2,0,0],[3,0,2],[2,1,1],[0,0,2]],
        max: [[7,5,3],[3,2,2],[9,0,2],[2,2,2],[4,3,3]]
    };

    const result = BankerAlgorithm.processRequest(state, 4, [5, 0, 0]);
    assert(result.status === 'REJECTED_EXCEEDS_NEED', 'Solicitud rechazada por exceder necesidad');
    assert(result.updatedState === null, 'Sin estado actualizado');
}

// ===== Test 7: Request - Deferred (exceeds available) =====
console.log('\n📋 Test 7: Solicitud aplazada (recursos insuficientes)');
{
    const state = {
        nProc: 5, nRes: 3,
        total: [10, 5, 7],
        allocation: [[0,1,0],[2,0,0],[3,0,2],[2,1,1],[0,0,2]],
        max: [[7,5,3],[3,2,2],[9,0,2],[2,2,2],[4,3,3]]
    };

    const result = BankerAlgorithm.processRequest(state, 0, [0, 4, 0]);
    assert(result.status === 'DEFERRED_NO_RESOURCES', 'Solicitud aplazada por falta de disponibles');
    assert(result.updatedState === null, 'Sin estado actualizado');
}

// ===== Test 8: Request - Deferred (unsafe) =====
console.log('\n📋 Test 8: Solicitud aplazada (estado inseguro)');
{
    const state = {
        nProc: 5, nRes: 3,
        total: [10, 5, 7],
        allocation: [[0,1,0],[2,0,0],[3,0,2],[2,1,1],[0,0,2]],
        max: [[7,5,3],[3,2,2],[9,0,2],[2,2,2],[4,3,3]]
    };

    // P0 request [3,3,0] — available [3,3,2], need [7,4,3]
    // Would give P0: alloc [3,4,0], avail [0,0,2] — unsafe
    const result = BankerAlgorithm.processRequest(state, 0, [3, 3, 0]);
    assert(result.status === 'DEFERRED_UNSAFE', 'Solicitud denegada por estado inseguro');
    assert(result.updatedState === null, 'Sin estado actualizado (estado restaurado)');

    // Original intact
    assert(arrEq(state.allocation[0], [0, 1, 0]), 'Estado original intacto tras denegación');
    const avail = BankerAlgorithm.computeAvailable(state.total, state.allocation, 5, 3);
    assert(arrEq(avail, [3, 3, 2]), 'Disponible original intacto');
}

// ===== Test 9: Multiple valid sequences =====
console.log('\n📋 Test 9: Secuencias alternativas válidas');
{
    // Simple state where P0 and P1 can both go first
    const state = {
        nProc: 2, nRes: 1,
        total: [6],
        allocation: [[2], [2]],
        max: [[4], [4]]
    };

    const safety = BankerAlgorithm.checkSafety(state);
    assert(safety.isSafe, 'Estado seguro con múltiples secuencias posibles');
    assert(safety.sequence.length === 2, 'Secuencia completa');
    // Both [0,1] and [1,0] are valid — the algorithm finds one
    const valid = (arrEq(safety.sequence, [0, 1]) || arrEq(safety.sequence, [1, 0]));
    assert(valid, `Secuencia válida (encontrada: P${safety.sequence[0]}→P${safety.sequence[1]})`);
}

// ===== Test 10: Undo/Reset simulation logic =====
console.log('\n📋 Test 10: Lógica de deshacer/reiniciar');
{
    const state = {
        nProc: 3, nRes: 2,
        total: [5, 3],
        allocation: [[1,0],[1,1],[1,0]],
        max: [[3,2],[2,1],[3,2]]
    };

    const available = BankerAlgorithm.computeAvailable(state.total, state.allocation, 3, 2);
    let work = [...available]; // [2,2]
    let finish = [false, false, false];
    let seq = [];
    let history = [];

    // Execute P1
    history.push({ work: [...work], finish: [...finish], seq: [...seq] });
    for (let j = 0; j < 2; j++) work[j] += state.allocation[1][j];
    finish[1] = true;
    seq.push(1);
    assert(arrEq(work, [3, 3]), 'Tras P1: Trabajo = [3,3]');

    // Execute P0
    history.push({ work: [...work], finish: [...finish], seq: [...seq] });
    for (let j = 0; j < 2; j++) work[j] += state.allocation[0][j];
    finish[0] = true;
    seq.push(0);
    assert(arrEq(work, [4, 3]), 'Tras P0: Trabajo = [4,3]');

    // Undo P0
    const prev = history.pop();
    work = prev.work;
    finish = prev.finish;
    seq = prev.seq;
    assert(arrEq(work, [3, 3]), 'Deshacer P0: Trabajo = [3,3]');
    assert(finish[0] === false && finish[1] === true, 'P0 vuelve a pendiente, P1 sigue terminado');
    assert(arrEq(seq, [1]), 'Secuencia tras deshacer: [P1]');

    // Reset
    work = [...available];
    finish = [false, false, false];
    seq = [];
    history = [];
    assert(arrEq(work, [2, 2]), 'Reiniciar: Trabajo = [2,2]');
    assert(finish.every(f => !f), 'Todos pendientes');
    assert(seq.length === 0, 'Secuencia vacía');
}

// ===== Summary =====
console.log('\n' + '='.repeat(50));
console.log(`Resultados: ${passed} pasaron, ${failed} fallaron de ${passed + failed}`);
if (failed > 0) {
    console.log('❌ HAY FALLOS');
    process.exit(1);
} else {
    console.log('✅ TODAS LAS PRUEBAS PASARON');
    process.exit(0);
}
