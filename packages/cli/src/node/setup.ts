// tslint:disable:no-console
import { leaf, option } from '@carnesen/cli';
import { util } from 'protobufjs';
import { dbInit } from '../db/init';
import { dbAddRepos, dbInstall } from '../db/install';
import { dbStop } from '../db/stop';
import { download } from '../download';
import { VERSION_RISE } from '../shared/constants';
import { handleCLIError } from '../shared/exceptions';
import { killProcessTree } from '../shared/kill';
import { closeLog, debug, log } from '../shared/log';
import { checkSudo, hasLocalPostgres, isLinux } from '../shared/misc';
import {
  configOption,
  IConfig,
  INetwork,
  IVerbose,
  networkOption,
  verboseOption,
} from '../shared/options';
import { updateCLI } from '../update-cli';
import { nodeDownloadSnapshot } from './download-snapshot';
import { nodeInstallDeps } from './install-deps';
import { nodeStart } from './start';
import { nodeStop } from './stop';
import fs = util.fs;

export type TOptions = IConfig & INetwork & IVerbose & { skipKill?: boolean };

export default leaf({
  commandName: 'setup',
  description: 'Setup a fresh RISE Node in a single command',

  options: {
    ...configOption,
    ...networkOption,
    ...verboseOption,
    'skip-kill': option({
      defaultValue: false,
      description: 'Dont kill node and postgres processes',
      nullable: true,
      typeName: 'boolean',
    }),
  },

  async action(options: TOptions) {
    try {
      options.skipKill = options['skip-kill'];
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

function handleDefaultConfig(config?: string) {
  if (fs.existsSync('node_config.json') && !config) {
    log('Found node_config.json, using it as the default');
    return 'node_config.json';
  }
  return config;
}

async function stop(verbose, config, network) {
  try {
    await nodeStop({ verbose });
  } catch {
    // empty
  }

  try {
    await dbStop({ config, network, verbose });
  } catch {
    // empty
  }
}

export async function nodeSetup({
  config,
  network,
  verbose,
  skipKill,
}: TOptions) {
  try {
    // require `sudo`
    checkSudo();

    // update
    await download({ verbose, version: VERSION_RISE }, true);
    await updateCLI({ verbose, version: VERSION_RISE });

    // handle node_config.json
    config = handleDefaultConfig(config);

    // kill the v1 stuff (optional)
    if (!skipKill) {
      await killProcessTree('postgres');
      await killProcessTree('node');
    }

    // try to clean things up first
    await stop(verbose, config, network);

    if (isLinux()) {
      dbAddRepos({ verbose });
      await dbInstall({ verbose, skipRepo: true });
      await nodeInstallDeps({ verbose, skipRepo: true });
    }
    hasLocalPostgres();

    await dbInit({ config, network, verbose });
    await nodeDownloadSnapshot({ config, network, verbose });
    await nodeStart({ config, network, verbose, crontab: true });
  } catch (err) {
    handleCLIError(err);
  }
}
