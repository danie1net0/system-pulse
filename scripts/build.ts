import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

execFileSync(fileURLToPath(new URL('../node_modules/.bin/tsc', import.meta.url)), [], {cwd: root, stdio: 'inherit'});
execFileSync('glib-compile-schemas', ['--strict', 'schemas'], {cwd: root, stdio: 'inherit'});

for (const entry of ['extension', 'prefs']) {
    writeFileSync(new URL(`../${entry}.js`, import.meta.url),
        `// Gerado por npm run build. Edite src/${entry}.ts.\nexport {default} from './build/${entry}.js';\n`);
}

console.log('Build concluído. Reinicie apenas o GNOME de teste para carregar o novo código.');
