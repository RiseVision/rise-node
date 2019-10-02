// tslint:disable:no-console
import { leaf } from '@carnesen/cli';
import { execSync } from 'child_process';
import { closeLog, debug, log } from '../shared/log';
import { execCmd } from '../shared/misc';
import {
  configOption,
  IConfig,
  INetwork,
  IV1,
  IVerbose,
  networkOption,
  v1Option,
  verboseOption,
} from '../shared/options';

export type TOptions = IVerbose &
  IV1 & { removeOnly?: boolean } & INetwork &
  IConfig;

export default leaf({
  commandName: 'crontab',
  description: 'Manages RISE Node entries in crontab',

  options: {
    ...configOption,
    ...verboseOption,
    removeOnly: {
      defaultValue: false,
      description: "Remove old entries, but don't add new ones",
      nullable: true,
      typeName: 'boolean',
    },
    ...networkOption,
    ...v1Option,
  },

  async action({ verbose, v1, removeOnly }: TOptions) {
    try {
      await nodeCrontab({ verbose, v1, removeOnly });
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
    } finally {
      closeLog();
    }
  },
});

export async function nodeCrontab({ verbose, v1, removeOnly }: TOptions) {
  await removeEntries({ verbose });
  if (!removeOnly) {
    await addEntries({ verbose, v1 });
    log('RISE entries added to crontab');
  } else {
    log('RISE entries removed from crontab');
  }
}

async function addEntries({ verbose, v1, config, network }: TOptions) {
  let crontab = await getCrontab(verbose);
  debug('old crontab', crontab);
  const params = [];

  if (v1) {
    params.push('--v1');
  }

  if (network) {
    params.push(`--network ${network}`);
  }

  if (config) {
    params.push(`--config ${config}`);
  }

  const cmd = `${__dirname}${__filename} node start ${params.join(' ')}`;
  // TODO
  // crontab += `@daily ${__dirname}${__filename} node logRotate #managed_rise`;
  crontab += `@reboot ${cmd} #managed_rise\n`;
  debug('new crontab', crontab);

  execSync(`echo "${crontab}" | crontab -`);
}

// TODO share with /src/db/crontab
async function removeEntries({ verbose }: TOptions) {
  let crontab = await getCrontab(verbose);
  debug('old crontab', crontab);

  crontab = crontab.replace(/^.+#managed_rise\n?/gm, '');
  debug('new crontab', crontab);

  execSync(`echo "${crontab.trim()}" | crontab -`);
}

async function getCrontab(verbose = false): Promise<string> {
  return await execCmd(
    'crontab',
    ['-l'],
    "Couldn't fetch crontab's content",
    null,
    verbose
  );
}
