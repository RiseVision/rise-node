// tslint:disable:no-console
import { leaf } from '@carnesen/cli';
import { execSync } from 'child_process';
import { getDockerDir } from '../shared/fs-ops';
import { log } from '../shared/misc';

export default leaf({
  commandName: 'stop',
  description: 'Stops a running container',

  async action() {
    let cmd;
    console.log('Stopping docker-compose...');

    // TODO use execCmd

    cmd = 'docker-compose stop';
    log('$', cmd);
    try {
      execSync('docker-compose stop', {
        cwd: getDockerDir(),
      });
    } catch (e) {
      log(e);
    }

    console.log('Stopping containers...');

    cmd = 'docker stop rise-node';
    log('$', cmd);
    try {
      execSync(cmd);
    } catch (e) {
      log(e);
    }

    cmd = 'docker stop rise-postgres';
    log('$', cmd);
    try {
      execSync(cmd);
    } catch (e) {
      log(e);
    }
  },
});
