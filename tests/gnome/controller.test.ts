import assert from 'node:assert/strict';
import {beforeEach, test} from 'node:test';
import Gio from 'gi://Gio';
import {WidgetController} from '../../src/controller.ts';
import {WidgetContext} from '../../src/data/widget-context.ts';
import {ProcessService} from '../../src/services/processes.ts';
import {flush, PopupMenu, PopupMenuItem, reset, state} from '../support/gnome.ts';

beforeEach(() => {
    reset();
    state.contents.set('/proc/stat', 'cpu 10 0 0 90 0 0 0 0\ncpu0 0');
    state.contents.set('/proc/meminfo', 'MemTotal: 100 kB\nMemAvailable: 50 kB\nSwapTotal: 0 kB\nSwapFree: 0 kB');
});

const mainMenu = (): PopupMenu => {
    const menu = state.widgets.find(widget => widget instanceof PopupMenu && widget.actions.size > 0);

    assert.ok(menu instanceof PopupMenu);

    return menu;
};

const tick = (): void => {
    const callback = state.timers.values().next().value;

    assert.ok(callback);
    assert.equal(callback(), true);
};

test('controlador conecta preferências e atualiza processos apenas com menu aberto', async () => {
    const settings = new Gio.Settings();
    let openedPreferences = 0;
    const controller = new WidgetController(new WidgetContext('widget', 'System Pulse', settings,
        () => {openedPreferences++;}));
    assert.equal(state.installedButtons[0]?.[0], 'widget');
    assert.equal(state.timers.size, 1);

    tick();

    assert.equal(state.subprocesses.length, 0);

    const menu = mainMenu();

    menu.open();
    await flush();

    assert.equal(state.subprocesses.length, 1);

    tick();
    await flush();

    assert.equal(state.subprocesses.length, 2);

    settings.set_string('panel-mode', 'cpu');
    settings.set_int('update-interval', 3);

    assert.equal(state.timers.size, 1);

    const choice = state.widgets.find(widget => widget instanceof PopupMenuItem && widget.label.text === 'CPU (atividade recente)');

    assert.ok(choice instanceof PopupMenuItem);

    choice.emit('activate');

    assert.equal(settings.get_string('process-metric'), 'cpu');

    menu.actions.get('Preferências…')?.();

    assert.equal(openedPreferences, 1);

    menu.actions.get('Remover da barra')?.();

    assert.deepEqual(state.disabledExtensions, ['widget']);

    controller.dispose();

    assert.equal(state.timers.size, 0);

    menu.open();

    assert.equal(state.subprocesses.length, 2);

    controller.dispose();
});

test('fechar o menu e descartar o controlador invalida consultas pendentes', async () => {
    state.paused = true;

    const controller = new WidgetController(new WidgetContext('widget', 'System Pulse', new Gio.Settings(), () => undefined));
    const menu = mainMenu();

    menu.open();
    tick();
    menu.close();
    await flush();

    assert.equal(state.subprocesses[0]?.forced, true);

    state.paused = true;
    menu.open();
    controller.dispose();
    await flush();

    assert.equal(state.timers.size, 0);
});

test('erros atuais são exibidos e erros obsoletos são descartados', async context => {
    const errors = context.mock.method(console, 'error', () => undefined);
    let rejectSample: (error: Error) => void = () => undefined;

    context.mock.method(ProcessService.prototype, 'sample', (): Promise<null> => new Promise((_resolve, reject) => {
        rejectSample = reject;
    }));

    const controller = new WidgetController(new WidgetContext('widget', 'System Pulse', new Gio.Settings(), () => undefined));
    const menu = mainMenu();

    menu.open();
    rejectSample(new Error('falha atual'));
    await flush();

    assert.equal(errors.mock.callCount(), 1);
    assert.ok(state.widgets.some(widget => widget.text === 'Leitura indisponível'));

    tick();
    menu.close();
    rejectSample(new Error('falha antiga'));
    await flush();

    assert.equal(errors.mock.callCount(), 1);

    menu.open();
    controller.dispose();
    rejectSample(new Error('falha após dispose'));
    await flush();

    assert.equal(errors.mock.callCount(), 1);
});
