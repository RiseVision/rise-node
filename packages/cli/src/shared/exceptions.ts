// tslint:disable:max-classes-per-file

import { log } from './log';

/**
 * User facing error class.
 */
export class CLIError extends Error {}

export class NativeModulesError extends CLIError {
  constructor() {
    super('Native modules need rebuilding');
  }
}

export class AddressInUseError extends CLIError {
  constructor() {
    super('Address currently in use. Is another node running?');
  }
}

export class DBConnectionError extends CLIError {
  constructor() {
    super("Couldn't connect to the DB");
  }
}

export class DBCorruptedError extends CLIError {
  constructor() {
    super('DB seems to be corrupted');
  }
}

export class NoRiseDistFileError extends CLIError {
  constructor() {
    super(
      'ERROR: rise source missing.\n' +
        'You can download the latest version using:\n' +
        '  ./rise download'
    );
  }
}

export class DBNotInstalledError extends CLIError {
  constructor() {
    super('Install PostgreSQL first:\n$ sudo ./rise node install-deps');
  }
}

export class ConditionsNotMetError extends CLIError {}

export class ConfigMissingError extends ConditionsNotMetError {
  constructor(path: string) {
    super(`Config file missing:\n${path}`);
  }
}

export function handleCLIError(err: CLIError, rethrow = true) {
  if (err instanceof CLIError) {
    log('ERROR: ' + err.message);
  }
  if (rethrow) {
    throw err;
  }
}
