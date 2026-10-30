import {spawnSync} from 'node:child_process';
import {accessSync, constants} from 'node:fs';
import {delimiter, join} from 'node:path';

export const available = (command: string): boolean => {
    return (process.env['PATH'] ?? '').split(delimiter).some(directory => {
        try {
            accessSync(join(directory, command), constants.X_OK);

            return true;
        } catch {
            return false;
        }
    });
};

export const run = (command: string, commandArguments: readonly string[], workingDirectory: string): void => {
    const result = spawnSync(command, commandArguments, {cwd: workingDirectory, stdio: 'inherit'});

    if (result.error || result.status !== 0) {
        throw new Error(`Falha ao executar ${command} (código ${result.status ?? 'indisponível'}).`, {cause: result.error});
    }
};

export const tryRun = (command: string, commandArguments: readonly string[], workingDirectory: string): boolean => {
    return spawnSync(command, commandArguments, {cwd: workingDirectory, stdio: 'ignore'}).status === 0;
};

export const checkEnvironment = (skipBuild: boolean): void => {
    if (process.platform !== 'linux') {
        throw new Error('Este instalador é destinado ao Linux com GNOME Shell 50.');
    }

    if (Number(process.versions.node.split('.')[0]) < 24) {
        throw new Error('É necessário Node.js 24 ou superior.');
    }

    if (process.getuid?.() === 0) {
        throw new Error('Execute sem sudo para instalar no seu usuário.');
    }

    const required = ['gnome-shell', 'gnome-extensions', 'ps', ...(skipBuild ? [] : ['npm', 'glib-compile-schemas'])];
    const missing = required.filter(command => !available(command));

    if (missing.length) {
        throw new Error(`Dependências ausentes: ${missing.join(', ')}. No Ubuntu: GNOME Shell, Node.js/npm, procps e libglib2.0-bin.`);
    }

    const result = spawnSync('gnome-shell', ['--version'], {encoding: 'utf8'});

    if (result.status !== 0 || !/\b50(?:\.|\b)/.test(result.stdout)) {
        throw new Error(`GNOME Shell incompatível: ${result.stdout.trim() || 'versão desconhecida'}. Requer versão 50.`);
    }
};
