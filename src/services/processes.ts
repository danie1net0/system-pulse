import Gio from 'gi://Gio';
import {parseCpuStat} from '../domain/cpu.ts';
import {parseProcessList, parseProcessTimes, processUsages} from '../domain/processes.ts';
import {ProcessSnapshot} from '../data/process-snapshot.ts';
import type {ProcessTimes} from '../data/process-times.ts';
import type {ProcessUsage} from '../data/process-usage.ts';
import {readTextAsync} from '../platform/files.ts';

export class ProcessService {
    private readonly cancellable = new Gio.Cancellable();
    private subprocess: Gio.Subprocess | null = null;
    private previous: ProcessSnapshot | null = null;
    private busy = false;

    async sample(): Promise<ProcessUsage[] | null> {
        if (this.busy || this.cancellable.is_cancelled()) {
            return null;
        }

        this.busy = true;

        return this.sampleProcesses().finally(() => {
            this.busy = false;
        });
    }

    private async sampleProcesses(): Promise<ProcessUsage[] | null> {
        try {
            const processInformation = parseProcessList(await this.listProcesses());
            const processes = new Map<number, ProcessTimes>();

            // Limit concurrent IO so hosts with many PIDs do not monopolize the Shell.
            const processIterator = processInformation.values();
            const worker = async (): Promise<void> => {
                while (!this.cancellable.is_cancelled()) {
                    const {value: processInfo, done} = processIterator.next();

                    if (done) {
                        return;
                    }

                    try {
                        const content = await readTextAsync(`/proc/${processInfo.pid}/stat`, this.cancellable);

                        processes.set(processInfo.pid, parseProcessTimes(content));
                    } catch {
                        // The process may have exited or be unreadable for this user.
                    }
                }
            };

            await Promise.all(Array.from({length: Math.min(16, processInformation.length)}, worker));

            const cpu = parseCpuStat(await readTextAsync('/proc/stat', this.cancellable));
            const current = new ProcessSnapshot(cpu, processes);
            const usages = processUsages(processInformation, this.previous, current);

            if (this.cancellable.is_cancelled()) {
                return null;
            }

            this.previous = current;

            return usages;
        } catch (error) {
            if (this.cancellable.is_cancelled()) {
                return null;
            }

            this.previous = null;

            throw error;
        }
    }

    dispose(): void {
        this.cancellable.cancel();
        this.subprocess?.force_exit();
        this.subprocess = null;
        this.previous = null;
    }

    private listProcesses(): Promise<string> {
        const process = Gio.Subprocess.new(['ps', '-eo', 'pid=,rss=,comm='],
            Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE);
        this.subprocess = process;

        return new Promise((resolve, reject) => {
            process.communicate_utf8_async(null, this.cancellable, (_source, result) => {
                try {
                    const [success, stdout] = process.communicate_utf8_finish(result);

                    if (!success || !process.get_successful() || stdout === null) {
                        throw new Error('Could not query processes');
                    }

                    resolve(stdout);
                } catch (error) {
                    reject(error);
                } finally {
                    if (this.subprocess === process) {
                        this.subprocess = null;
                    }
                }
            });
        });
    }
}
