import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';

const script = fileURLToPath(new URL('../xfce/system-pulse-genmon.sh', import.meta.url));
const tools = ['awk', 'cat', 'getconf', 'grep', 'id', 'mv'];
const meminfo = 'MemTotal: 1048576 kB\nMemAvailable: 262144 kB\nSwapTotal: 2097152 kB\nSwapFree: 1048576 kB\n';

interface Fixture {
    readonly root: string;
    readonly proc: string;
    readonly state: string;
    readonly bin: string;
    run(args?: readonly string[], environment?: Record<string, string>): {status: number | null; stdout: string; stderr: string};
    process(pid: number, residentPages: number, name: string | null): void;
}

const fixture = (context: {after: (callback: () => void) => void}): Fixture => {
    const root = mkdtempSync(join(tmpdir(), 'system-pulse-xfce-'));
    const proc = join(root, 'proc');
    const bin = join(root, 'bin');

    context.after(() => rmSync(root, {recursive: true, force: true}));
    mkdirSync(proc);
    mkdirSync(bin);

    // Only the tools the script needs, so no system monitor is found by accident.
    for (const tool of tools) {
        const path = spawnSync('sh', ['-c', `command -v ${tool}`], {encoding: 'utf8'}).stdout.trim();

        symlinkSync(path, join(bin, tool));
    }

    writeFileSync(join(proc, 'stat'), 'cpu  100 0 0 900 0 0 0 0 0 0\ncpu0 50 0 0 450 0 0 0 0 0 0\ncpu1 50 0 0 450 0 0 0 0 0 0\n');
    writeFileSync(join(proc, 'meminfo'), meminfo);

    return {
        root,
        proc,
        state: join(root, 'state'),
        bin,
        run(args = [], environment = {}) {
            const result = spawnSync('/bin/sh', [script, ...args], {
                encoding: 'utf8',
                env: {PATH: bin, LANG: 'pt_BR.UTF-8', SYSTEM_PULSE_PROC: proc, SYSTEM_PULSE_STATE: join(root, 'state'), ...environment},
            });

            return {status: result.status, stdout: result.stdout, stderr: result.stderr};
        },
        process(pid, residentPages, name) {
            mkdirSync(join(proc, String(pid)));
            writeFileSync(join(proc, String(pid), 'statm'), `${residentPages * 2} ${residentPages} 0 0 0 0 0\n`);

            if (name !== null) {
                writeFileSync(join(proc, String(pid), 'comm'), `${name}\n`);
            }
        },
    };
};

const panel = (stdout: string): string => stdout.match(/<txt>(.*?)<\/txt>/)?.[1] ?? '';
const tooltip = (stdout: string): string => stdout.match(/<tool>([\s\S]*?)<\/tool>/)?.[1] ?? '';

test('genmon mostra CPU após a segunda amostra e RAM, swap e processos no tooltip', context => {
    const environment = fixture(context);

    environment.process(10, 256, 'pequeno');
    environment.process(20, 65536, 'navegador <web> & cia');
    environment.process(30, 1024, 'com espaço');

    const first = environment.run();

    assert.equal(first.status, 0);
    assert.equal(panel(first.stdout), 'CPU … · RAM 75%');
    assert.match(tooltip(first.stdout), /^CPU: calculando…\nRAM: 0\.8 GiB usados de 1\.0 GiB utilizáveis\nSwap: 1\.0 GiB usados de 2\.0 GiB\n/);
    assert.match(tooltip(first.stdout), /<tt> +256\.0 MiB<\/tt> {2}navegador &lt;web&gt; &amp; cia\n<tt> +4\.0 MiB<\/tt> {2}com espaço\n<tt> +1\.0 MiB<\/tt> {2}pequeno\n/);
    assert.ok(!first.stdout.includes('<txtclick>'));

    writeFileSync(join(environment.proc, 'stat'), 'cpu  175 0 0 925 0 0 0 0\ncpu0 0\ncpu1 0\n');

    const second = environment.run(['--mode', 'cpu', '--count', '1']);

    assert.equal(panel(second.stdout), 'CPU 75%');
    assert.match(tooltip(second.stdout), /^CPU: 75% em uso · média de 2 CPUs lógicas\n/);
    assert.equal(tooltip(second.stdout).match(/<tt>/g)?.length, 1);
    assert.equal(panel(environment.run(['--mode', 'ram']).stdout), 'RAM 75%');
});

