import { leaf } from '@carnesen/cli';
import { execSync } from 'child_process';

export default leaf({
  commandName: 'stop',
  description: 'Stops a running container',

  async action() {
    execSync('docker stop rise-node')
  },
});
