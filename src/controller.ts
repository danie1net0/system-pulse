import {gettext} from 'resource:///org/gnome/shell/extensions/extension.js';
import type {WidgetContext} from './data/widget-context.ts';
import {StatsPresenter} from './presenters/stats.ts';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {extensionManager, panel} from 'resource:///org/gnome/shell/ui/main.js';
import type {ProcessUsage} from './data/process-usage.ts';
import type {StatsView} from './data/stats-view.ts';
import {StatsSnapshot} from './data/stats-snapshot.ts';
import type {WidgetOptions} from './data/widget-options.ts';
import {openSystemMonitor} from './platform/system-monitor.ts';
import {ProcessService} from './services/processes.ts';
import {StatsService} from './services/stats.ts';
import {readOptions, SETTINGS} from './settings.ts';
import {WidgetIndicator} from './ui/indicator.ts';

export class WidgetController {
    private readonly settings: Gio.Settings;
    private readonly indicator: WidgetIndicator;
    private readonly statsService = new StatsService();
    private readonly statsPresenter = new StatsPresenter(gettext);
    private processService = new ProcessService();
    private options: WidgetOptions;
    private stats: StatsView;
    private processes: readonly ProcessUsage[] = [];
    private timerId = 0;
    private readonly settingsSignal: number;
    private disposed = false;

    constructor(context: WidgetContext) {
        const {uuid, name, settings, openPreferences} = context;

        this.settings = settings;
        this.options = readOptions(settings);
        this.stats = this.statsPresenter.present(new StatsSnapshot(null, null, null));

        this.indicator = new WidgetIndicator(name, {
            selectMetric: metric => {settings.set_string(SETTINGS.metric, metric);},
            openPreferences,
            openMonitor: openSystemMonitor,
            remove: () => {extensionManager.disableExtension(uuid);},
            menuChanged: open => {
                if (this.disposed) {
                    return;
                }

                // Uma nova abertura inicia um novo intervalo, sem médias de menu fechado.
                this.processService.dispose();
                this.processService = new ProcessService();
                this.processes = [];
                this.indicator.renderProcesses([], this.options);

                if (open) {
                    void this.updateProcesses();
                }
            },
        });

        this.indicator.configure(this.options);
        this.indicator.renderStats(this.stats, this.options);
        panel.addToStatusArea(uuid, this.indicator.button);

        this.settingsSignal = settings.connect('changed', () => this.settingsChanged());
        this.startTimer();
        void this.updateStats();
    }

    dispose(): void {
        this.disposed = true;

        this.settings.disconnect(this.settingsSignal);
        this.stopTimer();
        this.statsService.dispose();
        this.processService.dispose();
        this.indicator.destroy();
    }

    private settingsChanged(): void {
        const previous = this.options;

        this.options = readOptions(this.settings);

        this.indicator.configure(this.options);
        this.indicator.renderStats(this.stats, this.options);
        this.indicator.renderProcesses(this.processes, this.options);

        if (previous.intervalSeconds !== this.options.intervalSeconds) {
            this.startTimer();
        }
    }

    private startTimer(): void {
        this.stopTimer();

        this.timerId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, this.options.intervalSeconds, () => {
            void this.updateStats();

            if (this.indicator.menu.isOpen) {
                void this.updateProcesses();
            }

            return GLib.SOURCE_CONTINUE;
        });
    }

    private stopTimer(): void {
        if (this.timerId) {
            GLib.Source.remove(this.timerId);
        }

        this.timerId = 0;
    }

    private async updateStats(): Promise<void> {
        const snapshot = await this.statsService.sample();

        // Amostras canceladas pelo dispose chegam como null.
        if (!snapshot) {
            return;
        }

        this.stats = this.statsPresenter.present(snapshot);
        this.indicator.renderStats(this.stats, this.options);
    }

    private async updateProcesses(): Promise<void> {
        const service = this.processService;

        try {
            const processes = await service.sample();

            if (this.disposed || this.processService !== service || !processes) {
                return;
            }

            this.processes = processes;
            this.indicator.renderProcesses(processes, this.options);
        } catch (error) {
            if (this.disposed || this.processService !== service) {
                return;
            }

            console.error('[system-pulse] Falha ao listar processos:', error);
            this.indicator.showProcessError();
        }
    }
}
