export class ProcessInfo {
    readonly pid: number;
    readonly name: string;
    readonly rssKiB: number;

    constructor(
        pid: number,
        name: string,
        rssKiB: number,
    ) {
        this.pid = pid;
        this.name = name;
        this.rssKiB = rssKiB;
    }
}
