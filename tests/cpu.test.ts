import assert from 'node:assert/strict';
import {test} from 'node:test';
import {calculateCpuUsage, parseCpuStat} from '../src/domain/cpu.ts';

const snapshot = (times: number[], cores = 2) => parseCpuStat(
    `cpu  ${times.join(' ')}\n` +
    Array.from({length: cores}, (_, index) => `cpu${index} 0 0 0 0 0 0 0 0`).join('\n'),
);

const zero = snapshot([0, 0, 0, 0, 0, 0, 0, 0]);

test('a primeira leitura não inventa um percentual', () => {
    assert.equal(calculateCpuUsage(null, zero), null);
});

test('mede 0%, 50% e 100% sobre o intervalo, não sobre o tempo de boot', () => {
    const previous = snapshot([1000, 0, 1000, 1000, 0, 0, 0, 0]);

    assert.equal(calculateCpuUsage(previous, snapshot([1000, 0, 1000, 1100, 0, 0, 0, 0])), 0);
    assert.equal(calculateCpuUsage(previous, snapshot([1025, 0, 1025, 1050, 0, 0, 0, 0])), 50);
    assert.equal(calculateCpuUsage(previous, snapshot([1050, 0, 1050, 1000, 0, 0, 0, 0])), 100);
});

test('iowait é tratado como tempo não ocupado', () => {
    assert.equal(calculateCpuUsage(zero, snapshot([20, 0, 0, 30, 50, 0, 0, 0])), 20);
});

test('guest e guest_nice não são somados duas vezes', () => {
    assert.equal(calculateCpuUsage(zero, snapshot([20, 10, 0, 70, 0, 0, 0, 0, 20, 10])), 30);
});

test('sem novos ticks, ou após regressão de contador, aguarda outra amostra', () => {
    assert.equal(calculateCpuUsage(zero, zero), null);

    const previous = snapshot([10, 0, 0, 10, 10, 0, 0, 0]);

    assert.equal(calculateCpuUsage(previous, snapshot([20, 0, 0, 20, 9, 0, 0, 0])), null);
    assert.equal(calculateCpuUsage(previous, zero), null);
});

test('mudança na quantidade de CPUs reinicia a amostragem', () => {
    assert.equal(calculateCpuUsage(zero, snapshot([20, 0, 0, 80, 0, 0, 0, 0], 4)), null);
});

test('rejeita dados incompletos, negativos ou não numéricos', () => {
    for (const content of ['', 'cpu 1 2 3\ncpu0 0',
        'cpu 0 0 x 0 0 0 0 0\ncpu0 0', 'cpu -1 0 0 0 0 0 0 0\ncpu0 0',
        'cpu 0 0 0 0 0 0 0 0']) {
        assert.throws(() => parseCpuStat(content), /Contadores de CPU inválidos/);
    }
});

test('dados incompletos da amostra anterior não produzem percentual', () => {
    assert.equal(calculateCpuUsage({times: [], logicalCpuCount: 2}, zero), null);
});

test('soma apenas contadores presentes quando a leitura contém menos campos', () => {
    const previous = {times: [0], logicalCpuCount: 1};

    assert.equal(calculateCpuUsage(previous, {times: [10], logicalCpuCount: 1}), 100);
});
