import {isAbsolute, resolve} from 'node:path';
import {InstallOptions} from './data/install-options.ts';

export const parseOptions = (commandArguments: readonly string[]): InstallOptions => {
    let help = false;
    let development = false;
    let skipBuild = false;
    let withSystemMonitor = false;
    let destination: string | null = null;

    for (let index = 0; index < commandArguments.length; index++) {
        const argument = commandArguments[index];

        switch (argument) {
        case '--help': case '-h': help = true; break;
        case '--dev': development = true; break;
        case '--skip-build': skipBuild = true; break;
        case '--with-system-monitor': withSystemMonitor = true; break;
        case '--dest-dir': {
            const value = commandArguments[++index];

            if (!value || value.startsWith('-')) {
                throw new Error('--dest-dir exige um caminho.');
            }

            destination = resolve(value);
            break;
        }

        default: throw new Error(`Opção desconhecida: ${argument}. Use --help.`);
        }
    }

    if (destination && withSystemMonitor) {
        throw new Error('--dest-dir não pode ser combinado com --with-system-monitor.');
    }

    return new InstallOptions(help, development, skipBuild, withSystemMonitor, destination);
};

export const dataDirectory = (homeDirectory: string, xdgDataHome: string | undefined): string => {
    return xdgDataHome && isAbsolute(xdgDataHome) ? xdgDataHome : resolve(homeDirectory, '.local/share');
};

export const HELP = `Instalador do System Pulse (GNOME Shell 50)

Uso: node install.ts [opções]

  --dev                   Instala um link para este projeto (desenvolvimento).
  --skip-build            Usa o build existente, sem npm ci ou compilação.
  --with-system-monitor   Instala também gnome-system-monitor via sudo/apt.
  --dest-dir DIRETÓRIO    Instala em outra pasta, sem ativar a extensão.
  --help, -h             Mostra esta ajuda.

Sem opções, prepara o build e instala uma cópia para o usuário atual.
Execute sem sudo. Somente a instalação opcional do Monitor pede senha.
`;
