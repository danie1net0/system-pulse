import assert from 'node:assert/strict';
import {test} from 'node:test';

test('entrada do instalador mostra ajuda e reporta argumentos inválidos', async context => {
    context.mock.property(process, 'argv', ['node', 'install.ts', '--help']);

    const previousExitCode = process.exitCode;

    process.exitCode = undefined;
    context.after(() => {process.exitCode = previousExitCode;});

    const output = context.mock.method(console, 'log', () => undefined);

    await import(new URL('../../install.ts', import.meta.url).href);

    assert.match(String(output.mock.calls[0]?.arguments[0]), /Uso: node install.ts/);
    assert.equal(process.exitCode, undefined);
});
