import {ProcessTimes} from '../src/data/process-times.ts';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {parseProcessList, parseProcessTimes, processUsages, rankProcesses} from '../src/domain/processes.ts';
import {ProcessInfo} from '../src/data/process-info.ts';
import type {ProcessSnapshot} from '../src/data/process-snapshot.ts';
import type {ProcessUsage} from '../src/data/process-usage.ts';

const info: ProcessInfo = {pid: 42, name: 'aplicativo', rssKiB: 2048};
const snapshot = (ticks: number, total: number, startTime = 100): ProcessSnapshot => ({
    cpu: {times: [total, 0, 0, 0, 0, 0, 0, 0], logicalCpuCount: 4},
    processes: new Map([[42, {ticks, startTime}]]),
});

test('interpreta ps sem perder nomes com espaços e ignora linhas inválidas', () => {
    assert.deepEqual(parseProcessList(' 42 2048 aplicativo com espaço\n0 1 inválido\n43 0 kernel\nruído'),
        [new ProcessInfo(42, 'aplicativo com espaço', 2048)]);
});

test('localiza os campos de /proc/PID/stat mesmo com parênteses no nome', () => {
    const fields = Array<string>(22).fill('0');

    fields[0] = 'R'; fields[11] = '120'; fields[12] = '30'; fields[19] = '98765';

    assert.deepEqual(parseProcessTimes(`42 (nome (com) espaços)) ${fields.join(' ')}`),
        new ProcessTimes(150, 98765));
    assert.throws(() => parseProcessTimes('42 (curto) R 0'));
    assert.throws(() => parseProcessTimes('não é stat'));
});

test('CPU do processo mede o intervalo e normaliza pela capacidade total', () => {
    const before = snapshot(1000, 10000);
    const after = snapshot(1010, 10100);

    assert.equal(processUsages([info], before, after)[0]?.cpuPercent, 10);
    assert.equal(processUsages([info], null, after)[0]?.cpuPercent, null);
});

test('PID reutilizado, encerrado, CPU alterada e contadores reiniciados não inventam uso', () => {
    const before = snapshot(1000, 10000);

    for (const after of [snapshot(1010, 10100, 200), snapshot(10, 10100), snapshot(1010, 10000),
        snapshot(1010, 9000), {...snapshot(1010, 10100), processes: new Map()},
        {...snapshot(1010, 10100), cpu: {times: [10100, 0, 0, 0, 0, 0, 0, 0], logicalCpuCount: 8}}]) {
        assert.equal(processUsages([info], before, after)[0]?.cpuPercent, null);
    }
});

test('ranking alterna métrica, limita resultados e deixa amostras pendentes no final', () => {
    const rows: ProcessUsage[] = [
        {...info, pid: 1, rssKiB: 9000, cpuPercent: null},
        {...info, pid: 2, rssKiB: 2000, cpuPercent: 30},
        {...info, pid: 3, rssKiB: 4000, cpuPercent: 10},
    ];

    assert.deepEqual(rankProcesses(rows, 'ram', 2).map(row => row.pid), [1, 3]);
    assert.deepEqual(rankProcesses(rows, 'cpu', 3).map(row => row.pid), [2, 3, 1]);
    assert.deepEqual(rows.map(row => row.pid), [1, 2, 3]);
});

test('processo novo aguarda outra amostra e empates usam o PID', () => {
    const current = snapshot(20, 100);
    const previous = {...snapshot(10, 50), processes: new Map()};

    assert.equal(processUsages([info], previous, current)[0]?.cpuPercent, null);

    const rows = [
        {...info, pid: 2, cpuPercent: null},
        {...info, pid: 1, cpuPercent: null},
    ];

    assert.deepEqual(rankProcesses(rows, 'cpu', 2).map(process => process.pid), [1, 2]);
    assert.deepEqual(rankProcesses(rows, 'ram', 2).map(process => process.pid), [1, 2]);
    assert.equal(processUsages([info], snapshot(0, 0), snapshot(200, 100))[0]?.cpuPercent, 100);
});
