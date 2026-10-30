import assert from 'node:assert/strict';
import {test} from 'node:test';
import {InstallOptions} from '../../../scripts/installer/data/install-options.ts';

test('InstallOptions preserva os valores recebidos entre camadas', () => {
    const data = new InstallOptions(true, false, true, false, '/tmp/destino');

    assert.deepEqual({...data}, {help: true, development: false, skipBuild: true, withSystemMonitor: false, destination: '/tmp/destino'});
});
