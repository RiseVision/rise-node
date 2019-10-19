// tslint:disable:no-console
import { execSync } from 'child_process';
import kill from 'tree-kill';
import { promisify } from 'util';
import { debug, log } from './log';

const killAsync = promisify(kill);

/**
 * Kill a tree of processes.
 *
 * @param processName Has to be regexp-safe (or escaped)
 */
export async function killProcessTree(processName: string) {
  const list = execSync('ps x')
    .toString('utf8')
    .trim();
  debug('list of ' + processName);
  debug(list);

  const regex = new RegExp(`^\\s*(\\d+).+${processName}`, 'mg');

  const pids = list.match(regex);
  if (!pids || !pids.length) {
    log(`No processes to kill matching "${processName}"`);
    return;
  }

  const selfPID = process.pid.toString();
  const ppid = execSync(`ps -p ${selfPID} -o ppid=`)
    .toString('utf8')
    .trim();
  // TODO parallel
  for (const pid of pids) {
    // never kill yourself
    if (pid === selfPID || ppid) {
      continue;
    }
    debug(`Killing PID tree ${pid}`);
    log(`Killing PID tree ${pid}`);
    // TODO regex out the actual PID
    await killAsync(parseInt(pid, 10));
  }
}
