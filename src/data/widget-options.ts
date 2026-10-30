import type {PanelMode, ProcessMetric} from '../domain/types.ts';

export class WidgetOptions {
    readonly intervalSeconds: number;
    readonly processCount: number;
    readonly processMetric: ProcessMetric;
    readonly panelMode: PanelMode;

    constructor(
        intervalSeconds: number,
        processCount: number,
        processMetric: ProcessMetric,
        panelMode: PanelMode,
    ) {
        this.intervalSeconds = intervalSeconds;
        this.processCount = processCount;
        this.processMetric = processMetric;
        this.panelMode = panelMode;
    }
}
