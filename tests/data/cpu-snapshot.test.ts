import assert from 'node:assert/strict';
import {test} from 'node:test';
import {CpuSnapshot} from '../../src/data/cpu-snapshot.ts';

test('CpuSnapshot preserva os valores recebidos entre camadas', () => {
    const data = new CpuSnapshot([1, 2, 3, 4, 5, 6, 7, 8], 4);

    assert.deepEqual({...data}, {times: [1, 2, 3, 4, 5, 6, 7, 8], logicalCpuCount: 4});
});
