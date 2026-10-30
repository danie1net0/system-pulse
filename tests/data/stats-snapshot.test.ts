import assert from 'node:assert/strict';
import {test} from 'node:test';
import {MemorySnapshot} from '../../src/data/memory-snapshot.ts';
import {StatsSnapshot} from '../../src/data/stats-snapshot.ts';

test('StatsSnapshot preserva amostragem e ausência explícita de dados', () => {
    const memory = new MemorySnapshot(100, 20, 20, 0, 0);
    const snapshot = new StatsSnapshot(30, 4, memory);

    assert.equal(snapshot.cpuPercent, 30);
    assert.equal(snapshot.logicalCpuCount, 4);
    assert.equal(snapshot.memory, memory);
    assert.deepEqual({...new StatsSnapshot(null, null, null)},
        {cpuPercent: null, logicalCpuCount: null, memory: null});
});
