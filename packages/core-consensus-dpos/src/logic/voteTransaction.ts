import {
  IAccountLogic,
  IAccountsModel,
  ISystemModule,
  Symbols,
} from '@risevision/core-interfaces';
import { ModelSymbols } from '@risevision/core-models';
import { BaseTx } from '@risevision/core-transactions';
import {
  DBOp,
  IBaseTransaction,
  SignedBlockType,
} from '@risevision/core-types';
import { Diff } from '@risevision/core-utils';
import { inject, injectable, named, postConstruct } from 'inversify';
import * as _ from 'lodash';
import { Model } from 'sequelize-typescript';
import * as varuint from 'varuint-bitcoin';
import * as z_schema from 'z-schema';
import { DposConstantsType, dPoSSymbols } from '../helpers/';
import {
  Accounts2DelegatesModel,
  Accounts2U_DelegatesModel,
  AccountsModelForDPOS,
  VotesModel,
} from '../models/';
import { DelegatesModule } from '../modules/';
import { RoundsLogic } from './rounds';

// tslint:disable-next-line
const voteSchema = require('../../schema/vote.json');

// tslint:disable-next-line interface-over-type-literal
export type VoteAsset = {
  added: string[];
  removed: string[];
};

@injectable()
export class VoteTransaction extends BaseTx<VoteAsset, VotesModel> {
  // Generic
  @inject(Symbols.generic.zschema)
  private schema: z_schema;

  @inject(dPoSSymbols.constants)
  private dposConstants: DposConstantsType;

  // Logic
  @inject(dPoSSymbols.logic.rounds)
  private roundsLogic: RoundsLogic;
  @inject(Symbols.logic.account)
  private accountLogic: IAccountLogic;

  // Module
  @inject(dPoSSymbols.modules.delegates)
  private delegatesModule: DelegatesModule;
  @inject(Symbols.modules.system)
  private systemModule: ISystemModule;

  // models
  @inject(ModelSymbols.model)
  @named(dPoSSymbols.models.votes)
  private VotesModel: typeof VotesModel;
  @inject(ModelSymbols.model)
  @named(dPoSSymbols.models.accounts2UDelegates)
  // tslint:disable-next-line
  private Accounts2U_DelegatesModel: typeof Accounts2U_DelegatesModel;
  @inject(ModelSymbols.model)
  @named(dPoSSymbols.models.accounts2Delegates)
  private Accounts2DelegatesModel: typeof Accounts2DelegatesModel;
  @inject(ModelSymbols.model)
  @named(Symbols.models.accounts)
  private AccountsModel: typeof IAccountsModel;

  public calculateMinFee(
    tx: IBaseTransaction<VoteAsset>,
    sender: IAccountsModel,
    height: number
  ) {
    return this.systemModule.getFees(height).fees.vote;
  }

  public async verify(
    tx: IBaseTransaction<VoteAsset> & { senderId: string },
    sender: AccountsModelForDPOS
  ): Promise<void> {
    if (tx.recipientId !== tx.senderId) {
      throw new Error('Missing recipient');
    }

    if (!tx.asset || !tx.asset.added || !tx.asset.removed) {
      throw new Error('Invalid transaction asset');
    }

    if (!Array.isArray(tx.asset.added) || !Array.isArray(tx.asset.removed)) {
      throw new Error('Invalid votes. Must be an array');
    }

    const totalVotes = tx.asset.added.concat(tx.asset.removed);
    if (!totalVotes.length) {
      throw new Error('Invalid votes. Must not be empty');
    }

    if (totalVotes.length > this.dposConstants.maxVotesPerTransaction) {
      throw new Error(
        `Voting limit exceeded. Maximum is ${
          this.dposConstants.maxVotesPerTransaction
        } votes per transaction`
      );
    }

    // Assert vote is valid
    tx.asset.added.forEach((v) => this.assertValidVote(v));
    tx.asset.removed.forEach((v) => this.assertValidVote(v));

    // Check duplicates
    const dups = totalVotes.filter((v, i, a) => a.indexOf(v) !== i);

    if (dups.length > 0) {
      throw new Error('Multiple votes for same delegate are not allowed');
    }

    return this.checkConfirmedDelegates(tx, sender);
  }

