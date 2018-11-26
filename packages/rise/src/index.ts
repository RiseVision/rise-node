import {
  ExceptionsManager,
  ExceptionSymbols,
} from '@risevision/core-exceptions';
import { BaseCoreModule } from '@risevision/core-launchpad';
import * as SqlString from 'sequelize/lib/sql-string';
import { registerExceptions } from './exceptions/mainnet';

const oldEscape = SqlString.escape;
SqlString.escape = (val, timeZone, dialect, format) => {
  if (typeof(val) === 'bigint') {
    return oldEscape.call(SqlString, val.toString(), timeZone, dialect, format);
  } else {
    return oldEscape.call(SqlString, val, timeZone, dialect, format);
  }
};

export class CoreModule extends BaseCoreModule<any> {
  public configSchema = {};
  public constants = { addressSuffix: 'R' };

  public async initAppElements(): Promise<void> {
    const manager = this.container.get<ExceptionsManager>(
      ExceptionSymbols.manager
    );
    await registerExceptions(manager, this.container);
  }
}
