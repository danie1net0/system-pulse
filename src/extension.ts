import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import {WidgetContext} from './data/widget-context.ts';
import {WidgetController} from './controller.ts';

export default class SystemPulseExtension extends Extension {
    private controller: WidgetController | null = null;

    override enable(): void {
        this.controller = new WidgetController(new WidgetContext(this.uuid, this.metadata.name,
            this.getSettings(), () => this.openPreferences()));
    }

    override disable(): void {
        this.controller?.dispose();
        this.controller = null;
    }
}
