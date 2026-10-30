export class CpuSnapshot {
    readonly times: readonly number[];
    readonly logicalCpuCount: number;

    constructor(
        times: readonly number[],
        logicalCpuCount: number,
    ) {
        this.times = times;
        this.logicalCpuCount = logicalCpuCount;
    }
}
