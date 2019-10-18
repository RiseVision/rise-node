// tslint:disable:no-console
import { leaf, option } from '@carnesen/cli';
import { VERSION_CLI } from './shared/constants';
import { debug, log } from './shared/log';
import { execCmd } from './shared/misc';
import { IVerbose, verboseOption } from './shared/options';

export type TOptions = IVerbose & { localhost: boolean };

export default leaf({
  commandName: 'update-cli',
  description: 'Download the latest RISE CLI file to the current directory',

  options: {
    localhost: option({
      defaultValue: false,
      description: 'Download from localhost:8080',
      nullable: true,
      typeName: 'boolean',
    }),
    ...verboseOption,
  },

  async action({ verbose, localhost }: TOptions) {
    try {
      const url = localhost
        ? 'http://localhost:8080/rise'
        : 'https://github.com/RiseVision/rise-node/releases/latest/download/rise';

      await execCmd(
        'wget',
        ['--quiet', '-O', 'rise', url],
        "Couldn't download the file",
        null,
        verbose
      );

      await execCmd(
        'chmod',
        ['+x', 'rise'],
        "Couldn't chmod +x the file",
        null,
        verbose
      );

      let version = await execCmd(
        './rise',
        ['version'],
        "Couldn't get the version number",
        null,
        verbose
      );
      version = version.trim();

      if (VERSION_CLI === version) {
        console.log('No new version available');
      } else {
        console.log(`Updated to ${version}`);
      }
    } catch (err) {
      debug(err);
      if (verbose) {
        log(err);
      }
      log(
        '\nSomething went wrong. ' +
          (verbose ? '' : 'Examine the log using --verbose.')
      );
      process.exit(1);
    }
  },
});
