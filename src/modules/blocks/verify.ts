import * as crypto from 'crypto';
import { IDatabase } from 'pg-promise';
import sql from '../../../sql/blocks';
import { constants, ForkType, ILogger, Slots } from '../../helpers/';
import {
  BlockLogic,
  BlockRewardLogic,
  SignedAndChainedBlockType,
  SignedBlockType,
  TransactionLogic
} from '../../logic/';
import { IConfirmedTransaction } from '../../logic/transactions/';
import { AccountsModule } from '../accounts';
import { BlocksModule } from '../blocks';
import { DelegatesModule } from '../delegates';
import { TransactionsModule } from '../transactions';

// tslint:disable-next-line
export type BlocksModuleVerifyLibrary = {
  logger: ILogger,
  db: IDatabase<any>,
  logic: {
    block: BlockLogic,
    transaction: TransactionLogic
  }
};

export class BlocksModuleVerify {
  private loaded: boolean;
  private blockReward = new BlockRewardLogic();
  private modules: {
    blocks: BlocksModule,
    delegates: DelegatesModule,
    transactions: TransactionsModule,
    accounts: AccountsModule
  };

  public constructor(public library: BlocksModuleVerifyLibrary) {
    this.library.logger.trace('Blocks->Verify: Submodule initialized.');
  }

  /**
   * Verifies block before fork detection and return all possible errors related to block
   */
  public verifyReceipt(block: SignedBlockType): { errors: string[], verified: boolean } {
    const lastBlock: SignedBlockType = this.modules.blocks.lastBlock;

    block.height           = lastBlock.height + 1;
    const errors: string[] = [
      this.verifySignature(block),
      this.verifyPreviousBlock(block),
      this.verifyVersion(block),
      this.verifyReward(block),
      this.verifyId(block),
      this.verifyPayload(block),
    ]
      .reduce((a, b) => a.concat(b))
      .reverse();

    return {
      errors,
      verified: errors.length === 0,
    };
  }

  /**
   * Verify block before processing and return all possible errors related to block
   */
  public async verifyBlock(block: SignedBlockType): Promise<{ errors: string[], verified: boolean }> {
    const lastBlock: SignedBlockType = this.modules.blocks.lastBlock;

    const res = this.verifyReceipt(block);

    const errors = [
      await this.verifyForkOne(block, lastBlock),
      await this.verifyBlockSlot(block, lastBlock),
    ].reduce((a, b) => a.concat(b));

    res.errors.reverse();
    res.errors.concat.apply(res.errors, errors);
    res.errors.reverse();

    return {
      errors  : res.errors,
      verified: res.errors.length === 0,
    };
  }

  public async processBlock(block: SignedBlockType, broadcast: boolean, saveBlock: boolean): Promise<any> {
    if (this.modules.blocks.isCleaning) {
      // We're shutting down so stop processing any further
      throw new Error('Cleaning up');
    }
    if (!this.loaded) {
      throw new Error('Blockchain is still loading');
    }

    block = this.library.logic.block.objectNormalize(block);

    // after verifyBlock block also have 'height' field so it's a SignedAndChainedBlock
    // That's because of verifyReceipt.
    const { verified, errors } = await this.verifyBlock(block);

    if (!verified) {
      this.library.logger.error(`Block ${block.id} verification failed`, errors.join(', '));
      throw new Error(errors[0]);
    }

    // check if blocks exists.
    const rows = await this.library.db.query(sql.getBlockId, { id: block.id });
    if (rows.length > 0) {
      throw new Error(`Block ${block.id} already exists`);
    }

    // Check block slot.
    await this.modules.delegates.validateBlockSlot(block)
      .catch(async (err) => {
        await this.modules.delegates.fork(block, ForkType.WRONG_FORGE_SLOT);
        return Promise.reject(err);
      });

    // check transactions
    for (const tx of block.transactions) {
      // It will throw if tx is not valid somehow.
      await this.checkTransaction(block, tx);
    }

    // if nothing has thrown till here then block is valid and can be applied.
    // The block and the transactions are OK i.e:
    // * Block and transactions have valid values (signatures, block slots, etc...)
    // * The check against database state passed (for instance sender has enough LSK, votes are under 101, etc...)
    // We thus update the database with the transactions values, save the block and tick it
    return this.modules.blocks.chain.applyBlock(block as SignedAndChainedBlockType, broadcast, saveBlock);
  }

  public onBind(scope) {
    this.library.logger.trace('Blocks->Verify: Shared modules bind.');
    this.modules = {
      accounts    : scope.accounts,
      blocks      : scope.blocks,
      delegates   : scope.delegates,
      transactions: scope.transactions,
    };

    // Set module as loaded
    this.loaded = true;
  }

  /**
   * Verifies block signature and returns an array populated with errors.
   * @param {SignedBlockType} block
   * @returns {string[]}
   */
  private verifySignature(block: SignedBlockType): string[] {
    const errors = [];
    let valid    = false;
    try {
      valid = this.library.logic.block.verifySignature(block);
    } catch (e) {
      errors.push(e.toString());
    }

    if (!valid) {
      errors.push('Failed to verify block signature');
    }
    return errors;
  }

