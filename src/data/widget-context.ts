import type Gio from 'gi://Gio';

export class WidgetContext {
    readonly uuid: string;
    readonly name: string;
    readonly settings: Gio.Settings;
    readonly openPreferences: () => void;

    constructor(uuid: string, name: string, settings: Gio.Settings, openPreferences: () => void) {
        this.uuid = uuid;
        this.name = name;
        this.settings = settings;
        this.openPreferences = openPreferences;
    }
}
