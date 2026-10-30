import {MemorySnapshot} from '../data/memory-snapshot.ts';

export const parseMemory = (content: string): MemorySnapshot => {
    const value = (key: string): number => {
        const match = content.match(new RegExp(`^${key}:\\s+(\\d+)\\s+kB$`, 'm'));
        const number = match ? Number(match[1]) : NaN;

        if (!Number.isSafeInteger(number) || number < 0) {
            throw new Error(`Valor inválido de ${key} em /proc/meminfo`);
        }

        return number;
    };

    const totalKiB = value('MemTotal');
    const availableKiB = value('MemAvailable');
    const swapTotalKiB = value('SwapTotal');
    const swapFreeKiB = value('SwapFree');

    if (totalKiB === 0 || availableKiB > totalKiB || swapFreeKiB > swapTotalKiB) {
        throw new Error('Contadores de memória inconsistentes');
    }

    const usedKiB = totalKiB - availableKiB;

    return new MemorySnapshot(totalKiB, usedKiB, Math.round(usedKiB / totalKiB * 100),
        swapTotalKiB, swapTotalKiB - swapFreeKiB);
};

export const formatGiB = (kibibytes: number): string => {
    return `${(kibibytes / 1024 / 1024).toFixed(1)} GiB`;
};
