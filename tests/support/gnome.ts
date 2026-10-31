type Callback = (...values: unknown[]) => unknown;

export const state = {
    contents: new Map<string, string | Error | false>(),
    processOutput: '' as string | null,
    processSuccess: true,
    processExitSuccess: true,
    onRead: (_path: string): void => {},
    processError: null as Error | null,
    paused: false,
    pending: [] as (() => void)[],
    widgets: [] as Widget[],
    timers: new Map<number, () => boolean>(),
    nextTimer: 1,
    installedButtons: [] as unknown[][],
    disabledExtensions: [] as string[],
    notifications: [] as string[][],
    applications: new Map<string, boolean | Error>(),
    launched: [] as string[],
    subprocesses: [] as Subprocess[],
    validMenu: true,
    preferencesOpened: 0,
    settings: null as Settings | null,
    translations: [] as string[],
};

export const reset = (): void => {
    state.contents.clear();
    state.processOutput = '';
    state.processSuccess = true;
    state.processExitSuccess = true;
    state.onRead = () => {};
    state.processError = null;
    state.paused = false;
    state.pending = [];
    state.widgets = [];
    state.timers.clear();
    state.installedButtons = [];
    state.disabledExtensions = [];
    state.notifications = [];
    state.applications.clear();
    state.launched = [];
    state.subprocesses = [];
    state.validMenu = true;
    state.preferencesOpened = 0;
    state.settings = new Settings();
    state.translations = [];
};

const schedule = (callback: () => void): void => {
    if (state.paused) {
        state.pending.push(callback);

        return;
    }

    queueMicrotask(callback);
};

export const flush = async (): Promise<void> => {
    state.paused = false;
    state.pending.splice(0).forEach(callback => callback());
    await new Promise<void>(resolve => setImmediate(resolve));
};

class Signals {
    readonly signals = new Map<number, {name: string; callback: Callback}>();
    private nextSignal = 1;

    connect(name: string, callback: Callback): number {
        const identifier = this.nextSignal++;

        this.signals.set(identifier, {name, callback});

        return identifier;
    }

    disconnect(identifier: number): void {
        this.signals.delete(identifier);
    }

    emit(name: string, ...values: unknown[]): void {
        for (const signal of this.signals.values()) {
            if (signal.name === name) {
                signal.callback(this, ...values);
            }
        }
    }
}

export class Settings extends Signals {
    readonly values = new Map<string, string | number>([
        ['update-interval', 2], ['process-count', 5], ['process-metric', 'ram'], ['panel-mode', 'both'],
    ]);
    readonly bindings: unknown[][] = [];

    get_string(key: string): string {return String(this.values.get(key));}

    get_int(key: string): number {return Number(this.values.get(key));}

    set_string(key: string, value: string): void {
        this.values.set(key, value);
        this.emit(`changed::${key}`);
        this.emit('changed', key);
    }

    set_int(key: string, value: number): void {
        this.values.set(key, value);
        this.emit('changed', key);
    }

    bind(...values: unknown[]): void {this.bindings.push(values);}
}

export class Widget extends Signals {
    text = '';
    title = '';
    selected = 0;
    x_expand = false;
    accessible_name = '';
    destroyed = false;
    ornament = -1;
    readonly styles: string[] = [];
    readonly children: unknown[] = [];

    constructor(options: Record<string, unknown> = {}) {
        super();
        Object.assign(this, options);
        state.widgets.push(this);
    }

    add_child(child: unknown): void {this.children.push(child);}

    set_child(child: unknown): void {this.children.push(child);}

    add(child: unknown): void {this.children.push(child);}

    add_style_class_name(style: string): void {this.styles.push(style);}

    destroy(): void {this.destroyed = true;}

    setOrnament(value: number): void {this.ornament = value;}
}

export class PopupMenuItem extends Widget {
    readonly label: Widget;
    constructor(text = '', options: Record<string, unknown> = {}) {
        super(options);
        this.label = new Widget({text});
    }
}

export class PopupBaseMenuItem extends Widget {}
export class PopupSeparatorMenuItem extends PopupMenuItem {}
export class PopupMenu extends Widget {
    isOpen = false;
    readonly actions = new Map<string, () => void>();
    addMenuItem(item: unknown): void {this.children.push(item);}

    addAction(label: string, callback: () => void): void {this.actions.set(label, callback);}

