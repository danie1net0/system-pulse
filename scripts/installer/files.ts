import {cpSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync,
    renameSync, rmSync, statSync, symlinkSync, writeFileSync} from 'node:fs';
import {dirname, join, relative, sep} from 'node:path';
import type {InstallFilesOptions} from './data/install-files-options.ts';
import {InstallResult} from './data/install-result.ts';

// Identidade estável: a mudança de nome não cria outra extensão no GNOME.
export const UUID = 'ram-widget@local';

interface Change {
    readonly target: string;
    readonly staged: string;
    readonly backup: string;
    saved: boolean;
    installed: boolean;
}

const createChange = (target: string, stagingDirectory: string, index: number): Change => ({
    target,
    staged: join(stagingDirectory, `new-${index}`),
    backup: join(stagingDirectory, `old-${index}`),
    saved: false,
    installed: false,
});

const exists = (path: string): boolean => {
    return lstatSync(path, {throwIfNoEntry: false}) !== undefined;
};

const inside = (path: string, parent: string): boolean => {
    const relativePath = relative(parent, path);

    return relativePath === '' || (relativePath !== '..' && !relativePath.startsWith(`..${sep}`) && !relativePath.startsWith(sep));
};

const desktopValue = (value: string): string => {
    return value.replaceAll('\\', '\\\\').replaceAll('\n', '\\n')
        .replaceAll('\r', '\\r').replaceAll('\t', '\\t');
};

const validateExistingExtension = (extension: string): void => {
    if (!exists(extension) || lstatSync(extension).isSymbolicLink()) {
        return;
    }

    const metadata: unknown = JSON.parse(readFileSync(join(extension, 'metadata.json'), 'utf8'));

    if (typeof metadata !== 'object' || metadata === null || !('uuid' in metadata) || metadata.uuid !== UUID) {
        throw new Error('O destino existente não pertence ao System Pulse.');
    }
};

const stageExtension = (options: InstallFilesOptions, source: string, destination: string,
    runtimeFiles: readonly string[]): void => {
    if (options.development) {
        symlinkSync(source, destination, 'dir');

        return;
    }

    mkdirSync(destination);

    for (const file of runtimeFiles) {
        const target = join(destination, file);

        mkdirSync(dirname(target), {recursive: true});
        cpSync(join(source, file), target);
    }

    cpSync(join(source, 'build'), join(destination, 'build'), {recursive: true});
};

export const installFiles = (options: InstallFilesOptions): InstallResult => {
    const source = realpathSync(options.source);

    mkdirSync(options.dataHome, {recursive: true});

    const dataHome = realpathSync(options.dataHome);
    const extension = join(dataHome, 'gnome-shell/extensions', UUID);

    // Não permite instalar dentro do próprio checkout nem movê-lo como destino.
    if (inside(dataHome, source) || inside(source, extension)) {
        throw new Error('O destino de instalação não pode se sobrepor à pasta do projeto.');
    }

    const runtimeFiles = ['extension.js', 'prefs.js', 'metadata.json', 'stylesheet.css',
        'schemas/gschemas.compiled', 'schemas/org.gnome.shell.extensions.ram-widget.gschema.xml'];
    for (const file of [...runtimeFiles, 'build/extension.js', 'build/prefs.js', 'assets/system-pulse.png']) {
        if (!statSync(join(source, file), {throwIfNoEntry: false})?.isFile()) {
            throw new Error(`Arquivo ausente: ${file}. Execute npm run build antes de instalar.`);
        }
    }

    // Preserva o ID do atalho para manter os favoritos já configurados.
    const launcher = join(dataHome, 'applications/ram-widget-enable.desktop');
    const icon = join(dataHome, 'icons/hicolor/512x512/apps/system-pulse.png');

    for (const file of [launcher, icon]) {
        if (lstatSync(file, {throwIfNoEntry: false})?.isDirectory()) {
            throw new Error(`O destino deveria ser um arquivo: ${file}`);
        }
    }

    validateExistingExtension(extension);

    const stagingDirectory = mkdtempSync(join(dataHome, '.system-pulse-install-'));
    const extensionChange = createChange(extension, stagingDirectory, 0);
    const iconChange = createChange(icon, stagingDirectory, 1);
    const launcherChange = createChange(launcher, stagingDirectory, 2);
    const changes = [extensionChange, iconChange, launcherChange];
    let backup: string | null = null;
    let preserveWork = false;
    const install = (): InstallResult => {
        try {
            stageExtension(options, source, extensionChange.staged, runtimeFiles);
            cpSync(join(source, 'assets/system-pulse.png'), iconChange.staged);

            const template = readFileSync(join(source, 'system-pulse-enable.desktop'), 'utf8');

            writeFileSync(launcherChange.staged, template.replace(/^Icon=.*$/m, `Icon=${desktopValue(icon)}`), {mode: 0o644});

            for (const change of changes) {
                mkdirSync(dirname(change.target), {recursive: true});

                if (exists(change.target)) {
                    renameSync(change.target, change.backup);
                    change.saved = true;
                }

                renameSync(change.staged, change.target);
                change.installed = true;
            }

            if (changes.some(change => change.saved)) {
                const backups = join(dataHome, 'system-pulse/backups');

                mkdirSync(backups, {recursive: true});
                writeFileSync(join(stagingDirectory, 'restore.json'), JSON.stringify(changes.filter(change => change.saved)
                    .map(change => ({file: relative(stagingDirectory, change.backup), restoreTo: change.target})), null, 2));
                backup = join(backups, `installation-${Date.now()}-${relative(dataHome, stagingDirectory)}`);
                renameSync(stagingDirectory, backup);
            }

            return new InstallResult(extension, launcher, icon, backup);
        } catch (error) {
            const failures: unknown[] = [];

            for (const change of [...changes].reverse()) {
                try {
                    if (change.installed) {
                        rmSync(change.target, {recursive: true, force: true});
                    }

                    if (change.saved) {
                        renameSync(change.backup, change.target);
                    }
                } catch (failure) {
                    failures.push(failure);
                }
            }

            if (failures.length) {
                preserveWork = true;

                throw new AggregateError([error, ...failures], `Falha na restauração. Arquivos preservados em ${stagingDirectory}`);
            }

            throw error;
        }
    };

    try {
        return install();
    } finally {
        if (!preserveWork) {
            rmSync(stagingDirectory, {recursive: true, force: true});
        }
    }
};
