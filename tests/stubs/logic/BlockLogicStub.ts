import { injectable } from 'inversify';
import { IKeypair } from '../../../src/helpers';
import { IBlockLogic } from '../../../src/ioc/interfaces/logic';
import { BlockType, IBytesBlock, SignedAndChainedBlockType, SignedBlockType } from '../../../src/logic';
import { IBaseTransaction } from '../../../src/logic/transactions';
import { BaseStubClass } from '../BaseStubClass';
import { stubMethod } from '../stubDecorator';

@injectable()
export class BlockLogicStub extends BaseStubClass implements IBlockLogic {
  public table: string = 'blocks';
  public dbFields: string[] = ['dbfields'];

  @stubMethod()
  public getId(block: BlockType): string {
    return undefined;
  }

  @stubMethod()
  public create(data: { keypair: IKeypair; timestamp: number; transactions: Array<IBaseTransaction<any>>; previousBlock?: SignedAndChainedBlockType }) {
    return undefined;
  }

  @stubMethod()
  public sign(block: BlockType, key: IKeypair): Buffer {
    return undefined;
  }

  @stubMethod()
  public verifySignature(block: SignedBlockType): boolean {
    return undefined;
  }

  @stubMethod()
  public dbSave(block: SignedBlockType): any {
    return undefined;
  }

  @stubMethod()
  public objectNormalize<T extends BlockType>(block: T): T {
    return undefined;
  }

  @stubMethod()
  public dbRead(rawBlock: any): SignedBlockType & { totalForged: string, readonly generatorId: string } {
    return undefined;
  }

  @stubMethod()
  public getBytes(block: BlockType | SignedBlockType, includeSignature: boolean) {
    return undefined;
  }

  @stubMethod()
  public getHash(block: BlockType, includeSignature: boolean) {
    return undefined;
  }

  @stubMethod()
  public fromBytes(blk: IBytesBlock): SignedAndChainedBlockType {
    return undefined;
  }
}
