import {
  IAccountsModel,
  IAccountsModule,
  IBlockLogic,
  IBlockReward,
  IBlocksModel,
  IBlocksModule,
  IForkModule,
  ILogger,
  ITransactionLogic, ITransactionPool,
  ITransactionsModule, Symbols
} from '@risevision/core-interfaces';
import { ModelSymbols } from '@risevision/core-models';
import {
  ConstantsType,
  ForkType,
  SignedAndChainedBlockType,
  SignedBlockType
} from '@risevision/core-types';
import * as crypto from 'crypto';
import { inject, injectable, named } from 'inversify';
import { WordPressHookSystem } from 'mangiafuoco';
import { BlocksSymbols } from '../blocksSymbols';
import { VerifyBlock, VerifyReceipt } from '../hooks';
import { BlocksModuleChain } from './chain';

@injectable()
export class BlocksModuleVerify {

  // Helpers
  @inject(Symbols.generic.constants)
  private constants: ConstantsType;
  @inject(Symbols.helpers.logger)
  private logger: ILogger;
  @inject(Symbols.generic.hookSystem)
  private hookSystem: WordPressHookSystem;

  // Logic
  @inject(Symbols.logic.block)
  private blockLogic: IBlockLogic;
  @inject(Symbols.logic.blockReward)
  private blockRewardLogic: IBlockReward;
  @inject(Symbols.logic.transaction)
  private transactionLogic: ITransactionLogic;

  // Modules
  @inject(Symbols.modules.accounts)
  private accountsModule: IAccountsModule;
  @inject(BlocksSymbols.modules.chain)
  private blocksChainModule: BlocksModuleChain;
  @inject(Symbols.modules.blocks)
  private blocksModule: IBlocksModule;
  @inject(Symbols.modules.fork)
  private forkModule: IForkModule;
  @inject(Symbols.modules.transactions)
  private transactionsModule: ITransactionsModule;
  @inject(Symbols.logic.txpool)
  private txPool: ITransactionPool;

  // Models
  @inject(ModelSymbols.model)
  @named(Symbols.models.blocks)
  private BlocksModel: typeof IBlocksModel;

  /**
   * Contains the last N block Ids used to perform validations
   */
  private lastNBlockIds: string[] = [];

  private isCleaning: boolean = false;

  public cleanup(): Promise<void> {
    this.isCleaning = true;
    return Promise.resolve();
  }

  /**
   * Verifies block before fork detection and return all possible errors related to block
   */
  public async verifyReceipt(block: SignedBlockType): Promise<{ errors: string[], verified: boolean }> {
    const lastBlock: SignedBlockType = this.blocksModule.lastBlock;

    block.height           = lastBlock.height + 1;
    const errors: string[] = [
      this.verifySignature(block),
      this.verifyPreviousBlock(block),
      this.verifyBlockAgainstLastIds(block),
      this.verifyVersion(block),
      this.verifyReward(block),
      this.verifyId(block),
      this.verifyPayload(block),
    ]
      .reduce((a, b) => a.concat(b))
      .reverse();

    return  this.hookSystem.apply_filters(
      VerifyReceipt.name,
      {
        errors,
        verified: errors.length === 0,
      },
      block
    );
  }

  /**
   * Verify block before processing and return all possible errors related to block
   */
  public async verifyBlock(block: SignedBlockType): Promise<{ errors: string[], verified: boolean }> {
    const lastBlock: SignedBlockType = this.blocksModule.lastBlock;

    const errors = [
      this.verifySignature(block),
      this.verifyPreviousBlock(block),
      this.verifyVersion(block),
      this.verifyReward(block),
      this.verifyId(block),
      this.verifyPayload(block),
      await this.verifyForkOne(block, lastBlock),
    ].reduce((a, b) => a.concat(b));

    return this.hookSystem.apply_filters(
      VerifyBlock.name,
      {
        errors,
        verified: errors.length === 0,
      },
      block,
      lastBlock
    );
  }

