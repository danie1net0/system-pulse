export class InstallOptions {
    readonly help: boolean;
    readonly development: boolean;
    readonly skipBuild: boolean;
    readonly withSystemMonitor: boolean;
    readonly destination: string | null;

    constructor(
        help: boolean,
        development: boolean,
        skipBuild: boolean,
        withSystemMonitor: boolean,
        destination: string | null,
    ) {
        this.help = help;
        this.development = development;
        this.skipBuild = skipBuild;
        this.withSystemMonitor = withSystemMonitor;
        this.destination = destination;
    }
}
