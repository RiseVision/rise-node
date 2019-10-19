// tslint:disable:no-console
import { leaf } from '@carnesen/cli';
import { execSync } from 'child_process';
import { util } from 'protobufjs';
import { handleCLIError } from '../shared/exceptions';
import { closeLog, debug, log } from '../shared/log';
import {
  checkSudo,
  execSyncAsUser,
  hasLocalPostgres,
  isLinux,
} from '../shared/misc';
import {
  configOption,
  IConfig,
  INetwork,
  IVerbose,
  networkOption,
  verboseOption,
} from '../shared/options';
import fs = util.fs;

export type TOptions = IConfig & INetwork & IVerbose;

export default leaf({
  commandName: 'setup',
  description: 'Setup a fresh RISE Node in a single command',

  options: {
    ...configOption,
    ...networkOption,
    ...verboseOption,
  },

  async action(options: TOptions) {
    try {
      await nodeSetup(options);
    } catch (err) {
      debug(err);
      if (options.verbose) {
        log(err);
      }
      log(
        '\nSomething went wrong.' +
          (options.verbose ? '' : ' Examine the log using --verbose.')
      );
      process.exit(1);
    } finally {
      closeLog();
    }
  },
});

function getParams(config, network) {
  const params = [];
  if (config) {
    params.push('--config', config);
  }
  if (network && network !== 'mainnet') {
    params.push('--network', network);
  }
  return params;
}

function handleDefaultConfig(config?: string) {
  if (fs.existsSync('node_config.json') && !config) {
    log('Found node_config.json, using it as the default');
    return 'node_config.json';
  }
  return config;
}

export async function nodeSetup({ config, network }: TOptions) {
  try {
    // require `sudo` for the regular `execSync`
    checkSudo();

    // handle node_config.json
    config = handleDefaultConfig(config);

    const params = getParams(config, network);

    // const rise = `${__dirname}/rise`;
    // TODO dont exec `rise` again, call the internal functions
    const rise = './rise';
    execSyncAsUser(`${rise} download`);

    // sudo some apt deps on linux
    if (isLinux()) {
      // TODO throws "needs sudo"
      execSync(`${rise} db install`, { stdio: 'inherit' });
      execSync(`${rise} node install-deps`, { stdio: 'inherit' });
    }
    hasLocalPostgres();

    const cmd = `${rise} db init ${params.join(' ')}`;
    execSyncAsUser(cmd, isLinux() ? 'postgres' : null);

    execSyncAsUser(`${rise} node download-snapshot ${params.join(' ')}`);
    execSyncAsUser(`${rise} node start --crontab ${params.join(' ')}`);
  } catch (err) {
    handleCLIError(err);
  }
}
