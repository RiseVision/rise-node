import { injectable } from 'inversify';
import { ISystemModule } from '../../../src/ioc/interfaces/modules';
import { BaseStubClass } from '../BaseStubClass';
import { PeerHeaders } from '../../../src/types/genericTypes';
import { stubMethod } from '../stubDecorator';

@injectable()
export class SystemModuleStub extends BaseStubClass implements ISystemModule {
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

  @stubMethod(true)
  public getNonce(): string {
    return 'nonce';
  }

  @stubMethod()
  public networkCompatible(nethash: string): boolean {
    return undefined;
  }

  @stubMethod()
  public getMinVersion(height?: number): string {
    return undefined;
  }

  @stubMethod()
  public versionCompatible(version): boolean {
    return undefined;
  }

  @stubMethod()
  public getBroadhash(): Promise<string> {
    return undefined;
  }

  @stubMethod()
  public getFees(height?: number): { fees: { send: number; vote: number; secondsignature: number; delegate: number; multisignature: number; dapp }; fromHeight: number; height: number; toHeight: number } {
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
