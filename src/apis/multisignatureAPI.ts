import * as filterObject from 'filter-object';
import { inject, injectable } from 'inversify';
import { Get, JsonController, Post, Put, QueryParams } from 'routing-controllers';
import * as z_schema from 'z-schema';
import { ILogger } from '../helpers';
import { IoCSymbol } from '../helpers/decorators/iocSymbol';
import { SchemaValid, ValidateSchema } from '../helpers/decorators/schemavalidators';
import { ITransactionLogic, VerificationType } from '../ioc/interfaces/logic';
import { IAccountsModule, IBlocksModule, ITransactionsModule } from '../ioc/interfaces/modules';
import { Symbols } from '../ioc/symbols';
import { Accounts2MultisignaturesModel, TransactionsModel } from '../models';
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

  // Helpers
  @inject(Symbols.helpers.logger)
  private logger: ILogger;

  // Logic
  @inject(Symbols.logic.transaction)
  private txLogic: ITransactionLogic;

  // Modules
  @inject(Symbols.modules.accounts)
  private accounts: IAccountsModule;
  @inject(Symbols.modules.blocks)
  private blocksModule: IBlocksModule;
  @inject(Symbols.modules.transactions)
  private transactions: ITransactionsModule;

  // models
  @inject(Symbols.models.accounts2Multisignatures)
  private Accounts2MultisignaturesModel: typeof Accounts2MultisignaturesModel;
  @inject(Symbols.models.transactions)
  private TransactionsModel: typeof TransactionsModel;

  @Get('/accounts')
  @ValidateSchema()
  public async getAccounts(@SchemaValid(multisigSchema.getAccounts)
                           @QueryParams() params: { publicKey: pkType }) {
    const rows = await this.Accounts2MultisignaturesModel.findAll({
      // attributes: ['accountId'],
      where: { dependentId: params.publicKey },
    });

    const accountIds = rows.map((r) => r.accountId);

    // Get all multisignature accounts associated to that have that publicKey as a signer.
    const accounts = await this.accounts.getAccounts(
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
      items.push({
        ...filterObject(
          account.toPOJO(),
          ['address', 'balance', 'multisignatures', 'multilifetime', 'multimin']
        ),
        ...{
          multisigaccounts: multisigaccounts
            .map((m) => filterObject(m.toPOJO(), ['address', 'publicKey', 'balance'])),
        },
      });
    }

    return { accounts: items };
  }

  @Get('/pending')
  @ValidateSchema()
  public async getPending(@SchemaValid(multisigSchema.pending)
                          @QueryParams() params: { publicKey: pkType }) {
    const { publicKey } = params;
    const bufPubKey     = Buffer.from(publicKey, 'hex');
    const txs           = this.transactions.getMultisignatureTransactionList(false)
      .filter((tx) => tx.senderPublicKey.equals(bufPubKey));

    const toRet = [];

    for (const tx of txs) {
      let signed = false;
      if (tx.signatures && tx.signatures.length > 0) {
        let verified = false;
        for (let i = 0; i < tx.signatures.length && !verified; i++) {
          const signature = tx.signatures[i];
          verified        = this.txLogic.verifySignature(
            tx, bufPubKey, Buffer.from(signature, 'hex'), VerificationType.ALL
          );
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
        transaction: this.TransactionsModel.toTransportTransaction(tx, this.blocksModule),
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