  public async processBlock(block: SignedBlockType, broadcast: boolean, saveBlock: boolean): Promise<any> {
    if (this.isCleaning) {
      // We're shutting down so stop processing any further
      throw new Error('Cleaning up');
    }
    // if (!this.loaded) {
    //  throw new Error('Blockchain is still loading');
    // }

    block = this.blockLogic.objectNormalize(block);

    // after verifyBlock block also have 'height' field so it's a SignedAndChainedBlock
    // That's because of verifyReceipt.
    const { verified, errors } = await this.verifyBlock(block);

    if (!verified) {
      this.logger.error(`Block ${block.id} verification failed`, errors.join(', '));
      throw new Error(errors[0]);
    }

    // check if blocks exists.
    const dbBlock = await this.BlocksModel.findById(block.id);
    if (dbBlock !== null) {
      throw new Error(`Block ${block.id} already exists`);
    }

    // check transactions
    const accountsMap = await this.accountsModule.txAccounts(block.transactions);

    await this.accountsModule.checkTXsAccountsMap(block.transactions, accountsMap);
    await this.checkBlockTransactions(block, accountsMap);

    // if nothing has thrown till here then block is valid and can be applied.
    // The block and the transactions are OK i.e:
    // * Block and transactions have valid values (signatures, block slots, etc...)
    // * The check against database state passed (for instance sender has enough LSK, votes are under 101, etc...)
    // We thus update the database with the transactions values, save the block and tick it
    return this.blocksChainModule.applyBlock(
      block as SignedAndChainedBlockType,
      broadcast,
      saveBlock,
      accountsMap
    );
  }

  // TODO: me
  public async onBlockchainReady() {
    const blocks       = await this.BlocksModel.findAll({
      attributes: ['id'],
      limit     : this.constants.blockSlotWindow,
      order     : [['height', 'desc']],
      raw       : true,
    });
    this.lastNBlockIds = blocks.map((b) => b.id);
  }

  public async onNewBlock(block: SignedBlockType) {
    this.lastNBlockIds.push(block.id);
    if (this.lastNBlockIds.length > this.constants.blockSlotWindow) {
      this.lastNBlockIds.shift();
    }
  }

  /**
   * Verify that given block is not already within last known block ids.
   */
  private verifyBlockAgainstLastIds(block: SignedBlockType): string[] {
    if (this.lastNBlockIds.indexOf(block.id) !== -1) {
      return ['Block Already exists in the chain'];
    }
    return [];
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

  private verifyId(block: SignedBlockType) {
    const id = this.blockLogic.getId(block);
    if (block.id !== id) {
      return [`BlockID: Expected ${id} - Received ${block.id}`];
    }
    return [];
  }

  /**
   * Verifies that the calculated payload (txs) matches the data from the block
   * @returns {string[]} array of errors. Empty if no errors.
   */
  private verifyPayload(block: SignedBlockType): string[] {
    const errors: string[] = [];
    if (block.payloadLength > this.constants.maxPayloadLength) {
      errors.push('Payload length is too long');
    }

    if (block.transactions.length !== block.numberOfTransactions) {
      errors.push('Included transactions do not match block transactions count');
    }

    if (block.transactions.length > this.constants.maxTxsPerBlock) {
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

    if (!payloadHash.digest().equals(block.payloadHash)) {
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

  private async checkBlockTransactions(block: SignedBlockType, accountsMap: { [address: string]: IAccountsModel }) {
    const allIds = [];
    for (const tx of block.transactions) {
      tx.id         = this.transactionLogic.getId(tx);
      // Apply block id to the tx
      tx['blockId'] = block.id;
      allIds.push(tx.id);
    }

    // Check for duplicated transactions now that ids are set.
    allIds.sort();
    let prevId = allIds[0];
    for (let i = 1; i < allIds.length; i++) {
      if (prevId === allIds[i]) {
        throw new Error(`Duplicated transaction found in block with id ${prevId}`);
      }
      prevId = allIds[i];
    }

    // check that none of the transaction exists in db.
    const confirmedIDs = await this.transactionsModule.filterConfirmedIds(allIds);
    if (confirmedIDs.length > 0) {
      // Error, some of the included transactions are confirmed
      await this.forkModule.fork(block, ForkType.TX_ALREADY_CONFIRMED);
      for (const confirmedID of confirmedIDs) {
        if (this.txPool.unconfirmed.remove(confirmedID)) {
          await this.transactionsModule.undoUnconfirmed(block.transactions.filter((t) => t.id === confirmedID)[0]);
        }
      }
      throw new Error(`Transactions already confirmed: ${confirmedIDs.join(', ')}`);
    }

    await Promise.all(block.transactions
      .map((tx) => this.transactionsModule
        .checkTransaction(tx, accountsMap, block.height)
      )
    );
  }

}
