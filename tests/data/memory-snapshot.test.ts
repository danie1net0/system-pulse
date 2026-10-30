import assert from 'node:assert/strict';
import {test} from 'node:test';
import {MemorySnapshot} from '../../src/data/memory-snapshot.ts';

test('MemorySnapshot preserva os valores recebidos entre camadas', () => {
    const data = new MemorySnapshot(1024, 512, 50, 256, 128);

    assert.deepEqual({...data}, {totalKiB: 1024, usedKiB: 512, percent: 50, swapTotalKiB: 256, swapUsedKiB: 128});
});
