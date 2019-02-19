import { DelegatesModule } from '@risevision/core-consensus-dpos';
import { inject, injectable } from 'inversify';
import { RISESymbols } from '../symbols';

@injectable()
export class RiseDelegatesModule extends DelegatesModule {
  @inject(RISESymbols.helpers.constants)
  private riseContants: {
    '@risevision/rise': { dposRandSwitchRound: number };
  };

  protected calcV2Weight(
    rand: number,
    delegate: { publicKey: Buffer; vote: bigint },
    round: number
  ): number {
    if (round >= this.riseContants['@risevision/rise'].dposRandSwitchRound) {
      return super.calcV2Weight(rand, delegate, round);
    }
    return rand ** (1e8 / parseInt(delegate.vote.toString(), 10));
  }
}
