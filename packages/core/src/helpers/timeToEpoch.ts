import { ITimeToEpoch, Symbols } from '@risevision/core-interfaces';
import { inject, injectable } from 'inversify';
import { ConstantsType } from '@risevision/core-types';

@injectable()
export class TimeToEpoch implements ITimeToEpoch {
  @inject(Symbols.generic.constants)
  private constants: ConstantsType;

  public getTime(time: number = new Date().getTime()): number {
    return Math.floor((time - this.constants.epochTime.getTime()) / 1000);
  }
}
