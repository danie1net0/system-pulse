import assert from 'node:assert/strict';
import {existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {test} from 'node:test';
import {compileMo, compileTranslations, DOMAIN, parsePo} from '../scripts/translations.ts';

const readMo = (data: Buffer): Map<string, string> => {
    const count = data.readUInt32LE(8);
    const originals = data.readUInt32LE(12);
    const translations = data.readUInt32LE(16);
    const text = (table: number, index: number): string => {
        const length = data.readUInt32LE(table + index * 8);
        const offset = data.readUInt32LE(table + index * 8 + 4);

        return data.subarray(offset, offset + length).toString('utf8');
    };

    assert.equal(data.readUInt32LE(0), 0x950412de);

    return new Map(Array.from({length: count}, (_value, index) => [text(originals, index), text(translations, index)]));
};

test('parsePo lê cabeçalho, continuações, escapes e ignora mensagens sem tradução', () => {
    const messages = parsePo([
        '# comentário',
        'msgid ""',
        'msgstr ""',
        '"Content-Type: text/plain; charset=UTF-8\\n"',
        '',
        '#: src/arquivo.ts',
        'msgid "Olá \\"mundo\\""',
        'msgstr "Hello \\"world\\""',
        '',
        'msgid "Tab\\tbarra\\\\"',
        'msgstr ""',
        '"Tab\\t"',
        '"backslash\\\\"',
        '',
        'msgid "Sem tradução"',
        'msgstr ""',
    ].join('\n'));

    assert.deepEqual([...messages], [
        ['', 'Content-Type: text/plain; charset=UTF-8\n'],
        ['Olá "mundo"', 'Hello "world"'],
        ['Tab\tbarra\\', 'Tab\tbackslash\\'],
    ]);
});

test('parsePo rejeita linhas inválidas e texto fora de uma mensagem', () => {
    assert.throws(() => parsePo('msgctxt "x"'), /Linha inválida no catálogo: msgctxt "x"/);
    assert.throws(() => parsePo('"solto"'), /Texto fora de uma mensagem: "solto"/);
});

test('compileMo gera um catálogo GNU ordenado e em UTF-8', () => {
    const data = compileMo(new Map([['Processos', 'Processes'], ['', 'Content-Type: text/plain; charset=UTF-8\n'], ['Ação…', 'Action…']]));
    const messages = readMo(data);

    assert.deepEqual([...messages.keys()], ['', 'Ação…', 'Processos']);
    assert.equal(messages.get('Ação…'), 'Action…');
    assert.equal(data.readUInt32LE(4), 0);
    assert.equal(data.readUInt32LE(20), 0);
});

test('compileTranslations compila cada catálogo .po para locale/<idioma>', context => {
    const root = mkdtempSync(join(tmpdir(), 'system-pulse-translations-'));

    context.after(() => rmSync(root, {recursive: true, force: true}));
    mkdirSync(join(root, 'po'));
    writeFileSync(join(root, 'po/pt_PT.po'), 'msgid "Ecrã"\nmsgstr "Tela"\n');
    writeFileSync(join(root, 'po/en.po'), 'msgid "Tela"\nmsgstr "Screen"\n');
    writeFileSync(join(root, 'po/LEIA-ME.txt'), 'ignorado');

    assert.deepEqual(compileTranslations(root), ['en', 'pt_PT']);
    assert.equal(readMo(readFileSync(join(root, `locale/en/LC_MESSAGES/${DOMAIN}.mo`))).get('Tela'), 'Screen');
    assert.ok(existsSync(join(root, `locale/pt_PT/LC_MESSAGES/${DOMAIN}.mo`)));
});

test('o catálogo em inglês traduz todas as mensagens da interface', () => {
    const root = new URL('../', import.meta.url);
    const catalog = parsePo(readFileSync(new URL('po/en.po', root), 'utf8'));
    const sources = readdirSync(new URL('src', root), {recursive: true, encoding: 'utf8'}).filter(file => file.endsWith('.ts'));
    const missing = sources.flatMap(file => [...readFileSync(new URL(`src/${file}`, root), 'utf8')
        .matchAll(/\b(?:gettext|translate)\(\s*'((?:[^'\\]|\\.)*)'/g)].map(match => match[1]))
        .filter(message => message !== undefined && !catalog.has(message));

    assert.ok(sources.length > 0);
    assert.deepEqual(missing, []);
});
