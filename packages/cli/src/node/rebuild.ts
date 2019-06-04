import { leaf } from '@carnesen/cli';
import { execSync } from 'child_process';
import * as fs from 'fs';
import { NODE_DIR } from '../misc';

export default leaf({
  commandName: 'rebuild',
  description: 'Rebuilds the native node_modules for the current OS.',

  async action() {
    if (!checkNodeDirExists()) {
      return;
    }

    try {
      // TODO make sure yarn is installed
      execSync('yarn --force', { cwd: NODE_DIR });
    } catch (err) {
      console.log(
        'Error while building the container. Examine the log using --show_logs.'
      );
      console.error(err);
      process.exit(1);
    }
  },
});

function checkNodeDirExists(): boolean {
  if (!fs.existsSync(NODE_DIR) || !fs.lstatSync(NODE_DIR).isDirectory()) {
    console.log(`Error: directory '${NODE_DIR}' doesn't exist.`);
    console.log(`You can download the latest version using:`);
    console.log(`  ./rise node download`);
    return false;
  }
  return true;
}
