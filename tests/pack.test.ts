import assert from 'node:assert/strict';
import {mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {test} from 'node:test';
import {crc32, inflateRawSync} from 'node:zlib';
import {createZip, PACKAGE_FILES, pack, packageEntries} from '../scripts/pack.ts';

const readZip = (data: Buffer): Map<string, string> => {
    const end = data.length - 22;
    const count = data.readUInt16LE(end + 10);
    const files = new Map<string, string>();
    let position = data.readUInt32LE(end + 16);

    assert.equal(data.readUInt32LE(end), 0x06054b50);

    for (let index = 0; index < count; index++) {
        assert.equal(data.readUInt32LE(position), 0x02014b50);

        const size = data.readUInt32LE(position + 20);
        const nameLength = data.readUInt16LE(position + 28);
        const offset = data.readUInt32LE(position + 42);
        const name = data.subarray(position + 46, position + 46 + nameLength).toString('utf8');
        const start = offset + 30 + data.readUInt16LE(offset + 26);
        const content = inflateRawSync(data.subarray(start, start + size));

        assert.equal(data.readUInt32LE(offset), 0x04034b50);
        assert.equal(data.readUInt32LE(position + 16), crc32(content));
        files.set(name, content.toString('utf8'));
        position += 46 + nameLength;
    }

    return files;
};

const fixture = (context: {after: (callback: () => void) => void}): string => {
    const root = mkdtempSync(join(tmpdir(), 'system-pulse-pack-'));

    context.after(() => rmSync(root, {recursive: true, force: true}));

    for (const file of [...PACKAGE_FILES, 'build/ui/indicator.js', 'build/extension.js',
        'locale/en/LC_MESSAGES/system-pulse.mo', 'src/extension.ts', 'schemas/gschemas.compiled']) {
        mkdirSync(dirname(join(root, file)), {recursive: true});
        writeFileSync(join(root, file), `conteúdo: ${file}`);
    }

    writeFileSync(join(root, 'metadata.json'), JSON.stringify({uuid: 'teste@exemplo'}));

    return root;
};

test('createZip gera um arquivo ZIP com deflate e nomes em UTF-8', () => {
    const files = readZip(createZip(new Map([['ação.txt', Buffer.from('olá '.repeat(50))], ['vazio', Buffer.alloc(0)]])));

    assert.deepEqual([...files.keys()], ['ação.txt', 'vazio']);
    assert.equal(files.get('ação.txt'), 'olá '.repeat(50));
    assert.equal(files.get('vazio'), '');
});

test('packageEntries inclui apenas os arquivos de execução, o build e as traduções', context => {
    const root = fixture(context);

    assert.deepEqual(packageEntries(root), [...PACKAGE_FILES, 'build/extension.js', 'build/ui/indicator.js',
        'locale/en/LC_MESSAGES/system-pulse.mo']);
    rmSync(join(root, 'prefs.js'));
    rmSync(join(root, 'stylesheet.css'));
    assert.throws(() => packageEntries(root), /Arquivos ausentes: prefs\.js, stylesheet\.css\. Execute npm run build/);
});

test('pack grava dist/<uuid>.shell-extension.zip com o conteúdo do pacote', context => {
    const root = fixture(context);
    const output = pack(root);

    assert.equal(output, join(root, 'dist/teste@exemplo.shell-extension.zip'));

    const files = readZip(readFileSync(output));

    assert.equal(files.get('build/ui/indicator.js'), 'conteúdo: build/ui/indicator.js');
    assert.ok(files.has('locale/en/LC_MESSAGES/system-pulse.mo'));
    assert.ok(!files.has('src/extension.ts'));
    assert.ok(!files.has('schemas/gschemas.compiled'));
});

test('pack exige o UUID no metadata.json', context => {
    const root = fixture(context);

    for (const metadata of ['null', '{}', '{"uuid": 1}']) {
        writeFileSync(join(root, 'metadata.json'), metadata);
        assert.throws(() => pack(root), /metadata\.json não define o UUID/);
    }
});
