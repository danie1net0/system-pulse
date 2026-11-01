import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {UUID} from '../../scripts/installer/files.ts';

export const fixture = (): {root: string; source: string; dataHome: string; cleanup: () => void} => {
    const root = mkdtempSync(join(tmpdir(), 'system-pulse-installer-'));
    const source = join(root, 'projeto com espaços');
    const dataHome = join(root, 'dados com espaços');
    const files = ['stylesheet.css', 'build/extension.js', 'build/prefs.js',
        'schemas/gschemas.compiled', 'schemas/org.gnome.shell.extensions.system-pulse.gschema.xml',
        'locale/en/LC_MESSAGES/system-pulse.mo', 'assets/system-pulse.png'];
    for (const file of files) {
        mkdirSync(dirname(join(source, file)), {recursive: true});
        writeFileSync(join(source, file), `fixture: ${file}`);
    }

    writeFileSync(join(source, 'metadata.json'), JSON.stringify({uuid: UUID}));
    writeFileSync(join(source, 'system-pulse-enable.desktop'), '[Desktop Entry]\nIcon=system-pulse\n');
    mkdirSync(join(source, 'node_modules'));
    mkdirSync(join(source, 'src'));

    return {root, source, dataHome, cleanup: () => rmSync(root, {recursive: true, force: true})};
};
