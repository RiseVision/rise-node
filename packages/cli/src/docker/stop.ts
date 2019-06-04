import { leaf } from '@carnesen/cli';
import { execSync } from 'child_process';

export default leaf({
  commandName: 'stop',
  description: 'Stops a running container',

  async action() {
    // TODO check is container is running and show some info
    execSync('docker stop rise-node');
  },
});
