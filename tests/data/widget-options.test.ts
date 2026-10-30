import assert from 'node:assert/strict';
import {test} from 'node:test';
import {WidgetOptions} from '../../src/data/widget-options.ts';

test('WidgetOptions preserva os valores recebidos entre camadas', () => {
    const data = new WidgetOptions(3, 7, 'cpu', 'both');

    assert.deepEqual({...data}, {intervalSeconds: 3, processCount: 7, processMetric: 'cpu', panelMode: 'both'});
});
