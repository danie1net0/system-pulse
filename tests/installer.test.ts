import {fixture} from './support/installation.ts';
import fileSystem from 'node:fs';
import {syncBuiltinESMExports} from 'node:module';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {chmodSync, existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync,
    readdirSync, rmSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {installFiles, UUID} from '../scripts/installer/files.ts';
import {dataDirectory, parseOptions} from '../scripts/installer/options.ts';


test('instala apenas runtime, schema, ícone e atalho em caminhos com espaços', context => {
    const installationFixture = fixture(); context.after(installationFixture.cleanup);
    const result = installFiles({...installationFixture, development: false});

    assert.equal(result.backup, null);
    assert.equal(lstatSync(result.extension).isDirectory(), true);
    assert.equal(existsSync(join(result.extension, 'node_modules')), false);
    assert.equal(existsSync(join(result.extension, 'src')), false);
    assert.equal(existsSync(join(result.extension, 'schemas/gschemas.compiled')), true);
    assert.equal(readFileSync(result.icon, 'utf8'), 'fixture: assets/system-pulse.png');
    assert.match(readFileSync(result.launcher, 'utf8'), /Icon=\/.*dados com espaços\/icons\//);
});

test('reinstala com backup e retira arquivos antigos do runtime', context => {
    const installationFixture = fixture(); context.after(installationFixture.cleanup);
    const first = installFiles({...installationFixture, development: false});

    writeFileSync(join(first.extension, 'obsoleto.js'), 'antigo');
    writeFileSync(join(installationFixture.source, 'build/extension.js'), 'novo');

    const second = installFiles({...installationFixture, development: false});

    assert.ok(second.backup);
    assert.equal(readFileSync(join(second.extension, 'build/extension.js'), 'utf8'), 'novo');
    assert.equal(existsSync(join(second.extension, 'obsoleto.js')), false);
    assert.equal(readFileSync(join(second.backup, 'old-0/obsoleto.js'), 'utf8'), 'antigo');
    assert.ok(existsSync(join(second.backup, 'restore.json')));
});

test('substitui link de desenvolvimento sem modificar o checkout', context => {
    const installationFixture = fixture(); context.after(installationFixture.cleanup);
    const first = installFiles({...installationFixture, development: true});

    assert.equal(readlinkSync(first.extension), installationFixture.source);

    const second = installFiles({...installationFixture, development: false});

    assert.equal(lstatSync(second.extension).isSymbolicLink(), false);
    assert.equal(readFileSync(join(installationFixture.source, 'build/extension.js'), 'utf8'), 'fixture: build/extension.js');
    assert.ok(second.backup);
    assert.equal(readlinkSync(join(second.backup, 'old-0')), installationFixture.source);
});

test('restaura a instalação anterior se a gravação do ícone falhar', context => {
    if (process.getuid?.() === 0) {
        context.skip('O instalador roda sem root; este teste depende das permissões do usuário.');

        return;
    }

    const installationFixture = fixture(); context.after(installationFixture.cleanup);
    const first = installFiles({...installationFixture, development: true});

    // O preflight passa; a extensão é substituída antes de falhar ao mover o ícone.
    chmodSync(dirname(first.icon), 0o555);

    try {
        assert.throws(() => installFiles({...installationFixture, development: false}), /EACCES/);
    } finally {
        chmodSync(dirname(first.icon), 0o755);
    }

    assert.equal(readlinkSync(first.extension), installationFixture.source);
    assert.equal(readFileSync(first.icon, 'utf8'), 'fixture: assets/system-pulse.png');
    assert.equal(readdirSync(installationFixture.dataHome).some(name => name.startsWith('.system-pulse-install-')), false);
});

test('build ausente falha antes de substituir uma instalação', context => {
    const installationFixture = fixture(); context.after(installationFixture.cleanup);
    const installed = installFiles({...installationFixture, development: false});

    rmSync(join(installationFixture.source, 'build/extension.js'));

    assert.throws(() => installFiles({...installationFixture, development: false}), /Arquivo ausente/);
    assert.equal(readFileSync(join(installed.extension, 'build/extension.js'), 'utf8'), 'fixture: build/extension.js');
});

test('recusa destino sobreposto ao projeto e extensão com outro UUID', context => {
    const installationFixture = fixture(); context.after(installationFixture.cleanup);

    assert.throws(() => installFiles({...installationFixture, dataHome: join(installationFixture.source, 'destino'), development: false}), /sobrepor/);

    const extension = join(installationFixture.dataHome, 'gnome-shell/extensions', UUID);

    mkdirSync(extension, {recursive: true});
    writeFileSync(join(extension, 'metadata.json'), '{"uuid":"outro"}');

    assert.throws(() => installFiles({...installationFixture, development: false}), /não pertence/);
});

test('opções inválidas falham e destino alternativo impede instalar pacotes do sistema', () => {
    assert.throws(() => parseOptions(['--desconhecido']), /desconhecida/);
    assert.throws(() => parseOptions(['--dest-dir']), /caminho/);
    assert.throws(() => parseOptions(['--dest-dir', '/tmp/stage', '--with-system-monitor']), /combinado/);
    assert.equal(parseOptions(['--dev', '--skip-build']).development, true);
    assert.equal(dataDirectory('/home/teste', 'relativo'), '/home/teste/.local/share');
    assert.equal(dataDirectory('/home/teste', '/tmp/dados'), '/tmp/dados');
});

test('recusa diretórios no lugar do ícone ou atalho sem tocar na instalação', context => {
    const installationFixture = fixture();

    context.after(installationFixture.cleanup);

    const icon = join(installationFixture.dataHome, 'icons/hicolor/512x512/apps/system-pulse.png');

    mkdirSync(icon, {recursive: true});

    assert.throws(() => installFiles({...installationFixture, development: false}), /deveria ser um arquivo/);
});

test('recusa metadados inválidos e origem dentro do destino da extensão', context => {
    const installationFixture = fixture();

    context.after(installationFixture.cleanup);

    const extension = join(installationFixture.dataHome, 'gnome-shell/extensions', UUID);

    mkdirSync(extension, {recursive: true});

    for (const metadata of ['null', '"texto"', '{}']) {
        writeFileSync(join(extension, 'metadata.json'), metadata);

        assert.throws(() => installFiles({...installationFixture, development: false}), /não pertence/);
    }

    const nestedSource = join(extension, 'projeto');

    mkdirSync(nestedSource);

    assert.throws(() => installFiles({...installationFixture, source: nestedSource, development: false}), /sobrepor/);
});

test('aceita ajuda e monitor opcional, rejeita caminho que é outra opção', () => {
    assert.equal(parseOptions(['--help']).help, true);
    assert.equal(parseOptions(['-h']).help, true);
    assert.equal(parseOptions(['--with-system-monitor']).withSystemMonitor, true);
    assert.equal(parseOptions(['--dest-dir', '/tmp/destino']).destination, '/tmp/destino');
    assert.throws(() => parseOptions(['--dest-dir', '--dev']), /caminho/);
    assert.equal(dataDirectory('/home/teste', undefined), '/home/teste/.local/share');
    assert.equal(dataDirectory('/home/teste', ''), '/home/teste/.local/share');
});

test('preserva o backup e informa os erros quando o rollback também falha', context => {
    const installationFixture = fixture();

    context.after(installationFixture.cleanup);

    const installed = installFiles({...installationFixture, development: false});
    const rename = fileSystem.renameSync;

    context.mock.method(fileSystem, 'renameSync', (source: string, destination: string): void => {
        if (destination === installed.icon || (String(source).endsWith('old-0') && destination === installed.extension)) {
            throw new Error('falha de disco simulada');
        }

        rename(source, destination);
    });

    syncBuiltinESMExports();
    context.after(() => {context.mock.restoreAll(); syncBuiltinESMExports();});

    assert.throws(() => installFiles({...installationFixture, development: false}), error => {
        assert.ok(error instanceof AggregateError);
        assert.match(error.message, /Arquivos preservados/);
        assert.equal(error.errors.length, 3);

        return true;
    });

    const preserved = readdirSync(installationFixture.dataHome).find(name => name.startsWith('.system-pulse-install-'));

    assert.ok(preserved);
    assert.equal(readFileSync(join(installationFixture.dataHome, preserved, 'old-0/build/extension.js'), 'utf8'),
        'fixture: build/extension.js');
});
