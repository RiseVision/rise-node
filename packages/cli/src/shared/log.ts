// tslint:disable:no-console
import { debug as createDebug } from 'debug';
import fs from 'fs';
import path from 'path';
import { LOGS_DIR } from './constants';

export const debug = createDebug('rise-cli');

// open the shell log file (no IoC)
export const logHandler = createShellLogHeader(
  fs.openSync(path.join(LOGS_DIR, 'shell'), 'w')
);

export function log(...msg: string[]) {
  fs.writeSync(logHandler, msg.join('\n'));
  console.log(...msg);
}

export async function closeLog() {
  fs.closeSync(logHandler);
}

function createShellLogHeader(fd: number): number {
  // TODO
  return fd;
}
