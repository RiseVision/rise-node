import * as changeCase from 'change-case';
import { SignedBlockType } from '../logic/';
import { IConfirmedTransaction } from '../logic/transactions/';

export class Bus {
  public modules: any = {};

  public message(event: 'bind', modules: any);
  public message(event: 'finishRound', round: number);
  public message(event: 'transactionsSaved', txs: Array<IConfirmedTransaction<any>>);
  public message(event: 'blockchainReady' | 'syncStarted' | 'peersReady');
  public message(event: 'newBlock', block: SignedBlockType, broadcast: boolean);
  public message(event: 'signature', ob: { transaction: string, signature: any }, broadcast: boolean);
  public message(event: 'unconfirmedTransaction', transaction: any, broadcast: any);
  public message(event: string, ...rest: any[]) {
    const methodToCall = `on${changeCase.pascalCase(event)}`;
    const moduleKeys = Object.keys(this.modules);
    for (const m of moduleKeys) {
      const module = this.modules[m];
      if (typeof(module[methodToCall]) === 'function') {
        module[methodToCall].apply(module, rest);
      }
    }
  }
}
