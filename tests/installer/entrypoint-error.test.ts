import assert from 'node:assert/strict';
import {test} from 'node:test';

test('entrada do instalador também relata falhas que não são Error', async context => {
    context.mock.property(process, 'argv', ['node', 'install.ts', '--help']);

    const previousExitCode = process.exitCode;

    process.exitCode = undefined;
    context.after(() => {process.exitCode = previousExitCode;});
    context.mock.method(console, 'log', () => {throw 'falha externa';});

    const errors = context.mock.method(console, 'error', () => undefined);

    await import(new URL('../../install.ts', import.meta.url).href);

    assert.equal(process.exitCode, 1);
    assert.equal(errors.mock.calls[0]?.arguments[0], 'Instalação não concluída: falha externa');
});
