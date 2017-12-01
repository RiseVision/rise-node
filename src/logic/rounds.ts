import { Slots } from '../helpers';
import { IRoundsLogic } from '../ioc/interfaces/logic/IRoundsLogic';

export class RoundsLogic implements IRoundsLogic {

  constructor(private slots: typeof Slots) {
  }

  /**
   * Return round calculated given the blockheight
   * @return {number}
   */
  public calcRound(height: number) {
    return Math.ceil(height / this.slots.delegates);
  }

  /**
   * Gets inclusive range of round from given height
   */
  public heightFromRound(round: number): { first: number, last: number } {
    return {
      first: this.firstInRound(round),
      last : this.lastInRound(round),
    };
  }

  public firstInRound(round: number): number {
    return round * this.slots.delegates + 1;
  }

  public lastInRound(round: number): number {
    return (round + 1) * this.slots.delegates;
  }
}
