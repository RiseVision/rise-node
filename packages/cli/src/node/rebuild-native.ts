// tslint:disable:no-console
import { leaf } from '@carnesen/cli';
import {
  checkNodeDirExists,
  cmdSilenceString,
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
      rebuildNative({ show_logs });
    } catch {
      console.log(
        '\nError while rebuilding native node modules. ' +
          'Examine the log using --show_logs.'
      );
      process.exit(1);
    }
  },
});

export function rebuildNative({ show_logs }: IShowLogs) {
  if (!checkNodeDirExists(true)) {
    extractSourceFile();
  }

  const silent = show_logs ? '' : cmdSilenceString;

  execCmd(
    `npm rebuild ${silent}`,
    "Couldn't rebuild native modules.\n\n" +
      'Make sure you have all the dependencies installed by running:\n' +
      '$ sudo ./rise node install-deps',
    null,
    {
      cwd: getNodeDir(),
    }
  );

  console.log('Native node_modules have been rebuilt.');
}
