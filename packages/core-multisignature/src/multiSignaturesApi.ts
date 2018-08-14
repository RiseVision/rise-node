import {
  IAccountsModule,
  ILogger,
  ITransactionLogic,
  ITransactionsModel,
  ITransactionsModule,
  Symbols,
} from '@risevision/core-interfaces';
import { ModelSymbols } from '@risevision/core-models';
import { publicKey } from '@risevision/core-types';
import { IoCSymbol, SchemaValid, ValidateSchema } from '@risevision/core-utils';
import * as filterObject from 'filter-object';
import { inject, injectable, named } from 'inversify';
import { Get, JsonController, QueryParams } from 'routing-controllers';
import * as z_schema from 'z-schema';
import { MultisigSymbols } from './helpers';
import { Accounts2MultisignaturesModel } from './models';
import { AccountsModelWithMultisig } from './models/AccountsModelWithMultisig';
import { MultiSigUtils } from './utils';

const apiSchema = require('../schema/apischema.json');

@JsonController('/api/multisignatures')
@injectable()
@IoCSymbol(MultisigSymbols.api)
export class MultiSignaturesApi {
  // Generics
  @inject(Symbols.generic.zschema)
  public schema: z_schema;

  // Helpers
  @inject(Symbols.helpers.logger)
  private logger: ILogger;

  @inject(MultisigSymbols.utils)
  private multiUtils: MultiSigUtils;

  // Logic
  @inject(Symbols.logic.transaction)
  private txLogic: ITransactionLogic;

  // Modules
  @inject(Symbols.modules.accounts)
  private accounts: IAccountsModule<AccountsModelWithMultisig>;
  @inject(Symbols.modules.transactions)
  private transactions: ITransactionsModule;

  // models
  @inject(ModelSymbols.model)
  @named(MultisigSymbols.models.accounts2Multi)
  private Accounts2MultisignaturesModel: typeof Accounts2MultisignaturesModel;
  @inject(ModelSymbols.model)
  @named(Symbols.models.transactions)
  private TransactionsModel: typeof ITransactionsModel;

  @Get('/accounts')
  @ValidateSchema()
  public async getAccounts(@SchemaValid(apiSchema.getAccounts)
                           @QueryParams() params: { publicKey: publicKey }) {
    const rows = await this.Accounts2MultisignaturesModel.findAll({
      // attributes: ['accountId'],
      where: { dependentId: params.publicKey },
    });

    const accountIds = rows.map((r) => r.accountId);

    // Get all multisignature accounts associated to that have that publicKey as a signer.
    const accounts = await this.accounts.getAccounts({ address: { $in: accountIds }, sort: 'balance' });

    const items = [];
    for (const account of accounts) {
      const addresses        = account.multisignatures.map((pk) => this.accounts
        .generateAddressByPublicKey(Buffer.from(pk, 'hex')));
      const multisigaccounts = await this.accounts.getAccounts(
        {
          address: { $in: addresses },
        });
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
  public async getPending(@SchemaValid(apiSchema.pending)
                          @QueryParams() params: { publicKey: publicKey }) {
    const bufPubKey = Buffer.from(params.publicKey, 'hex');
    const txs       = this.transactions.getPendingTransactionList(false);

    const accounts = await this.accounts.resolveAccountsForTransactions(txs);

    const toRet = txs
      .map((tx) => {
        const sender         = accounts[tx.senderId];
        const senderMultiSig = sender.isMultisignature();
        if (this.multiUtils.txMultiSigReady(tx, sender)) {
          // Tx is ready for multisig. There must be some other module keeping the tx to go through.
          // OR waiting for txpool
          return;
        }
        if (senderMultiSig || tx.type === 4) {
          const matchingPubKey = [
            sender.publicKey,
            ... senderMultiSig ? sender.multisignatures.map((pk) => Buffer.from(pk, 'hex')) : [],
            ... tx.type === 4 ? tx.asset.multisignature.keysgroup.map((pk) => Buffer.from(pk.substr(1), 'hex')) : [],
          ]
            .filter((pk) => pk.equals(bufPubKey))[0];
          if (!matchingPubKey) {
            return; // Tx does not match the pubKey filter wanted by the user.
          }
        } else {
          // Account is not multisig and is not multisigregistration tx.
          return;
        }

        const signed     = tx.senderPublicKey.equals(bufPubKey) || this.multiUtils.isTxSignedByPubKey(tx, bufPubKey);
        const min        = sender.u_multimin || sender.multimin;
        const lifetime   = sender.u_multilifetime || sender.multilifetime;
        const signatures = sender.u_multisignatures || [];
        return {
          lifetime,
          max        : signatures.length,
          min,
          signed,
          transaction: this.TransactionsModel.toTransportTransaction(tx),
        };
      })
      .filter((res) => !!res);
    return { transactions: toRet };

  }
}
