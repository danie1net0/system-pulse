import assert from 'node:assert/strict';
import {test} from 'node:test';

test('entrada do instalador reporta argumentos inválidos com status de falha', async context => {
    context.mock.property(process, 'argv', ['node', 'install.ts', '--invalid']);

    const previousExitCode = process.exitCode;

    context.after(() => {process.exitCode = previousExitCode;});

    const errors = context.mock.method(console, 'error', () => undefined);

    await import('../../install.ts');

    assert.equal(process.exitCode, 1);
    assert.match(String(errors.mock.calls[0]?.arguments[0]), /Opção desconhecida/);
});
