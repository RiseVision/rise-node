import { As } from 'type-tagger';

import { Address } from '../../types';

/**
 * ID Handler, Produces IDs for several objects.
 */
export interface IIdsHandler {
  maxBlockIdBytesUsage: number;

  addressFromPubData(pubData: Buffer): string & As<'address'>;
  addressFromBytes(bytes: Buffer): Address;
  addressToBytes(address: string): Buffer;

  calcTxIdFromBytes(bytes: Buffer): string;

  calcBlockIdFromBytes(bytes: Buffer): string;
  blockIdFromBytes(bytes: Buffer): string;
  blockIdToBytes(id: string): Buffer;
}
