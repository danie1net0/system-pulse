export class StatsView {
    readonly cpuText: string;
    readonly ramText: string;
    readonly cpuDetails: string;
    readonly ramDetails: string;
    readonly swapDetails: string;

    constructor(
        cpuText: string,
        ramText: string,
        cpuDetails: string,
        ramDetails: string,
        swapDetails: string,
    ) {
        this.cpuText = cpuText;
        this.ramText = ramText;
        this.cpuDetails = cpuDetails;
        this.ramDetails = ramDetails;
        this.swapDetails = swapDetails;
    }
}
