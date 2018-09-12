import { inject, injectable } from 'inversify';
import { constants as constantsType, Slots } from '../helpers';
import { IRoundsLogic } from '../ioc/interfaces/logic/';
import { Symbols } from '../ioc/symbols';

@injectable()
export class RoundsLogic implements IRoundsLogic {

  @inject(Symbols.helpers.slots)
  private slots: Slots;
  @inject(Symbols.helpers.constants)
  private constants: typeof constantsType;
  /**
   * Return round calculated given the blockheight
   * @return {number}
   */
  public calcRound(height: number) {
    if (height < this.constants.fairVoteSystem.firstBlock) {
      return Math.ceil(height / this.slots.numDelegates(height));
    } else {
      const numNewBlocks = height - this.constants.fairVoteSystem.firstBlock;
      return this.numOldRounds + Math.ceil(numNewBlocks / this.slots.numDelegates(numNewBlocks));
    }
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
    if (round <= this.numOldRounds) {
      return (round - 1) * this.slots.numDelegates(this.numOldBlocks) + 1;
    } else {
      const numNewRounds = round - this.numOldRounds;
      return this.numOldBlocks
        + ((numNewRounds - 1) * this.slots.numDelegates(this.constants.fairVoteSystem.firstBlock) + 1);
    }
  }

  public lastInRound(round: number): number {
    if (round < this.numOldRounds) {
      return round * this.slots.numDelegates(this.numOldBlocks);
    } else {
      const numNewRounds = round - this.numOldRounds;
      return this.numOldBlocks
        + (numNewRounds * this.slots.numDelegates(this.constants.fairVoteSystem.firstBlock));
    }
  }

  private get numOldBlocks(): number {
    return this.constants.fairVoteSystem.firstBlock - 1;
  }

  private get numOldRounds(): number {
    return Math.ceil(this.numOldBlocks / this.slots.numDelegates(this.numOldBlocks));
  }

}
