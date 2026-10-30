import assert from 'node:assert/strict';
import {test} from 'node:test';
import {join} from 'node:path';
import {existsSync} from 'node:fs';
import {setup} from '../../scripts/installer/setup.ts';
import {mockCommands} from '../support/commands.ts';
import {fixture} from '../support/installation.ts';

test('ajuda não executa comandos nem modifica arquivos', context => {
    const environment = mockCommands(context);
    const output = context.mock.method(console, 'log', () => undefined);

    setup(['--help'], '/origem-inexistente');

    assert.equal(environment.calls.length, 0);
    assert.match(String(output.mock.calls[0]?.arguments[0]), /Uso: node install.ts/);
});

test('destino alternativo instala cópia e prepara build sem ativar extensão', context => {
    const installation = fixture();

    context.after(installation.cleanup);

    const environment = mockCommands(context);

    context.mock.method(console, 'log', () => undefined);
    setup(['--dest-dir', installation.dataHome], installation.source);

    assert.ok(existsSync(join(installation.dataHome, 'gnome-shell/extensions/ram-widget@local/extension.js')));
    assert.deepEqual(environment.calls.filter(call => call.command === 'npm').map(call => call.arguments),
        [['ci', '--ignore-scripts', '--no-audit', '--no-fund'], ['run', 'build']]);
    assert.equal(environment.calls.some(call => call.command === 'gnome-extensions'), false);
});

test('instalação normal habilita extensão, guarda backup e instala monitor solicitado', context => {
    const installation = fixture();

    context.after(installation.cleanup);

    const environment = mockCommands(context);

    environment.environmentVariables.mock.mockImplementation({...process.env, XDG_DATA_HOME: installation.dataHome});
    environment.commands.delete('gnome-system-monitor');

    const output = context.mock.method(console, 'log', () => undefined);

    setup(['--skip-build', '--with-system-monitor'], installation.source);

    assert.ok(environment.calls.some(call => call.command === 'sudo' && call.arguments.includes('gnome-system-monitor')));
    assert.ok(environment.calls.some(call => call.command === 'gnome-extensions' && call.arguments.includes('enable')));

    setup(['--skip-build', '--with-system-monitor'], installation.source);

    assert.ok(output.mock.calls.some(call => String(call.arguments[0]).startsWith('Backup da instalação anterior:')));
    assert.ok(output.mock.calls.some(call => String(call.arguments[0]).startsWith('Monitor do Sistema opcional ausente.')));
});

test('ativação indisponível informa como continuar e monitor já instalado não usa sudo', context => {
    const installation = fixture();

    context.after(installation.cleanup);

    const environment = mockCommands(context);

    environment.environmentVariables.mock.mockImplementation({...process.env, XDG_DATA_HOME: installation.dataHome});
    environment.commands.delete('update-desktop-database');
    environment.responses.set('gnome-extensions', {status: 1, stdout: ''});

    const output = context.mock.method(console, 'log', () => undefined);

    setup(['--skip-build', '--with-system-monitor'], installation.source);

    assert.equal(environment.calls.some(call => call.command === 'sudo'), false);
    assert.ok(output.mock.calls.some(call => String(call.arguments[0]).startsWith('O GNOME ainda não reconheceu')));
});

test('monitor solicitado sem gerenciador ou sudo falha antes da cópia', context => {
    const environment = mockCommands(context);

    environment.commands.delete('gnome-system-monitor');
    environment.commands.delete('apt-get');

    assert.throws(() => setup(['--skip-build', '--with-system-monitor'], '/origem'), /gerenciador/);

    environment.commands.add('apt-get');
    environment.commands.delete('sudo');

    assert.throws(() => setup(['--skip-build', '--with-system-monitor'], '/origem'), /gerenciador/);
});