test('genmon fala inglês fora do português e abre o primeiro monitor disponível', context => {
    const environment = fixture(context);

    writeFileSync(join(environment.bin, 'gnome-system-monitor'), '#!/bin/sh\n', {mode: 0o755});
    writeFileSync(join(environment.bin, 'xfce4-taskmanager'), '#!/bin/sh\n', {mode: 0o755});
    writeFileSync(join(environment.proc, 'meminfo'), meminfo.replace('SwapTotal: 2097152', 'SwapTotal: 0').replace('SwapFree: 1048576', 'SwapFree: 0'));

    const result = environment.run([], {LANG: 'en_US.UTF-8', LC_ALL: 'C'});

    assert.match(result.stdout, /<txtclick>xfce4-taskmanager<\/txtclick>/);
    assert.match(tooltip(result.stdout), /^CPU: calculating…\nRAM: 0\.8 GiB used of 1\.0 GiB usable\nSwap: not configured\n\n<b>Processes · RAM \(RSS\)<\/b>\nReading unavailable\n/);
    assert.match(tooltip(result.stdout), /Click to open the system monitor\.<\/small>$/);
});

test('genmon trata leituras inválidas e troca de CPUs sem inventar valores', context => {
    const environment = fixture(context);

    environment.run();
    writeFileSync(join(environment.proc, 'stat'), 'cpu  200 0 0 1000 0 0 0 0\ncpu0 0\n');

    assert.equal(panel(environment.run().stdout), 'CPU … · RAM 75%');

    writeFileSync(join(environment.proc, 'stat'), 'cpu  100 0 0 900 0 0 0 0\ncpu0 0\n');

    assert.equal(panel(environment.run().stdout), 'CPU … · RAM 75%');

    for (const stat of ['cpu  1 2 x 4 5 6 7 8\ncpu0 0\n', 'cpu  1 2\ncpu0 0\n', 'cpu  1 2 3 4 5 6 7 8\n']) {
        writeFileSync(join(environment.proc, 'stat'), stat);

        const result = environment.run();

        assert.equal(panel(result.stdout), 'CPU — · RAM 75%');
        assert.match(tooltip(result.stdout), /^CPU: leitura indisponível\./);
        assert.match(readFileSync(environment.state, 'utf8'), /^x x 0 \d+\n$/);
    }

    for (const memory of ['MemTotal: 0 kB\nMemAvailable: 0 kB\nSwapTotal: 0 kB\nSwapFree: 0 kB\n',
        meminfo.replace('MemAvailable: 262144', 'MemAvailable: 9999999'),
        meminfo.replace('SwapFree: 1048576', 'SwapFree: 9999999'), 'MemTotal: 10 kB\n']) {
        writeFileSync(join(environment.proc, 'meminfo'), memory);

        const result = environment.run();

        assert.equal(panel(result.stdout), 'CPU — · RAM —');
        assert.match(tooltip(result.stdout), /RAM: leitura indisponível\.\nSwap: leitura indisponível\./);
    }

    rmSync(join(environment.proc, 'stat'));
    rmSync(join(environment.proc, 'meminfo'));

    assert.equal(environment.run().status, 0);
});

test('genmon refaz a lista de processos só a cada N execuções e ignora PIDs encerrados', context => {
    const environment = fixture(context);

    environment.process(10, 256, 'antigo');
    environment.process(11, 512, null);
    environment.run(['--process-every', '3']);
    environment.process(20, 4096, 'novo');

    assert.doesNotMatch(environment.run(['--process-every', '3']).stdout, /novo/);

    const refreshed = environment.run(['--process-every', '3']);

    assert.doesNotMatch(refreshed.stdout, /novo/);
    assert.match(environment.run(['--process-every', '3']).stdout, /novo[\s\S]*antigo/);
    assert.equal(readFileSync(`${environment.state}.processes`, 'utf8'), '16384\tnovo\n1024\tantigo\n');
});

