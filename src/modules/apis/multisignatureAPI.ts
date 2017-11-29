import { IDatabase } from 'pg-promise';
import { Get, JsonController, Post, Put, QueryParam } from 'routing-controllers';
import sql from '../../../sql/multisignatures';
import { catchToLoggerAndRemapError, ILogger } from '../../helpers/';
import { TransactionLogic } from '../../logic/';
import { AccountsModule } from '../accounts';
import { TransactionsModule } from '../transactions';
import { SchemaValid, ValidateSchema } from './baseAPIClass';

@JsonController('/multisignatures')
export class MultisignatureAPI {
  public schema: any;
  private db: IDatabase<any>;
  private logger: ILogger;
  private txLogic: TransactionLogic;
  private modules: {
    accounts: AccountsModule
    transactions: TransactionsModule
  };

  @Get('/accounts')
  @ValidateSchema()
  public async getAccounts(@SchemaValid({ format: 'publicKey', type: 'string' })
                           @QueryParam('publicKey', { required: true }) publicKey: string) {
    const row = await this.db.one(sql.getAccountIds, { publicKey })
      .catch(catchToLoggerAndRemapError('Multisignature#getAccountIds error', this.logger));

    const accountIds = Array.isArray(row.accountIds) ? row.accountIds : [];
    // Get all multisignature accounts associated to that have that publicKey as a signer.
    const accounts   = await this.modules.accounts.getAccounts(
      { address: { $in: accountIds }, sort: 'balance' },
      ['address', 'balance', 'multisignatures', 'multilifetime', 'multimin']);

    const items = [];
    for (const account of accounts) {
      const addresses        = account.multisignatures.map((pk) => this.modules.accounts
        .generateAddressByPublicKey(pk));
      const multisigaccounts = await this.modules.accounts.getAccounts(
        {
          address: { $in: addresses },
        },
        ['address', 'publicKey', 'balance']
      );
      items.push({ ...account, ...{ multisigaccounts } });
    }

    return { accounts: items };
  }

  @Get('/pending')
  @ValidateSchema()
  public async getPending(@SchemaValid({ format: 'publicKey', type: 'string' })
                          @QueryParam('publicKey', { required: true }) publicKey: string) {
    const txs = this.modules.transactions.getMultisignatureTransactionList(false)
      .filter((tx) => tx.senderPublicKey === publicKey);

    const toRet = [];

    for (const tx of txs) {
      let signed = false;
      if (tx.signatures && tx.signatures.length > 0) {
        let verified = false;
        for (let i = 0; i < tx.signatures.length && !verified; i++) {
          const signature = tx.signatures[i];
          verified        = this.txLogic.verifySignature(tx, publicKey, signature);
        }
        signed = verified;
      }

      if (!signed && tx.senderPublicKey === publicKey) {
        // It's signed if the sender is the publickey( signature of tx)
        signed = true;
      }

      const sender = await this.modules.accounts.getAccount({ publicKey: tx.senderPublicKey });
      if (!sender) {
        throw new Error('Sender not found');
      }

      const min        = sender.u_multimin || sender.multimin;
      const lifetime   = sender.u_multilifetime || sender.multilifetime;
      const signatures = sender.u_multisignatures || [];

      toRet.push({
        lifetime,
        max        : signatures.length,
        min,
        signed,
        transaction: tx,
      });
    }

    return { transactions: toRet };

  }

  @Post('/sign')
  public sign() {
    return Promise.reject('Method deprecated');
  }

  @Put('/')
  public addMultisignature() {
    return Promise.reject('Method deprecated');
  }
}
