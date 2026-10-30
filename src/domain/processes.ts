import {cpuDeltas} from './cpu.ts';
import {ProcessInfo} from '../data/process-info.ts';
import type {ProcessSnapshot} from '../data/process-snapshot.ts';
import {ProcessTimes} from '../data/process-times.ts';
import {ProcessUsage} from '../data/process-usage.ts';
import type {ProcessMetric} from './types.ts';

export const parseProcessList = (output: string): ProcessInfo[] => {
    const processes: ProcessInfo[] = [];

    for (const line of output.split('\n')) {
        const match = line.trim().match(/^(\d+)\s+(\d+)\s+(.+)$/);

        if (!match?.[3]) {
            continue;
        }

        const pid = Number(match[1]);
        const rssKiB = Number(match[2]);

        if (Number.isSafeInteger(pid) && pid > 0 && Number.isSafeInteger(rssKiB) && rssKiB > 0) {
            processes.push(new ProcessInfo(pid, match[3], rssKiB));
        }
    }

    return processes;
};

export const parseProcessTimes = (content: string): ProcessTimes => {
    // comm pode conter espaços e parênteses; os campos numéricos vêm após o último ')'.
    const nameEnd = content.lastIndexOf(')');

    if (nameEnd < 0 || !/^\d+ \(/.test(content)) {
        throw new Error('Formato inválido de /proc/PID/stat');
    }

    const fields = content.slice(nameEnd + 1).trim().split(/\s+/);
    const userTicks = Number(fields[11]); // campo 14
    const systemTicks = Number(fields[12]); // campo 15
    const startTime = Number(fields[19]); // campo 22: distingue reuso do PID

    if ([userTicks, systemTicks, startTime].some(value => !Number.isSafeInteger(value) || value < 0)) {
        throw new Error('Contadores inválidos de /proc/PID/stat');
    }

    return new ProcessTimes(userTicks + systemTicks, startTime);
};

export const processUsages = (processInformation: readonly ProcessInfo[], previous: ProcessSnapshot | null,
    current: ProcessSnapshot): ProcessUsage[] => {
    const deltas = cpuDeltas(previous?.cpu ?? null, current.cpu);
    const total = deltas?.reduce((sum, value) => sum + value, 0) ?? 0;

    return processInformation.map(processInfo => {
        const before = previous?.processes.get(processInfo.pid);
        const after = current.processes.get(processInfo.pid);
        let cpuPercent: number | null = null;

        if (total > 0 && before && after && before.startTime === after.startTime && after.ticks >= before.ticks) {
            cpuPercent = Math.min(100, (after.ticks - before.ticks) / total * 100);
        }

        return new ProcessUsage(processInfo.pid, processInfo.name, processInfo.rssKiB, cpuPercent);
    });
};

export const rankProcesses = (processes: readonly ProcessUsage[], metric: ProcessMetric, count: number): ProcessUsage[] => {
    const score = (process: ProcessUsage): number => metric === 'ram' ? process.rssKiB : process.cpuPercent ?? -1;

    return [...processes].sort((firstProcess, secondProcess) => score(secondProcess) - score(firstProcess) || firstProcess.pid - secondProcess.pid).slice(0, count);
};
