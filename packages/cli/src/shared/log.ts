// tslint:disable:no-console
import { debug as createDebug } from 'debug';
import fs from 'fs';
import { sync as mkdirpSync } from 'mkdirp';
import { LOGS_DIR, SHELL_LOG_FILE } from './constants';

export const debug = createDebug('rise-cli');

// open the shell log file (no IoC)
export const logHandler = createShellLogHandler();

function createShellLogHandler(): number {
  mkdirpSync(LOGS_DIR);
  const fd = fs.openSync(SHELL_LOG_FILE, 'a');
  appendHeader(fd);

  return fd;
}

export function log(...msg: string[]) {
  fs.writeSync(logHandler, msg.join('\n') + '\n');
  console.log(...msg);
}

export function closeLog() {
  fs.closeSync(logHandler);
}

function appendHeader(fd: number) {
  // TODO
}
