import assert from 'node:assert/strict';
import {test} from 'node:test';
import {ProcessUsage} from '../../src/data/process-usage.ts';

test('ProcessUsage preserva os valores recebidos entre camadas', () => {
    const data = new ProcessUsage(42, 'processo', 2048, 25);

    assert.deepEqual({...data}, {pid: 42, name: 'processo', rssKiB: 2048, cpuPercent: 25});
});
