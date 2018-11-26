import {
  ExceptionsManager,
  ExceptionSymbols,
} from '@risevision/core-exceptions';
import { BaseCoreModule } from '@risevision/core-launchpad';
import * as requireJSON5 from 'require-json5';
import * as SqlString from 'sequelize/lib/sql-string';
import { registerExceptions } from './exceptions/mainnet';
const oldEscape = SqlString.escape;
SqlString.escape = (val, timeZone, dialect, format) => {
  if (typeof val === 'bigint') {
    return oldEscape.call(SqlString, val.toString(), timeZone, dialect, format);
  } else {
    return oldEscape.call(SqlString, val, timeZone, dialect, format);
  }
};

export class CoreModule extends BaseCoreModule<any> {
  public configSchema = {};
  // tslint:disable-next-line
  private _constants: any;

  public get constants() {
    if (!this._constants) {
      this._constants = requireJSON5(
        `${__dirname}/../etc/${process.env.NETWORK}/constants.json`,
        'utf8'
      );
    }
    return this._constants;
  }

  public async initAppElements(): Promise<void> {
    const manager = this.container.get<ExceptionsManager>(
      ExceptionSymbols.manager
    );
    await registerExceptions(manager, this.container);
  }
}
