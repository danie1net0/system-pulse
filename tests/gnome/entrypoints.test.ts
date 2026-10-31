import assert from 'node:assert/strict';
import {beforeEach, test} from 'node:test';
import Adw from 'gi://Adw';
import SystemPulseExtension from '../../src/extension.ts';
import SystemPulsePreferences from '../../src/prefs.ts';
import {PopupMenu, reset, state} from '../support/gnome.ts';

const metadata = {uuid: 'system-pulse@danie1net0.gitlab.io', name: 'System Pulse', description: 'Teste', 'shell-version': ['50']};

beforeEach(() => {
    reset();
    state.contents.set('/proc/stat', 'cpu 0 0 0 1 0 0 0 0\ncpu0 0');
    state.contents.set('/proc/meminfo', 'MemTotal: 100 kB\nMemAvailable: 50 kB\nSwapTotal: 0 kB\nSwapFree: 0 kB');
});

test('entrada da extensão cria, descarta e abre as preferências', () => {
    const extension = new SystemPulseExtension(metadata);

    extension.disable();
    extension.enable();

    assert.equal(state.installedButtons.length, 1);

    const menu = state.widgets.find(widget => widget instanceof PopupMenu && widget.actions.size > 0);

    assert.ok(menu instanceof PopupMenu);

    menu.actions.get('Preferências…')?.();

    assert.equal(state.preferencesOpened, 1);

    extension.disable();

    assert.equal(state.timers.size, 0);
});

test('entrada das preferências monta a página com as configurações da extensão', async () => {
    await new SystemPulsePreferences(metadata).fillPreferencesWindow(new Adw.PreferencesWindow());

    assert.ok(state.widgets.some(widget => widget.title === 'Exibir na barra'));
});
