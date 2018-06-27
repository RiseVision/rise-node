import { IAccountsModel, IDelegatesModule } from '@risevision/core-interfaces';
import { SignedBlockType } from '@risevision/core-types';
import { injectable } from 'inversify';
import { BaseStubClass } from '../BaseStubClass';
import { stubMethod } from '../stubDecorator';

@injectable()
export class DelegatesModuleStub extends BaseStubClass  implements IDelegatesModule {

  @stubMethod(true)
  public cleanup(): Promise<void> {
    return Promise.resolve();
  }

  @stubMethod()
  public assertValidBlockSlot(block: SignedBlockType): Promise<void> {
    return null;
  }

  @stubMethod()
  public isLoaded(): boolean {
    return null;
  }

  @stubMethod()
  public checkConfirmedDelegates(aaccount: IAccountsModel, votes: string[]): Promise<void> {
    return null;
  }

  @stubMethod()
  public checkUnconfirmedDelegates(account: IAccountsModel, votes: string[]): Promise<void> {
    return null;
  }

  @stubMethod()
  public generateDelegateList(height: number): Promise<Buffer[]> {
    return null;
  }

  @stubMethod()
  public getDelegates(query: { limit?: number, offset?: number, orderBy: string }): Promise<{
    delegates: Array<{
      delegate: IAccountsModel,
      info: { rank: number, approval: number, productivity: number }
    }>
    count: number,
    offset: number,
    limit: number,
    sortField: string,
    sortMethod: 'ASC' | 'DESC'
  }> {
    return null;
  }
}
