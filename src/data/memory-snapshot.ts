export class MemorySnapshot {
    readonly totalKiB: number;
    readonly usedKiB: number;
    readonly percent: number;
    readonly swapTotalKiB: number;
    readonly swapUsedKiB: number;

    constructor(
        totalKiB: number,
        usedKiB: number,
        percent: number,
        swapTotalKiB: number,
        swapUsedKiB: number,
    ) {
        this.totalKiB = totalKiB;
        this.usedKiB = usedKiB;
        this.percent = percent;
        this.swapTotalKiB = swapTotalKiB;
        this.swapUsedKiB = swapUsedKiB;
    }
}
