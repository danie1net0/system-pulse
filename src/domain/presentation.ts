import type {StatsView} from '../data/stats-view.ts';
import type {PanelMode} from './types.ts';

export const panelText = (stats: StatsView, mode: PanelMode): string => {
    switch (mode) {
    case 'cpu': return `CPU ${stats.cpuText}`;
    case 'ram': return `RAM ${stats.ramText}`;
    case 'both': return `CPU ${stats.cpuText} · RAM ${stats.ramText}`;
    }
};
