import { injectable } from 'inversify';
import { ISystemModule } from '../../../src/ioc/interfaces/modules';
import { PeerHeaders } from '../../../src/types/genericTypes';
import { BaseStubClass } from '../BaseStubClass';
import { stubMethod } from '../stubDecorator';

@injectable()
export class ISystemStub extends BaseStubClass implements ISystemModule {
  public minVersion: string;
  public headers: PeerHeaders;
  public broadhash: string;

  @stubMethod()
  public getOS(): string {
    return undefined;
  }

  @stubMethod()
  public getVersion(): string {
    return undefined;
  }

  @stubMethod()
  public getPort(): number {
    return undefined;
  }

  @stubMethod()
  public getHeight(): number {
    return undefined;
  }

  @stubMethod()
  public getNethash(): string {
    return undefined;
  }

  @stubMethod()
  public getNonce(): string {
    return undefined;
  }

  @stubMethod()
  public networkCompatible(nethash: string) {
    return undefined;
  }

  @stubMethod()
  public getMinVersion(height?: number) {
    return undefined;
  }

  @stubMethod()
  public versionCompatible(version) {
    return undefined;
  }

  @stubMethod()
  public getBroadhash() {
    return undefined;
  }

  @stubMethod()
  public getFees(height?: number) {
    return undefined;
  }

  @stubMethod()
  public update(): Promise<void> {
    return undefined;
  }

  @stubMethod()
  public cleanup(): Promise<void> {
    return undefined;
  }

}
