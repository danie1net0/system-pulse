import Gio from 'gi://Gio';
import {WidgetOptions} from './data/widget-options.ts';
import type {PanelMode, ProcessMetric} from './domain/types.ts';

export const SETTINGS = {
    interval: 'update-interval',
    count: 'process-count',
    metric: 'process-metric',
    panel: 'panel-mode',
} as const;

export const readOptions = (settings: Gio.Settings): WidgetOptions => {
    const metric = settings.get_string(SETTINGS.metric);
    const panel = settings.get_string(SETTINGS.panel);
    const processMetric: ProcessMetric = metric === 'cpu' ? 'cpu' : 'ram';
    const panelMode: PanelMode = panel === 'cpu' || panel === 'ram' ? panel : 'both';

    return new WidgetOptions(settings.get_int(SETTINGS.interval),
        settings.get_int(SETTINGS.count), processMetric, panelMode);
};
