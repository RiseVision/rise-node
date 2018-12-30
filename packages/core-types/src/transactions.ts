export enum TransactionType {
  SEND = 0,
  SIGNATURE = 1,
  DELEGATE = 2,
  VOTE = 3,
  MULTI = 4,
  // DAPP         = 5,
  // IN_TRANSFER  = 6,
  // OUT_TRANSFER = 7,
}

export interface ITransportTransaction<T> {
  type: TransactionType;
  amount: string | number;
  senderId?: string;
  senderPublicKey: string;
  timestamp: number;
  asset?: T;
  recipientId: string;
  signature: string;
  id: string;
  fee: string | number;
  signatures?: string[];
}

export interface IBaseTransaction<T, amountType = bigint> {
  type: TransactionType;
  version: number;
  amount: amountType;
  senderId?: string;
  senderPublicKey: Buffer;
  timestamp: number;
  asset?: T;
  recipientId: string;
  signature: Buffer;
  id: string;
  fee: amountType;
  blockId?: string;
  signatures?: Buffer[];
}
