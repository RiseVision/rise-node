import { injectable } from 'inversify';
import { IDelegatesModule } from '../../../src/ioc/interfaces/modules';
import { MemAccountsData, SignedBlockType } from '../../../src/logic';
import { publicKey } from '../../../src/types/sanityTypes';
import { BaseStubClass } from '../BaseStubClass';
import { stubMethod } from '../stubDecorator';

@injectable()
export class DelegatesModuleStub extends BaseStubClass  implements IDelegatesModule {

  @stubMethod()
  public checkConfirmedDelegates(pk: publicKey, votes: string[]): Promise<void> {
    return undefined;
  }

  @stubMethod()
  public checkUnconfirmedDelegates(pk: publicKey, votes: string[]): Promise<void> {
    return undefined;
  }

  @stubMethod()
  public generateDelegateList(height: number): Promise<publicKey[]> {
    return undefined;
  }

  @stubMethod()
  public getDelegates(query: { limit?: number, offset?: number, orderBy: string }): Promise<{
    delegates: Array<MemAccountsData & { rank: number, approval: number, productivity: number }>,
    count: number,
    offset: number,
    limit: number,
    sortField: string,
    sortMethod: 'ASC' | 'DESC'
  }> {
    return undefined;
  }

  @stubMethod()
  public assertValidBlockSlot(block: SignedBlockType): Promise<void> {
    return undefined;
  }

  @stubMethod()
  public isLoaded(): boolean {
    return undefined;
  }

  @stubMethod()
  public cleanup() {
    return undefined;
  }
}