import * as crypto from 'crypto';
import BigNum from '../helpers/bignum';
import {Ed, IKeypair} from '../helpers/ed';
import logicBlockSchema from '../schema/logic/block';
import * as BlockReward from './blockReward';
import {IBaseTransaction} from './transactions/baseTransaction';
import constants from '../helpers/constants';

export class Block {
  private blockReward = new BlockReward();

  private scope: { ed: Ed, schema: any /*ZSchema*/, transaction: any };

  constructor(ed: Ed, schema: any, transaction: any, cb?: any) {
    this.scope = {
      ed,
      schema,
      transaction,
    };

    // TODO: remove this nonSeNSE
    if (cb) {
      setImmediate(cb, null, this);
    }
  }

  get schema() {
    return logicBlockSchema;
  }

  private getAddressByPublicKey(publicKey: Buffer | string) {
    const publicKeyHash = crypto.createHash('sha256')
      .update(publicKey, 'utf8' /* TODO: should be hex?*/).digest();
    const temp          = Buffer.alloc(8);

    for (let i = 0; i < 8; i++) {
      temp[i] = publicKeyHash[7 - i];
    }
    return `${BigNum.fromBuffer(temp).toString()}R`;
  }

  public create(data: {
    keypair: IKeypair, timestamp: number,
    transactions: Array<IBaseTransaction<any>>,
    previousBlock?: { id: string, height: number }
  }) {
    const transactions = data.transactions.sort((a, b) => {
      if (a.type < b.type) {
        return -1;
      }
      if (a.type > b.type) {
        return 1;
      }
      if (a.amount < b.amount) {
        return -1;
      }
      if (a.amount > b.amount) {
        return 1;
      }
      return 0;
    });

    const nextHeight = (data.previousBlock) ? data.previousBlock.height + 1 : 1;

    const reward    = this.blockReward.calcReward(nextHeight);
    let totalFee    = 0;
    let totalAmount = 0;
    let size        = 0;

    const blockTransactions = [];
    const payloadHash       = crypto.createHash('sha256');

    for (const transaction of transactions) {
      const bytes: Buffer = this.scope.transaction.getBytes(transaction);

      if (size + bytes.length > constants.maxPayloadLength) {
        break;
      }

      size += bytes.length;

      totalFee += transaction.fee;
      totalAmount += transaction.amount;

      blockTransactions.push(transaction);
      payloadHash.update(bytes);
    }

    const block = {
      version             : 0,
      totalAmount,
      totalFee,
      reward,
      payloadHash         : payloadHash.digest().toString('hex'),
      timestamp           : data.timestamp,
      numberOfTransactions: blockTransactions.length,
      payloadLength       : size,
      previousBlock       : data.previousBlock.id,
      generatorPublicKey  : data.keypair.publicKey.toString('hex'),
      transactions        : blockTransactions,
      signature           : null,
    };

    block.signature = this.sign(block, data.keypair);
    return this.objectNormalize(block);
  }
}