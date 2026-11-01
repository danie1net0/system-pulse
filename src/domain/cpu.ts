import {CpuSnapshot} from '../data/cpu-snapshot.ts';

export const parseCpuStat = (content: string): CpuSnapshot => {
    // guest/guest_nice are already included in user/nice.
    const line = content.match(/^cpu[ \t]+([^\n]+)/m);
    const times = line?.[1]?.trim().split(/\s+/).slice(0, 8).map(Number);
    const logicalCpuCount = (content.match(/^cpu\d+[ \t]/gm) ?? []).length;

    if (!times || times.length !== 8 || logicalCpuCount === 0 ||
        times.some(value => !Number.isSafeInteger(value) || value < 0)) {
        throw new Error('Invalid CPU counters in /proc/stat');
    }

    return new CpuSnapshot(times, logicalCpuCount);
};

export const cpuDeltas = (previous: CpuSnapshot | null, current: CpuSnapshot): readonly number[] | null => {
    if (!previous || previous.logicalCpuCount !== current.logicalCpuCount) {
        return null;
    }

    const deltas = current.times.map((value, index) => value - (previous.times[index] ?? NaN));

    if (deltas.some(value => !Number.isFinite(value) || value < 0)) {
        return null;
    }

    return deltas;
};

export const calculateCpuUsage = (previous: CpuSnapshot | null, current: CpuSnapshot): number | null => {
    const deltas = cpuDeltas(previous, current);

    if (!deltas) {
        return null;
    }

    const total = deltas.reduce((sum, value) => sum + value, 0);

    if (total === 0) {
        return null;
    }

    const idle = (deltas[3] ?? 0) + (deltas[4] ?? 0);

    return Math.round((total - idle) / total * 100);
};
