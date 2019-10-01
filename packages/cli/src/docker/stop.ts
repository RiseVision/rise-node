// tslint:disable:no-console
import { leaf } from '@carnesen/cli';
import { closeLog } from '../shared/log';
import { execCmd } from '../shared/misc';

export default leaf({
  commandName: 'stop',
  description: 'Stops a running container',

  async action() {
    // TODO check is container is running and show some info
    await execCmd(
      'docker',
      ['stop', 'rise-node'],
      "Couldn't stop the container"
    );
    closeLog();
  },
});
