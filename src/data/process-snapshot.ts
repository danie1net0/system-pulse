import type {CpuSnapshot} from './cpu-snapshot.ts';
import type {ProcessTimes} from './process-times.ts';

export class ProcessSnapshot {
    readonly cpu: CpuSnapshot;
    readonly processes: ReadonlyMap<number, ProcessTimes>;

    constructor(
        cpu: CpuSnapshot,
        processes: ReadonlyMap<number, ProcessTimes>,
    ) {
        this.cpu = cpu;
        this.processes = processes;
    }
}
