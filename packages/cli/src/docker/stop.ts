// tslint:disable:no-console
import { leaf } from '@carnesen/cli';
import { execSync } from 'child_process';
import { execCmd } from '../shared/misc';

export default leaf({
  commandName: 'stop',
  description: 'Stops a running container',

  async action() {
    // TODO check is container is running and show some info
    execCmd('docker stop rise-node', "Couldn't stop the container");
  },
});
