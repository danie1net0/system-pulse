import {gettext} from 'resource:///org/gnome/shell/extensions/extension.js';
import Clutter from 'gi://Clutter';
import St from 'gi://St';
import {Button} from 'resource:///org/gnome/shell/ui/panelMenu.js';
import {Ornament, PopupBaseMenuItem, PopupMenu, PopupMenuItem, PopupMenuSection, PopupSeparatorMenuItem, PopupSubMenuMenuItem} from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {panelText} from '../domain/presentation.ts';
import {rankProcesses} from '../domain/processes.ts';
import type {ProcessUsage} from '../data/process-usage.ts';
import type {StatsView} from '../data/stats-view.ts';
import type {WidgetOptions} from '../data/widget-options.ts';
import type {ProcessMetric} from '../domain/types.ts';
import {ProcessRow} from './process-row.ts';

export interface IndicatorActions {
    readonly selectMetric: (metric: ProcessMetric) => void;
    readonly openPreferences: () => void;
    readonly openMonitor: () => void;
    readonly remove: () => void;
    readonly menuChanged: (open: boolean) => void;
}

export class WidgetIndicator {
    readonly button: Button;
    readonly menu: PopupMenu;
    readonly label = new St.Label({text: gettext('CPU … · RAM …'), y_align: Clutter.ActorAlign.CENTER});
    private readonly cpu = this.detail(gettext('CPU: calculando…'));
    private readonly ram = this.detail(gettext('RAM: carregando…'));
    private readonly swap = this.detail(gettext('Swap: carregando…'));
    private readonly selector = new PopupSubMenuMenuItem(gettext('Ordenar por RAM'), false);
    private readonly ramChoice = new PopupMenuItem(gettext('RAM (RSS)'));
    private readonly cpuChoice = new PopupMenuItem(gettext('CPU (atividade recente)'));
    private readonly section = new PopupMenuSection();
    private readonly header = new ProcessRow(true);
    private readonly hint = this.detail('');
    private rows: ProcessRow[] = [];

    constructor(name: string, actions: IndicatorActions) {
        this.button = new Button(0, name, false);

        const menu = this.button.menu;

        if (!(menu instanceof PopupMenu)) {
            throw new Error('The indicator needs a menu');
        }

        this.menu = menu;
        this.button.add_child(this.label);
        [this.cpu, this.ram, this.swap].forEach(item => menu.addMenuItem(item));
        menu.addMenuItem(new PopupSeparatorMenuItem(gettext('Processos')));
        menu.addMenuItem(this.selector);
        this.selector.menu.addMenuItem(this.ramChoice);
        this.selector.menu.addMenuItem(this.cpuChoice);
        this.ramChoice.connect('activate', () => actions.selectMetric('ram'));
        this.cpuChoice.connect('activate', () => actions.selectMetric('cpu'));
        menu.addMenuItem(this.header.item);

        const scroll = new St.ScrollView({
            style_class: 'system-pulse-process-scroll',
            hscrollbar_policy: St.PolicyType.NEVER,
            vscrollbar_policy: St.PolicyType.AUTOMATIC,
            overlay_scrollbars: true,
            x_expand: true,
        });

        scroll.set_child(this.section.actor);

        const processArea = new PopupBaseMenuItem({reactive: false, can_focus: false});

        processArea.add_style_class_name('system-pulse-process-area');
        processArea.add_child(scroll);
        menu.addMenuItem(processArea);
        this.hint.label.add_style_class_name('system-pulse-hint');
        menu.addMenuItem(this.hint);
        menu.addMenuItem(new PopupSeparatorMenuItem());
        menu.addAction(gettext('Abrir Monitor do Sistema'), actions.openMonitor);
        menu.addAction(gettext('Preferências…'), actions.openPreferences);
        menu.addAction(gettext('Remover da barra'), () => {
            menu.close();
            actions.remove();
        });

        menu.connect('open-state-changed', (_menu, open) => actions.menuChanged(open));
    }

    configure(options: WidgetOptions): void {
        const metric = options.processMetric;

        this.selector.label.text = metric === 'ram' ? gettext('Ordenar por RAM') : gettext('Ordenar por CPU');
        this.ramChoice.setOrnament(metric === 'ram' ? Ornament.DOT : Ornament.NONE);
        this.cpuChoice.setOrnament(metric === 'cpu' ? Ornament.DOT : Ornament.NONE);
        this.header.setHeader(metric);
        this.hint.label.text = metric === 'ram' ? gettext('RSS inclui páginas compartilhadas.') : gettext('CPU: 100% = capacidade total · … = aguardando amostra');

        if (this.rows.length === options.processCount) {
            return;
        }

        this.section.removeAll();
        this.rows = Array.from({length: options.processCount}, () => {
            const row = new ProcessRow();

            this.section.addMenuItem(row.item);

            return row;
        });
    }

    renderStats(stats: StatsView, options: WidgetOptions): void {
        this.label.text = panelText(stats, options.panelMode);
        this.cpu.label.text = stats.cpuDetails;
        this.ram.label.text = stats.ramDetails;
        this.swap.label.text = stats.swapDetails;
        this.button.accessible_name = `${stats.cpuDetails}. ${stats.ramDetails}`;
    }

    renderProcesses(processes: readonly ProcessUsage[], options: WidgetOptions): void {
        const ranked = rankProcesses(processes, options.processMetric, options.processCount);

        this.rows.forEach((row, index) => row.update(ranked[index], options.processMetric));
    }

    showProcessError(): void {
        this.rows.forEach(row => row.update(undefined, 'ram'));

        const first = this.rows[0];

        if (first) {
            first.item.label.text = gettext('Leitura indisponível');
        }
    }

    destroy(): void {
        this.section.destroy();
        this.button.destroy();
    }

    private detail(text: string): PopupMenuItem {
        return new PopupMenuItem(text, {reactive: false, can_focus: false});
    }
}
