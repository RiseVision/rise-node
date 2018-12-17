import { IIdsHandler } from '@risevision/core-interfaces';
import { toBigIntBE, toBigIntLE, toBufferBE, toBufferLE } from 'bigint-buffer';
import { injectable } from 'inversify';
import * as supersha from 'supersha';

@injectable()
export class TestIdsHandler implements IIdsHandler {
  public addressBytes: number = 8;
  public blockIdByteSize: number = 8;

  public addressFromBytes(bytes: Buffer): string {
    return `${toBigIntLE(bytes)}R`;
  }

  public addressFromPubKey(pubKey: Buffer): string {
    return `${this.toBigInt(pubKey)}R`;
  }

  public addressToBytes(address: string): Buffer {
    if (!address) {
      return toBufferBE(0n, 8);
    }
    return toBufferBE(BigInt(address.slice(0, -1)), 8);
  }

  public blockIdFromBytes(bytes: Buffer): string {
    return this.toBigInt(bytes).toString();
  }

  public blockIdToBytes(id: string): Buffer {
    if (id === null) {
      return Buffer.alloc(0);
    }
    return toBufferLE(BigInt(id), 8);
  }

  public txIdFromBytes(bytes: Buffer): string {
    return `${this.toBigInt(bytes)}`;
  }

  private toBigInt(bytes: Buffer) {
    const hash = supersha.sha256(bytes);
    const tmp = Buffer.alloc(8);
    for (let i = 0; i < 8; i++) {
      tmp[i] = hash[7 - i];
    }
    return toBigIntBE(tmp);
  }
}
