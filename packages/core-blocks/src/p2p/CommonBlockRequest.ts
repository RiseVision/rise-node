import {
  IBlockLogic,
  IBlocksModel,
  Symbols
} from '@risevision/core-interfaces';
import { ModelSymbols } from '@risevision/core-models';
import {
  BaseProtobufTransportMethod,
  ProtoIdentifier,
  SingleTransportPayload
} from '@risevision/core-p2p';
import { SignedAndChainedBlockType } from '@risevision/core-types';
import { inject, injectable, named } from 'inversify';
import { Op } from 'sequelize';

@injectable()
// tslint:disable-next-line
export class CommonBlockRequest extends BaseProtobufTransportMethod<
  null,
  { ids: string },
  { common: SignedAndChainedBlockType }
> {
  public readonly method: 'GET' = 'GET';
  public readonly baseUrl: string = '/v2/peer/blocks/common';

  public readonly requestSchema = require('../../schema/transport.json')
    .commonBlock;

  protected readonly protoResponse: ProtoIdentifier<{
    common: SignedAndChainedBlockType;
  }> = {
    messageType: 'commonBlock',
    namespace: 'blocks.transport'
  };

  @inject(Symbols.logic.block)
  private blockLogic: IBlockLogic;

  @inject(ModelSymbols.model)
  @named(Symbols.models.blocks)
  private BlocksModel: typeof IBlocksModel;

  // tslint:disable-next-line
  protected async produceResponse(
    request: SingleTransportPayload<null, { ids: string }>
  ): Promise<{ common: SignedAndChainedBlockType }> {
    const excapedIds = request.query.ids
      // Remove quotes
      .replace(/['"]+/g, '')
      // Separate by comma into an array
      .split(',')
      // Reject any non-numeric values
      .filter((id) => /^[0-9]+$/.test(id));
    if (excapedIds.length === 0 || excapedIds.length > 10) {
      throw new Error('Invalid block id sequence');
    }

    const common = await this.BlocksModel.findOne({
      limit: 1,
      order: [['height', 'DESC']],
      raw: true,
      where: { id: { [Op.in]: excapedIds } }
    });

    return { common };
  }

  protected encodeResponse(data: {
    common: SignedAndChainedBlockType;
  }): Promise<Buffer> {
    return super.encodeResponse({
      common: data.common
        ? this.blockLogic.toProtoBuffer(data.common)
        : (null as any)
    });
  }

  protected async decodeResponse(
    res: Buffer
  ): Promise<{ common: SignedAndChainedBlockType }> {
    const data: any = await super.decodeResponse(res);
    return {
      common: data.common ? this.blockLogic.fromProtoBuffer(data.common) : null
    };
  }
}