    removeAll(): void {this.children.splice(0);}

    close(): void {this.isOpen = false; this.emit('open-state-changed', false);}

    open(): void {this.isOpen = true; this.emit('open-state-changed', true);}

    get actor(): Widget {return this;}
}

export class PopupMenuSection extends PopupMenu {}
export class PopupSubMenuMenuItem extends PopupMenuItem {
    readonly menu = new PopupMenu();
}

export class Button extends Widget {
    readonly menu = state.validMenu ? new PopupMenu() : new Widget();
}

export const Ornament = {DOT: 1, NONE: 0};

export class Cancellable {
    private cancelled = false;
    cancel(): void {this.cancelled = true;}

    is_cancelled(): boolean {return this.cancelled;}
}

class File {
    readonly path: string;
    constructor(path: string) {this.path = path;}

    static new_for_path(path: string): File {return new File(path);}

    load_contents(): [boolean, Uint8Array] {
        const content = state.contents.get(this.path);

        if (content instanceof Error) {throw content;}

        if (typeof content !== 'string') {return [false, new Uint8Array()];}
        state.onRead(this.path);

        return [true, new TextEncoder().encode(content)];
    }

    load_contents_async(cancellable: Cancellable, callback: Callback): void {
        schedule(() => callback(this, cancellable));
    }

    load_contents_finish(cancellable: Cancellable): [boolean, Uint8Array] {
        if (cancellable.is_cancelled()) {throw new Error('cancelado');}

        return this.load_contents();
    }
}

class Subprocess {
    forced = false;
    static new(): Subprocess {
        const subprocess = new Subprocess();

        state.subprocesses.push(subprocess);

        return subprocess;
    }

    communicate_utf8_async(_input: unknown, cancellable: Cancellable, callback: Callback): void {
        schedule(() => callback(this, cancellable));
    }

    communicate_utf8_finish(cancellable: Cancellable): [boolean, string | null] {
        if (cancellable.is_cancelled()) {throw new Error('cancelado');}

        if (state.processError) {throw state.processError;}

        return [state.processSuccess, state.processOutput];
    }

    get_successful(): boolean {return state.processExitSuccess;}

    force_exit(): void {this.forced = true;}
}

export const Gio = {Settings, File, Cancellable, Subprocess,
    SubprocessFlags: {STDOUT_PIPE: 1, STDERR_SILENCE: 2}, SettingsBindFlags: {DEFAULT: 0}};
export const GLib = {
    PRIORITY_DEFAULT: 0, SOURCE_CONTINUE: true,
    timeout_add_seconds: (_priority: number, _seconds: number, callback: () => boolean): number => {
        const identifier = state.nextTimer++;

        state.timers.set(identifier, callback);

        return identifier;
    },
    Source: {remove: (identifier: number): void => {state.timers.delete(identifier);}},
};

export const St = {Label: Widget, ScrollView: Widget, PolicyType: {NEVER: 0, AUTOMATIC: 1}};
export const Clutter = {ActorAlign: {CENTER: 0}};
export const Adw = {PreferencesPage: Widget, PreferencesGroup: Widget, PreferencesWindow: Widget, SpinRow: Widget, ComboRow: Widget};
export const Gtk = {Adjustment: Widget, StringList: {new: (labels: string[]): string[] => labels}};
export const panel = {addToStatusArea: (...values: unknown[]): void => {state.installedButtons.push(values);}};
export const extensionManager = {disableExtension: (uuid: string): void => {state.disabledExtensions.push(uuid);}};
export const notify = (...messages: string[]): void => {state.notifications.push(messages);};
export const GioUnix = {DesktopAppInfo: {new: (name: string): {launch: () => boolean} | null => {
    const result = state.applications.get(name);

    if (result === undefined) {return null;}

    return {launch: (): boolean => {
        state.launched.push(name);

        if (result instanceof Error) {throw result;}

        return result;
    }};
}}};
export const gettext = (message: string): string => {state.translations.push(message); return message;};
export class Extension {
    readonly uuid = 'system-pulse@danie1net0.gitlab.io';
    readonly metadata = {name: 'System Pulse'};
    getSettings(): Settings | null {return state.settings;}

    openPreferences(): void {state.preferencesOpened++;}
}

export class ExtensionPreferences extends Extension {}
Object.assign(globalThis, {create_app_launch_context: (): object => ({})});
