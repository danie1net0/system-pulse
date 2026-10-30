import assert from 'node:assert/strict';
import {test} from 'node:test';
import {ProcessInfo} from '../../src/data/process-info.ts';

test('ProcessInfo preserva os valores recebidos entre camadas', () => {
    const data = new ProcessInfo(42, 'processo', 2048);

    assert.deepEqual({...data}, {pid: 42, name: 'processo', rssKiB: 2048});
});
