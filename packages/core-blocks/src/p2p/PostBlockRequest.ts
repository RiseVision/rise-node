import { IBlockLogic, Symbols } from '@risevision/core-interfaces';
import {
  BaseProtobufTransportMethod,
  Peer,
  ProtoIdentifier,
  SingleTransportPayload,
} from '@risevision/core-p2p';
import { SignedAndChainedBlockType } from '@risevision/core-types';
import { inject, injectable } from 'inversify';
import { WordPressHookSystem } from 'mangiafuoco';
import { BlocksSymbols } from '../blocksSymbols';
import { OnPostApplyBlock, OnReceiveBlock } from '../hooks';
import { BlocksModuleProcess } from '../modules';

// tslint:disable-next-line
export type PostBlockRequestDataType = { block: SignedAndChainedBlockType };

@injectable()
export class PostBlockRequest extends BaseProtobufTransportMethod<
  PostBlockRequestDataType,
  null,
  null
> {
  public readonly method: 'POST' = 'POST';
  public readonly baseUrl = '/v2/peer/blocks';

  protected readonly protoRequest: ProtoIdentifier<any> = {
    messageType: 'transportBlock',
    namespace: 'blocks.transport',
  };

  @inject(Symbols.logic.block)
  private blockLogic: IBlockLogic;

  @inject(BlocksSymbols.modules.process)
  private process: BlocksModuleProcess;

  protected async encodeRequest(
    data: PostBlockRequestDataType,
    peer: Peer
  ): Promise<Buffer> {
    return super.encodeRequest(
      {
        block: this.blockLogic.toProtoBuffer(data.block) as any,
      },
      peer
    );
  }

  protected async decodeRequest(
    req: SingleTransportPayload<PostBlockRequestDataType, null> & {
      body: Buffer;
    }
  ): Promise<PostBlockRequestDataType> {
    const data: any = await super.decodeRequest(req);
    return {
      block: this.blockLogic.objectNormalize(
        this.blockLogic.fromProtoBuffer(data.block)
      ),
    };
  }

  protected async produceResponse(
    req: SingleTransportPayload<PostBlockRequestDataType, null>
  ): Promise<null> {
    const normalizedBlock = this.blockLogic.objectNormalize(req.body.block);

    await this.process.onReceiveBlock(normalizedBlock);
    return null;
  }
}
