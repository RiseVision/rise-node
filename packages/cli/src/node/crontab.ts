// tslint:disable:no-console
import { leaf } from '@carnesen/cli';
import { execSync } from 'child_process';
import { closeLog, debug, log } from '../shared/log';
import { execCmd } from '../shared/misc';
import { IVerbose, verboseOption } from '../shared/options';

export type TOptions = IVerbose & { v1?: boolean } & { removeOnly?: boolean };

export default leaf({
  commandName: 'crontab',
  description: 'Add RISE Node entries to crontab',

  options: {
    ...verboseOption,
    removeOnly: {
      defaultValue: false,
      description: "Remove old entries, but don't add new ones",
      nullable: true,
      typeName: 'boolean',
    },
    // TODO share with ./node/start
    v1: {
      defaultValue: false,
      description: 'Use the V1 config and DB',
      nullable: true,
      typeName: 'boolean',
    },
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

async function addEntries({ verbose, v1 }: TOptions) {
  let crontab = await getCrontab(verbose);
  debug('old crontab', crontab);

  const v1Suffix = v1 ? '--v1' : '';

  // TODO
  // crontab += `@daily ${__dirname}${__filename} node logRotate #managed_rise`;
  crontab += `@reboot ${__dirname}${__filename} node start ${v1Suffix} #managed_rise\n`;
  debug('new crontab', crontab);

  execSync(`echo "${crontab}" | crontab -`);
}

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
