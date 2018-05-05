import { inject, injectable } from 'inversify';
import { IDatabase } from 'pg-promise';
import { Get, JsonController, Post, Put, QueryParams } from 'routing-controllers';
import * as z_schema from 'z-schema';
import { ILogger} from '../helpers';
import { IoCSymbol } from '../helpers/decorators/iocSymbol';
import { SchemaValid, ValidateSchema } from '../helpers/decorators/schemavalidators';
import { ITransactionLogic } from '../ioc/interfaces/logic';
import { IAccountsModule, ITransactionsModule } from '../ioc/interfaces/modules';
import { Symbols } from '../ioc/symbols';
import { Accounts2MultisignaturesModel } from '../models';
import multisigSchema from '../schema/multisignatures';
import { publicKey as pkType } from '../types/sanityTypes';
import { APIError, DeprecatedAPIError } from './errors';

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

  // models
  @inject(Symbols.models.multisignatures)
  private Accounts2MultisignaturesModel: typeof Accounts2MultisignaturesModel;

  @Get('/accounts')
  @ValidateSchema()
  public async getAccounts(@SchemaValid(multisigSchema.getAccounts)
                           @QueryParams() params: { publicKey: pkType }) {
    const rows = await this.Accounts2MultisignaturesModel.findAll({
      attributes: ['accountId'],
      where     : { dependentId: params.publicKey },
    });

    const accountIds = rows.map((r) => r.accountId);

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
  public async getPending(@SchemaValid(multisigSchema.pending)
                          @QueryParams() params: { publicKey: pkType }) {
    const { publicKey } = params;
    const bufPubKey = Buffer.from(publicKey, 'hex');
    const txs = this.transactions.getMultisignatureTransactionList(false)
      .filter((tx) => tx.senderPublicKey.equals(bufPubKey));

    const toRet = [];

    for (const tx of txs) {
      let signed = false;
      if (tx.signatures && tx.signatures.length > 0) {
        let verified = false;
        for (let i = 0; i < tx.signatures.length && !verified; i++) {
          const signature = tx.signatures[i];
          verified        = this.txLogic.verifySignature(tx, bufPubKey, Buffer.from(signature, 'hex'));
        }
        signed = verified;
      }

      if (!signed && tx.senderPublicKey.equals(bufPubKey)) {
        // It's signed if the sender is the publickey( signature of tx)
        signed = true;
      }

      const sender = await this.accounts.getAccount({ publicKey: tx.senderPublicKey });
      if (!sender) {
        throw new APIError('Sender not found', 200);
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
  public async sign() {
    throw new DeprecatedAPIError();
  }

  @Put('/')
  public async addMultisignature() {
    throw new DeprecatedAPIError();
  }
}
