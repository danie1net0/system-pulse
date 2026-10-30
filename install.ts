#!/usr/bin/env node
import {fileURLToPath} from 'node:url';
import {setup} from './scripts/installer/setup.ts';

try {
    setup(process.argv.slice(2), fileURLToPath(new URL('.', import.meta.url)));
} catch (error) {
    console.error(`Instalação não concluída: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
}
