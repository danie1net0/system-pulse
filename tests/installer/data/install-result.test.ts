import assert from 'node:assert/strict';
import {test} from 'node:test';
import {InstallResult} from '../../../scripts/installer/data/install-result.ts';

test('InstallResult preserva os valores recebidos entre camadas', () => {
    const data = new InstallResult('/extensao', '/atalho', '/icone', '/backup');

    assert.deepEqual({...data}, {extension: '/extensao', launcher: '/atalho', icon: '/icone', backup: '/backup'});
});