test('genmon valida argumentos e mostra ajuda', context => {
    const environment = fixture(context);
    const help = environment.run(['--help']);

    assert.equal(help.status, 0);
    assert.match(help.stdout, /^Usage: system-pulse-genmon/);

    for (const args of [['--mode', 'gpu'], ['--mode'], ['--count', '0'], ['--count', '21'], ['--count', 'x'], ['--count'],
        ['--process-every', '0'], ['--process-every'], ['--desconhecido']]) {
        const result = environment.run(args);

        assert.equal(result.status, 2, args.join(' '));
        assert.match(result.stderr, /^Usage:/);
        assert.equal(result.stdout, '');
    }
});

test('genmon guarda o estado em XDG_RUNTIME_DIR quando não há caminho explícito', context => {
    const environment = fixture(context);
    const runtime = join(environment.root, 'runtime');

    mkdirSync(runtime);
    spawnSync('/bin/sh', [script], {env: {PATH: environment.bin, SYSTEM_PULSE_PROC: environment.proc, XDG_RUNTIME_DIR: runtime}});

    assert.match(readFileSync(join(runtime, 'system-pulse-genmon'), 'utf8'), /^1000 900 2 1\n$/);

});

const installer = fileURLToPath(new URL('../xfce/install.sh', import.meta.url));

// Keeps each xfconf property in a file; arrays start with an "@array" line.
const fakeXfconf = `#!/bin/sh
prop=; list=false; create=false; array=false; reset=false; values=
while [ $# -gt 0 ]; do
    case $1 in
        -c|-t) shift 2 ;;
        -p) prop=$2; shift 2 ;;
        -l) list=true; shift ;;
        -n) create=true; shift ;;
        -a) array=true; shift ;;
        -r) reset=true; shift ;;
        -R) shift ;;
        -s) values="$values$2
"; shift 2 ;;
        *) exit 9 ;;
    esac
done
$list && { ls "$FAKE_XFCONF" | tr % /; exit 0; }
file=$FAKE_XFCONF/$(printf %s "$prop" | tr / %)
$reset && { rm -f "$file" "$file"%*; exit 0; }
if [ -n "$values" ]; then
    [ -e "$file" ] || $create || exit 1
    { $array && echo @array; printf %s "$values"; } >"$file"
    exit 0
fi
[ -e "$file" ] || { echo "Property $prop does not exist" >&2; exit 1; }
if [ "$(head -n 1 "$file")" = @array ]; then
    echo "Value is an array with $(($(wc -l <"$file") - 1)) items:"; echo; tail -n +2 "$file"
else
    cat "$file"
fi
`;

const panelFixture = (context: {after: (callback: () => void) => void}) => {
    const root = mkdtempSync(join(tmpdir(), 'system-pulse-xfce-install-'));
    const store = join(root, 'xfconf');
    const bin = join(root, 'bin');
    const plugins = join(root, 'plugins');

    context.after(() => rmSync(root, {recursive: true, force: true}));
    for (const directory of [store, bin, plugins]) mkdirSync(directory);
    writeFileSync(join(plugins, 'libgenmon.so'), '');
    writeFileSync(join(bin, 'xfconf-query'), fakeXfconf, {mode: 0o755});
    writeFileSync(join(bin, 'xfce4-panel'), `#!/bin/sh\necho "$@" >>"${join(root, 'panel.log')}"\n`, {mode: 0o755});

    const property = (name: string): string => join(store, name.replaceAll('/', '%'));
    const set = (name: string, ...lines: string[]) => writeFileSync(property(name), `${lines.join('\n')}\n`);

    return {
        root,
        set,
        get: (name: string): string => readFileSync(property(name), 'utf8'),
        target: join(root, 'home', '.local', 'bin', 'system-pulse-genmon'),
        run(args: readonly string[] = [], environment: Record<string, string> = {}) {
            const result = spawnSync('/bin/sh', [installer, ...args], {
                encoding: 'utf8',
                env: {PATH: `${bin}:${process.env.PATH}`, HOME: join(root, 'home'), FAKE_XFCONF: store,
                    SYSTEM_PULSE_PANEL_PLUGINS: plugins, ...environment},
            });

            return {status: result.status, stdout: result.stdout, stderr: result.stderr};
        },
    };
};

