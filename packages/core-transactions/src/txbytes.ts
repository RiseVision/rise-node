import {
  IBaseTransactionType,
  IIdsHandler,
  Symbols,
} from '@risevision/core-interfaces';
import { p2pSymbols, ProtoBufHelper } from '@risevision/core-p2p';
import { IBaseTransaction } from '@risevision/core-types';
import { inject, injectable, multiInject, optional } from 'inversify';
import { Model } from 'sequelize-typescript';
import { BaseTx } from './BaseTx';
import { TXSymbols } from './txSymbols';

/**
 * Defines a codec to serialize and deserialize tx fields added by a module.
 */
// tslint:disable-next-line
interface P2PTxCodec<K = {}> {
  // Creates buffer of such field(s)
  toBuffer(tx: IBaseTransaction<any, bigint> & K): Buffer;
  // Reads buffer and modifies tx object adding/modifying it with the read data
  applyFromBuffer<T = any>(
    buffer: Buffer,
    tx: IBaseTransaction<T, bigint>
  ): IBaseTransaction<T, bigint> & K;
}

@injectable()
export class TXBytes {
  @inject(Symbols.generic.txtypes)
  private types: { [type: number]: IBaseTransactionType<any, any> };

  @inject(p2pSymbols.helpers.protoBuf)
  private protoBufHelper: ProtoBufHelper;

  @multiInject(TXSymbols.p2p.codecs)
  @optional()
  private p2ptxcodecs: Array<P2PTxCodec<any>> = [];

  @inject(Symbols.helpers.idsHandler)
  private idsHandler: IIdsHandler;

  public attachAssetType<K, M extends Model<any>>(
    instance: IBaseTransactionType<K, M>,
    type: number
  ): IBaseTransactionType<K, M> {
    if (!(instance instanceof BaseTx)) {
      throw new Error('Invalid instance interface');
    }
    this.types[type] = instance;
    return instance;
  }

  public fullBytes(tx: IBaseTransaction<any, bigint>): Buffer {
    return this.types[tx.type].fullBytes(tx);
  }

  public signableBytes(tx: IBaseTransaction<any, bigint>): Buffer {
    return this.types[tx.type].signableBytes(tx);
  }

  public toBuffer(tx: IBaseTransaction<any, bigint>) {
    const buffers: Buffer[] = this.p2ptxcodecs.map((codec) =>
      codec.toBuffer(tx)
    );

    return this.protoBufHelper.encode(
      { data: this.fullBytes(tx), buffers },
      'transactions.transport',
      'transportTx'
    );
  }

  public fromBuffer(buf: Buffer) {
    const { data, buffers } = this.protoBufHelper.decode<{
      data: Buffer;
      buffers: Buffer[];
    }>(buf, 'transactions.transport', 'transportTx');
    const type = data.readUInt8(0);
    const txObj = this.types[type].fromBytes(data);
    for (let i = 1; i < (buffers || []).length; i++) {
      this.p2ptxcodecs[i - 1].applyFromBuffer(buffers[i], txObj);
    }
    return txObj;
  }
}
