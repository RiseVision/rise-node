import { dPoSSymbols } from '@risevision/core-consensus-dpos';
import {
  ExceptionsManager,
  ExceptionSymbols,
} from '@risevision/core-exceptions';
import {
  IBaseTransactionType,
  IIdsHandler,
  ITransactionLogic,
  Symbols,
} from '@risevision/core-interfaces';
import { BaseCoreModule } from '@risevision/core-launchpad';
import { SigSymbols } from '@risevision/core-secondsignature';
import { TXBytes, TXSymbols } from '@risevision/core-transactions';
import { ConstantsType } from '@risevision/core-types';
import * as requireJSON5 from 'require-json5';
import * as SqlString from 'sequelize/lib/sql-string';
import * as z_schema from 'z-schema';
import { registerExceptions } from './exceptions/mainnet';
import { RiseIdsHandler } from './idsHandler';

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

  public addElementsToContainer() {
    this.container
      .bind(Symbols.helpers.idsHandler)
      .to(RiseIdsHandler)
      .inSingletonScope();
    // Register transaction types.
    this.container.bind(Symbols.generic.txtypes).toConstantValue({});
  }

  public async initAppElements(): Promise<void> {
    const manager = this.container.get<ExceptionsManager>(
      ExceptionSymbols.manager
    );
    await registerExceptions(manager, this.container);
    const types = [
      { name: TXSymbols.sendTX, type: 0 },
      { name: SigSymbols.transaction, type: 1 },
      { name: dPoSSymbols.logic.delegateTransaction, type: 2 },
      { name: dPoSSymbols.logic.voteTransaction, type: 3 },
    ];
    const toSet = this.container.get(Symbols.generic.txtypes);
    for (const { name, type } of types) {
      const tx = this.container.getNamed<IBaseTransactionType<any, any>>(
        TXSymbols.transaction,
        name
      );
      tx.type = type;
      toSet[type] = tx;
    }

    // Register schema validators
    z_schema.registerFormat('txId', (value: string) => {
      return /^[0-9]+$/.test(value);
    });

    z_schema.registerFormat('address', (str: string) => {
      // tslint:disable-next-line
      return new RegExp(
        `^[0-9]{1,20}${
          this.container.get<ConstantsType>(Symbols.generic.constants)
            .addressSuffix
        }$`
      ).test(str);
    });
  }
}
