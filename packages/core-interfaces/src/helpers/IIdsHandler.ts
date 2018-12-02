/**
 * ID Handler, Produces IDs for several objects.
 */
export interface IIdsHandler {
  addressBytes: number;
  blockIdByteSize: number;

  addressFromPubKey(pubKey: Buffer): string;
  addressFromBytes(bytes: Buffer): string;
  addressToBytes(address: string): Buffer;

  txIdFromBytes(bytes: Buffer): string;

  blockIdFromBytes(bytes: Buffer): string;
  blockIdToBytes(id: string): Buffer;
}
