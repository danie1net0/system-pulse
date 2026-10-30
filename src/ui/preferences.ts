import {gettext} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import {SETTINGS} from '../settings.ts';

const createSpinRow = (settings: Gio.Settings, key: string, title: string, lower: number, upper: number): Adw.SpinRow => {
    const row = new Adw.SpinRow({title, digits: 0,
        adjustment: new Gtk.Adjustment({lower, upper, step_increment: 1, page_increment: 5})});
    settings.bind(key, row, 'value', Gio.SettingsBindFlags.DEFAULT);

    return row;
};

const createChoiceRow = (settings: Gio.Settings, key: string, title: string, labels: string[], values: readonly string[],
    disconnectors: (() => void)[]): Adw.ComboRow => {
    const row = new Adw.ComboRow({title, model: Gtk.StringList.new(labels)});
    const synchronizeSelection = (): void => {
        row.selected = Math.max(0, values.indexOf(settings.get_string(key)));
    };

    synchronizeSelection();
    row.connect('notify::selected', () => {
        const value = values[row.selected];

        if (value !== undefined && settings.get_string(key) !== value) {
            settings.set_string(key, value);
        }
    });

    const settingsSignal = settings.connect(`changed::${key}`, synchronizeSelection);

    disconnectors.push(() => settings.disconnect(settingsSignal));

    return row;
};

export const fillPreferences = (window: Adw.PreferencesWindow, settings: Gio.Settings): void => {
    const disconnectors: (() => void)[] = [];
    const page = new Adw.PreferencesPage({title: 'System Pulse', icon_name: 'utilities-system-monitor-symbolic'});
    const panel = new Adw.PreferencesGroup({title: gettext('Barra superior'), description: gettext('As alterações são aplicadas imediatamente.')});

    panel.add(createChoiceRow(settings, SETTINGS.panel, gettext('Exibir na barra'), [gettext('CPU e RAM'), gettext('Somente CPU'), gettext('Somente RAM')],
        ['both', 'cpu', 'ram'], disconnectors));
    panel.add(createSpinRow(settings, SETTINGS.interval, gettext('Intervalo de atualização (segundos)'), 1, 60));

    const processes = new Adw.PreferencesGroup({title: gettext('Processos'),
        description: gettext('CPU é medida entre leituras: 100% representa a capacidade total do computador.')});
    processes.add(createChoiceRow(settings, SETTINGS.metric, gettext('Ordenar por'), [gettext('RAM (RSS)'), gettext('CPU (atividade recente)')],
        ['ram', 'cpu'], disconnectors));
    processes.add(createSpinRow(settings, SETTINGS.count, gettext('Quantidade de processos'), 1, 20));
    page.add(panel);
    page.add(processes);
    window.add(page);
    window.connect('close-request', () => {
        disconnectors.splice(0).forEach(disconnect => disconnect());

        return false;
    });
};
