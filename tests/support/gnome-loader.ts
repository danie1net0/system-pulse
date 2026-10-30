import {registerHooks} from 'node:module';

const fakeModules = new URL('./gnome.ts', import.meta.url).href;
const modules = new Map<string, string>([
    ...['Gio', 'GLib', 'St', 'Clutter', 'Adw', 'Gtk', 'GioUnix'].map((name): [string, string] =>
        [`gi://${name}`, `export {${name} as default} from '${fakeModules}';`]),
    ['resource:///org/gnome/shell/ui/main.js', `export {panel, extensionManager, notify} from '${fakeModules}';`],
    ['resource:///org/gnome/shell/ui/panelMenu.js', `export {Button} from '${fakeModules}';`],
    ['resource:///org/gnome/shell/ui/popupMenu.js', `export {PopupMenu, PopupMenuItem, PopupMenuSection, PopupSeparatorMenuItem, PopupSubMenuMenuItem, PopupBaseMenuItem, Ornament} from '${fakeModules}';`],
    ['resource:///org/gnome/shell/extensions/extension.js', `export {Extension, gettext} from '${fakeModules}';`],
    ['resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js', `export {ExtensionPreferences, gettext} from '${fakeModules}';`],
]);
registerHooks({
    resolve(specifier, context, nextResolve) {
        if (modules.has(specifier)) {
            return {url: specifier, shortCircuit: true};
        }

        return nextResolve(specifier, context);
    },
    load(url, context, nextLoad) {
        const source = modules.get(url);

        if (source !== undefined) {
            return {format: 'module', source, shortCircuit: true};
        }

        return nextLoad(url, context);
    },
});
