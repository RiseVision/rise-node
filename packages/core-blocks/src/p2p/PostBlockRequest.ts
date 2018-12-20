import { IBlockLogic, Symbols } from '@risevision/core-interfaces';
import {
  BaseProtobufTransportMethod,
  Peer,
  ProtoIdentifier,
  SingleTransportPayload,
} from '@risevision/core-p2p';
import { SignedAndChainedBlockType } from '@risevision/core-types';
import { inject, injectable } from 'inversify';
import { BlocksSymbols } from '../blocksSymbols';
import { BlockLogic } from '../logic';
import { BlockBytes } from '../logic/blockBytes';
import { BlocksModuleProcess } from '../modules';

// tslint:disable-next-line
export type PostBlockRequestDataType = { block: SignedAndChainedBlockType, relays: number };

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

  @inject(BlocksSymbols.logic.blockBytes)
  private blockBytes: BlockBytes;

  @inject(BlocksSymbols.logic.block)
  private blockLogic: BlockLogic;

  @inject(BlocksSymbols.modules.process)
  private process: BlocksModuleProcess;

  protected async encodeRequest(
    data: PostBlockRequestDataType,
    peer: Peer
  ): Promise<Buffer> {
    return super.encodeRequest(
      {
        block: this.blockBytes.toBuffer(data.block) as any,
        relays: data.relays,
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
        this.blockBytes.fromBuffer(data.block)
      ),
      relays: data.relays,
    };
  }

  protected async produceResponse(
    req: SingleTransportPayload<PostBlockRequestDataType, null>
  ): Promise<null> {
    const normalizedBlock = this.blockLogic.objectNormalize(req.body.block);

    // We propagate relays here so that the next postblockrequest has a relay to handle.
    ( normalizedBlock as any ).relays = req.body.relays;
    await this.process.onReceiveBlock( normalizedBlock );
    return null;
  }
}
