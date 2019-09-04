// tslint:disable:no-console
import { leaf } from '@carnesen/cli';
import { execSync } from 'child_process';
import { execCmd, log } from '../shared/misc';
import { IVerbose, verboseOption } from '../shared/options';
import { crontabRemove } from './remove';

export type TOptions = IVerbose;

export default leaf({
  commandName: 'download',
  description:
    'Download a release file from GitHub and extracts it in ' +
    'the current directory.',

  options: {
    ...verboseOption,
  },

  async action({ verbose }: TOptions) {
    try {
      await crontabRemove({ verbose });
      await crontabAdd({ verbose });
      console.log('RISE entries added to crontab');
    } catch (err) {
      log(err);
      if (verbose) {
        console.log(err);
      }
      console.log(
        '\nSomething went wrong. ' +
          (verbose ? '' : 'Examine the log using --verbose.')
      );
      process.exit(1);
    }
  },
});

export async function crontabAdd({ verbose }: TOptions) {
  let crontab = await execCmd(
    'crontab',
    ['-l'],
    "Couldn't fetch crontab's content",
    null,
    verbose
  );
  log('old crontab', crontab);

  crontab = crontab.replace(/^.+#managed_rise/g, '');
  log('new crontab', crontab);

  execSync(`echo "${crontab}" | crontab -`);
}
