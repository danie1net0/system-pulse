import Gio from 'gi://Gio';
import type {CpuSnapshot} from '../data/cpu-snapshot.ts';
import type {MemorySnapshot} from '../data/memory-snapshot.ts';
import {StatsSnapshot} from '../data/stats-snapshot.ts';
import {calculateCpuUsage, parseCpuStat} from '../domain/cpu.ts';
import {parseMemory} from '../domain/memory.ts';
import {readTextAsync} from '../platform/files.ts';

const settledText = (result: PromiseSettledResult<string>): string => {
    if (result.status === 'rejected') {
        throw result.reason;
    }

    return result.value;
};

export class StatsService {
    private readonly cancellable = new Gio.Cancellable();
    private previousCpu: CpuSnapshot | null = null;
    private busy = false;

    async sample(): Promise<StatsSnapshot | null> {
        if (this.busy || this.cancellable.is_cancelled()) {
            return null;
        }

        this.busy = true;

        try {
            // Read asynchronously so the Shell main loop is never blocked.
            const [stat, meminfo] = await Promise.allSettled([
                readTextAsync('/proc/stat', this.cancellable),
                readTextAsync('/proc/meminfo', this.cancellable),
            ]);

            if (this.cancellable.is_cancelled()) {
                return null;
            }

            let cpuPercent: number | null = null;
            let logicalCpuCount: number | null = null;

            try {
                const cpu = parseCpuStat(settledText(stat));

                cpuPercent = calculateCpuUsage(this.previousCpu, cpu);
                logicalCpuCount = cpu.logicalCpuCount;
                this.previousCpu = cpu;
            } catch (error) {
                this.previousCpu = null;
                console.error('[system-pulse] Failed to read CPU:', error);
            }

            let memory: MemorySnapshot | null = null;

            try {
                memory = parseMemory(settledText(meminfo));
            } catch (error) {
                console.error('[system-pulse] Failed to read memory:', error);
            }

            return new StatsSnapshot(cpuPercent, logicalCpuCount, memory);
        } finally {
            this.busy = false;
        }
    }

    dispose(): void {
        this.cancellable.cancel();
        this.previousCpu = null;
    }
}