  /**
   * Verifies that block has a previousBlock
   */
  private verifyPreviousBlock(block: SignedBlockType): string[] {
    if (!block.previousBlock && block.height !== 1) {
      return ['Invalid previous block'];
    }
    return [];
  }

  /**
   * Verifies that block has a valid version
   */
  private verifyVersion(block: SignedBlockType): string[] {
    if (block.version > 0) {
      return ['Invalid block version'];
    }
    return [];
  }

  private verifyReward(block: SignedBlockType): string[] {
    const expected = this.blockReward.calcReward(block.height);

    if (block.height !== 1 && expected !== block.reward) {
      return [`Invalid block reward: ${block.reward} expected: ${expected}`];
    }
    return [];
  }

  // TODO: This is totally useless!
  private verifyId(block: SignedBlockType) {
    try {
      // Get block ID
      // FIXME: Why we don't have it?
      block.id = this.library.logic.block.getId(block);
      return [];
    } catch (e) {
      return [e.toString()];
    }
  }

  /**
   * Verifies that the calculated payload (txs) matches the data from the block
   * @returns {string[]} array of errors. Empty if no errors.
   */
  private verifyPayload(block: SignedBlockType): string[] {
    const errors: string[] = [];
    if (block.payloadLength > constants.maxPayloadLength) {
      errors.push('Payload length is too long');
    }

    if (block.transactions.length !== block.numberOfTransactions) {
      errors.push('Included transactions do not match block transactions count');
    }

    if (block.transactions.length > constants.maxTxsPerBlock) {
      errors.push('Number of transactions exceeds maximum per block');
    }

    let totalAmount   = 0;
    let totalFee      = 0;
    const payloadHash = crypto.createHash('sha256');

    const appliedTransactions = {};

    for (const tx of block.transactions) {
      let bytes: Buffer;
      try {
        bytes = this.library.logic.transaction.getBytes(tx);
        payloadHash.update(bytes);
      } catch (e) {
        errors.push(e.toString());
        continue;
      }

      if (appliedTransactions[tx.id]) {
        errors.push(`Encountered duplicate transaction: ${tx.id}`);
      }

      appliedTransactions[tx.id] = tx;
      totalAmount += tx.amount;
      totalFee += tx.fee;
    }

    if (payloadHash.digest().toString('hex') !== block.payloadHash) {
      errors.push('Invalid payload hash');
    }

    if (totalAmount !== block.totalAmount) {
      errors.push('Invalid total amount');
    }

    if (totalFee !== block.totalFee) {
      errors.push('Invalid total fee');
    }
    return errors;
  }

  /**
   * Verifies if this block is after the previous one or is on another chain (Fork type 1)
   */
  private async verifyForkOne(block: SignedBlockType, lastBlock: SignedBlockType): Promise<string[]> {
    if (block.previousBlock && block.previousBlock !== lastBlock.id) {
      await this.modules.delegates.fork(block, ForkType.TYPE_1);
      return [`Invalid previous block: ${block.previousBlock} expected ${lastBlock.id}`];
    }
    return [];
  }

  private async verifyBlockSlot(block: SignedBlockType, lastBlock: SignedBlockType): Promise<string[]> {
    const slotNumber = Slots.getSlotNumber(block.timestamp);
    const lastSlot   = Slots.getSlotNumber(lastBlock.timestamp);

    if (slotNumber > Slots.getSlotNumber(Slots.getTime()) || slotNumber <= lastSlot) {
      // if in future or in the past => error
      return ['Invalid block timestamp'];
    }
    return [];
  }

  /**
   * Check transaction - perform transaction validation when processing block
   * FIXME: Some checks are probably redundant, see: logic.transactionPool
   * If it does not throw the tx should be valid.
   */
  private async checkTransaction(block: SignedBlockType, tx: IConfirmedTransaction<any>): Promise<void> {
    tx.id      = this.library.logic.transaction.getId(tx);
    // Apply block id to the tx
    tx.blockId = block.id;

    // Check if db is in db already if so -> fork type 2.
    await this.library.logic.transaction.assertNonConfirmed(tx)
      .catch(async (err) => {
        await this.modules.delegates.fork(block, ForkType.TX_ALREADY_CONFIRMED);
        // undo the offending tx
        await this.modules.transactions.undoUnconfirmed(tx);
        this.modules.transactions.removeUnconfirmedTransaction(tx.id);
        return Promise.reject(err);
      });

    // get account from db if exists
    const acc = await this.modules.accounts.getAccount({ publicKey: tx.senderPublicKey });

    let requester = null;
    if (tx.requesterPublicKey) {
      requester = await this.modules.accounts.getAccount({ publicKey: tx.requesterPublicKey });
    }
    // Verify will throw if any error occurs during validation.
    await this.library.logic.transaction.verify(tx, acc, requester, block.height);

  }
}
