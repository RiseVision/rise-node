// tslint:disable:no-console
import { leaf } from '@carnesen/cli';
import {
  checkNodeDirExists,
  execCmd,
  extractSourceFile,
  getNodeDir,
} from '../shared/misc';
import { IShowLogs, showLogsOption } from '../shared/options';

export default leaf({
  commandName: 'rebuild-native',
  description: 'Rebuilds the native node_modules for the current OS.',
  options: showLogsOption,

  async action({ show_logs }: IShowLogs) {
    try {
      await nodeRebuildNative({ show_logs });
    } catch {
      console.log(
        '\nError while rebuilding native node modules. ' +
          'Examine the log using --show_logs.'
      );
      process.exit(1);
    }
  },
});

export async function nodeRebuildNative({ show_logs }: IShowLogs) {
  if (!checkNodeDirExists(true)) {
    await extractSourceFile();
  }

  console.log('Rebuilding native modules...');

  const errorMsg =
    "Couldn't rebuild native modules.\n\n" +
    'Make sure you have all the dependencies installed by running:\n' +
    '$ sudo ./rise node install-deps';

  await execCmd('npm', ['rebuild'], errorMsg, { cwd: getNodeDir() }, show_logs);

  console.log('Native node_modules have been rebuilt.');
}
