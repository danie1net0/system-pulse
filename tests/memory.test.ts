import {MemorySnapshot} from '../src/data/memory-snapshot.ts';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {parseMemory} from '../src/domain/memory.ts';
import {panelText} from '../src/domain/presentation.ts';
import type {StatsView} from '../src/data/stats-view.ts';

const memory = (total = 1000, available = 250, swapTotal = 500, swapFree = 100): string =>
    `MemTotal: ${total} kB\nMemAvailable: ${available} kB\nSwapTotal: ${swapTotal} kB\nSwapFree: ${swapFree} kB`;

test('RAM usa disponibilidade e swap usa total menos livre', () => {
    assert.deepEqual(parseMemory(memory()), new MemorySnapshot(1000, 750, 75, 500, 400));
    assert.equal(parseMemory(memory(1000, 1000, 0, 0)).swapUsedKiB, 0);
});

test('rejeita memória incompleta e valores inconsistentes', () => {
    for (const content of ['', memory(0), memory(100, 200), memory(1000, 250, 10, 20), memory(-1)]) {
        assert.throws(() => parseMemory(content));
    }
});

test('preferência da barra seleciona CPU, RAM ou ambos', () => {
    const stats: StatsView = {cpuText: '10%', ramText: '65%', cpuDetails: '', ramDetails: '', swapDetails: ''};

    assert.equal(panelText(stats, 'cpu'), 'CPU 10%');
    assert.equal(panelText(stats, 'ram'), 'RAM 65%');
    assert.equal(panelText(stats, 'both'), 'CPU 10% · RAM 65%');
});
