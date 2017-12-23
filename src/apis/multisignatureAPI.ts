import { inject, injectable } from 'inversify';
import { IDatabase } from 'pg-promise';
import { Get, JsonController, Post, Put, QueryParam } from 'routing-controllers';
import * as z_schema from 'z-schema';
import { catchToLoggerAndRemapError, ILogger} from '../helpers';
import { IoCSymbol } from '../helpers/decorators/iocSymbol';
import { SchemaValid, ValidateSchema } from '../helpers/decorators/schemavalidators';
import { ITransactionLogic } from '../ioc/interfaces/logic';
import { IAccountsModule, ITransactionsModule } from '../ioc/interfaces/modules';
import { Symbols } from '../ioc/symbols';
import sql from '../sql/multisignatures';

@JsonController('/api/multisignatures')
@injectable()
@IoCSymbol(Symbols.api.multisignatures)
export class MultisignatureAPI {
  // Generics
  @inject(Symbols.generic.zschema)
  public schema: z_schema;
  @inject(Symbols.generic.db)
  private db: IDatabase<any>;

  // Helpers
  @inject(Symbols.helpers.logger)
  private logger: ILogger;

  // Logic
  @inject(Symbols.logic.transaction)
  private txLogic: ITransactionLogic;

  // Modules
  @inject(Symbols.modules.accounts)
  private accounts: IAccountsModule;
  @inject(Symbols.modules.transactions)
  private transactions: ITransactionsModule;

  @Get('/accounts')
  @ValidateSchema()
  public async getAccounts(@SchemaValid({ format: 'publicKey', type: 'string' })
                           @QueryParam('publicKey', { required: true }) publicKey: string) {
    const row = await this.db.one(sql.getAccountIds, { publicKey })
      .catch(catchToLoggerAndRemapError('Multisignature#getAccountIds error', this.logger));

    const accountIds = Array.isArray(row.accountIds) ? row.accountIds : [];
    // Get all multisignature accounts associated to that have that publicKey as a signer.
    const accounts   = await this.accounts.getAccounts(
      { address: { $in: accountIds }, sort: 'balance' },
      ['address', 'balance', 'multisignatures', 'multilifetime', 'multimin']);

    const items = [];
    for (const account of accounts) {
      const addresses        = account.multisignatures.map((pk) => this.accounts
        .generateAddressByPublicKey(pk));
      const multisigaccounts = await this.accounts.getAccounts(
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
    const txs = this.transactions.getMultisignatureTransactionList(false)
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

      const sender = await this.accounts.getAccount({ publicKey: tx.senderPublicKey });
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
