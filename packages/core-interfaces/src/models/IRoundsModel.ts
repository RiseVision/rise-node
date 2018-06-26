import { IBaseTransaction, publicKey} from '@risevision/core-types';
import { IBaseModel } from './IBaseModel';

export class IRoundsModel extends IBaseModel<IRoundsModel> {
  public address: string;

  public amount: number;

  public delegate: publicKey;

  public blockId: string;

  public round: number;

  // tslint:disable member-ordering
  public static sumRound(activeDelegates: number, round: number, tx: IBaseTransaction<any>): Promise<{ fees: null | string, rewards: null | string[], delegates: null | Buffer[] }> {
    return null;
  }

  /**
   * Generates SQL to update mem_accounts based on data in mem_rounds
   * @param {number} round
   * @return {string}
   */
  public static updateVotesSQL(round: number): string {
    return null;
  }

  public static insertMemRoundBalanceSQL(params: { address: string, amount: number, blockId: string, round: number }) {
    return null;
  }

  public static insertMemRoundDelegatesSQL(params: { add: boolean, address: string, delegate: string, blockId: string, round: number }) {
    return null;
  }
}
