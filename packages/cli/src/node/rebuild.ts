// tslint:disable:no-console
import { leaf } from '@carnesen/cli';
import { execSync } from 'child_process';
import {
  checkNodeDirExists,
  extractRiseNodeFile,
  getNodeDir,
} from '../misc';

export default leaf({
  commandName: 'rebuild',
  description: 'Rebuilds the native node_modules for the current OS.',

  async action() {
    if (!checkNodeDirExists(true)) {
      extractRiseNodeFile();
    }

    try {
      execSync('npm rebuild', {
        cwd: getNodeDir(),
      });
    } catch (err) {
      console.log(
        'Error while rebuilding native node modules. ' +
          'Examine the log using --show_logs.'
      );
      console.error(err);
      process.exit(1);
    }
  },
});
