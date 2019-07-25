// tslint:disable:no-console
import { leaf } from '@carnesen/cli';
import { checkSourceDir, execCmd, getNodeDir, log } from '../shared/misc';
import { IVerbose, verboseOption } from '../shared/options';

export default leaf({
  commandName: 'rebuild-native',
  description: 'Rebuilds the native node_modules for the current OS.',
  options: verboseOption,

  async action({ verbose }: IVerbose) {
    try {
      await nodeRebuildNative({ verbose });
    } catch (err) {
      log(err);
      if (verbose) {
        console.log(err);
      }
      console.log(
        '\nError while rebuilding native node modules.' +
          (verbose ? '' : 'Examine the log using --verbose.')
      );
      process.exit(1);
    }
  },
});

export async function nodeRebuildNative({ verbose }: IVerbose) {
  await checkSourceDir();

  console.log('Rebuilding native modules...');

  const errorMsg =
    "Couldn't rebuild native modules.\n\n" +
    'Make sure you have all the dependencies installed by running:\n' +
    '$ sudo ./rise node install-deps';

  await execCmd('npm', ['rebuild'], errorMsg, { cwd: getNodeDir() }, verbose);

  console.log('Native node_modules have been rebuilt.');
}
