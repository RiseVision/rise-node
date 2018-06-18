import { injectable } from 'inversify';
import { IAPIRequest } from '../../../../src/apis/requests/BaseRequest';
import { IPeerLogic } from '../../../../src/ioc/interfaces/logic';
import { PeerRequestOptions } from '../../../../src/modules';
import { BaseStubClass } from '../../BaseStubClass';
import { spyMethod, stubMethod } from '../../stubDecorator';

@injectable()
export class APIRequestStub extends BaseStubClass implements IAPIRequest{
  @stubMethod()
  public getRequestOptions(): PeerRequestOptions {
    return undefined;
  }

  @stubMethod()
  public getResponseData(res: any): any {
    return undefined;
  }

  @spyMethod
  public setPeer(peer: IPeerLogic) {
    return undefined;
  }

  @stubMethod()
  public getOrigOptions(): PeerRequestOptions {
    return undefined;
  }
}
