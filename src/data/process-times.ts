export class ProcessTimes {
    readonly ticks: number;
    readonly startTime: number;

    constructor(
        ticks: number,
        startTime: number,
    ) {
        this.ticks = ticks;
        this.startTime = startTime;
    }
}
