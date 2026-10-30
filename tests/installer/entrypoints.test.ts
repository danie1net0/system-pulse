import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import fileSystem from 'node:fs';
import {syncBuiltinESMExports} from 'node:module';
import {test} from 'node:test';

test('build invoca compiladores e gera entradas que carregam os módulos compilados', async context => {
    const commands = context.mock.method(childProcess, 'execFileSync', () => Buffer.from(''));
    const writes = context.mock.method(fileSystem, 'writeFileSync', () => undefined);

    context.mock.method(console, 'log', () => undefined);
    syncBuiltinESMExports();
    context.after(() => {context.mock.restoreAll(); syncBuiltinESMExports();});
    await import(new URL('../../scripts/build.ts', import.meta.url).href);

    assert.equal(commands.mock.callCount(), 2);
    assert.match(String(commands.mock.calls[0]?.arguments[0]), /node_modules\/\.bin\/tsc$/);
    assert.equal(commands.mock.calls[1]?.arguments[0], 'glib-compile-schemas');
    assert.deepEqual(commands.mock.calls[1]?.arguments[1], ['--strict', 'schemas']);
    assert.equal(writes.mock.callCount(), 2);
    assert.match(String(writes.mock.calls[0]?.arguments[1]), /export \{default\} from '\.\/build\/extension.js'/);
    assert.match(String(writes.mock.calls[1]?.arguments[1]), /export \{default\} from '\.\/build\/prefs.js'/);
});
