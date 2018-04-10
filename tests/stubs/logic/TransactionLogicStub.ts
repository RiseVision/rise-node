import { injectable } from 'inversify';
import { BaseStubClass } from '../BaseStubClass';
import { ITransactionLogic } from '../../../src/ioc/interfaces/logic';
import { BaseTransactionType, IBaseTransaction, IConfirmedTransaction } from '../../../src/logic/transactions';
import { MemAccountsData, SignedBlockType } from '../../../src/logic';
import BigNumber from 'bignumber.js';
import { IKeypair } from '../../../src/helpers';
import { stubMethod } from '../stubDecorator';

@injectable()
export default class TransactionLogicStub extends BaseStubClass implements ITransactionLogic {
    @stubMethod()
    public afterSave(tx: IBaseTransaction<any>): Promise<void> {
        return undefined;
    }

    @stubMethod()
    public apply(tx: IConfirmedTransaction<any>, block: SignedBlockType, sender: MemAccountsData): Promise<void> {
        return undefined;
    }

    @stubMethod()
    public applyUnconfirmed(tx: IBaseTransaction<any>, sender: MemAccountsData, requester?: MemAccountsData): Promise<void> {
        return undefined;
    }

    @stubMethod()
    public assertKnownTransactionType(tx: IBaseTransaction<any>): void {
    }

    @stubMethod()
    public assertNonConfirmed(tx: IBaseTransaction<any>): Promise<void> {
        return undefined;
    }

    @stubMethod()
    public attachAssetType<K>(instance: BaseTransactionType<K>): BaseTransactionType<K> {
        return undefined;
    }

    @stubMethod()
    public checkBalance(amount: number | BigNumber, balanceKey, tx: IConfirmedTransaction<any> | IBaseTransaction<any>, sender: any): { error: string; exceeded: boolean } {
        return undefined;
    }

    @stubMethod()
    public countById(tx: IBaseTransaction<any>): Promise<number> {
        return undefined;
    }

    @stubMethod()
    public dbRead(raw: any): IConfirmedTransaction<any> {
        return undefined;
    }

    @stubMethod()
    public dbSave(tx: IConfirmedTransaction<any> & { senderId: string }): Array<{ table: string; fields: string[]; values: any }> {
        return undefined;
    }

    @stubMethod()
    public getBytes(tx: IBaseTransaction<any>, skipSignature?: boolean, skipSecondSignature?: boolean): Buffer {
        return undefined;
    }

    @stubMethod()
    public getHash(tx: IBaseTransaction<any>, skipSign: boolean, skipSecondSign: boolean): Buffer {
        return undefined;
    }

    @stubMethod()
    public getId(tx: IBaseTransaction<any>): string {
        return "";
    }

    @stubMethod()
    public multiSign(keypair: IKeypair, tx: IBaseTransaction<any>): void {
    }

    @stubMethod()
    public objectNormalize(tx: IBaseTransaction<any>): IBaseTransaction<any> {
        return undefined;
    }

    @stubMethod()
    public process<T>(tx: IBaseTransaction<T>, sender: MemAccountsData, requester: MemAccountsData): Promise<IBaseTransaction<T>> {
        return undefined;
    }

    @stubMethod()
    public ready(tx: IBaseTransaction<any>, sender: MemAccountsData): boolean {
        return false;
    }

    @stubMethod()
    public sign(keypair: IKeypair, tx: IBaseTransaction<any>): void {
    }

    @stubMethod()
    public undo(tx: IConfirmedTransaction<any>, block: SignedBlockType, sender: MemAccountsData): Promise<void> {
        return undefined;
    }

    @stubMethod()
    public undoUnconfirmed(tx: IBaseTransaction<any>, sender: MemAccountsData): Promise<void> {
        return undefined;
    }

    @stubMethod()
    public verify(tx: IConfirmedTransaction<any> | IBaseTransaction<any>, sender: MemAccountsData, requester: MemAccountsData, height: number): Promise<void> {
        return undefined;
    }

    @stubMethod()
    public verifySignature(tx: IBaseTransaction<any>, publicKey: string, signature: string, isSecondSignature?: boolean): boolean {
        return false;
    }

    @stubMethod(true)
    public async restoreAsset<T>(tx: IBaseTransaction<void> | IConfirmedTransaction<void>) {
        return tx;
    }

}