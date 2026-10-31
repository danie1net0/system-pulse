import {mkdirSync, readdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';

export const DOMAIN = 'system-pulse';

const MO_MAGIC = 0x950412de;
const HEADER_SIZE = 28;

const unquote = (line: string): string => {
    if (!/^".*"$/.test(line)) {
        throw new Error(`Linha inválida no catálogo: ${line}`);
    }

    return line.slice(1, -1).replace(/\\(.)/g, (_sequence, character: string) => {
        switch (character) {
        case 'n': return '\n';
        case 't': return '\t';
        default: return character;
        }
    });
};

export const parsePo = (text: string): Map<string, string> => {
    const messages = new Map<string, string>();
    let field: 'msgid' | 'msgstr' | null = null;
    let id = '';
    let translation = '';
    const flush = (): void => {
        if (field === 'msgstr' && (translation !== '' || id === '')) {
            messages.set(id, translation);
        }

        field = null;
        id = '';
        translation = '';
    };

    for (const raw of text.split('\n')) {
        const line = raw.trim();

        if (line === '' || line.startsWith('#')) {
            continue;
        }

        const keyword = /^(msgid|msgstr) (".*")$/.exec(line);

        if (keyword?.[1] === 'msgid') {
            flush();
            field = 'msgid';
        } else if (keyword) {
            field = 'msgstr';
        }

        const value = unquote(keyword?.[2] ?? line);

        if (field === 'msgid') {
            id += value;
        } else if (field === 'msgstr') {
            translation += value;
        } else {
            throw new Error(`Texto fora de uma mensagem: ${line}`);
        }
    }

    flush();

    return messages;
};

export const compileMo = (messages: ReadonlyMap<string, string>): Buffer => {
    const entries = [...messages].map(([id, translation]) => [Buffer.from(id), Buffer.from(translation)] as const)
        .sort(([left], [right]) => Buffer.compare(left, right));
    const tables = HEADER_SIZE + entries.length * 16;
    const header = Buffer.alloc(tables);
    const strings: Buffer[] = [];
    let offset = tables;

    header.writeUInt32LE(MO_MAGIC, 0);
    header.writeUInt32LE(0, 4);
    header.writeUInt32LE(entries.length, 8);
    header.writeUInt32LE(HEADER_SIZE, 12);
    header.writeUInt32LE(HEADER_SIZE + entries.length * 8, 16);
    header.writeUInt32LE(0, 20);
    header.writeUInt32LE(tables, 24);

    for (const [table, column] of [[HEADER_SIZE, 0], [HEADER_SIZE + entries.length * 8, 1]] as const) {
        entries.forEach((entry, index) => {
            const value = entry[column];

            header.writeUInt32LE(value.length, table + index * 8);
            header.writeUInt32LE(offset, table + index * 8 + 4);
            strings.push(value, Buffer.alloc(1));
            offset += value.length + 1;
        });
    }

    return Buffer.concat([header, ...strings]);
};

export const compileTranslations = (root: string): readonly string[] => {
    const catalogs = readdirSync(join(root, 'po')).filter(file => file.endsWith('.po')).sort();

    return catalogs.map(catalog => {
        const language = catalog.slice(0, -'.po'.length);
        const directory = join(root, 'locale', language, 'LC_MESSAGES');

        mkdirSync(directory, {recursive: true});
        writeFileSync(join(directory, `${DOMAIN}.mo`), compileMo(parsePo(readFileSync(join(root, 'po', catalog), 'utf8'))));

        return language;
    });
};
