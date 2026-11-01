import {gettext} from 'resource:///org/gnome/shell/extensions/extension.js';
import GioUnix from 'gi://GioUnix';
import {notify} from 'resource:///org/gnome/shell/ui/main.js';

export const openSystemMonitor = (): void => {
    try {
        const application = GioUnix.DesktopAppInfo.new('org.gnome.SystemMonitor.desktop') ??
            GioUnix.DesktopAppInfo.new('gnome-system-monitor.desktop');
        if (!application) {
            notify('System Pulse', gettext('Instale o Monitor do Sistema: sudo apt install gnome-system-monitor'));

            return;
        }

        if (!application.launch([], global.create_app_launch_context(0, -1))) {
            throw new Error('The application could not be launched');
        }
    } catch (error) {
        console.error('[system-pulse] Failed to open System Monitor:', error);
        notify('System Pulse', gettext('Não foi possível abrir o Monitor do Sistema.'));
    }
};
