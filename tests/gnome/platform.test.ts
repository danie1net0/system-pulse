import assert from 'node:assert/strict';
import {beforeEach, test} from 'node:test';
import Gio from 'gi://Gio';
import {readTextAsync} from '../../src/platform/files.ts';
import {openSystemMonitor} from '../../src/platform/system-monitor.ts';
import {reset, state} from '../support/gnome.ts';

beforeEach(reset);

test('leitura assíncrona decodifica UTF-8 e propaga falhas', async () => {
    state.contents.set('/arquivo', 'memória');

    assert.equal(await readTextAsync('/arquivo', new Gio.Cancellable()), 'memória');
    await assert.rejects(readTextAsync('/ausente', new Gio.Cancellable()), /Não foi possível ler/);

    state.contents.set('/negado', new Error('negado'));

    await assert.rejects(readTextAsync('/negado', new Gio.Cancellable()), /negado/);
});

test('monitor prefere o desktop moderno e aceita o identificador legado', () => {
    state.applications.set('org.gnome.SystemMonitor.desktop', true);
    openSystemMonitor();

    assert.deepEqual(state.launched, ['org.gnome.SystemMonitor.desktop']);

    state.applications.clear();
    state.applications.set('gnome-system-monitor.desktop', true);
    openSystemMonitor();

    assert.equal(state.launched[1], 'gnome-system-monitor.desktop');
    assert.deepEqual(state.notifications, []);
});

test('monitor ausente ou com falha informa o usuário sem derrubar a extensão', context => {
    context.mock.method(console, 'error', () => undefined);
    openSystemMonitor();

    assert.match(state.notifications[0]?.[1] ?? '', /sudo apt install/);

    state.applications.set('org.gnome.SystemMonitor.desktop', false);
    openSystemMonitor();

    assert.match(state.notifications[1]?.[1] ?? '', /Não foi possível abrir/);

    state.applications.set('org.gnome.SystemMonitor.desktop', new Error('falha de lançamento'));
    openSystemMonitor();

    assert.equal(state.notifications.length, 3);
});
