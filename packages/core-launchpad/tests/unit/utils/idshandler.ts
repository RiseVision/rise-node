import { IIdsHandler } from '@risevision/core-interfaces';
import { Address } from '@risevision/core-types';
import { toBigIntBE, toBigIntLE, toBufferBE, toBufferLE } from 'bigint-buffer';
import { injectable } from 'inversify';
import * as supersha from 'supersha';

const maxAddress = 18446744073709551615n;

@injectable()
export class TestIdsHandler implements IIdsHandler {
  public maxBlockIdBytesUsage = 8;
  public addressFromBytes(bytes: Buffer): Address {
    return `${toBigIntBE(bytes)}R` as Address;
  }

  public addressFromPubData(pubKey: Buffer): Address {
    return `${this.toBigInt(pubKey)}R` as Address;
  }

  public addressToBytes(address: string): Buffer {
    if (!address) {
      return toBufferBE(0n, 8);
    }
    const num = BigInt(address.slice(0, -1));
    if (num > maxAddress) {
      return toBufferBE(num, 16).slice(0, 8);
    }
    return toBufferBE(num, 8);
  }

  public calcBlockIdFromBytes(bytes: Buffer): string {
    return this.toBigInt(bytes).toString();
  }

  public blockIdFromBytes(bytes: Buffer): string {
    return toBigIntLE(bytes).toString();
  }

  public blockIdToBytes(id: string): Buffer {
    if (id === null) {
      return Buffer.alloc(0);
    }
    return toBufferLE(BigInt(id), 8);
  }

  public calcTxIdFromBytes(bytes: Buffer): string {
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
