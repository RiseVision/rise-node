import { injectable } from 'inversify';
import { BaseStubClass } from '../BaseStubClass';
import { stubMethod } from '../stubDecorator';
import { ISystemModule } from '@risevision/core-interfaces';
import { PeerHeaders } from '@risevision/core-types';

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