  public async findConflicts(
    txs: Array<IBaseTransaction<VoteAsset>>
  ): Promise<Array<IBaseTransaction<VoteAsset>>> {
    // This piece of logic does not really finds conflicting transactions
    // It will allow only one tx per given set per sender.
    // this will ensure no conflicting votes will be casted that could cause a block to be invalid.

    const grouped = _.groupBy(txs, (a) => a.senderId);
    const conflictingTransactions: Array<IBaseTransaction<VoteAsset>> = [];
    // tslint:disable-next-line
    for (const senderId in grouped) {
      const groupedTXsBySender = grouped[senderId];
      if (groupedTXsBySender.length > 1) {
        conflictingTransactions.push(...groupedTXsBySender.slice(1));
      }
    }
    return conflictingTransactions;
  }

  public assetBytes(tx: IBaseTransaction<VoteAsset>): Buffer {
    function encodeVote(username: string) {
      const usernameBuf = Buffer.from(username, 'utf8');
      return Buffer.concat([varuint.encode(usernameBuf.length), usernameBuf]);
    }
    return Buffer.concat([
      varuint.encode(tx.asset.added.length),
      ...tx.asset.added.map(encodeVote),
      varuint.encode(tx.asset.removed.length),
      ...tx.asset.removed.map(encodeVote),
    ]);
  }

  public readAssetFromBytes(bytes: Buffer): VoteAsset {
    let offset = 0;
    function decodeVotesArr() {
      const totalEntries = varuint.decode(bytes, offset);
      offset += varuint.decode.bytes;
      const toRet = [];
      for (let i = 0; i < totalEntries; i++) {
        const usernameLength = varuint.decode(bytes, offset);
        offset += varuint.decode.bytes;
        toRet.push(
          bytes.slice(offset, offset + usernameLength).toString('utf8')
        );
        offset += usernameLength;
      }
      return toRet;
    }
    const added = decodeVotesArr();
    const removed = decodeVotesArr();
    return { added, removed };
  }

  // tslint:disable-next-line max-line-length
  public async apply(
    tx: IBaseTransaction<VoteAsset>,
    block: SignedBlockType,
    sender: AccountsModelForDPOS
  ): Promise<Array<DBOp<any>>> {
    await this.checkConfirmedDelegates(tx, sender);
    sender.applyDiffArray('delegates', this.buildDiffArray(tx));
    return this.calculateOPs(
      this.Accounts2DelegatesModel,
      block.id,
      tx.asset.added,
      tx.asset.removed,
      sender.address
    );
  }

  // tslint:disable-next-line max-line-length
  public async undo(
    tx: IBaseTransaction<VoteAsset, bigint>,
    block: SignedBlockType,
    sender: AccountsModelForDPOS
  ): Promise<Array<DBOp<any>>> {
    this.objectNormalize(tx);
    sender.applyDiffArray('delegates', Diff.reverse(this.buildDiffArray(tx)));
    return this.calculateOPs(
      this.Accounts2DelegatesModel,
      block.id,
      tx.asset.removed,
      tx.asset.added,
      sender.address
    );
  }

  public async applyUnconfirmed(
    tx: IBaseTransaction<VoteAsset, bigint>,
    sender: AccountsModelForDPOS
  ): Promise<Array<DBOp<any>>> {
    await this.checkUnconfirmedDelegates(tx, sender);
    sender.applyDiffArray('u_delegates', this.buildDiffArray(tx));
    return this.calculateOPs(
      this.Accounts2U_DelegatesModel,
      null,
      tx.asset.added,
      tx.asset.removed,
      sender.address
    );
  }

  public async undoUnconfirmed(
    tx: IBaseTransaction<VoteAsset, bigint>,
    sender: AccountsModelForDPOS
  ): Promise<Array<DBOp<any>>> {
    this.objectNormalize(tx);
    sender.applyDiffArray('u_delegates', Diff.reverse(this.buildDiffArray(tx)));
    return this.calculateOPs(
      this.Accounts2U_DelegatesModel,
      null,
      tx.asset.removed,
      tx.asset.added,
      sender.address
    );
  }

