import { IBlockLogic, Symbols } from '@risevision/core-interfaces';
import { BaseRequest } from '@risevision/core-p2p';
import { SignedAndChainedBlockType } from '@risevision/core-types';
import { inject, injectable } from 'inversify';

// tslint:disable-next-line
@injectable()
export class CommonBlockRequest extends BaseRequest<{ common: SignedAndChainedBlockType }, void> {
  protected readonly method: 'GET'             = 'GET';
  protected readonly baseUrl: string           = '/v2/peer/blocks/common';

  @inject(Symbols.logic.block)
  private blockLogic: IBlockLogic;

  protected decodeProtoBufValidResponse(buf: Buffer) {
    const { common } = this.protoBufHelper.decode<{ common: Buffer }>(buf, 'blocks.transport', 'commonBlock');
    return {
      common: this.blockLogic.fromProtoBuffer(common)
    };
  }

}
