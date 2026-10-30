export class ProcessUsage {
    readonly pid: number;
    readonly name: string;
    readonly rssKiB: number;
    readonly cpuPercent: number | null;

    constructor(
        pid: number,
        name: string,
        rssKiB: number,
        cpuPercent: number | null,
    ) {
        this.pid = pid;
        this.name = name;
        this.rssKiB = rssKiB;
        this.cpuPercent = cpuPercent;
    }
}
