import {mkdirSync, readdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {crc32, deflateRawSync} from 'node:zlib';

export const PACKAGE_FILES = ['metadata.json', 'extension.js', 'prefs.js', 'stylesheet.css',
    'schemas/org.gnome.shell.extensions.system-pulse.gschema.xml'] as const;
export const PACKAGE_DIRECTORIES = ['build', 'locale'] as const;

const listFiles = (root: string, directory: string): string[] => {
    return readdirSync(join(root, directory), {recursive: true, encoding: 'utf8'})
        .map(file => `${directory}/${file}`)
        .filter(file => statSync(join(root, file)).isFile())
        .sort();
};

export const packageEntries = (root: string): readonly string[] => {
    const missing = PACKAGE_FILES.filter(file => !statSync(join(root, file), {throwIfNoEntry: false})?.isFile());

    if (missing.length) {
        throw new Error(`Arquivos ausentes: ${missing.join(', ')}. Execute npm run build antes de empacotar.`);
    }

    return [...PACKAGE_FILES, ...PACKAGE_DIRECTORIES.flatMap(directory => listFiles(root, directory))];
};

export const createZip = (files: ReadonlyMap<string, Buffer>): Buffer => {
    const locals: Buffer[] = [];
    const centrals: Buffer[] = [];
    let offset = 0;

    for (const [name, content] of files) {
        const path = Buffer.from(name);
        const compressed = deflateRawSync(content);
        const checksum = crc32(content);
        const local = Buffer.alloc(30);
        const central = Buffer.alloc(46);

        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4);
        local.writeUInt16LE(0x0800, 6);
        local.writeUInt16LE(8, 8);
        local.writeUInt32LE(checksum, 14);
        local.writeUInt32LE(compressed.length, 18);
        local.writeUInt32LE(content.length, 22);
        local.writeUInt16LE(path.length, 26);

        central.writeUInt32LE(0x02014b50, 0);
        central.writeUInt16LE(0x0314, 4);
        central.writeUInt16LE(20, 6);
        central.writeUInt16LE(0x0800, 8);
        central.writeUInt16LE(8, 10);
        central.writeUInt32LE(checksum, 16);
        central.writeUInt32LE(compressed.length, 20);
        central.writeUInt32LE(content.length, 24);
        central.writeUInt16LE(path.length, 28);
        central.writeUInt32LE((0o100644 << 16) >>> 0, 38);
        central.writeUInt32LE(offset, 42);

        locals.push(local, path, compressed);
        centrals.push(central, path);
        offset += local.length + path.length + compressed.length;
    }

    const directory = Buffer.concat(centrals);
    const end = Buffer.alloc(22);

    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(files.size, 8);
    end.writeUInt16LE(files.size, 10);
    end.writeUInt32LE(directory.length, 12);
    end.writeUInt32LE(offset, 16);

    return Buffer.concat([...locals, directory, end]);
};

export const pack = (root: string): string => {
    const metadata: unknown = JSON.parse(readFileSync(join(root, 'metadata.json'), 'utf8'));

    if (typeof metadata !== 'object' || metadata === null || !('uuid' in metadata) || typeof metadata.uuid !== 'string') {
        throw new Error('metadata.json não define o UUID da extensão.');
    }

    const output = join(root, 'dist', `${metadata.uuid.split('@')[0]}.shell-extension.zip`);

    mkdirSync(join(root, 'dist'), {recursive: true});
    writeFileSync(output, createZip(new Map(packageEntries(root).map(file => [file, readFileSync(join(root, file))]))));

    return output;
};
