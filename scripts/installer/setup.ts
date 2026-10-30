import {homedir} from 'node:os';
import {dirname} from 'node:path';
import {available, checkEnvironment, run, tryRun} from './commands.ts';
import {InstallFilesOptions} from './data/install-files-options.ts';
import type {InstallOptions} from './data/install-options.ts';
import type {InstallResult} from './data/install-result.ts';
import {installFiles, UUID} from './files.ts';
import {dataDirectory, HELP, parseOptions} from './options.ts';

const prepareBuild = (options: InstallOptions, source: string): void => {
    if (options.skipBuild) {
        return;
    }

    run('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], source);
    run('npm', ['run', 'build'], source);
};

const installSystemMonitor = (options: InstallOptions, source: string): void => {
    if (!options.withSystemMonitor || available('gnome-system-monitor')) {
        return;
    }

    if (!available('apt-get') || !available('sudo')) {
        throw new Error('Instale gnome-system-monitor pelo gerenciador da sua distribuição e execute novamente.');
    }

    run('sudo', ['apt-get', 'install', '--yes', 'gnome-system-monitor'], source);
};

const activateExtension = (result: InstallResult, source: string): void => {
    if (available('update-desktop-database')) {
        tryRun('update-desktop-database', [dirname(result.launcher)], source);
    }

    if (tryRun('gnome-extensions', ['enable', UUID], source)) {
        console.log('Extensão habilitada.');

        return;
    }

    console.log('O GNOME ainda não reconheceu a extensão. Após entrar novamente na sessão, abra o atalho System Pulse.');
};

const finishInstallation = (options: InstallOptions, result: InstallResult, source: string): void => {
    if (options.destination) {
        console.log('Instalação em pasta alternativa concluída; nenhuma extensão foi ativada.');

        return;
    }

    activateExtension(result, source);
};

export const setup = (commandArguments: readonly string[], source: string): void => {
    const options = parseOptions(commandArguments);

    if (options.help) {
        console.log(HELP);

        return;
    }

    checkEnvironment(options.skipBuild);
    prepareBuild(options, source);
    installSystemMonitor(options, source);

    const dataHome = options.destination ?? dataDirectory(homedir(), process.env['XDG_DATA_HOME']);
    const result = installFiles(new InstallFilesOptions(source, dataHome, options.development));

    console.log(`Extensão instalada: ${result.extension}\nAtalho instalado: ${result.launcher}`);

    if (result.backup) {
        console.log(`Backup da instalação anterior: ${result.backup}`);
    }

    finishInstallation(options, result, source);

    if (!available('gnome-system-monitor')) {
        console.log('Monitor do Sistema opcional ausente. Instale com: sudo apt install gnome-system-monitor');
    }

    console.log('Para carregar código atualizado, reabra o GNOME de teste ou entre novamente na sessão principal.');
};
