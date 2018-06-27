import { IAccountsModel, IBaseTransactionType, ITransactionLogic, VerificationType } from '@risevision/core-interfaces';
import {
  DBOp,
  IBaseTransaction,
  IConfirmedTransaction,
  IKeypair,
  ITransportTransaction,
  SignedBlockType
} from '@risevision/core-types';
import { injectable } from 'inversify';
import { BaseStubClass } from '../BaseStubClass';
import BigNumber from 'bignumber.js';
import { stubMethod } from '../stubDecorator';
import { Model } from 'sequelize-typescript';


@injectable()
export default class TransactionLogicStub extends BaseStubClass implements ITransactionLogic {

  @stubMethod()
  public attachAssetType<K, M extends Model<any>>(instance: IBaseTransactionType<K, M>): IBaseTransactionType<K, M> {
    return null;
  }

  @stubMethod()
  public sign(keypair: IKeypair, tx: IBaseTransaction<any>): void {
    return null;
  }

  @stubMethod()
  public multiSign(keypair: IKeypair, tx: IBaseTransaction<any>): void {
    return null;
  }

  @stubMethod()
  public getId(tx: IBaseTransaction<any>): string {
    return null;
  }

  @stubMethod()
  public getHash(tx: IBaseTransaction<any>, skipSign: boolean, skipSecondSign: boolean): Buffer {
    return null;
  }

  @stubMethod()
  public getBytes(tx: IBaseTransaction<any>, skipSignature?: boolean, skipSecondSignature?: boolean): Buffer {
    return null;
  }

  @stubMethod()
  public ready(tx: IBaseTransaction<any>, sender: IAccountsModel): boolean {
    return null;
  }

  @stubMethod()
  public assertKnownTransactionType(type: number): void {
    return null;
  }

  @stubMethod()
  public checkBalance(amount: number | BigNumber, balanceKey: 'balance' | 'u_balance', tx: IConfirmedTransaction<any> | IBaseTransaction<any>, sender: any): { error: string; exceeded: boolean } {
    return null;
  }

  @stubMethod()
  public process<T = any>(tx: IBaseTransaction<T>, sender: IAccountsModel, requester: IAccountsModel): Promise<IBaseTransaction<T>> {
    return null;
  }

  @stubMethod()
  public verify(tx: IConfirmedTransaction<any> | IBaseTransaction<any>, sender: IAccountsModel, requester: IAccountsModel, height: number): Promise<void> {
    return null;
  }

  @stubMethod()
  public verifySignature(tx: IBaseTransaction<any>, publicKey: Buffer, signature: Buffer, verificationType: VerificationType): boolean {
    return null;
  }

  @stubMethod()
  public apply(tx: IConfirmedTransaction<any>, block: SignedBlockType, sender: IAccountsModel): Promise<Array<DBOp<any>>> {
    return null;
  }

  @stubMethod()
  public undo(tx: IConfirmedTransaction<any>, block: SignedBlockType, sender: IAccountsModel): Promise<Array<DBOp<any>>> {
    return null;
  }

  @stubMethod()
  public applyUnconfirmed(tx: IBaseTransaction<any>, sender: IAccountsModel, requester?: IAccountsModel): Promise<Array<DBOp<any>>> {
    return null;
  }

  @stubMethod()
  public undoUnconfirmed(tx: IBaseTransaction<any>, sender: IAccountsModel): Promise<Array<DBOp<any>>> {
    return null;
  }

  @stubMethod()
  public dbSave(txs: Array<IBaseTransaction<any> & { senderId: string }>, blockId: string, height: number): Array<DBOp<any>> {
    return null;
  }

  @stubMethod()
  public afterSave(tx: IBaseTransaction<any>): Promise<void> {
    return null;
  }

  public objectNormalize(tx: IConfirmedTransaction<any>): IConfirmedTransaction<any>;
  @stubMethod()
  public objectNormalize(tx: ITransportTransaction<any> | IBaseTransaction<any>): IBaseTransaction<any> {
    return null;
  }

  @stubMethod()
  public dbRead(raw: any): IConfirmedTransaction<any> {
    return null;
  }

  @stubMethod(true)
  public attachAssets(txs: Array<IConfirmedTransaction<any>>): Promise<void> {
    return Promise.resolve();
  }

}