  /**
   * Checks vote integrity of tx sender
   */
  public checkUnconfirmedDelegates(
    tx: IBaseTransaction<VoteAsset>,
    sender: AccountsModelForDPOS
  ): Promise<any> {
    return this.delegatesModule.checkUnconfirmedDelegates(
      sender,
      tx.asset.added,
      tx.asset.removed
    );
  }

  /**
   * Checks vote integrity of sender
   */
  public checkConfirmedDelegates(
    tx: IBaseTransaction<VoteAsset>,
    sender: AccountsModelForDPOS
  ): Promise<any> {
    return this.delegatesModule.checkConfirmedDelegates(
      sender,
      tx.asset.added,
      tx.asset.removed
    );
  }

  public objectNormalize(
    tx: IBaseTransaction<VoteAsset, bigint>
  ): IBaseTransaction<VoteAsset, bigint> {
    const report = this.schema.validate(tx.asset, voteSchema);
    if (!report) {
      throw new Error(
        `Failed to validate vote schema: ${this.schema
          .getLastErrors()
          .map((err) => err.message)
          .join(', ')}`
      );
    }

    return tx;
  }

  // tslint:disable-next-line max-line-length
  public dbSave(
    tx: IBaseTransaction<VoteAsset> & { senderId: string }
  ): DBOp<any> {
    return {
      model: this.VotesModel,
      type: 'create',
      values: {
        added: tx.asset.added,
        removed: tx.asset.removed,
        transactionId: tx.id,
      },
    };
  }

  public async attachAssets(txs: Array<IBaseTransaction<VoteAsset>>) {
    const res = await this.VotesModel.findAll({
      where: { transactionId: txs.map((tx) => tx.id) },
    });

    const indexes = {};
    res.forEach((tx, idx) => (indexes[tx.transactionId] = idx));

    txs.forEach((tx) => {
      if (typeof indexes[tx.id] === 'undefined') {
        throw new Error(`Couldn't restore asset for Vote tx: ${tx.id}`);
      }
      const info = res[indexes[tx.id]];
      tx.asset = {
        added: info.added || [],
        removed: info.removed || [],
      };
    });
  }

  public getMaxBytesSize(): number {
    let size = super.getMaxBytesSize();
    size += this.dposConstants.maxVotesPerTransaction * 65; // 64 bytes for pubkey + "sign"
    return size;
  }

  @postConstruct()
  private postConstruct() {
    voteSchema.properties.votes.maxItems = this.dposConstants.maxVotesPerTransaction;
  }

  private assertValidVote(vote: string) {
    if (typeof vote !== 'string') {
      throw new Error('Invalid vote type');
    }
    const username = vote;
    if (!this.schema.validate(username, { format: 'username' })) {
      throw new Error('Invalid vote username');
    }
  }

  private calculateOPs(
    model: typeof Model & (new () => any),
    blockId: string,
    added: string[],
    removed: string[],
    senderAddress: string
  ) {
    const ops: Array<DBOp<any>> = [];

    // Remove unvoted usernames.
    if (removed.length > 0) {
      ops.push({
        model,
        options: {
          limit: removed.length,
          where: {
            address: senderAddress,
            username: removed,
          },
        },
        type: 'remove',
      });
    }
    // create new elements for each added pk.
    if (added.length > 0) {
      ops.push({
        model,
        type: 'bulkCreate',
        values: added.map((username) => ({
          address: senderAddress,
          username,
        })),
      });
    }

    if (blockId) {
      ops.push({
        model: this.AccountsModel,
        options: { where: { address: senderAddress } },
        type: 'update',
        values: { blockId },
      });
    }
    return ops;
  }

  private buildDiffArray(tx: IBaseTransaction<VoteAsset>) {
    return tx.asset.added
      .map((a) => `+${a}`)
      .concat(tx.asset.removed.map((a) => `-${a}`));
  }
}
