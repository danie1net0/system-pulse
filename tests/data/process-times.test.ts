import assert from 'node:assert/strict';
import {test} from 'node:test';
import {ProcessTimes} from '../../src/data/process-times.ts';

test('ProcessTimes preserva os valores recebidos entre camadas', () => {
    const data = new ProcessTimes(37, 100);

    assert.deepEqual({...data}, {ticks: 37, startTime: 100});
});
