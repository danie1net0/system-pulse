import assert from 'node:assert/strict';
import {beforeEach, test} from 'node:test';
import Gio from 'gi://Gio';
import Adw from 'gi://Adw';
import {WidgetOptions} from '../../src/data/widget-options.ts';
import {StatsView} from '../../src/data/stats-view.ts';
import {ProcessUsage} from '../../src/data/process-usage.ts';
import {readOptions} from '../../src/settings.ts';
import {WidgetIndicator} from '../../src/ui/indicator.ts';
import {ProcessRow} from '../../src/ui/process-row.ts';
import {fillPreferences} from '../../src/ui/preferences.ts';
import {PopupMenu, PopupMenuItem, reset, state, Widget} from '../support/gnome.ts';

beforeEach(reset);

test('preferências inválidas usam padrões e valores válidos são preservados', () => {
    const settings = new Gio.Settings();

    assert.deepEqual({...readOptions(settings)},
        {intervalSeconds: 2, processCount: 5, processMetric: 'ram', panelMode: 'both'});
    settings.set_string('process-metric', 'cpu');
    settings.set_string('panel-mode', 'cpu');

    assert.equal(readOptions(settings).processMetric, 'cpu');
    assert.equal(readOptions(settings).panelMode, 'cpu');

    settings.set_string('panel-mode', 'ram');

    assert.equal(readOptions(settings).panelMode, 'ram');

    settings.set_string('panel-mode', 'inválido');
    settings.set_string('process-metric', 'inválido');

    assert.equal(readOptions(settings).panelMode, 'both');
    assert.equal(readOptions(settings).processMetric, 'ram');
});

test('linha apresenta cabeçalho, RAM, CPU, espera e ausência de processo', () => {
    const header = new ProcessRow(true);

    header.setHeader('ram');

    assert.equal(header.item.label.text, 'Processo');
    assert.equal(header.value.text, 'RAM');

    header.setHeader('cpu');

    assert.equal(header.value.text, 'CPU');

    const row = new ProcessRow();

    row.update(new ProcessUsage(42, 'aplicativo', 2048, null), 'ram');

    assert.equal(row.value.text, '2.0 MiB');
    assert.equal(row.pid.text, '42');

    row.update(new ProcessUsage(42, 'aplicativo', 2048, null), 'cpu');

    assert.equal(row.value.text, '…');

    row.update(new ProcessUsage(42, 'aplicativo', 2048, 12.34), 'cpu');

    assert.equal(row.value.text, '12.3%');

    row.update(undefined, 'ram');

    assert.equal(row.value.text, '—');
    assert.equal(row.pid.text, '—');
    assert.equal(row.item.label.text, '—');
});

test('indicador atualiza estatísticas, ranking, ações e descarte', () => {
    const events: string[] = [];
    const indicator = new WidgetIndicator('System Pulse', {
        selectMetric: metric => events.push(metric), openPreferences: () => events.push('preferences'),
        openMonitor: () => events.push('monitor'), remove: () => events.push('remove'),
        menuChanged: open => events.push(String(open)),
    });

    const options = new WidgetOptions(2, 2, 'ram', 'both');

    indicator.configure(options);
    indicator.configure(options);
    indicator.renderStats(new StatsView('10%', '50%', 'cpu', 'ram', 'swap'), options);

    assert.equal(indicator.label.text, 'CPU 10% · RAM 50%');
    assert.equal(indicator.button.accessible_name, 'cpu. ram');

    indicator.renderProcesses([new ProcessUsage(42, 'maior', 2048, 10)], options);

    assert.ok(state.widgets.some(widget => widget.text === 'maior'));

    indicator.configure(new WidgetOptions(2, 1, 'cpu', 'cpu'));
    indicator.showProcessError();

    assert.ok(state.widgets.some(widget => widget.text === 'Leitura indisponível'));

    const menu = state.widgets.find(widget => widget instanceof PopupMenu && widget.actions.size > 0);

    assert.ok(menu instanceof PopupMenu);

    menu.open();
    menu.actions.get('Abrir Monitor do Sistema')?.();
    menu.actions.get('Preferências…')?.();
    menu.actions.get('Remover da barra')?.();

    for (const item of state.widgets) {
        if (item instanceof PopupMenuItem && ['RAM (RSS)', 'CPU (atividade recente)'].includes(item.label.text)) {
            item.emit('activate');
        }
    }

    assert.deepEqual(events, ['true', 'monitor', 'preferences', 'false', 'remove', 'ram', 'cpu']);

    indicator.configure(new WidgetOptions(2, 0, 'ram', 'ram'));
    indicator.showProcessError();
    indicator.destroy();

    assert.ok(state.widgets.some(widget => widget.destroyed));
});

test('indicador rejeita botão sem menu compatível', () => {
    state.validMenu = false;

    assert.throws(() => new WidgetIndicator('System Pulse', {
        selectMetric: () => undefined, openPreferences: () => undefined, openMonitor: () => undefined,
        remove: () => undefined, menuChanged: () => undefined,
    }), /needs a menu/);
});

test('janela sincroniza escolhas, vincula números e desconecta sinais ao fechar', () => {
    const settings = new Gio.Settings();
    const window = new Adw.PreferencesWindow();

    fillPreferences(window, settings);

    const panelChoice = state.widgets.find(widget => widget.title === 'Exibir na barra');

    assert.ok(panelChoice);

    panelChoice.selected = 1;
    panelChoice.emit('notify::selected');

    assert.equal(settings.get_string('panel-mode'), 'cpu');

    panelChoice.emit('notify::selected');
    panelChoice.selected = 99;
    panelChoice.emit('notify::selected');

    assert.equal(settings.get_string('panel-mode'), 'cpu');

    settings.set_string('panel-mode', 'ram');

    assert.equal(panelChoice.selected, 2);

    settings.set_string('panel-mode', 'inválido');

    assert.equal(panelChoice.selected, 0);
    assert.ok(window instanceof Widget);

    window.emit('close-request');
    settings.set_string('panel-mode', 'cpu');

    assert.equal(panelChoice.selected, 0);
});
