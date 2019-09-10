// tslint:disable:max-classes-per-file
export class NativeModulesError extends Error {
  constructor() {
    super('Native modules need rebuilding');
  }
}

export class AddressInUseError extends Error {
  constructor() {
    super('Address in use');
  }
}

export class DBConnectionError extends Error {
  constructor() {
    super("Couldn't connect to the DB");
  }
}

export class DBCorruptedError extends Error {
  constructor() {
    super('DB seems to be corrupted');
  }
}

export class NoRiseDistFileError extends Error {
  constructor() {
    super(
      'ERROR: rise source missing.\n' +
        'You can download the latest version using:\n' +
        '  ./rise download'
    );
  }
}

export class ConditionsNotMetError extends Error {
  public name = 'ErrorCmdConditionsNotMet';
}
