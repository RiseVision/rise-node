// tslint:disable:no-console
import { leaf, option } from '@carnesen/cli';
import { VERSION_CLI, VERSION_RISE } from './shared/constants';
import { debug, log } from './shared/log';
import { execCmd, getDownloadURL } from './shared/misc';
import { IVerbose, IVersion, verboseOption } from './shared/options';

export type TOptions = IVersion & IVerbose & { localhost?: boolean };

export default leaf({
  commandName: 'update-cli',
  description: 'Download the latest RISE CLI file to the current directory',

  options: {
    // TODO add version
    localhost: option({
      defaultValue: false,
      description: 'Download from localhost:8080',
      nullable: true,
      typeName: 'boolean',
    }),
    ...verboseOption,
    // TODO replace with `...versionOption`
    version: option({
      defaultValue: VERSION_RISE,
      description: 'Version number to download, eg v2.0.0 (optional)',
      nullable: true,
      typeName: 'string',
    }),
  },

  async action({ version, verbose, localhost }: TOptions) {
    try {
      await updateCLI({ verbose, localhost, version });
    } catch (err) {
      debug(err);
      if (verbose) {
        log(err);
      }
      log(
        '\nSomething went wrong.' +
          (verbose ? '' : ' Examine the log using --verbose.')
      );
      process.exit(1);
    }
  },
});

export async function updateCLI({ verbose, localhost, version }: TOptions) {
  version = version || 'latest';
  const url = localhost
    ? 'http://localhost:8080/rise'
    : getDownloadURL('rise', version);

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

  let currentVersion = await execCmd(
    './rise',
    ['version'],
    "Couldn't get the version number",
    null,
    verbose
  );
  currentVersion = currentVersion.trim();

  if (VERSION_CLI === currentVersion) {
    console.log('RISE CLI is at the latest version');
  } else {
    console.log(`RISE CLI updated to ${currentVersion}`);
  }
}
