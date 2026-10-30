import assert from 'node:assert/strict';
import {test} from 'node:test';
import {InstallFilesOptions} from '../../../scripts/installer/data/install-files-options.ts';

test('InstallFilesOptions preserva os valores recebidos entre camadas', () => {
    const data = new InstallFilesOptions('/origem', '/dados', true);

    assert.deepEqual({...data}, {source: '/origem', dataHome: '/dados', development: true});
});
