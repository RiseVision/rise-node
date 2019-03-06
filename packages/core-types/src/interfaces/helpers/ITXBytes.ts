import { IBaseTransaction } from '../../types';

export interface ITXBytes {
  fullBytes(tx: IBaseTransaction<any, bigint>): Buffer;
  signableBytes(tx: IBaseTransaction<any, bigint>): Buffer;
  toBuffer(tx: IBaseTransaction<any, bigint>);
  fromBuffer(buf: Buffer);
}
