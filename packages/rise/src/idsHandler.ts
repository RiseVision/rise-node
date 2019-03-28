import { Address, IIdsHandler } from '@risevision/core-types';
import * as bech32 from 'bech32-buffer';
import { toBigIntBE, toBufferBE } from 'bigint-buffer';
import { RiseV2 } from 'dpos-offline';
import { injectable } from 'inversify';
import * as supersha from 'supersha';
import { As } from 'type-tagger';

const maxAddress = 18446744073709551615n;

@injectable()
export class RiseIdsHandler implements IIdsHandler {
  public maxBlockIdBytesUsage = 8;

  public addressFromBytes(bytes: Buffer): Address {
    if (bytes.length === 0) {
      return null;
    }
    if (bytes.length === 8) {
      return `${toBigIntBE(bytes)}R` as Address;
    } else {
      return bech32.encode(
        bytes.slice(0, 4).toString('ascii'),
        bytes.slice(4)
      ) as Address;
    }
  }

  public addressFromPubData(pubKey: Buffer): Address {
    if (pubKey[0] === 1 && pubKey.length === 33) {
      return RiseV2.calcAddress(
        pubKey.slice(1) as Buffer & As<'publicKey'>,
        'main',
        'v1'
      );
    }
    return RiseV2.calcAddress(pubKey as Buffer & As<'publicKey'>, 'main', 'v0');
  }

  public addressToBytes(address: Address): Buffer {
    if (!address) {
      return toBufferBE(0n, 0);
    }
    if (/^[0-9]+R$/i.test(address)) {
      if (address.substring(-1) === 'r') {
        throw new Error('Invalid address');
      }
      const num = BigInt(address.slice(0, -1));
      if (num > maxAddress) {
        return toBufferBE(num, 16).slice(0, 8);
      }
      return toBufferBE(num, 8);
    } else {
      // TODO: Eventually move codebase from lib to here.
      return RiseV2.txs.getAddressBytes(address);
    }
  }

  public calcBlockIdFromBytes(bytes: Buffer): string {
    return this.toBigInt(bytes).toString();
  }

  public blockIdFromBytes(bytes: Buffer): string {
    return toBigIntBE(bytes).toString();
  }

  public blockIdToBytes(id: string): Buffer {
    if (id === null) {
      return Buffer.alloc(0);
    }
    return toBufferBE(BigInt(id), 8);
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
