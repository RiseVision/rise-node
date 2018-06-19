import * as changeCase from 'change-case';
import { SignedAndChainedBlockType, SignedBlockType } from '../logic/';
import { IConfirmedTransaction } from '../logic/transactions/';

/**
 * Handler for to call events to the proper module.
 */
export class Bus {
  public modules: any[];

  /**
   * Call to onReceiveBlock event
   */
  public message(event: 'receiveBlock', block: SignedAndChainedBlockType): Promise<void>;

  /**
   * Call to onFinishRound event
   */
  public message(event: 'finishRound', round: number): Promise<void>;

  /**
   * Call to onTransactionsSaved event
   */
  public message(event: 'transactionsSaved', txs: Array<IConfirmedTransaction<any>>): Promise<void>;

  /**
   * Call to onBlockchainReady event
   */
  public message(event: 'blockchainReady' | 'syncStarted' | 'syncFinished' | 'peersReady'): Promise<void>;

  /**
   * Call to onNewBlock event
   */
  public message(event: 'newBlock', block: SignedBlockType, broadcast: boolean): Promise<void>;

  /**
   * Call to onSignature event
   */
  public message(event: 'signature', ob: { transaction: string, signature: any }, broadcast: boolean): Promise<void>;

  /**
   * Call to onUnconfirmedTransaction event
   */
  public message(event: 'unconfirmedTransaction', transaction: any, broadcast: any): Promise<void>;

  /**
   * Search and execute the called event in the available modules.
   */
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
