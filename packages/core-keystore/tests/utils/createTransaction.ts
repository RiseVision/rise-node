import { Address, IKeypair } from '@risevision/core-types';
import {
  BaseRiseV2Codec,
  IBaseTx,
  riseCodecUtils,
  RiseV2,
  RiseV2Transaction,
} from 'dpos-offline';
import * as varuint from 'varuint-bitcoin';
import { KeyStoreAsset } from '../../src';

interface IBaseKeystoreTx extends IBaseTx {
  kind: 'keystore-tx';
  key: string;
  value: Buffer;
}

class RiseKeystoreTxCodec extends BaseRiseV2Codec<KeyStoreAsset> {
  constructor() {
    super(100, 'keystore-tx');
  }

  public transform(from: IBaseKeystoreTx): RiseV2Transaction<KeyStoreAsset> {
    const s = super.transform(from);
    s.asset = {
      key: from.key,
      value: from.value,
    };
    return s;
  }

  public calcFees(tx: IBaseKeystoreTx): number {
    const fees = {
      keystore: 10000,
      keystoreMultiplier: 10,
    };
    return fees.keystore + this.bytes(tx).length * fees.keystoreMultiplier;
  }

  protected assetBytes(tx: RiseV2Transaction<KeyStoreAsset>): Buffer {
    return this.bytes(tx.asset);
  }

  protected assetFromBytes(buf: Buffer): KeyStoreAsset {
    return undefined;
  }

  private bytes(b: KeyStoreAsset): Buffer {
    const keyBuf = Buffer.from(b.key, 'utf8');
    return Buffer.concat([
      varuint.encode(keyBuf.length),
      keyBuf,
      varuint.encode(b.value.length),
      b.value,
    ]);
  }
}

riseCodecUtils.allCodecs.push(new RiseKeystoreTxCodec());
export const createKeystoreTransaction = (
  acc: IKeypair & { address: Address },
  key: string,
  value: Buffer
): RiseV2Transaction<KeyStoreAsset> => {
  return RiseV2.txs.createAndSign<IBaseKeystoreTx>(
    {
      key,
      kind: 'keystore-tx',
      sender: acc,
      value,
    },
    acc,
    true
  );
};
