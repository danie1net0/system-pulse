import type Gio from 'gi://Gio';

declare global {
    function create_app_launch_context(timestamp: number, workspace: number): Gio.AppLaunchContext;
}
