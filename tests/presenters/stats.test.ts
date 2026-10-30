import assert from 'node:assert/strict';
import {test} from 'node:test';
import {MemorySnapshot} from '../../src/data/memory-snapshot.ts';
import {StatsSnapshot} from '../../src/data/stats-snapshot.ts';
import {StatsPresenter} from '../../src/presenters/stats.ts';

const presenter = new StatsPresenter(message => message);

test('apresenta indisponibilidade e a primeira amostra sem inventar CPU', () => {
    const unavailable = presenter.present(new StatsSnapshot(null, null, null));

    assert.equal(unavailable.cpuText, '—');
    assert.equal(unavailable.ramText, '—');
    assert.equal(unavailable.cpuDetails, 'CPU: leitura indisponível.');
    assert.equal(unavailable.ramDetails, 'RAM: leitura indisponível.');
    assert.equal(unavailable.swapDetails, 'Swap: leitura indisponível.');

    const calculating = presenter.present(new StatsSnapshot(null, 4, null));

    assert.equal(calculating.cpuText, '…');
    assert.equal(calculating.cpuDetails, 'CPU: calculando…');
});

test('formata percentuais e memória mantendo unidades e ausência de swap', () => {
    const memory = new MemorySnapshot(2097152, 1048576, 50, 1048576, 524288);
    const view = presenter.present(new StatsSnapshot(25, 8, memory));

    assert.equal(view.cpuText, '25%');
    assert.equal(view.cpuDetails, 'CPU: 25% em uso · média de 8 CPUs lógicas');
    assert.equal(view.ramText, '50%');
    assert.equal(view.ramDetails, 'RAM: 1.0 GiB usados de 2.0 GiB utilizáveis');
    assert.equal(view.swapDetails, 'Swap: 0.5 GiB usados de 1.0 GiB');

    const noSwap = presenter.present(new StatsSnapshot(0, 1, new MemorySnapshot(1, 0, 0, 0, 0)));

    assert.equal(noSwap.swapDetails, 'Swap: não configurada');
});

test('traduz a mensagem completa antes de substituir seus parâmetros', () => {
    const translated = new StatsPresenter(message => message.replace('CPU: {percent}% em uso · média de {count} CPUs lógicas',
        '{count} processors: {percent}%'));
    assert.equal(translated.present(new StatsSnapshot(30, 4, null)).cpuDetails, '4 processors: 30%');
});