test('instalador do XFCE adiciona o Monitor Genérico ao primeiro painel uma única vez', context => {
    const environment = panelFixture(context);

    environment.set('/panels', '@array', '1', '2');
    environment.set('/panels/panel-1/plugin-ids', '@array', '1', '3');
    environment.set('/plugins/plugin-1', 'separator');
    environment.set('/plugins/plugin-3', 'clock');
    environment.set('/plugins/plugin-7', 'systray');

    const first = environment.run();

    assert.equal(first.status, 0, first.stderr);
    assert.match(first.stdout, /Adicionado ao painel 1 como plugin-8\./);
    assert.equal(readFileSync(environment.target, 'utf8'), readFileSync(script, 'utf8'));
    assert.equal(environment.get('/plugins/plugin-8'), 'genmon\n');
    assert.equal(environment.get('/plugins/plugin-8/command'), `${environment.target}\n`);
    assert.equal(environment.get('/plugins/plugin-8/use-label'), 'false\n');
    assert.equal(environment.get('/plugins/plugin-8/update-period'), '2000\n');
    assert.equal(environment.get('/panels/panel-1/plugin-ids'), '@array\n1\n3\n8\n');
    assert.equal(readFileSync(join(environment.root, 'panel.log'), 'utf8'), '-r\n');

    const second = environment.run();

    assert.match(second.stdout, /O painel já tem o System Pulse \(plugin-8\)\./);
    assert.equal(environment.get('/panels/panel-1/plugin-ids'), '@array\n1\n3\n8\n');
});

test('instalador do XFCE cai nas instruções manuais quando não pode mexer no painel', context => {
    const environment = panelFixture(context);

    assert.match(environment.run().stdout, /Não encontrei a configuração do painel[\s\S]*Comando: .*system-pulse-genmon/);
    environment.set('/panels', '@array', '1');
    environment.set('/panels/panel-1/plugin-ids', '@array', '1');

    const skipped = environment.run(['--no-panel']);

    assert.match(skipped.stdout, /Adicionar novos itens/);
    assert.doesNotMatch(skipped.stdout, /Adicionado ao painel/);

    const missing = environment.run([], {SYSTEM_PULSE_PANEL_PLUGINS: join(environment.root, 'nada')});

    assert.match(missing.stdout, /sudo apt install xfce4-genmon-plugin/);
    assert.equal(environment.get('/panels/panel-1/plugin-ids'), '@array\n1\n');
    assert.equal(environment.run(['--desconhecido']).status, 2);
});

test('instalador do XFCE remove os itens do System Pulse de todos os painéis com --uninstall', context => {
    const environment = panelFixture(context);
    const runtime = join(environment.root, 'runtime');

    mkdirSync(runtime);
    writeFileSync(join(runtime, 'system-pulse-genmon'), '1 1 1 1\n');
    writeFileSync(join(runtime, 'system-pulse-genmon.processes'), '');
    environment.set('/panels', '@array', '1', '2');
    environment.set('/panels/panel-1/plugin-ids', '@array', '1');
    environment.set('/panels/panel-2/plugin-ids', '@array', '4');
    environment.set('/plugins/plugin-1', 'clock');
    environment.set('/plugins/plugin-4', 'genmon');
    environment.run();
    environment.set('/plugins/plugin-4/command', environment.target);

    const removed = environment.run(['--uninstall'], {XDG_RUNTIME_DIR: runtime});

    assert.equal(removed.status, 0, removed.stderr);
    assert.match(removed.stdout, /Removido do painel 1 \(plugin-5\)\.\nRemovido do painel 2 \(plugin-4\)\./);
    assert.equal(environment.get('/panels/panel-1/plugin-ids'), '@array\n1\n');
    assert.throws(() => environment.get('/panels/panel-2/plugin-ids'));
    assert.throws(() => environment.get('/plugins/plugin-5/command'));
    assert.equal(environment.get('/plugins/plugin-1'), 'clock\n');
    assert.throws(() => readFileSync(environment.target));
    assert.throws(() => readFileSync(join(runtime, 'system-pulse-genmon')));
    assert.equal(readFileSync(join(environment.root, 'panel.log'), 'utf8'), '-r\n-r\n');

    assert.match(environment.run(['--uninstall']).stdout, /Nenhum item do System Pulse no painel\./);
    rmSync(join(environment.root, 'xfconf'), {recursive: true});
    assert.match(environment.run(['--uninstall']).stdout, /remova o item à mão/);
});
