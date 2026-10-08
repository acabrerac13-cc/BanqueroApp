/**
 * Algoritmo del Banquero - Motor de cálculo puro (JavaScript)
 * Implementación fiel del algoritmo de Dijkstra (1965).
 * Sin dependencias, ejecuta en el navegador.
 */

const BankerAlgorithm = (() => {
    /**
     * Calcula el vector Necesidad: Necesidad[i][j] = Máximo[i][j] - Asignado[i][j]
     */
    function computeNeed(allocation, max, nProc, nRes) {
        const need = [];
        for (let i = 0; i < nProc; i++) {
            need[i] = [];
            for (let j = 0; j < nRes; j++) {
                need[i][j] = Math.max(0, (max[i]?.[j] || 0) - (allocation[i]?.[j] || 0));
            }
        }
        return need;
    }

    /**
     * Calcula la suma de asignados por recurso
     */
    function computeAllocSum(allocation, nProc, nRes) {
        const sum = new Array(nRes).fill(0);
        for (let i = 0; i < nProc; i++) {
            for (let j = 0; j < nRes; j++) {
                sum[j] += (allocation[i]?.[j] || 0);
            }
        }
        return sum;
    }

    /**
     * Calcula Disponible: Disponible[j] = Total[j] - suma(Asignado[*][j])
     */
    function computeAvailable(total, allocation, nProc, nRes) {
        const allocSum = computeAllocSum(allocation, nProc, nRes);
        return total.map((t, j) => t - allocSum[j]);
    }

    /**
     * Valida la coherencia de los datos
     */
    function validate(state) {
        const issues = [];
        const { nProc, nRes, total, allocation, max } = state;

        if (nProc < 1 || nProc > 10 || nRes < 1 || nRes > 5) {
            issues.push({ type: 'dimensions', msg: `Dimensiones fuera de rango: ${nProc} procesos, ${nRes} recursos.` });
        }

        for (let j = 0; j < nRes; j++) {
            if ((total[j] || 0) < 0) {
                issues.push({ type: 'negative', msg: `Recurso total ${resName(j)} no puede ser negativo.` });
            }
        }

        for (let i = 0; i < nProc; i++) {
            for (let j = 0; j < nRes; j++) {
                const a = allocation[i]?.[j] || 0;
                const m = max[i]?.[j] || 0;
                const t = total[j] || 0;

                if (a < 0) issues.push({ type: 'negative', msg: `Asignado de P${i} recurso ${resName(j)} no puede ser negativo.` });
                if (m < 0) issues.push({ type: 'negative', msg: `Máximo de P${i} recurso ${resName(j)} no puede ser negativo.` });

                if (a > m) {
                    issues.push({
                        type: 'alloc_exceeds_max',
                        msg: `P${i}: Asignado(${resName(j)})=${a} supera Máximo(${resName(j)})=${m}.`,
                        proc: i, res: j
                    });
                }

                if (m > t) {
                    issues.push({
                        type: 'max_exceeds_total',
                        msg: `P${i}: Máximo(${resName(j)})=${m} excede el total del sistema(${resName(j)})=${t}. ` +
                             `El proceso ha declarado que podría necesitar más de lo que existe.`,
                        proc: i, res: j
                    });
                }
            }
        }

        const allocSum = computeAllocSum(allocation, nProc, nRes);
        for (let j = 0; j < nRes; j++) {
            if (allocSum[j] > (total[j] || 0)) {
                issues.push({
                    type: 'sum_exceeds_total',
                    msg: `Recurso ${resName(j)}: la suma de asignados (${allocSum[j]}) supera el total (${total[j] || 0}).`,
                    res: j
                });
            }
        }

        return { valid: issues.length === 0, issues };
    }

    /**
     * Algoritmo de Seguridad completo con pasos detallados
     */
    function checkSafety(state) {
        const { nProc, nRes, total, allocation, max } = state;
        const need = computeNeed(allocation, max, nProc, nRes);
        const available = computeAvailable(total, allocation, nProc, nRes);

        const work = [...available];
        const finish = new Array(nProc).fill(false);
        const sequence = [];
        const steps = [];

        let progress = true;
        while (progress && sequence.length < nProc) {
            progress = false;
            for (let i = 0; i < nProc; i++) {
                if (finish[i]) continue;

                const comparisons = [];
                let canFinish = true;
                for (let j = 0; j < nRes; j++) {
                    const needVal = need[i][j];
                    const workVal = work[j];
                    const ok = needVal <= workVal;
                    if (!ok) canFinish = false;
                    comparisons.push({ res: j, resName: resName(j), need: needVal, work: workVal, ok });
                }

                const workBefore = [...work];

                if (canFinish) {
                    for (let j = 0; j < nRes; j++) {
                        work[j] += allocation[i][j];
                    }
                    finish[i] = true;
                    sequence.push(i);
                    progress = true;

                    steps.push({
                        proc: i, canFinish: true,
                        comparisons,
                        workBefore, workAfter: [...work],
                        allocation: [...allocation[i]],
                        need: [...need[i]],
                        sequence: [...sequence],
                        finish: [...finish]
                    });
                } else {
                    steps.push({
                        proc: i, canFinish: false,
                        comparisons,
                        workBefore, workAfter: [...workBefore],
                        allocation: [...allocation[i]],
                        need: [...need[i]],
                        sequence: [...sequence],
                        finish: [...finish]
                    });
                }
            }
        }

        const isSafe = finish.every(f => f);
        const pending = [];
        const missing = {};

        for (let i = 0; i < nProc; i++) {
            if (!finish[i]) {
                pending.push(i);
                missing[i] = [];
                for (let j = 0; j < nRes; j++) {
                    if (need[i][j] > work[j]) {
                        missing[i].push({
                            res: j, resName: resName(j),
                            need: need[i][j], work: work[j],
                            deficit: need[i][j] - work[j]
                        });
                    }
                }
            }
        }

        return {
            isSafe, sequence, steps, pending, missing,
            initialWork: [...available], finalWork: [...work],
            need, available
        };
    }

    /**
     * Procesa una solicitud de recursos
     */
    function processRequest(state, procIdx, request) {
        const { nRes, total, allocation, max } = state;
        const need = computeNeed(allocation, max, state.nProc, nRes);
        const available = computeAvailable(total, allocation, state.nProc, nRes);

        // Paso 1: Solicitud <= Necesidad
        for (let j = 0; j < nRes; j++) {
            const rq = request[j] || 0;
            const nd = need[procIdx][j];
            if (rq > nd) {
                return {
                    status: 'REJECTED_EXCEEDS_NEED',
                    title: 'Solicitud inválida',
                    icon: '🚫',
                    message: `P${procIdx} solicita ${rq} unidades de ${resName(j)}, pero su necesidad restante es solo ${nd}. Ningún proceso puede pedir más de lo que declaró como máximo.`,
                    detail: `Solicitud(${resName(j)})=${rq} > Necesidad(${resName(j)})=${nd}`,
                    updatedState: null
                };
            }
        }

        // Paso 2: Solicitud <= Disponible
        for (let j = 0; j < nRes; j++) {
            const rq = request[j] || 0;
            const av = available[j];
            if (rq > av) {
                return {
                    status: 'DEFERRED_NO_RESOURCES',
                    title: 'Recursos insuficientes — debe esperar',
                    icon: '⏳',
                    message: `P${procIdx} debe esperar: se solicitan ${rq} unidades de ${resName(j)}, pero solo hay ${av} disponibles.`,
                    detail: `Solicitud(${resName(j)})=${rq} > Disponible(${resName(j)})=${av}`,
                    updatedState: null
                };
            }
        }

        // Paso 3: Asignación provisional
        const newAlloc = allocation.map((row, p) => {
            if (p === procIdx) return row.map((v, j) => v + (request[j] || 0));
            return [...row];
        });

        const newState = {
            nProc: state.nProc, nRes, total: [...total],
            allocation: newAlloc, max: max.map(r => [...r])
        };

        // Paso 4: Comprobar seguridad
        const safety = checkSafety(newState);

        if (safety.isSafe) {
            return {
                status: 'APPROVED',
                title: 'Solicitud aprobada',
                icon: '✅',
                message: `Se asignan los recursos a P${procIdx}. El estado resultante es seguro.`,
                detail: `Secuencia segura: ${safety.sequence.map(i => 'P' + i).join(' → ')}`,
                safetyResult: safety,
                updatedState: newState
            };
        } else {
            return {
                status: 'DEFERRED_UNSAFE',
                title: 'Solicitud denegada — estado inseguro',
                icon: '⚠️',
                message: `Los recursos están disponibles, pero asignarlos dejaría al sistema en un estado inseguro. P${procIdx} debe esperar. El estado original se conserva intacto.`,
                detail: `Procesos que quedarían pendientes: ${safety.pending.map(i => 'P' + i).join(', ')}`,
                safetyResult: safety,
                updatedState: null
            };
        }
    }

    function resName(j) {
        return String.fromCharCode(65 + j); // A, B, C...
    }

    // Public API
    return {
        computeNeed,
        computeAllocSum,
        computeAvailable,
        validate,
        checkSafety,
        processRequest,
        resName
    };
})();

// Export for test environment (Node.js)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BankerAlgorithm;
}
