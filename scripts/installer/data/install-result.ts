export class InstallResult {
    readonly extension: string;
    readonly launcher: string;
    readonly icon: string;
    readonly backup: string | null;

    constructor(
        extension: string,
        launcher: string,
        icon: string,
        backup: string | null,
    ) {
        this.extension = extension;
        this.launcher = launcher;
        this.icon = icon;
        this.backup = backup;
    }
}
