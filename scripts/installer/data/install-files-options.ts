export class InstallFilesOptions {
    readonly source: string;
    readonly dataHome: string;
    readonly development: boolean;

    constructor(
        source: string,
        dataHome: string,
        development: boolean,
    ) {
        this.source = source;
        this.dataHome = dataHome;
        this.development = development;
    }
}
