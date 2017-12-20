import * as changeCase from 'change-case';
import { SignedAndChainedBlockType, SignedBlockType } from '../logic/';
import { IConfirmedTransaction } from '../logic/transactions/';

export class Bus {
  public modules: any[];

  public message(event: 'bind', modules: any): Promise<void>;
  public message(event: 'receiveBlock', block: SignedAndChainedBlockType): Promise<void>;
  public message(event: 'finishRound', round: number): Promise<void>;
  public message(event: 'transactionsSaved', txs: Array<IConfirmedTransaction<any>>): Promise<void>;
  public message(event: 'blockchainReady' | 'syncStarted' | 'syncFinished' | 'peersReady'): Promise<void>;
  public message(event: 'newBlock', block: SignedBlockType, broadcast: boolean): Promise<void>;
  public message(event: 'signature', ob: { transaction: string, signature: any }, broadcast: boolean): Promise<void>;
  public message(event: 'unconfirmedTransaction', transaction: any, broadcast: any): Promise<void>;
  public async message(event: string, ...rest: any[]) {
    const methodToCall = `on${changeCase.pascalCase(event)}`;
    await Promise.all(this.modules.map(async (module) => {
      if (typeof(module[methodToCall]) === 'function') {
        const toRet = module[methodToCall].apply(module, rest);
        if (toRet instanceof Promise) {
          await toRet;
        }
      }
    }));
  }
}
