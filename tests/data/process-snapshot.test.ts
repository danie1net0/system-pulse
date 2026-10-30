import assert from 'node:assert/strict';
import {test} from 'node:test';
import {CpuSnapshot} from '../../src/data/cpu-snapshot.ts';
import {ProcessSnapshot} from '../../src/data/process-snapshot.ts';
import {ProcessTimes} from '../../src/data/process-times.ts';

test('ProcessSnapshot mantém CPU e tempos associados ao PID correto', () => {
    const cpu = new CpuSnapshot([10, 0, 0, 90, 0, 0, 0, 0], 2);
    const processes = new Map([[42, new ProcessTimes(10, 100)]]);
    const snapshot = new ProcessSnapshot(cpu, processes);

    assert.equal(snapshot.cpu, cpu);
    assert.equal(snapshot.processes.get(42)?.ticks, 10);
    assert.equal(snapshot.processes.get(42)?.startTime, 100);
    assert.equal(snapshot.processes.size, 1);
});
