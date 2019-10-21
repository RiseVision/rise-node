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
export async function killProcessTree(processName: string, verbose = false) {
  const list = execSync(`ps ax | grep ${processName}`)
    .toString('utf8')
    .trim();
  debug('list of ' + processName);
  debug(list);

  // get the parent PID of this process
  const selfPID = process.pid.toString();
  const ppid = execSync(`ps -p ${selfPID} -o ppid=`)
    .toString('utf8')
    .trim();

  // TODO parallel
  for (const line of list.split('\n')) {
    try {
      // skip gres
      if (line.includes('grep')) {
        continue;
      }
      const pid = line.match(/^\s*(\d+)/)[1];
      debug(`PID ${pid}`);
      // never kill yourself
      if (pid === selfPID || pid === ppid) {
        continue;
      }
      if (verbose) {
        log(`Killing PID tree ${pid} of ${processName}`);
      }
      await killAsync(parseInt(pid, 10));
    } catch (err) {
      log(err);
    }
  }
}
