import { dPoSSymbols } from '@risevision/core-consensus-dpos';
import {
  ExceptionsManager,
  ExceptionSymbols,
} from '@risevision/core-exceptions';
import { IBaseTransactionType, Symbols } from '@risevision/core-interfaces';
import { BaseCoreModule } from '@risevision/core-launchpad';
import { ModelSymbols } from '@risevision/core-models';
import { SigSymbols } from '@risevision/core-secondsignature';
import { TXSymbols } from '@risevision/core-transactions';
import { ConstantsType } from '@risevision/core-types';
import * as requireJSON5 from 'require-json5';
import * as SqlString from 'sequelize/lib/sql-string';
import * as z_schema from 'z-schema';
import { registerExceptions } from './exceptions/mainnet';
import { RiseIdsHandler } from './idsHandler';
import { OldVoteTxModel } from './models';
import {
  OldRegDelegateTx,
  OldSecondSignatureTx,
  OldSendTx,
  OldVoteTx,
} from './oldtxs';
import { RISESymbols } from './symbols';

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

    // Register old tx type.
    this.container
      .bind(TXSymbols.transaction)
      .to(OldSendTx)
      .inSingletonScope()
      .whenTargetNamed(RISESymbols.oldtxs.send);
    this.container
      .bind(TXSymbols.transaction)
      .to(OldRegDelegateTx)
      .inSingletonScope()
      .whenTargetNamed(RISESymbols.oldtxs.delegate);
    this.container
      .bind(TXSymbols.transaction)
      .to(OldVoteTx)
      .inSingletonScope()
      .whenTargetNamed(RISESymbols.oldtxs.vote);
    this.container
      .bind(TXSymbols.transaction)
      .to(OldSecondSignatureTx)
      .inSingletonScope()
      .whenTargetNamed(RISESymbols.oldtxs.secondSign);

    // Register transaction types.
    this.container.bind(Symbols.generic.txtypes).toConstantValue({});
  }

  public async initAppElements(): Promise<void> {
    const manager = this.container.get<ExceptionsManager>(
      ExceptionSymbols.manager
    );
    await registerExceptions(manager, this.container);

    this.container
      .bind(ModelSymbols.model)
      .toConstructor(OldVoteTxModel)
      .whenTargetNamed(RISESymbols.models.oldVotesModel);

    const types = [
      // OLD
      { name: RISESymbols.oldtxs.send, type: 0 },
      { name: RISESymbols.oldtxs.secondSign, type: 1 },
      { name: RISESymbols.oldtxs.delegate, type: 2 },
      { name: RISESymbols.oldtxs.vote, type: 3 },
      // NEW
      { name: TXSymbols.sendTX, type: 10 },
      { name: SigSymbols.transaction, type: 11 },
      { name: dPoSSymbols.logic.delegateTransaction, type: 12 },
      { name: dPoSSymbols.logic.voteTransaction, type: 13 },
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
