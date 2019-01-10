import {
  AccountDiffType,
  AccountFilterData,
  IAccountsModel,
  IAccountsModule,
  IIdsHandler,
  Symbols,
} from '@risevision/core-interfaces';
import { DBHelper, ModelSymbols } from '@risevision/core-models';
import { Address, DBOp, IBaseTransaction } from '@risevision/core-types';
import { inject, injectable, named } from 'inversify';
import { AccountLogic } from '../logic';
import { AccountsSymbols } from '../symbols';

@injectable()
export class AccountsModule implements IAccountsModule {
  @inject(AccountsSymbols.logic)
  private accountLogic: AccountLogic;

  @inject(Symbols.helpers.idsHandler)
  private idsHandler: IIdsHandler;

  @inject(ModelSymbols.helpers.db)
  private dbHelper: DBHelper;

  @inject(ModelSymbols.model)
  @named(AccountsSymbols.model)
  private AccountsModel: typeof IAccountsModel;

  public getAccount(filter: AccountFilterData): Promise<IAccountsModel> {
    return this.accountLogic.get(filter);
  }

  public getAccounts(filter: AccountFilterData): Promise<IAccountsModel[]> {
    return this.accountLogic.getAll(filter);
  }

  public unfoldSenders(txs: Array<IBaseTransaction<any>>): Address[] {
    const allSenders: Address[] = [];
    txs.forEach((tx) => {
      const senderId = this.idsHandler.addressFromPubData(tx.senderPubData);
      if (!allSenders.find((item) => item === senderId)) {
        allSenders.push(senderId);
      }
    });
    return allSenders;
  }

  public async txAccounts(
    txs: Array<IBaseTransaction<any>>
  ): Promise<{ [address: string]: IAccountsModel }> {
    if (txs.length === 0) {
      return {};
    }
    const allSenders = this.unfoldSenders(txs);

    const senderAccounts = await this.AccountsModel.findAll({
      where: { address: allSenders },
    });

    const sendersMap: { [address: string]: IAccountsModel } = {};
    for (const senderAccount of senderAccounts) {
      sendersMap[senderAccount.address] = senderAccount;
    }

    return sendersMap;
  }

  public async checkTXsAccountsMap(
    txs: Array<IBaseTransaction<any>>,
    accMap: { [add: string]: IAccountsModel }
  ) {
    const allSenders = this.unfoldSenders(txs);

    await Promise.all(
      allSenders.map(async (address) => {
        if (!accMap[address]) {
          throw new Error(`Account ${address} not found in db.`);
        }
        if (accMap[address].address !== address) {
          throw new Error(`Stealing attempt type.1 for ${address}`);
        }
      })
    );
  }

  public mergeAccountAndGetOPs(diff: AccountDiffType): Array<DBOp<any>> {
    diff = this.fixAndCheckInputParams(diff);
    const { address } = diff;
    delete diff.address;
    return this.accountLogic.merge(address, diff);
  }

  public generateAddressByPubData(pk: Buffer) {
    return this.accountLogic.generateAddressFromPubData(pk);
  }

  private fixAndCheckInputParams<
    T extends { address?: string; pubData?: Buffer } = any
  >(what: T): T & { address: string } {
    if (!what.address && !what.pubData) {
      throw new Error('Missing address and public key');
    }
    // We calculate address in the case it was not provided or
    // in case publicKey was provided (even if address was provided for security reasons)
    if (what.pubData || !what.address) {
      what.address = this.accountLogic.generateAddressFromPubData(what.pubData);
    }
    return what as any;
  }
}
