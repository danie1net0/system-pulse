import type {CpuSnapshot} from '../data/cpu-snapshot.ts';
import type {MemorySnapshot} from '../data/memory-snapshot.ts';
import {StatsSnapshot} from '../data/stats-snapshot.ts';
import {calculateCpuUsage, parseCpuStat} from '../domain/cpu.ts';
import {parseMemory} from '../domain/memory.ts';
import {readText} from '../platform/files.ts';

export class StatsService {
    private previousCpu: CpuSnapshot | null = null;

    sample(): StatsSnapshot {
        let cpuPercent: number | null = null;
        let logicalCpuCount: number | null = null;

        try {
            const cpu = parseCpuStat(readText('/proc/stat'));

            cpuPercent = calculateCpuUsage(this.previousCpu, cpu);
            logicalCpuCount = cpu.logicalCpuCount;
            this.previousCpu = cpu;
        } catch (error) {
            this.previousCpu = null;
            console.error('[system-pulse] Falha ao ler CPU:', error);
        }

        let memory: MemorySnapshot | null = null;

        try {
            memory = parseMemory(readText('/proc/meminfo'));
        } catch (error) {
            console.error('[system-pulse] Falha ao ler memória:', error);
        }

        return new StatsSnapshot(cpuPercent, logicalCpuCount, memory);
    }
}
