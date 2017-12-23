import * as crypto from 'crypto';
import { inject, injectable } from 'inversify';
import { IDatabase } from 'pg-promise';
import { constants, ForkType, ILogger, Slots } from '../../helpers/';
import { IBlockLogic, IBlockReward, ITransactionLogic } from '../../ioc/interfaces/logic';
import {
  IAccountsModule,
  IBlocksModule, IBlocksModuleChain, IBlocksModuleVerify, IDelegatesModule, IForkModule,
  ITransactionsModule
} from '../../ioc/interfaces/modules/';
import { Symbols } from '../../ioc/symbols';
import { SignedAndChainedBlockType, SignedBlockType, } from '../../logic/';
import { IConfirmedTransaction } from '../../logic/transactions/';
import sql from '../../sql/blocks';

@injectable()
export class BlocksModuleVerify implements IBlocksModuleVerify {
  // Modules
  @inject(Symbols.modules.blocks)
  private blocksModule: IBlocksModule;
  @inject(Symbols.modules.blocksSubModules.chain)
  private blocksChainModule: IBlocksModuleChain;
  @inject(Symbols.modules.delegates)
  private delegatesModule: IDelegatesModule;
  @inject(Symbols.modules.fork)
  private forkModule: IForkModule;
  @inject(Symbols.modules.transactions)
  private transactionsModule: ITransactionsModule;
  @inject(Symbols.modules.accounts)
  private accountsModule: IAccountsModule;

  // Generics
  @inject(Symbols.generic.db)
  private db: IDatabase<any>;

  // Helpers
  @inject(Symbols.helpers.logger)
  private logger: ILogger;
  @inject(Symbols.helpers.slots)
  private slots: Slots;

  // Logic
  @inject(Symbols.logic.block)
  private blockLogic: IBlockLogic;
  @inject(Symbols.logic.blockReward)
  private blockRewardLogic: IBlockReward;
  @inject(Symbols.logic.transaction)
  private transactionLogic: ITransactionLogic;

  public cleanup(): Promise<void> {
    return Promise.resolve();
  }

  /**
   * Verifies block before fork detection and return all possible errors related to block
   */
  public verifyReceipt(block: SignedBlockType): { errors: string[], verified: boolean } {
    const lastBlock: SignedBlockType = this.blocksModule.lastBlock;

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
    const lastBlock: SignedBlockType = this.blocksModule.lastBlock;

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
    if (this.blocksModule.isCleaning) {
      // We're shutting down so stop processing any further
      throw new Error('Cleaning up');
    }
    // if (!this.loaded) {
    //  throw new Error('Blockchain is still loading');
    // }

    block = this.blockLogic.objectNormalize(block);

    // after verifyBlock block also have 'height' field so it's a SignedAndChainedBlock
    // That's because of verifyReceipt.
    const {verified, errors} = await this.verifyBlock(block);

    if (!verified) {
      this.logger.error(`Block ${block.id} verification failed`, errors.join(', '));
      throw new Error(errors[0]);
    }

    // check if blocks exists.
    const rows = await this.db.query(sql.getBlockId, {id: block.id});
    if (rows.length > 0) {
      throw new Error(`Block ${block.id} already exists`);
    }

    // Check block slot.
    await this.delegatesModule.assertValidBlockSlot(block)
      .catch(async (err) => {
        await this.forkModule.fork(block, ForkType.WRONG_FORGE_SLOT);
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
    return this.blocksChainModule.applyBlock(block as SignedAndChainedBlockType, broadcast, saveBlock);
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
      valid = this.blockLogic.verifySignature(block);
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
    const expected = this.blockRewardLogic.calcReward(block.height);

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
      block.id = this.blockLogic.getId(block);
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
        bytes = this.transactionLogic.getBytes(tx);
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
      await this.forkModule.fork(block, ForkType.TYPE_1);
      return [`Invalid previous block: ${block.previousBlock} expected ${lastBlock.id}`];
    }
    return [];
  }

  private async verifyBlockSlot(block: SignedBlockType, lastBlock: SignedBlockType): Promise<string[]> {
    const slotNumber = this.slots.getSlotNumber(block.timestamp);
    const lastSlot   = this.slots.getSlotNumber(lastBlock.timestamp);

    if (slotNumber > this.slots.getSlotNumber(this.slots.getTime()) || slotNumber <= lastSlot) {
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
    tx.id      = this.transactionLogic.getId(tx);
    // Apply block id to the tx
    tx.blockId = block.id;

    // Check if tx is in db already if so -> fork type 2.
    await this.transactionLogic.assertNonConfirmed(tx)
      .catch(async (err) => {
        await this.forkModule.fork(block, ForkType.TX_ALREADY_CONFIRMED);
        // undo the offending tx
        await this.transactionsModule.undoUnconfirmed(tx);
        this.transactionsModule.removeUnconfirmedTransaction(tx.id);
        return Promise.reject(err);
      });

    // get account from db if exists
    const acc = await this.accountsModule.getAccount({publicKey: tx.senderPublicKey});

    let requester = null;
    if (tx.requesterPublicKey) {
      requester = await this.accountsModule.getAccount({publicKey: tx.requesterPublicKey});
    }
    // Verify will throw if any error occurs during validation.
    await this.transactionLogic.verify(tx, acc, requester, block.height);

  }
}
