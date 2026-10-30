import type {StatsSnapshot} from '../data/stats-snapshot.ts';
import {StatsView} from '../data/stats-view.ts';
import {formatGiB} from '../domain/memory.ts';

export class StatsPresenter {
    private readonly translate: (message: string) => string;

    constructor(translate: (message: string) => string) {
        this.translate = translate;
    }

    present(snapshot: StatsSnapshot): StatsView {
        return new StatsView(
            this.cpuText(snapshot),
            snapshot.memory === null ? '—' : `${snapshot.memory.percent}%`,
            this.cpuDetails(snapshot),
            this.ramDetails(snapshot),
            this.swapDetails(snapshot),
        );
    }

    private cpuText(snapshot: StatsSnapshot): string {
        if (snapshot.logicalCpuCount === null) {
            return '—';
        }

        return snapshot.cpuPercent === null ? '…' : `${snapshot.cpuPercent}%`;
    }

    private cpuDetails(snapshot: StatsSnapshot): string {
        if (snapshot.logicalCpuCount === null) {
            return this.translate('CPU: leitura indisponível.');
        }

        if (snapshot.cpuPercent === null) {
            return this.translate('CPU: calculando…');
        }

        return this.translate('CPU: {percent}% em uso · média de {count} CPUs lógicas')
            .replaceAll('{percent}', String(snapshot.cpuPercent))
            .replaceAll('{count}', String(snapshot.logicalCpuCount));
    }

    private ramDetails(snapshot: StatsSnapshot): string {
        if (snapshot.memory === null) {
            return this.translate('RAM: leitura indisponível.');
        }

        return this.translate('RAM: {used} usados de {total} utilizáveis')
            .replaceAll('{used}', formatGiB(snapshot.memory.usedKiB))
            .replaceAll('{total}', formatGiB(snapshot.memory.totalKiB));
    }

    private swapDetails(snapshot: StatsSnapshot): string {
        if (snapshot.memory === null) {
            return this.translate('Swap: leitura indisponível.');
        }

        if (snapshot.memory.swapTotalKiB === 0) {
            return this.translate('Swap: não configurada');
        }

        return this.translate('Swap: {used} usados de {total}')
            .replaceAll('{used}', formatGiB(snapshot.memory.swapUsedKiB))
            .replaceAll('{total}', formatGiB(snapshot.memory.swapTotalKiB));
    }
}
