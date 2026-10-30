import assert from 'node:assert/strict';
import {test} from 'node:test';
import {available, checkEnvironment, run, tryRun} from '../../scripts/installer/commands.ts';
import {mockCommands} from '../support/commands.ts';

test('localiza executáveis no PATH e tolera ausência de PATH e de comando', context => {
    const environment = mockCommands(context);

    assert.equal(available('ps'), true);

    environment.commands.delete('ps');

    assert.equal(available('ps'), false);

    environment.environmentVariables.mock.mockImplementation({});

    assert.equal(available('desconhecido'), false);
});

test('comandos propagam erro e código inválido, tentativa opcional retorna booleano', context => {
    const environment = mockCommands(context);

    run('npm', ['run', 'build'], '/projeto');

    assert.deepEqual(environment.calls[0], {command: 'npm', arguments: ['run', 'build']});
    assert.equal(tryRun('npm', [], '/projeto'), true);

    environment.responses.set('npm', {status: 2, stdout: ''});

    assert.throws(() => run('npm', [], '/projeto'), /código 2/);
    assert.equal(tryRun('npm', [], '/projeto'), false);

    environment.responses.set('npm', {status: null, stdout: '', error: new Error('ausente')});

    assert.throws(() => run('npm', [], '/projeto'), /indisponível/);
});

test('recusa outro sistema operacional', context => {
    mockCommands(context, {platform: 'win32'});

    assert.throws(() => checkEnvironment(true), /Linux/);
});

test('recusa Node anterior ao mínimo suportado', context => {
    mockCommands(context, {nodeVersion: '22.0.0'});

    assert.throws(() => checkEnvironment(true), /Node.js 24/);
});

test('recusa execução como root', context => {
    mockCommands(context, {userId: 0});

    assert.throws(() => checkEnvironment(true), /sem sudo/);
});

test('valida dependências mesmo quando a função getuid não existe', context => {
    const environment = mockCommands(context);

    environment.userId.mock.mockImplementation(undefined);

    assert.doesNotThrow(() => checkEnvironment(true));
});

test('verifica dependências e versão do GNOME, dispensando ferramentas no skip-build', context => {
    const environment = mockCommands(context);

    assert.doesNotThrow(() => checkEnvironment(false));

    environment.commands.delete('npm');

    assert.throws(() => checkEnvironment(false), /Dependências ausentes: npm/);
    assert.doesNotThrow(() => checkEnvironment(true));

    environment.responses.set('gnome-shell', {status: 0, stdout: 'GNOME Shell 49.0'});

    assert.throws(() => checkEnvironment(true), /incompatível: GNOME Shell 49/);

    environment.responses.set('gnome-shell', {status: 1, stdout: ''});

    assert.throws(() => checkEnvironment(true), /versão desconhecida/);
});
