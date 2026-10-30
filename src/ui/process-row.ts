import {gettext} from 'resource:///org/gnome/shell/extensions/extension.js';
import Clutter from 'gi://Clutter';
import St from 'gi://St';
import {PopupMenuItem} from 'resource:///org/gnome/shell/ui/popupMenu.js';
import type {ProcessUsage} from '../data/process-usage.ts';
import type {ProcessMetric} from '../domain/types.ts';

export class ProcessRow {
    readonly item = new PopupMenuItem('—', {reactive: false, can_focus: false});
    readonly pid = new St.Label({text: '—', style_class: 'system-pulse-process-pid', y_align: Clutter.ActorAlign.CENTER});
    readonly value = new St.Label({text: '—', style_class: 'system-pulse-process-memory', y_align: Clutter.ActorAlign.CENTER});

    constructor(header = false) {
        this.item.label.add_style_class_name('system-pulse-process-name');
        this.item.label.x_expand = true;
        this.item.add_child(this.pid);
        this.item.add_child(this.value);

        if (header) {
            this.item.add_style_class_name('system-pulse-process-header');
        }
    }

    setHeader(metric: ProcessMetric): void {
        this.item.label.text = gettext('Processo');
        this.pid.text = 'PID';
        this.value.text = metric === 'ram' ? 'RAM' : 'CPU';
    }

    update(process: ProcessUsage | undefined, metric: ProcessMetric): void {
        this.item.label.text = process?.name ?? '—';
        this.pid.text = process ? String(process.pid) : '—';
        this.value.text = !process ? '—' : metric === 'ram'
            ? `${(process.rssKiB / 1024).toFixed(1)} MiB`
            : process.cpuPercent === null ? '…' : `${process.cpuPercent.toFixed(1)}%`;
    }
}
