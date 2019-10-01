// tslint:disable:no-console
import { leaf } from '@carnesen/cli';
import { execSync } from 'child_process';
import { getDockerDir } from '../shared/fs-ops';
import { closeLog, debug, log } from '../shared/log';

export default leaf({
  commandName: 'stop',
  description: 'Stops a running container',

  async action() {
    let cmd;
    log('Stopping docker-compose...');

    // TODO use execCmd

    cmd = 'docker-compose stop';
    debug('$', cmd);
    try {
      execSync('docker-compose stop', {
        cwd: getDockerDir(),
      });
    } catch (e) {
      debug(e);
    }

    log('Stopping containers...');

    cmd = 'docker stop rise-node';
    debug('$', cmd);
    try {
      execSync(cmd);
    } catch (e) {
      debug(e);
    }

    cmd = 'docker stop rise-postgres';
    debug('$', cmd);
    try {
      execSync(cmd);
    } catch (e) {
      debug(e);
    }

    closeLog();
  },
});
