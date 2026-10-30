import type {MemorySnapshot} from './memory-snapshot.ts';

export class StatsSnapshot {
    readonly cpuPercent: number | null;
    readonly logicalCpuCount: number | null;
    readonly memory: MemorySnapshot | null;

    constructor(cpuPercent: number | null, logicalCpuCount: number | null, memory: MemorySnapshot | null) {
        this.cpuPercent = cpuPercent;
        this.logicalCpuCount = logicalCpuCount;
        this.memory = memory;
    }
}
