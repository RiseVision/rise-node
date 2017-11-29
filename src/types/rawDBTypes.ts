import {TransactionType} from '../helpers/transactionTypes';
import {address, publicKey} from './sanityTypes';

// tslint:disable-next-line
export type RawFullBlockListType = {
  b_id: string
  b_version: number
  b_timestamp: number
  b_height: number
  b_previousBlock: number
  b_numberOfTransactions: number
  b_totalAmount: number
  b_totalFee: number
  b_reward: number
  b_payloadLength: number
  b_payloadHash: string
  b_generatorPublicKey: publicKey
  b_blockSignature: string

  // TX part
  t_id: string
  t_rowId: string
  t_type: TransactionType
  t_timestamp: number
  t_senderPublicKey: publicKey
  t_senderId: address,
  t_recipientId: address,
  t_amount: number
  t_fee: number
  t_signature: string
  t_signSignature: string
  t_requesterPublicKey: publicKey
  t_signatures: string[] // ?

  s_publicKey: publicKey
  d_username: string
  v_votes: number
  m_min: number
  m_lifetime: number
  m_keysgroup: number

  // dapps left out.
};

