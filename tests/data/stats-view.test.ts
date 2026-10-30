import assert from 'node:assert/strict';
import {test} from 'node:test';
import {StatsView} from '../../src/data/stats-view.ts';

test('StatsView preserva os valores recebidos entre camadas', () => {
    const data = new StatsView('10%', '50%', 'CPU', 'RAM', 'Swap');

    assert.deepEqual({...data}, {cpuText: '10%', ramText: '50%', cpuDetails: 'CPU', ramDetails: 'RAM', swapDetails: 'Swap'});
});
