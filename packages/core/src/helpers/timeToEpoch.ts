import { ITimeToEpoch, Symbols } from '@risevision/core-interfaces';
import { ConstantsType } from '@risevision/core-types';
import { inject, injectable } from 'inversify';

@injectable()
export class TimeToEpoch implements ITimeToEpoch {
  @inject(Symbols.generic.constants)
  private constants: ConstantsType;

  public getTime(time: number = new Date().getTime()): number {
    return Math.floor((time - this.constants.epochTime.getTime()) / 1000);
  }

  public fromTimeStamp(timestamp: number): number {
    return this.constants.epochTime.getTime() + timestamp * 1000;
  }
}
