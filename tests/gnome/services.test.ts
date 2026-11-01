import assert from 'node:assert/strict';
import {beforeEach, test} from 'node:test';
import {StatsService} from '../../src/services/stats.ts';
import {ProcessService} from '../../src/services/processes.ts';
import {flush, reset, state} from '../support/gnome.ts';

const cpu = (user: number, idle: number): string => `cpu ${user} 0 0 ${idle} 0 0 0 0\ncpu0 0`;
const processStat = (ticks: number): string => {
    const fields = Array<string>(22).fill('0');

    fields[0] = 'R'; fields[11] = String(ticks); fields[19] = '100';

    return `42 (processo) ${fields.join(' ')}`;
};

beforeEach(() => {
    reset();
    state.contents.set('/proc/stat', cpu(10, 90));
    state.contents.set('/proc/meminfo', 'MemTotal: 1000 kB\nMemAvailable: 250 kB\nSwapTotal: 500 kB\nSwapFree: 100 kB');
    state.contents.set('/proc/42/stat', processStat(10));
    state.processOutput = '42 2048 processo\n43 1024 inacessível';
});

test('amostragem retorna dados sem apresentação e reinicia CPU após falha', async context => {
    const errors = context.mock.method(console, 'error', () => undefined);
    const service = new StatsService();
    const first = await service.sample();

    assert.equal(first?.cpuPercent, null);
    assert.equal(first?.logicalCpuCount, 1);
    assert.equal(first?.memory?.percent, 75);

    state.contents.set('/proc/stat', cpu(60, 140));

    assert.equal((await service.sample())?.cpuPercent, 50);

    state.contents.clear();

    const unavailable = await service.sample();

    assert.equal(unavailable?.cpuPercent, null);
    assert.equal(unavailable?.logicalCpuCount, null);
    assert.equal(unavailable?.memory, null);
    assert.equal(errors.mock.callCount(), 2);

    state.contents.set('/proc/stat', cpu(70, 150));
    state.contents.set('/proc/meminfo', 'inválido');

    assert.equal((await service.sample())?.cpuPercent, null);
    assert.equal(errors.mock.callCount(), 3);
});

test('amostragem ocupada ou descartada não lê novamente', async () => {
    state.paused = true;

    const service = new StatsService();
    const pending = service.sample();

    assert.equal(await service.sample(), null);

    service.dispose();
    await flush();

    assert.equal(await pending, null);
    assert.equal(await service.sample(), null);
});

test('processos calculam atividade recente e toleram PID inacessível', async () => {
    const service = new ProcessService();
    const first = await service.sample();

    assert.equal(first?.length, 2);
    assert.equal(first?.[0]?.cpuPercent, null);

    state.contents.set('/proc/stat', cpu(60, 140));
    state.contents.set('/proc/42/stat', processStat(20));

    const second = await service.sample();

    assert.equal(second?.[0]?.cpuPercent, 10);
    assert.equal(second?.[1]?.cpuPercent, null);

    service.dispose();

    assert.equal(await service.sample(), null);
});

test('consulta ocupada não inicia outro subprocesso e dispose cancela o pendente', async () => {
    state.paused = true;

    const service = new ProcessService();
    const sample = service.sample();

    assert.equal(await service.sample(), null);

    service.dispose();

    assert.equal(state.subprocesses[0]?.forced, true);

    await flush();

    assert.equal(await sample, null);
    assert.equal(state.subprocesses.length, 1);
});

test('falha de ps e saída nula rejeitam e liberam a próxima consulta', async () => {
    const service = new ProcessService();

    state.processSuccess = false;

    await assert.rejects(service.sample(), /Could not query processes/);

    state.processSuccess = true;
    state.processOutput = null;

    await assert.rejects(service.sample(), /Could not query processes/);

    state.processOutput = '';

    assert.deepEqual(await service.sample(), []);

    state.contents.set('/proc/stat', 'inválido');

    await assert.rejects(service.sample(), /Invalid CPU counters/);

    service.dispose();
});

test('cancelamento durante leitura de PID interrompe os workers', async () => {
    const service = new ProcessService();

    state.onRead = path => {
        if (path === '/proc/42/stat') {
            service.dispose();
        }
    };

    assert.equal(await service.sample(), null);
});

test('cancelamento após leitura bem-sucedida da CPU descarta os dados', async () => {
    const service = new ProcessService();

    state.onRead = path => {
        if (path === '/proc/stat') {
            service.dispose();
        }
    };

    assert.equal(await service.sample(), null);
});

test('ps com transporte bem-sucedido mas código de saída inválido rejeita a leitura', async () => {
    state.processExitSuccess = false;

    await assert.rejects(new ProcessService().sample(), /Could not query processes/);
});
