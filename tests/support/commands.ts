import childProcess from 'node:child_process';
import fileSystem from 'node:fs';
import {syncBuiltinESMExports} from 'node:module';
import {basename} from 'node:path';
import type {TestContext} from 'node:test';

export const mockCommands = (context: TestContext, overrides: {platform?: NodeJS.Platform; nodeVersion?: string; userId?: number} = {}) => {
    const commands = new Set(['gnome-shell', 'gnome-extensions', 'ps', 'npm', 'glib-compile-schemas',
        'gnome-system-monitor', 'sudo', 'apt-get', 'update-desktop-database']);
    const calls: {command: string; arguments: readonly string[]}[] = [];
    const responses = new Map<string, {status: number | null; stdout: string; error?: Error}>();
    const environmentVariables = context.mock.property(process, 'env', {...process.env, PATH: '/mock/bin'});
    const platform = context.mock.property(process, 'platform', overrides.platform ?? 'linux');
    const nodeVersion = context.mock.property(process.versions, 'node', overrides.nodeVersion ?? '24.19.0');
    const userId = context.mock.property(process, 'getuid', () => overrides.userId ?? 1000);

    context.mock.method(fileSystem, 'accessSync', (path: string): void => {
        if (!commands.has(basename(path))) {
            throw new Error('comando ausente');
        }
    });

    context.mock.method(childProcess, 'spawnSync', (command: string, commandArguments: readonly string[]) => {
        calls.push({command, arguments: commandArguments});

        const response = responses.get(command);

        return {pid: 123, output: [], stdout: 'GNOME Shell 50.0', stderr: '', status: 0, signal: null, ...response};
    });

    syncBuiltinESMExports();
    context.after(() => {context.mock.restoreAll(); syncBuiltinESMExports();});

    return {commands, calls, responses, environmentVariables, platform, nodeVersion, userId};
};
