import * as z_schema from 'z-schema';
import { Ed, ILogger, Sequence, TransactionType } from '../helpers/';
import { TransactionLogic } from '../logic/';
import { SecondSignatureTransaction } from '../logic/transactions/';
import { AccountsModule } from './accounts';
import { SystemModule } from './system';
import { TransactionsModule } from './transactions';

// tslint:disable-next-line
export type SignatureLibrary = {
  schema: z_schema,
  ed: Ed,
  logger: ILogger,
  balancesSequence: Sequence,
  logic: {
    transaction: TransactionLogic
  }
};

export class SignaturesModule {
  private signatureTxType: SecondSignatureTransaction;
  private modules: { accounts: AccountsModule, transactions: TransactionsModule, system: SystemModule } | null = null;

  constructor(public library: SignatureLibrary) {
    this.signatureTxType = this.library.logic.transaction.attachAssetType(
      TransactionType.SIGNATURE,
      new SecondSignatureTransaction({
        logger: this.library.logger,
        schema: this.library.schema,
      })
    );
  }

  public isLoaded() {
    return !!this.modules;
  }

  public onBind(mods: { accounts: AccountsModule, transactions: TransactionsModule, system: SystemModule }) {
    this.modules = {
      accounts    : mods.accounts,
      system      : mods.system,
      transactions: mods.transactions,
    };

    this.signatureTxType.bind(mods.accounts, mods.system);
  }

}
